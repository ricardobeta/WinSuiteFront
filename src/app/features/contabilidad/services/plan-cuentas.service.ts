import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, remove, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import {
  CuentaContable,
  CuentaPlanExport,
  AsientoContable,
  ConfiguracionIntegracionContable,
  MapeoCategoriaContable,
  NaturalezaCuenta,
  PlanCuentasExport,
  PlantillaPlanCuentas,
  ResultadoAplicarPlantilla,
  TipoCuenta
} from '../models/contabilidad.models';

@Injectable({
  providedIn: 'root'
})
export class PlanCuentasService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `contabilidad/${this.authService.getTenantId()}`;
  }

  private getCollectionPath(): string {
    return `${this.getTenantPath()}/planCuentas`;
  }

  private getCollectionRef() {
    return ref(this.database, this.getCollectionPath());
  }

  private getItemRef(cuentaId: string) {
    return ref(this.database, `${this.getCollectionPath()}/${cuentaId}`);
  }

  getCuentas(): Observable<CuentaContable[]> {
    return new Observable<CuentaContable[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getCollectionRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, CuentaContable>;
          const cuentas = Object.entries(raw)
            .map(([id, cuenta]) => ({
              ...cuenta,
              id
            }))
            .sort((a, b) => this.compararCodigos(a.codigo, b.codigo));

          subscriber.next(cuentas);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getCuentasOnce(): Promise<CuentaContable[]> {
    const snapshot = await get(this.getCollectionRef());
    if (!snapshot.exists()) {
      return [];
    }

    const raw = snapshot.val() as Record<string, CuentaContable>;
    return Object.entries(raw)
      .map(([id, cuenta]) => ({
        ...cuenta,
        id
      }))
      .sort((a, b) => this.compararCodigos(a.codigo, b.codigo));
  }

  async guardarCuenta(cuenta: CuentaContable): Promise<void> {
    const timestamp = Date.now();
    const payload: Omit<CuentaContable, 'id'> = {
      codigo: this.normalizarCodigo(cuenta.codigo),
      nombre: cuenta.nombre.trim(),
      descripcion: cuenta.descripcion?.trim() || '',
      cuentaPadreId: cuenta.cuentaPadreId ?? null,
      nivel: this.calcularNivel(cuenta.codigo),
      tipo: cuenta.tipo,
      naturaleza: cuenta.naturaleza,
      permiteMovimiento: cuenta.permiteMovimiento,
      estado: cuenta.estado,
      origen: cuenta.origen,
      seccionReporte: cuenta.seccionReporte ?? null,
      ordenReporte: cuenta.ordenReporte ?? this.sugerirOrdenReporte(cuenta.codigo),
      incluyeEnEstadoFinanciero: cuenta.incluyeEnEstadoFinanciero ?? true,
      creadoEn: cuenta.creadoEn ?? timestamp,
      actualizadoEn: timestamp
    };

    if (cuenta.id) {
      await update(this.getItemRef(cuenta.id), payload);
      return;
    }

    const cuentaRef = push(this.getCollectionRef());
    await set(cuentaRef, payload);
  }

  async cambiarEstado(cuenta: CuentaContable, estado: CuentaContable['estado']): Promise<void> {
    if (!cuenta.id) {
      return;
    }

    await update(this.getItemRef(cuenta.id), {
      estado,
      actualizadoEn: Date.now()
    });
  }

  async cambiarPermiteMovimiento(cuentaIds: string[], permiteMovimiento: boolean): Promise<void> {
    const idsUnicos = [...new Set(cuentaIds)].filter(Boolean);
    if (idsUnicos.length === 0) {
      return;
    }

    const timestamp = Date.now();
    const updates: Record<string, boolean | number> = {};
    for (const cuentaId of idsUnicos) {
      updates[`${cuentaId}/permiteMovimiento`] = permiteMovimiento;
      updates[`${cuentaId}/actualizadoEn`] = timestamp;
    }

    await update(this.getCollectionRef(), updates);
  }

  async eliminarCuenta(cuenta: CuentaContable): Promise<void> {
    if (!cuenta.id) {
      return;
    }

    const cuentaId = cuenta.id;
    const cuentas = await this.getCuentasOnce();
    const cuentaActual = cuentas.find((item) => item.id === cuentaId);
    if (!cuentaActual) {
      throw new Error('La cuenta ya no existe en el plan de cuentas.');
    }

    if (!cuentaActual.cuentaPadreId) {
      throw new Error('Solo se pueden eliminar cuentas hijas. Las cuentas principales se conservan para mantener la estructura del plan.');
    }

    if (cuentas.some((item) => item.cuentaPadreId === cuentaActual.id)) {
      throw new Error('No se puede eliminar la cuenta porque tiene subcuentas asociadas.');
    }

    const uso = await this.validarCuentaSinUso(cuentaId);
    if (uso) {
      throw new Error(uso);
    }

    await remove(this.getItemRef(cuentaId));
  }

  async aplicarPlantilla(plantilla: PlantillaPlanCuentas): Promise<ResultadoAplicarPlantilla> {
    const existentes = await this.getCuentasOnce();
    const codigosExistentes = new Set(existentes.map((cuenta) => this.normalizarCodigo(cuenta.codigo)));
    const idsPorCodigo = new Map(existentes.map((cuenta) => [this.normalizarCodigo(cuenta.codigo), cuenta.id!]));
    let insertadas = 0;
    let omitidas = 0;

    for (const cuentaPlantilla of [...plantilla.cuentas].sort((a, b) => this.compararCodigos(a.codigo, b.codigo))) {
      const codigo = this.normalizarCodigo(cuentaPlantilla.codigo);
      if (codigosExistentes.has(codigo)) {
        omitidas += 1;
        continue;
      }

      const cuentaRef = push(this.getCollectionRef());
      const parentCode = this.obtenerCodigoPadre(codigo);
      const cuenta: Omit<CuentaContable, 'id'> = {
        codigo,
        nombre: cuentaPlantilla.nombre,
        descripcion: cuentaPlantilla.descripcion ?? '',
        cuentaPadreId: parentCode ? idsPorCodigo.get(parentCode) ?? null : null,
        nivel: this.calcularNivel(codigo),
        tipo: this.sugerirTipo(codigo),
        naturaleza: this.sugerirNaturaleza(codigo),
        permiteMovimiento: cuentaPlantilla.permiteMovimiento,
        estado: 'ACTIVA',
        origen: plantilla.origen,
        seccionReporte: cuentaPlantilla.seccionReporte ?? this.sugerirSeccionReporte(codigo),
        ordenReporte: cuentaPlantilla.ordenReporte ?? this.sugerirOrdenReporte(codigo),
        incluyeEnEstadoFinanciero: cuentaPlantilla.incluyeEnEstadoFinanciero ?? true,
        creadoEn: Date.now(),
        actualizadoEn: Date.now()
      };

      await set(cuentaRef, cuenta);
      codigosExistentes.add(codigo);
      idsPorCodigo.set(codigo, cuentaRef.key!);
      insertadas += 1;
    }

    return { insertadas, omitidas };
  }

  /** Exporta el plan de cuentas del tenant activo a un JSON portable (sin ids ni jerarquía). */
  async exportarPlanCuentas(): Promise<PlanCuentasExport> {
    const cuentas = await this.getCuentasOnce();
    return {
      formato: 'winsuite-plan-cuentas',
      version: 1,
      exportadoEn: Date.now(),
      totalCuentas: cuentas.length,
      cuentas: cuentas.map((cuenta) => ({
        codigo: this.normalizarCodigo(cuenta.codigo),
        nombre: cuenta.nombre,
        descripcion: cuenta.descripcion ?? '',
        tipo: cuenta.tipo,
        naturaleza: cuenta.naturaleza,
        permiteMovimiento: cuenta.permiteMovimiento,
        estado: cuenta.estado,
        seccionReporte: cuenta.seccionReporte ?? null,
        ordenReporte: cuenta.ordenReporte ?? null,
        incluyeEnEstadoFinanciero: cuenta.incluyeEnEstadoFinanciero ?? true
      }))
    };
  }

  /**
   * Importa un plan de cuentas exportado en el tenant activo. Salta códigos ya existentes,
   * inserta en orden de código y reconstruye `cuentaPadreId` desde el código padre,
   * preservando los atributos explícitos de cada cuenta. Idempotente.
   */
  async importarPlanCuentas(data: PlanCuentasExport): Promise<ResultadoAplicarPlantilla> {
    if (!data || data.formato !== 'winsuite-plan-cuentas' || !Array.isArray(data.cuentas)) {
      throw new Error('El archivo no es un plan de cuentas válido de WinSuite.');
    }

    const existentes = await this.getCuentasOnce();
    const codigosExistentes = new Set(existentes.map((cuenta) => this.normalizarCodigo(cuenta.codigo)));
    const idsPorCodigo = new Map(existentes.map((cuenta) => [this.normalizarCodigo(cuenta.codigo), cuenta.id!]));
    let insertadas = 0;
    let omitidas = 0;

    const ordenadas = [...data.cuentas].sort((a, b) => this.compararCodigos(a.codigo, b.codigo));
    for (const cuentaExport of ordenadas) {
      const codigo = this.normalizarCodigo(cuentaExport.codigo);
      if (!codigo || !cuentaExport.nombre) {
        omitidas += 1;
        continue;
      }
      if (codigosExistentes.has(codigo)) {
        omitidas += 1;
        continue;
      }

      const parentCode = this.obtenerCodigoPadre(codigo);
      const cuentaRef = push(this.getCollectionRef());
      const cuenta: Omit<CuentaContable, 'id'> = {
        codigo,
        nombre: cuentaExport.nombre.trim(),
        descripcion: cuentaExport.descripcion?.trim() || '',
        cuentaPadreId: parentCode ? idsPorCodigo.get(parentCode) ?? null : null,
        nivel: this.calcularNivel(codigo),
        tipo: cuentaExport.tipo ?? this.sugerirTipo(codigo),
        naturaleza: cuentaExport.naturaleza ?? this.sugerirNaturaleza(codigo),
        permiteMovimiento: cuentaExport.permiteMovimiento ?? false,
        estado: cuentaExport.estado ?? 'ACTIVA',
        origen: 'MANUAL',
        seccionReporte: cuentaExport.seccionReporte ?? this.sugerirSeccionReporte(codigo),
        ordenReporte: cuentaExport.ordenReporte ?? this.sugerirOrdenReporte(codigo),
        incluyeEnEstadoFinanciero: cuentaExport.incluyeEnEstadoFinanciero ?? true,
        creadoEn: Date.now(),
        actualizadoEn: Date.now()
      };

      await set(cuentaRef, cuenta);
      codigosExistentes.add(codigo);
      idsPorCodigo.set(codigo, cuentaRef.key!);
      insertadas += 1;
    }

    return { insertadas, omitidas };
  }

  normalizarCodigo(codigo: string): string {
    return codigo.trim().replace(/\s+/g, '').replace(/\.+/g, '.').replace(/^\./, '').replace(/\.$/, '');
  }

  calcularNivel(codigo: string): number {
    const normalizado = this.normalizarCodigo(codigo);
    return normalizado ? normalizado.split('.').length : 0;
  }

  obtenerCodigoPadre(codigo: string): string | null {
    const segments = this.normalizarCodigo(codigo).split('.');
    if (segments.length <= 1) {
      return null;
    }

    return segments.slice(0, -1).join('.');
  }

  sugerirTipo(codigo: string): TipoCuenta {
    const firstSegment = this.normalizarCodigo(codigo).split('.')[0];
    if (firstSegment === '2') {
      return 'PASIVO';
    }
    if (firstSegment === '3') {
      return 'PATRIMONIO';
    }
    if (firstSegment === '4') {
      return 'INGRESO';
    }
    if (firstSegment === '5') {
      return 'GASTO';
    }
    if (firstSegment === '6') {
      return 'COSTO';
    }
    return 'ACTIVO';
  }

  sugerirNaturaleza(codigo: string): NaturalezaCuenta {
    const tipo = this.sugerirTipo(codigo);
    return tipo === 'ACTIVO' || tipo === 'GASTO' || tipo === 'COSTO' ? 'DEUDORA' : 'ACREEDORA';
  }

  sugerirSeccionReporte(codigo: string): CuentaContable['seccionReporte'] {
    const normalizado = this.normalizarCodigo(codigo);
    if (normalizado.startsWith('1.1')) {
      return 'ACTIVO_CORRIENTE';
    }
    if (normalizado.startsWith('1.2')) {
      return 'ACTIVO_NO_CORRIENTE';
    }
    if (normalizado.startsWith('2.1')) {
      return 'PASIVO_CORRIENTE';
    }
    if (normalizado.startsWith('2.2')) {
      return 'PASIVO_NO_CORRIENTE';
    }
    if (normalizado.startsWith('3')) {
      return 'PATRIMONIO';
    }
    if (normalizado.startsWith('4.9')) {
      return 'OTROS_INGRESOS';
    }
    if (normalizado.startsWith('4')) {
      return 'INGRESOS_OPERACIONALES';
    }
    if (normalizado.startsWith('5.1')) {
      return 'COSTOS';
    }
    if (normalizado.startsWith('5.2')) {
      return 'GASTOS_ADMINISTRATIVOS';
    }
    if (normalizado.startsWith('5.3')) {
      return 'GASTOS_VENTAS';
    }
    if (normalizado.startsWith('5.4')) {
      return 'GASTOS_FINANCIEROS';
    }
    if (normalizado.startsWith('5.9')) {
      return 'OTROS_GASTOS';
    }
    if (normalizado.startsWith('6')) {
      return 'COSTOS';
    }
    return null;
  }

  sugerirOrdenReporte(codigo: string): number {
    const segments = this.normalizarCodigo(codigo).split('.');
    return segments.reduce((total, segment, index) => total + Number(segment || 0) * Math.pow(100, Math.max(0, 4 - index)), 0);
  }

  private compararCodigos(a: string, b: string): number {
    const left = this.normalizarCodigo(a).split('.').map((segment) => Number(segment));
    const right = this.normalizarCodigo(b).split('.').map((segment) => Number(segment));
    const length = Math.max(left.length, right.length);

    for (let index = 0; index < length; index += 1) {
      const leftValue = left[index] ?? -1;
      const rightValue = right[index] ?? -1;
      if (leftValue !== rightValue) {
        return leftValue - rightValue;
      }
    }

    return 0;
  }

  private async validarCuentaSinUso(cuentaId: string): Promise<string | null> {
    const asientosSnapshot = await get(ref(this.database, `${this.getTenantPath()}/asientos`));
    if (asientosSnapshot.exists()) {
      const asientos = asientosSnapshot.val() as Record<string, AsientoContable>;
      const usadaEnAsiento = Object.values(asientos).some((asiento) =>
        Array.isArray(asiento.lineas) && asiento.lineas.some((linea) => linea.cuentaId === cuentaId)
      );
      if (usadaEnAsiento) {
        return 'No se puede eliminar la cuenta porque ya fue usada en asientos contables.';
      }
    }

    const saldosSnapshot = await get(ref(this.database, `${this.getTenantPath()}/saldos`));
    if (saldosSnapshot.exists() && this.saldosUsanCuenta(saldosSnapshot.val(), cuentaId)) {
      return 'No se puede eliminar la cuenta porque tiene saldos contables asociados.';
    }

    const integracionesSnapshot = await get(ref(this.database, `${this.getTenantPath()}/configuracion/integraciones`));
    if (integracionesSnapshot.exists() && this.configuracionUsaCuenta(integracionesSnapshot.val(), cuentaId)) {
      return 'No se puede eliminar la cuenta porque esta asignada en la configuracion de integraciones contables.';
    }

    const mapeosSnapshot = await get(ref(this.database, `${this.getTenantPath()}/mapeosAutomaticos/categorias`));
    if (mapeosSnapshot.exists()) {
      const mapeos = mapeosSnapshot.val() as Record<string, MapeoCategoriaContable>;
      const usadaEnMapeo = Object.values(mapeos).some((mapeo) => this.mapeoUsaCuenta(mapeo, cuentaId));
      if (usadaEnMapeo) {
        return 'No se puede eliminar la cuenta porque esta asignada en un mapeo contable de categoria.';
      }
    }

    return null;
  }

  private saldosUsanCuenta(value: unknown, cuentaId: string): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }

    return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
      key === cuentaId || this.saldosUsanCuenta(child, cuentaId)
    );
  }

  private configuracionUsaCuenta(value: unknown, cuentaId: string): boolean {
    const config = value as Partial<ConfiguracionIntegracionContable> | null;
    if (!config || typeof config !== 'object') {
      return false;
    }

    return Object.entries(config).some(([key, configValue]) => key.startsWith('cuenta') && configValue === cuentaId);
  }

  private mapeoUsaCuenta(mapeo: MapeoCategoriaContable, cuentaId: string): boolean {
    return Object.entries(mapeo).some(([key, value]) => key.startsWith('cuenta') && value === cuentaId);
  }
}
