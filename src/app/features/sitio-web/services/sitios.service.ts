import { Injectable, inject } from '@angular/core';
import {
  Database,
  get,
  onValue,
  ref,
  remove,
  runTransaction,
  update,
} from '@angular/fire/database';
import { Observable } from 'rxjs';
import {
  ContenidoSitio,
  EntradaSubdominio,
  SitioConfig,
  TipoSitio,
  sitioConfigSchema,
} from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';
import { LIMITES_SITIOS, ResumenSitio } from '../models/sitio-web.models';
import { esSubdominioReservado } from '../config/subdominios-reservados';

@Injectable({ providedIn: 'root' })
export class SitiosService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `sitios/${this.authService.getTenantId()}`;
  }

  getSitios(): Observable<ResumenSitio[]> {
    return new Observable<ResumenSitio[]>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, this.getTenantPath()),
        (snapshot) => {
          const valor = (snapshot.val() ?? {}) as Record<
            string,
            { config?: SitioConfig; publicado?: { meta?: { version?: number } } }
          >;
          const sitios: ResumenSitio[] = Object.entries(valor)
            .filter(([, sitio]) => !!sitio?.config)
            .map(([sitioId, sitio]) => ({
              sitioId,
              config: sitio.config as SitioConfig,
              versionPublicada: sitio.publicado?.meta?.version ?? null,
            }))
            .sort((a, b) => a.config.creadoEn - b.config.creadoEn);
          subscriber.next(sitios);
        },
        (error) => subscriber.error(error),
      );
      return () => unsubscribe();
    });
  }

  async getConfig(sitioId: string): Promise<SitioConfig | null> {
    const snapshot = await get(ref(this.database, `${this.getTenantPath()}/${sitioId}/config`));
    return snapshot.exists() ? (snapshot.val() as SitioConfig) : null;
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
    const tenantId = this.authService.getTenantId();
    const { tipo, nombre, subdominio, contenidoInicial } = opciones;

    const existentes = await get(ref(this.database, this.getTenantPath()));
    const sitios = (existentes.val() ?? {}) as Record<string, { config?: SitioConfig }>;
    const delMismoTipo = Object.values(sitios).filter((s) => s.config?.tipo === tipo).length;
    if (delMismoTipo >= LIMITES_SITIOS[tipo]) {
      throw new Error(
        tipo === 'ecommerce'
          ? 'Ya tienes un ecommerce. Tu plan permite 1 ecommerce por negocio.'
          : `Tu plan permite hasta ${LIMITES_SITIOS.landing} landing pages.`,
      );
    }

    const sitioId = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await this.reclamarSubdominio(subdominio, sitioId);

    const ahora = Date.now();
    const config: SitioConfig = {
      schemaVersion: 1,
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

    try {
      await update(ref(this.database), {
        [`${this.getTenantPath()}/${sitioId}/config`]: config,
        [`${this.getTenantPath()}/${sitioId}/borrador`]: {
          meta: { updatedAt: ahora, updatedBy: this.authService.currentUser()?.uid ?? '' },
          ...contenidoInicial,
        },
      });
    } catch (error) {
      // Si fallo la escritura del sitio, liberar el subdominio reclamado.
      await this.liberarSubdominio(subdominio).catch(() => undefined);
      throw error;
    }

    void tenantId;
    return sitioId;
  }

  async eliminarSitio(sitio: ResumenSitio): Promise<void> {
    const tenantId = this.authService.getTenantId();
    await this.liberarSubdominio(sitio.config.subdominio).catch(() => undefined);
    await update(ref(this.database), {
      [`sitios/${tenantId}/${sitio.sitioId}`]: null,
      [`publicaciones/${tenantId}/${sitio.sitioId}`]: null,
    });
  }

  /** Comprueba disponibilidad de un subdominio (reservados + indice global). */
  async subdominioDisponible(subdominio: string): Promise<boolean> {
    if (esSubdominioReservado(subdominio)) return false;
    const snapshot = await get(ref(this.database, `subdominios/${subdominio}`));
    return !snapshot.exists();
  }

  /** Reclama el subdominio de forma atomica: falla si otro tenant lo tomo primero. */
  async reclamarSubdominio(subdominio: string, sitioId: string): Promise<void> {
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
    await remove(ref(this.database, `subdominios/${subdominio}`));
  }
}
