import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Database,
  get,
  onValue,
  ref,
  remove,
  runTransaction,
  update,
} from 'firebase/database';
import { Observable, firstValueFrom, from, switchMap } from 'rxjs';
import {
  ContenidoSitio,
  EntradaSubdominio,
  SitioConfig,
  TipoSitio,
  SCHEMA_VERSION_SITIO,
  migrarSitioConfig,
  sitioConfigSchema,
} from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';
import { ResumenSitio } from '../models/sitio-web.models';
import { esSubdominioReservado } from '../config/subdominios-reservados';
import { SITES_DATABASE } from '../../../core/firebase/sites-firebase.tokens';
import { SitesFirebaseSessionService } from '../../../core/services/sites-firebase-session.service';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SitiosService {
  private readonly database = inject(SITES_DATABASE);
  private readonly authService = inject(AuthService);
  private readonly sitesSession = inject(SitesFirebaseSessionService);
  private readonly http = inject(HttpClient);

  private getTenantPath(): string {
    return `sitios/${this.authService.getTenantId()}`;
  }

  private getResumenPath(): string {
    return `sitios_resumen/${this.authService.getTenantId()}`;
  }

  getSitios(): Observable<ResumenSitio[]> {
    return from(this.sitesSession.ensureReady()).pipe(switchMap(() => new Observable<ResumenSitio[]>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, this.getResumenPath()),
        (snapshot) => {
          const valor = (snapshot.val() ?? {}) as Record<
            string,
            { config?: SitioConfig; versionPublicada?: number | null }
          >;
          const sitios: ResumenSitio[] = Object.entries(valor)
            .filter(([, sitio]) => !!sitio?.config)
            .map(([sitioId, sitio]) => ({
              sitioId,
              config: sitio.config as SitioConfig,
              versionPublicada: sitio.versionPublicada ?? null,
            }))
            .sort((a, b) => a.config.creadoEn - b.config.creadoEn);
          subscriber.next(sitios);
        },
        (error) => subscriber.error(error),
      );
      return () => unsubscribe();
    })));
  }

  async getConfig(sitioId: string): Promise<SitioConfig | null> {
    await this.sitesSession.ensureReady();
    const snapshot = await get(ref(this.database, `${this.getTenantPath()}/${sitioId}/config`));
    return snapshot.exists() ? migrarSitioConfig(snapshot.val()) : null;
  }

  /**
   * Crea un sitio: valida limites del plan, reclama el subdominio (transaccional sobre el
   * indice global) y escribe config + borrador inicial de la plantilla.
   */
  async crearSitio(opciones: {
    tipo: TipoSitio;
    nombre: string;
    subdominio: string;
    contenidoInicial: ContenidoSitio;
  }): Promise<string> {
    await this.sitesSession.ensureReady();
    const tenantId = this.authService.getTenantId();
    const { tipo, nombre, subdominio, contenidoInicial } = opciones;

    // El backend valida el limite del plan, contabiliza la plaza y autoriza la creacion.
    // Sin esa autorizacion las reglas del proyecto de sitios rechazan el alta.
    const reserva = await firstValueFrom(
      this.http.post<{ sitioId: string; tipo: TipoSitio }>(
        `${environment.apiBaseUrl}/api/tenants/current/sitios/reservar`,
        { tipo },
      ),
    );
    const sitioId = reserva.sitioId;

    try {
      await this.reclamarSubdominio(subdominio, sitioId);
    } catch (error) {
      await this.liberarPlaza(sitioId, tipo);
      throw error;
    }

    const ahora = Date.now();
    const config: SitioConfig = {
      schemaVersion: SCHEMA_VERSION_SITIO,
      sitioId,
      nombre,
      tipo,
      subdominio,
      dominioCustom: null,
      seo: { title: nombre, description: '' },
      tracking: {},
      whatsapp: { numero: '', mensajePlantilla: 'Hola, quiero hacer un pedido' },
      ...(tipo === 'ecommerce' ? { checkout: { modo: 'whatsapp' as const } } : {}),
      activo: true,
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
    sitioConfigSchema.parse(config);
    // Las plantillas y los bloques IA tienen propiedades opcionales. RTDB no
    // admite undefined; el round-trip conserva null/arrays y elimina solo esas
    // propiedades antes del update multipath inicial.
    const contenidoLimpio = JSON.parse(JSON.stringify(contenidoInicial)) as ContenidoSitio;

    try {
      await update(ref(this.database), {
        [`${this.getTenantPath()}/${sitioId}/config`]: config,
        [`${this.getTenantPath()}/${sitioId}/borrador`]: {
          meta: { updatedAt: ahora, updatedBy: this.authService.currentUser()?.uid ?? '' },
          ...contenidoLimpio,
        },
        [`${this.getResumenPath()}/${sitioId}`]: { config, versionPublicada: null },
      });
    } catch (error) {
      // Si fallo la escritura del sitio, liberar el subdominio y la plaza reservada.
      await this.liberarSubdominio(subdominio).catch(() => undefined);
      await this.liberarPlaza(sitioId, tipo);
      throw error;
    }

    void tenantId;
    return sitioId;
  }

  async eliminarSitio(sitio: ResumenSitio): Promise<void> {
    await this.sitesSession.ensureReady();
    const tenantId = this.authService.getTenantId();
    await this.liberarSubdominio(sitio.config.subdominio).catch(() => undefined);
    await update(ref(this.database), {
      [`sitios/${tenantId}/${sitio.sitioId}`]: null,
      [`sitios_resumen/${tenantId}/${sitio.sitioId}`]: null,
      [`publicaciones/${tenantId}/${sitio.sitioId}`]: null,
    });
    await this.liberarPlaza(sitio.sitioId, sitio.config.tipo);
  }

  /** Devuelve al plan la plaza de un sitio eliminado o de una creacion que fallo. */
  private async liberarPlaza(sitioId: string, tipo: TipoSitio): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<void>(`${environment.apiBaseUrl}/api/tenants/current/sitios/liberar`, {
          sitioId,
          tipo,
        }),
      );
    } catch {
      // No bloquea la operacion del usuario: el super administrador puede corregir el contador.
    }
  }

  /** Comprueba disponibilidad de un subdominio (reservados + indice global). */
  async subdominioDisponible(subdominio: string): Promise<boolean> {
    await this.sitesSession.ensureReady();
    if (esSubdominioReservado(subdominio)) return false;
    const snapshot = await get(ref(this.database, `subdominios/${subdominio}`));
    return !snapshot.exists();
  }

  /** Reclama el subdominio de forma atomica: falla si otro tenant lo tomo primero. */
  async reclamarSubdominio(subdominio: string, sitioId: string): Promise<void> {
    await this.sitesSession.ensureReady();
    if (esSubdominioReservado(subdominio)) {
      throw new Error('Ese subdominio esta reservado.');
    }
    const tenantId = this.authService.getTenantId();
    const entrada: EntradaSubdominio = { tenantId, sitioId, creadoEn: Date.now() };
    const resultado = await runTransaction(
      ref(this.database, `subdominios/${subdominio}`),
      (actual) => (actual === null ? entrada : undefined),
    );
    if (!resultado.committed) {
      throw new Error('Ese subdominio ya esta en uso. Elige otro.');
    }
  }

  async liberarSubdominio(subdominio: string): Promise<void> {
    await this.sitesSession.ensureReady();
    await remove(ref(this.database, `subdominios/${subdominio}`));
  }
}
