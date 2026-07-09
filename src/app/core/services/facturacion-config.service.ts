import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Database, get, onValue, ref, set } from '@angular/fire/database';
import { combineLatest, forkJoin, map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import {
  CatalogoEntry,
  CatalogosFacturacion,
  ConfiguracionCorreoFactura,
  ConfiguracionFacturacion,
  EstablecimientoConfig,
  FirmaDigitalConfig,
  PuntoEmisionConfig,
  ResultadoPruebaCorreo
} from '../../shared/models/facturacion.models';

const EMPTY_CONFIG: ConfiguracionFacturacion = {
  formaPagoActivos: [],
  tipoIdentificacionActivos: [],
  ambienteActivo: null,
  codigoPorcentajeIvaActivos: [],
  establecimientos: [],
  puntosEmision: [],
  direccionMatriz: '',
  obligadoContabilidad: false,
  contribuyenteEspecial: '',
  agenteRetencion: '',
  contribuyenteRimpe: false,
  logoUrl: ''
};

@Injectable({
  providedIn: 'root'
})
export class FacturacionConfigService {
  private readonly http = inject(HttpClient);
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly audit = inject(AuditService);

  private getConfigPath(): string {
    return `Facturacion/${this.authService.getTenantId()}/configuracion`;
  }

  getCatalogosFacturacion(): Observable<CatalogosFacturacion> {
    return forkJoin({
      formaPago: this.getCatalogo('FormaPago'),
      tipoIdentificacion: this.getCatalogo('TipoIdentificacion'),
      ambiente: this.getCatalogo('Ambiente'),
      codigoPorcentajeIva: this.getCatalogo('CodigoPorcentajeIva')
    });
  }

  getConfiguracion(): Observable<ConfiguracionFacturacion> {
    return new Observable<ConfiguracionFacturacion>((subscriber) => {
      const configRef = ref(this.database, this.getConfigPath());

      const unsubscribe = onValue(
        configRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next({ ...EMPTY_CONFIG });
            return;
          }

          subscriber.next(this.normalizarConfiguracion(snapshot.val()));
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async guardarConfiguracion(configuracion: ConfiguracionFacturacion): Promise<void> {
    const configRef = ref(this.database, this.getConfigPath());
    const actual = await this.getConfiguracionOnce();
    await set(configRef, {
      ...this.normalizarConfiguracion(configuracion),
      ...this.audit.createMetadata('configurar', actual)
    });
    await this.audit.recordSafe({
      action: 'configurar',
      target: { module: 'facturacion', entityType: 'configuracion', entityId: 'configuracion', label: 'Configuracion de facturacion' },
      summary: 'Actualizo la configuracion de facturacion',
      changesBefore: {
        ambienteActivo: actual.ambienteActivo,
        puntosEmision: actual.puntosEmision?.length ?? 0,
        establecimientos: actual.establecimientos?.length ?? 0
      },
      changesAfter: {
        ambienteActivo: configuracion.ambienteActivo,
        puntosEmision: configuracion.puntosEmision?.length ?? 0,
        establecimientos: configuracion.establecimientos?.length ?? 0
      }
    });
  }

  getFirmasDisponibles(): Observable<FirmaDigitalConfig[]> {
    return this.http.get<FirmaDigitalConfig[]>(`${environment.apiBaseUrl}/api/firmas`).pipe(
      map((firmas) => [...firmas].sort((a, b) => a.nombreArchivo.localeCompare(b.nombreArchivo)))
    );
  }

  uploadFirma(file: File, password: string, ruc: string, razonSocial: string, nombreComercial?: string): Observable<FirmaDigitalConfig> {
    const body = new FormData();
    body.append('file', file);
    body.append('password', password);
    body.append('ruc', ruc);
    body.append('razonSocial', razonSocial);
    if (nombreComercial) {
      body.append('nombreComercial', nombreComercial);
    }

    return this.http.post<FirmaDigitalConfig>(`${environment.apiBaseUrl}/api/firmas`, body);
  }

  eliminarFirma(firmaId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/api/firmas/${encodeURIComponent(firmaId)}`);
  }

  getConfiguracionCorreo(): Observable<ConfiguracionCorreoFactura> {
    return this.http.get<ConfiguracionCorreoFactura>(`${environment.apiBaseUrl}/api/invoices/email-settings`);
  }

  guardarConfiguracionCorreo(config: ConfiguracionCorreoFactura): Observable<ConfiguracionCorreoFactura> {
    return this.http.put<ConfiguracionCorreoFactura>(`${environment.apiBaseUrl}/api/invoices/email-settings`, config);
  }

  probarConfiguracionCorreo(recipient: string): Observable<ResultadoPruebaCorreo> {
    return this.http.post<ResultadoPruebaCorreo>(`${environment.apiBaseUrl}/api/invoices/email-settings/test`, { recipient });
  }

  async getConfiguracionOnce(): Promise<ConfiguracionFacturacion> {
    const snapshot = await get(ref(this.database, this.getConfigPath()));
    if (!snapshot.exists()) {
      return { ...EMPTY_CONFIG };
    }
    return this.normalizarConfiguracion(snapshot.val());
  }

  private getCatalogo(nombre: string): Observable<CatalogoEntry[]> {
    return this.http
      .get<CatalogoEntry[]>(`${environment.apiBaseUrl}/api/catalogs/${nombre}`)
      .pipe(map((entries) => this.normalizarCatalogo(entries)));
  }

  private normalizarCatalogo(entries: CatalogoEntry[] | null | undefined): CatalogoEntry[] {
    if (!Array.isArray(entries)) {
      return [];
    }

    return entries
      .filter((entry) => !!entry && !!entry.code)
      .map((entry) => ({
        code: entry.code,
        value: entry.value ?? entry.code
      }));
  }

  private normalizarConfiguracion(value: unknown): ConfiguracionFacturacion {
    const data = (value as Partial<ConfiguracionFacturacion> | null) ?? null;
    const legacyIvaActivo = (data as { codigoPorcentajeIvaActivo?: unknown } | null)?.codigoPorcentajeIvaActivo;
    const isLegacyFormat = !Array.isArray(data?.establecimientos) || data?.establecimientos?.length === 0;
    const { establecimientos, puntosEmision } = this.migrateIfNeeded(data, isLegacyFormat);

    return {
      formaPagoActivos: this.asStringArray(data?.formaPagoActivos),
      tipoIdentificacionActivos: this.asStringArray(data?.tipoIdentificacionActivos),
      ambienteActivo: this.asStringOrNull(data?.ambienteActivo),
      codigoPorcentajeIvaActivos: this.asStringArray(data?.codigoPorcentajeIvaActivos).length
        ? this.asStringArray(data?.codigoPorcentajeIvaActivos)
        : this.asStringOrNull(legacyIvaActivo)
          ? [this.asStringOrNull(legacyIvaActivo) as string]
          : [],
      establecimientos,
      puntosEmision,
      direccionMatriz: typeof data?.direccionMatriz === 'string' ? data.direccionMatriz : '',
      obligadoContabilidad: data?.obligadoContabilidad === true,
      contribuyenteEspecial: typeof data?.contribuyenteEspecial === 'string' ? data.contribuyenteEspecial : '',
      agenteRetencion: typeof data?.agenteRetencion === 'string' ? data.agenteRetencion : '',
      contribuyenteRimpe: data?.contribuyenteRimpe === true,
      logoUrl: typeof data?.logoUrl === 'string' ? data.logoUrl : '',
      actualizadoEn: typeof data?.actualizadoEn === 'number' ? data.actualizadoEn : undefined
    };
  }

  private migrateIfNeeded(
    data: Partial<ConfiguracionFacturacion> | null,
    isLegacyFormat: boolean
  ): { establecimientos: EstablecimientoConfig[]; puntosEmision: PuntoEmisionConfig[] } {
    const rawLegacyPuntos = data?.puntosEmision ?? data?.puntosEmisionLegacy;
    const legacyPuntos = this.normalizarPuntos(rawLegacyPuntos);

    let establecimientos: EstablecimientoConfig[] = [];
    let puntosEmision: PuntoEmisionConfig[] = [];

    if (isLegacyFormat && Array.isArray(rawLegacyPuntos) && rawLegacyPuntos.length > 0) {
      const defaultEstab: EstablecimientoConfig = {
        id: 'estab-default-001',
        codigo: '001',
        nombre: 'Matriz',
        almacenIds: []
      };

      const allAlmacenes = new Set<string>();
      rawLegacyPuntos.forEach((punto) => {
        const raw = punto as unknown as Record<string, unknown>;
        const almacenesRaw = raw['almacenes'] ?? raw['almacenIds'];
        this.asStringArray(almacenesRaw).forEach((id) => allAlmacenes.add(id));
      });
      defaultEstab.almacenIds = Array.from(allAlmacenes);

      establecimientos = [defaultEstab];
      puntosEmision = legacyPuntos.map((punto) => ({
        ...punto,
        establecimientoId: defaultEstab.id
      }));
    } else {
      establecimientos = this.normalizarEstablecimientos(data?.establecimientos);
      puntosEmision = legacyPuntos.map((punto) => ({
        ...punto,
        establecimientoId: punto.establecimientoId ?? (establecimientos[0]?.id ?? 'estab-default-001')
      }));
    }

    return { establecimientos, puntosEmision };
  }

  private normalizarEstablecimientos(establecimientos: unknown): EstablecimientoConfig[] {
    if (!Array.isArray(establecimientos)) {
      return [];
    }

    return establecimientos
      .filter((e) => !!e && !!e.id && !!e.codigo)
      .map((e) => {
        const raw = e as unknown as Record<string, unknown>;
        return {
          id: e.id,
          codigo: e.codigo ?? '',
          nombre: e.nombre ?? '',
          direccion: e.direccion,
          almacenIds: this.asStringArray(raw['almacenIds'] ?? raw['almacenes']),
          activo: typeof e.activo === 'boolean' ? e.activo : true
        } as EstablecimientoConfig;
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  getPuntoYEstablecimientoParaAlmacen(
    almacenId: string
  ): Observable<{ establecimiento: EstablecimientoConfig; puntoEmision: PuntoEmisionConfig } | null> {
    return this.getConfiguracion().pipe(
      map((config) => {
        const establecimientos = config.establecimientos ?? [];
        const puntos = config.puntosEmision ?? [];

        const estab = establecimientos.find((e) => Array.isArray(e.almacenIds) && e.almacenIds.includes(almacenId));
        if (!estab) {
          return null;
        }

        const punto = puntos.find((p) => p.establecimientoId === estab.id && p.activo !== false);
        if (!punto) {
          return null;
        }

        return { establecimiento: estab, puntoEmision: punto };
      })
    );
  }

  getPuntosEmisionPorEstablecimiento(establecimientoId: string): Observable<PuntoEmisionConfig[]> {
    return this.getConfiguracion().pipe(
      map((config) => (config.puntosEmision ?? []).filter((p) => p.establecimientoId === establecimientoId))
    );
  }

  getPuntoEmisionParaAlmacen(almacenId: string): Observable<PuntoEmisionConfig | null> {
    return this.getPuntoYEstablecimientoParaAlmacen(almacenId).pipe(
      map((result) => result?.puntoEmision ?? null)
    );
  }

  getFirmaParaAlmacen(almacenId: string): Observable<FirmaDigitalConfig | null> {
    return combineLatest({ punto: this.getPuntoEmisionParaAlmacen(almacenId), firmas: this.getFirmasDisponibles() }).pipe(
      map(({ punto, firmas }) => {
        if (!punto || !punto.firmaId) {
          return null;
        }

        return firmas.find((f) => f.id === punto.firmaId) ?? null;
      })
    );
  }

  private normalizarPuntos(puntos: PuntoEmisionConfig[] | null | undefined): PuntoEmisionConfig[] {
    if (!Array.isArray(puntos)) {
      return [];
    }

    return puntos
      .filter((punto) => !!punto && !!punto.id)
      .map((punto) => ({
        id: punto.id,
        codigo: punto.codigo ?? '',
        descripcion: punto.descripcion ?? '',
        firmaId: punto.firmaId ?? '',
        establecimientoId: punto.establecimientoId ?? '',
        activo: typeof punto.activo === 'boolean' ? punto.activo : true
      } as PuntoEmisionConfig))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  private asStringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }
}
