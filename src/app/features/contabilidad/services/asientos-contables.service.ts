import { Injectable, inject } from '@angular/core';
import { Database, endAt, get, limitToLast, orderByChild, push, query, ref, remove, runTransaction, set, startAt, update } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import { AuditService } from '../../../core/services/audit.service';
import { AsientoContable, AsientoContableLinea, SaldoCuentaPeriodo } from '../models/contabilidad.models';
import { ConfiguracionContableService } from './configuracion-contable.service';

export interface AsientosPageCursor {
  value: string;
  key: string;
}

export interface AsientosPageResult {
  items: AsientoContable[];
  nextCursor: AsientosPageCursor | null;
  hasMore: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AsientosContablesService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly audit = inject(AuditService);
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

  async getAsientosPage(
    periodo: string,
    limit = 50,
    cursor: AsientosPageCursor | null = null
  ): Promise<AsientosPageResult> {
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      throw new Error('Selecciona un periodo contable valido.');
    }

    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const desde = `${periodo}-01`;
    const hasta = `${periodo}-31`;
    const constraints = [orderByChild('fecha'), startAt(desde)];
    constraints.push(cursor ? endAt(cursor.value, cursor.key) : endAt(hasta));
    constraints.push(limitToLast(boundedLimit + (cursor ? 2 : 1)));

    const snapshot = await get(query(this.getAsientosRef(), ...constraints));
    const items: AsientoContable[] = [];
    snapshot.forEach((child) => {
      if (child.key !== cursor?.key) {
        const asiento = child.val() as AsientoContable;
        items.push({
          ...asiento,
          id: child.key ?? undefined,
          lineas: Array.isArray(asiento.lineas) ? asiento.lineas : []
        });
      }
      return false;
    });

    const hasMore = items.length > boundedLimit;
    if (hasMore) {
      items.shift();
    }
    items.reverse();
    const last = items.at(-1);

    return {
      items,
      nextCursor: hasMore && last?.id
        ? { value: last.fecha, key: last.id }
        : null,
      hasMore
    };
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
      ...this.audit.createMetadata(asiento.id ? 'actualizar' : 'crear', asiento, timestamp),
      aprobadoEn: asiento.aprobadoEn ?? null
    });

    if (asiento.id) {
      await set(this.getAsientoRef(asiento.id), payload);
      await this.audit.recordSafe({
        action: 'actualizar',
        target: { module: 'contabilidad', entityType: 'asiento', entityId: asiento.id, label: asiento.numero ?? asiento.glosa },
        summary: `Actualizo el asiento en borrador ${asiento.numero ?? asiento.glosa}`,
        changesAfter: { glosa: payload.glosa, estado: payload.estado, totalDebe: payload.totalDebe, totalHaber: payload.totalHaber }
      });
      return asiento.id;
    }

    const asientoRef = push(this.getAsientosRef());
    await set(asientoRef, payload);
    await this.audit.recordSafe({
      action: 'crear',
      target: { module: 'contabilidad', entityType: 'asiento', entityId: asientoRef.key!, label: payload.glosa },
      summary: `Creo un asiento en borrador: ${payload.glosa}`,
      changesAfter: { glosa: payload.glosa, estado: payload.estado, totalDebe: payload.totalDebe, totalHaber: payload.totalHaber }
    });
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
      ...this.audit.createMetadata('aprobar', validado, timestamp),
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
    await this.audit.recordSafe({
      action: 'aprobar',
      target: { module: 'contabilidad', entityType: 'asiento', entityId: asientoId, label: numero },
      summary: `Aprobo el asiento ${numero}`,
      changesAfter: { numero, estado: payload.estado, totalDebe: payload.totalDebe, totalHaber: payload.totalHaber }
    });
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
    await this.audit.recordSafe({
      action: 'eliminar',
      target: { module: 'contabilidad', entityType: 'asiento', entityId: asiento.id, label: asiento.numero ?? asiento.glosa },
      summary: `Elimino el asiento borrador ${asiento.numero ?? asiento.glosa}`,
      changesBefore: { glosa: asiento.glosa, estado: asiento.estado, totalDebe: asiento.totalDebe, totalHaber: asiento.totalHaber }
    });
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
      ...this.audit.createMetadata('reversar', null)
    });
    await this.audit.recordSafe({
      action: 'reversar',
      target: { module: 'contabilidad', entityType: 'asiento', entityId: asientoId, label: asientoId },
      summary: `Marco como reversado el asiento ${asientoId}`
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
