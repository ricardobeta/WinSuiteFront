import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import {
  CuentaContable,
  NaturalezaCuenta,
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
}
