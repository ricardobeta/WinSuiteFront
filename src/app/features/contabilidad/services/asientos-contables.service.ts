import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref, remove, runTransaction, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { AsientoContable, AsientoContableLinea, SaldoCuentaPeriodo } from '../models/contabilidad.models';
import { ConfiguracionContableService } from './configuracion-contable.service';

@Injectable({
  providedIn: 'root'
})
export class AsientosContablesService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly configuracionService = inject(ConfiguracionContableService);

  private getTenantPath(): string {
    return `contabilidad/${this.authService.getTenantId()}`;
  }

  private getAsientosPath(): string {
    return `${this.getTenantPath()}/asientos`;
  }

  private getAsientosRef() {
    return ref(this.database, this.getAsientosPath());
  }

  private getAsientoRef(asientoId: string) {
    return ref(this.database, `${this.getAsientosPath()}/${asientoId}`);
  }

  getAsientos(): Observable<AsientoContable[]> {
    return new Observable<AsientoContable[]>((subscriber) => {
      const unsubscribe = onValue(
        this.getAsientosRef(),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, AsientoContable>;
          const asientos = Object.entries(raw)
            .map(([id, asiento]) => ({
              ...asiento,
              id,
              lineas: Array.isArray(asiento.lineas) ? asiento.lineas : []
            }))
            .sort((a, b) => {
              const byDate = b.fecha.localeCompare(a.fecha);
              return byDate !== 0 ? byDate : (b.numero ?? '').localeCompare(a.numero ?? '');
            });

          subscriber.next(asientos);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getAsientoById(asientoId: string): Promise<AsientoContable | null> {
    const snapshot = await get(this.getAsientoRef(asientoId));
    if (!snapshot.exists()) {
      return null;
    }

    const asiento = snapshot.val() as AsientoContable;
    return {
      ...asiento,
      id: asientoId,
      lineas: Array.isArray(asiento.lineas) ? asiento.lineas : []
    };
  }

  async guardarBorrador(asiento: AsientoContable): Promise<string> {
    const normalizado = this.normalizarAsiento(asiento);
    await this.configuracionService.validarPeriodoParaMovimiento(normalizado.fecha);

    if (asiento.id) {
      const actual = await this.getAsientoById(asiento.id);
      if (actual && actual.estado !== 'BORRADOR') {
        throw new Error('Solo se pueden editar asientos en borrador.');
      }
    }

    const timestamp = Date.now();
    const { id: _draftId, ...payload } = this.normalizarAsiento({
      ...normalizado,
      estado: 'BORRADOR',
      numero: asiento.numero ?? null,
      creadoEn: asiento.creadoEn ?? timestamp,
      actualizadoEn: timestamp,
      aprobadoEn: asiento.aprobadoEn ?? null
    });

    if (asiento.id) {
      await set(this.getAsientoRef(asiento.id), payload);
      return asiento.id;
    }

    const asientoRef = push(this.getAsientosRef());
    await set(asientoRef, payload);
    return asientoRef.key!;
  }

  async aprobarAsiento(asiento: AsientoContable): Promise<string> {
    const validado = this.validarParaAprobacion(asiento);
    await this.configuracionService.validarPeriodoParaMovimiento(validado.fecha);

    const timestamp = Date.now();
    const anio = validado.fecha.slice(0, 4);
    const numero = validado.numero ?? await this.reservarNumero(anio);
    const { id: _approvedId, ...payload } = this.normalizarAsiento({
      ...validado,
      numero,
      estado: 'APROBADO',
      creadoEn: validado.creadoEn ?? timestamp,
      actualizadoEn: timestamp,
      aprobadoEn: timestamp
    });

    let asientoId = asiento.id;
    if (asientoId) {
      const actual = await this.getAsientoById(asientoId);
      if (actual && actual.estado !== 'BORRADOR') {
        throw new Error('Solo se pueden aprobar asientos en borrador.');
      }
      await set(this.getAsientoRef(asientoId), payload);
    } else {
      const asientoRef = push(this.getAsientosRef());
      asientoId = asientoRef.key!;
      await set(asientoRef, payload);
    }

    await this.acumularSaldos(payload);
    return asientoId;
  }

  async eliminarBorrador(asiento: AsientoContable): Promise<void> {
    if (!asiento.id) {
      return;
    }

    if (asiento.estado !== 'BORRADOR') {
      throw new Error('Solo se pueden eliminar asientos en borrador.');
    }

    await remove(this.getAsientoRef(asiento.id));
  }

  duplicarAsiento(asiento: AsientoContable): AsientoContable {
    return this.normalizarAsiento({
      fecha: this.fechaHoy(),
      periodo: this.periodoDesdeFecha(this.fechaHoy()),
      tipo: asiento.tipo,
      glosa: `${asiento.glosa} (copia)`,
      referencia: asiento.referencia ?? '',
      estado: 'BORRADOR',
      origen: 'MANUAL',
      numero: null,
      lineas: asiento.lineas.map((linea) => ({
        ...linea,
        id: this.generarLineaId()
      })),
      totalDebe: 0,
      totalHaber: 0,
      diferencia: 0
    });
  }

  crearReverso(asiento: AsientoContable): AsientoContable {
    return this.normalizarAsiento({
      fecha: this.fechaHoy(),
      periodo: this.periodoDesdeFecha(this.fechaHoy()),
      tipo: 'AJUSTE',
      glosa: `Reverso de ${asiento.numero ?? asiento.id}: ${asiento.glosa}`,
      referencia: asiento.numero ?? asiento.referencia ?? '',
      estado: 'BORRADOR',
      origen: 'MANUAL',
      numero: null,
      asientoReversadoId: asiento.id ?? null,
      lineas: asiento.lineas.map((linea) => ({
        ...linea,
        id: this.generarLineaId(),
        debe: linea.haber,
        haber: linea.debe
      })),
      totalDebe: 0,
      totalHaber: 0,
      diferencia: 0
    });
  }

  async marcarReversado(asientoId: string): Promise<void> {
    await update(this.getAsientoRef(asientoId), {
      estado: 'REVERSADO',
      reversadoEn: Date.now(),
      actualizadoEn: Date.now()
    });
  }

  normalizarAsiento(asiento: AsientoContable): AsientoContable {
    const lineas = asiento.lineas
      .map((linea) => this.normalizarLinea(linea))
      .filter((linea) => linea.cuentaId || linea.descripcion || linea.debe > 0 || linea.haber > 0);
    const totalDebe = this.roundToTwo(lineas.reduce((total, linea) => total + linea.debe, 0));
    const totalHaber = this.roundToTwo(lineas.reduce((total, linea) => total + linea.haber, 0));
    const fecha = asiento.fecha || this.fechaHoy();

    return {
      ...asiento,
      fecha,
      periodo: this.periodoDesdeFecha(fecha),
      glosa: asiento.glosa.trim(),
      referencia: asiento.referencia?.trim() ?? '',
      origen: asiento.origen ?? 'MANUAL',
      origenTipo: asiento.origenTipo ?? null,
      origenId: asiento.origenId ?? null,
      origenNumero: asiento.origenNumero ?? null,
      origenModulo: asiento.origenModulo ?? null,
      lineas,
      totalDebe,
      totalHaber,
      diferencia: this.roundToTwo(totalDebe - totalHaber)
    };
  }

  crearLineaVacia(descripcion = ''): AsientoContableLinea {
    return {
      id: this.generarLineaId(),
      cuentaId: '',
      codigoCuenta: '',
      nombreCuenta: '',
      descripcion,
      debe: 0,
      haber: 0
    };
  }

  periodoDesdeFecha(fecha: string): string {
    return fecha.slice(0, 7);
  }

  fechaHoy(): string {
    return new Date().toISOString().slice(0, 10);
  }

  roundToTwo(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private validarParaAprobacion(asiento: AsientoContable): AsientoContable {
    const normalizado = this.normalizarAsiento(asiento);

    if (normalizado.lineas.length < 2) {
      throw new Error('El asiento debe tener al menos dos lineas.');
    }

    if (!normalizado.glosa) {
      throw new Error('El detalle es obligatorio.');
    }

    for (const linea of normalizado.lineas) {
      if (!linea.cuentaId) {
        throw new Error('Todas las lineas deben tener cuenta contable.');
      }
      if (linea.debe <= 0 && linea.haber <= 0) {
        throw new Error('Cada linea debe tener debe o haber.');
      }
      if (linea.debe > 0 && linea.haber > 0) {
        throw new Error('Una linea no puede tener debe y haber al mismo tiempo.');
      }
    }

    if (normalizado.diferencia !== 0) {
      throw new Error('El asiento debe estar cuadrado para aprobar.');
    }

    return normalizado;
  }

  private normalizarLinea(linea: AsientoContableLinea): AsientoContableLinea {
    const debe = this.roundToTwo(Number(linea.debe || 0));
    const haber = this.roundToTwo(Number(linea.haber || 0));

    return {
      id: linea.id || this.generarLineaId(),
      cuentaId: linea.cuentaId,
      codigoCuenta: linea.codigoCuenta,
      nombreCuenta: linea.nombreCuenta,
      descripcion: linea.descripcion?.trim() ?? '',
      debe,
      haber
    };
  }

  private async reservarNumero(anio: string): Promise<string> {
    const contadorRef = ref(this.database, `${this.getTenantPath()}/secuencias/asientos/${anio}`);
    const result = await runTransaction(contadorRef, (current: unknown) => {
      const actual = typeof current === 'number' ? current : 0;
      return actual + 1;
    });
    const secuencia = typeof result.snapshot.val() === 'number' ? Number(result.snapshot.val()) : 1;
    return `${anio}-${String(secuencia).padStart(6, '0')}`;
  }

  private async acumularSaldos(asiento: AsientoContable): Promise<void> {
    for (const linea of asiento.lineas) {
      const saldoRef = ref(this.database, `${this.getTenantPath()}/saldos/${asiento.periodo}/${linea.cuentaId}`);
      await runTransaction(saldoRef, (current: unknown) => {
        const actual = (current ?? {}) as Partial<SaldoCuentaPeriodo>;
        const debitos = this.roundToTwo(Number(actual.debitos ?? 0) + linea.debe);
        const creditos = this.roundToTwo(Number(actual.creditos ?? 0) + linea.haber);

        return {
          cuentaId: linea.cuentaId,
          codigoCuenta: linea.codigoCuenta,
          nombreCuenta: linea.nombreCuenta,
          periodo: asiento.periodo,
          debitos,
          creditos,
          saldo: this.roundToTwo(debitos - creditos),
          actualizadoEn: Date.now()
        };
      });
    }
  }

  private generarLineaId(): string {
    return `lin_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }
}
