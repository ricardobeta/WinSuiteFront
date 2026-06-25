import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import {
  AsientoContable,
  AuditoriaPeriodoContable,
  ConfiguracionEmpresaContable,
  PeriodoContable
} from '../models/contabilidad.models';

@Injectable({
  providedIn: 'root'
})
export class ConfiguracionContableService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `contabilidad/${this.authService.getTenantId()}`;
  }

  private getEmpresaPath(): string {
    return `${this.getTenantPath()}/configuracion/empresa`;
  }

  private getPeriodosPath(): string {
    return `${this.getTenantPath()}/periodos`;
  }

  getEmpresa(): Observable<ConfiguracionEmpresaContable | null> {
    return new Observable<ConfiguracionEmpresaContable | null>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, this.getEmpresaPath()),
        (snapshot) => subscriber.next(snapshot.exists() ? snapshot.val() as ConfiguracionEmpresaContable : null),
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getEmpresaOnce(): Promise<ConfiguracionEmpresaContable | null> {
    const snapshot = await get(ref(this.database, this.getEmpresaPath()));
    return snapshot.exists() ? snapshot.val() as ConfiguracionEmpresaContable : null;
  }

  async guardarEmpresa(empresa: ConfiguracionEmpresaContable): Promise<void> {
    const actual = await this.getEmpresaOnce();
    const timestamp = Date.now();
    const payload: ConfiguracionEmpresaContable = {
      ...empresa,
      ruc: this.normalizarRuc(empresa.ruc),
      razonSocial: empresa.razonSocial.trim(),
      nombreComercial: empresa.nombreComercial?.trim() ?? '',
      actividadEconomicaCodigo: empresa.actividadEconomicaCodigo.trim(),
      actividadEconomicaDescripcion: empresa.actividadEconomicaDescripcion.trim(),
      correoNotificacionesSri: empresa.correoNotificacionesSri.trim(),
      monedaFuncional: 'USD',
      configurado: true,
      creadoEn: actual?.creadoEn ?? timestamp,
      actualizadoEn: timestamp
    };

    this.validarEmpresa(payload);
    await set(ref(this.database, this.getEmpresaPath()), payload);
  }

  getPeriodos(anio: number): Observable<PeriodoContable[]> {
    return new Observable<PeriodoContable[]>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, this.getPeriodosPath()),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, PeriodoContable>;
          const periodos = Object.values(raw)
            .filter((periodo) => periodo.anio === anio)
            .sort((a, b) => a.id.localeCompare(b.id));
          subscriber.next(periodos);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getPeriodo(periodoId: string): Promise<PeriodoContable | null> {
    const snapshot = await get(ref(this.database, `${this.getPeriodosPath()}/${periodoId}`));
    return snapshot.exists() ? snapshot.val() as PeriodoContable : null;
  }

  async generarPeriodos(anio: number): Promise<{ creados: number; existentes: number }> {
    const timestamp = Date.now();
    let creados = 0;
    let existentes = 0;

    for (let mes = 1; mes <= 12; mes += 1) {
      const periodo = this.crearPeriodo(anio, mes, timestamp);
      const periodoRef = ref(this.database, `${this.getPeriodosPath()}/${periodo.id}`);
      const snapshot = await get(periodoRef);

      if (snapshot.exists()) {
        existentes += 1;
        continue;
      }

      await set(periodoRef, periodo);
      await this.registrarAuditoria(periodo.id, 'CREAR');
      creados += 1;
    }

    return { creados, existentes };
  }

  async cerrarPeriodo(periodo: PeriodoContable): Promise<void> {
    if (periodo.estado === 'CERRADO') {
      return;
    }

    const borradores = await this.contarBorradoresEnPeriodo(periodo.id);
    if (borradores > 0) {
      throw new Error(`No se puede cerrar ${periodo.id}: existen ${borradores} asientos en borrador.`);
    }

    const timestamp = Date.now();
    await update(ref(this.database, `${this.getPeriodosPath()}/${periodo.id}`), {
      estado: 'CERRADO',
      actualizadoEn: timestamp,
      cerradoEn: timestamp,
      cerradoPor: this.authService.currentUser()?.uid ?? null
    });
    await this.registrarAuditoria(periodo.id, 'CERRAR');
  }

  async reabrirPeriodo(periodo: PeriodoContable, motivo: string): Promise<void> {
    if (periodo.estado === 'ABIERTO') {
      return;
    }

    const motivoNormalizado = motivo.trim();
    if (!motivoNormalizado) {
      throw new Error('El motivo de reapertura es obligatorio.');
    }

    const timestamp = Date.now();
    await update(ref(this.database, `${this.getPeriodosPath()}/${periodo.id}`), {
      estado: 'ABIERTO',
      actualizadoEn: timestamp,
      reabiertoEn: timestamp,
      reabiertoPor: this.authService.currentUser()?.uid ?? null,
      motivoReapertura: motivoNormalizado
    });
    await this.registrarAuditoria(periodo.id, 'REABRIR', motivoNormalizado);
  }

  async validarPeriodoParaMovimiento(fecha: string): Promise<void> {
    const empresa = await this.getEmpresaOnce();
    if (!empresa?.configurado) {
      throw new Error('Configura la empresa contable antes de registrar asientos.');
    }

    const periodoId = this.periodoDesdeFecha(fecha);
    const periodo = await this.getPeriodo(periodoId);
    if (!periodo) {
      throw new Error(`El periodo ${periodoId} no existe. Genera los periodos contables en configuracion.`);
    }

    if (periodo.estado === 'CERRADO') {
      throw new Error(`El periodo ${periodoId} esta cerrado. Reabre el periodo para registrar movimientos.`);
    }
  }

  periodoDesdeFecha(fecha: string): string {
    return fecha.slice(0, 7);
  }

  validarRucEcuador(ruc: string): boolean {
    const value = this.normalizarRuc(ruc);
    if (!/^\d{13}$/.test(value) || value.slice(10) !== '001') {
      return false;
    }

    const provincia = Number(value.slice(0, 2));
    const thirdDigit = Number(value[2]);
    return provincia >= 1 && provincia <= 24 && thirdDigit !== 7 && thirdDigit !== 8;
  }

  private validarEmpresa(empresa: ConfiguracionEmpresaContable): void {
    if (!this.validarRucEcuador(empresa.ruc)) {
      throw new Error('Ingresa un RUC ecuatoriano valido de 13 digitos.');
    }

    if (!empresa.razonSocial) {
      throw new Error('La razon social es obligatoria.');
    }

    if (!empresa.actividadEconomicaCodigo || !empresa.actividadEconomicaDescripcion) {
      throw new Error('La actividad economica es obligatoria.');
    }

    if (!empresa.fechaInicioContable) {
      throw new Error('La fecha de inicio contable es obligatoria.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(empresa.correoNotificacionesSri)) {
      throw new Error('Ingresa un correo SRI valido.');
    }
  }

  private normalizarRuc(ruc: string): string {
    return ruc.replace(/\D/g, '').slice(0, 13);
  }

  private crearPeriodo(anio: number, mes: number, timestamp: number): PeriodoContable {
    const id = `${anio}-${String(mes).padStart(2, '0')}`;
    const fechaInicio = `${id}-01`;
    const fechaFinDate = new Date(anio, mes, 0);
    const fechaFin = `${anio}-${String(mes).padStart(2, '0')}-${String(fechaFinDate.getDate()).padStart(2, '0')}`;

    return {
      id,
      anio,
      mes,
      nombre: this.nombrePeriodo(anio, mes),
      fechaInicio,
      fechaFin,
      estado: 'ABIERTO',
      creadoEn: timestamp,
      actualizadoEn: timestamp,
      cerradoEn: null,
      cerradoPor: null,
      reabiertoEn: null,
      reabiertoPor: null,
      motivoReapertura: null
    };
  }

  private nombrePeriodo(anio: number, mes: number): string {
    const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${nombres[mes - 1]} ${anio}`;
  }

  private async contarBorradoresEnPeriodo(periodoId: string): Promise<number> {
    const snapshot = await get(ref(this.database, `${this.getTenantPath()}/asientos`));
    if (!snapshot.exists()) {
      return 0;
    }

    const raw = snapshot.val() as Record<string, AsientoContable>;
    return Object.values(raw).filter((asiento) => asiento.periodo === periodoId && asiento.estado === 'BORRADOR').length;
  }

  private async registrarAuditoria(
    periodoId: string,
    accion: AuditoriaPeriodoContable['accion'],
    motivo: string | null = null
  ): Promise<void> {
    const auditoriaRef = push(ref(this.database, `${this.getTenantPath()}/auditoriaPeriodos/${periodoId}`));
    await set(auditoriaRef, {
      periodoId,
      accion,
      motivo,
      usuarioId: this.authService.currentUser()?.uid ?? null,
      creadoEn: Date.now()
    } satisfies AuditoriaPeriodoContable);
  }

}
