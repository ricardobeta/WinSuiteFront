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

export interface CorregirAsientoInput {
  /** Version editada del asiento. Solo se toman fecha, tipo, glosa, referencia y lineas. */
  asiento: AsientoContable;
  motivo: string;
}

export interface RecalculoSaldosResult {
  periodos: number;
  cuentas: number;
}

interface SaldoDelta {
  periodo: string;
  cuentaId: string;
  codigoCuenta: string;
  nombreCuenta: string;
  debe: number;
  haber: number;
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

    await this.ajustarSaldos(null, payload);
    await this.audit.recordSafe({
      action: 'aprobar',
      target: { module: 'contabilidad', entityType: 'asiento', entityId: asientoId, label: numero },
      summary: `Aprobo el asiento ${numero}`,
      changesAfter: { numero, estado: payload.estado, totalDebe: payload.totalDebe, totalHaber: payload.totalHaber }
    });
    return asientoId;
  }

  /**
   * Corrige un asiento YA APROBADO cuyo periodo sigue abierto, ajustando los saldos de forma
   * diferencial: lo que aportaba la version anterior se resta y lo que aporta la nueva se suma.
   * Asi un cambio de cuenta deja la cuenta antigua sin el importe y la nueva con el, sin duplicar.
   */
  async actualizarAsientoAprobado(input: CorregirAsientoInput): Promise<string> {
    const asientoId = input.asiento.id;
    if (!asientoId) {
      throw new Error('No se puede corregir un asiento sin identificador.');
    }

    const motivo = input.motivo?.trim() ?? '';
    if (!motivo) {
      throw new Error('El motivo de la correccion es obligatorio.');
    }

    const actual = await this.getAsientoById(asientoId);
    if (!actual) {
      throw new Error('El asiento ya no existe.');
    }
    if (actual.estado === 'BORRADOR') {
      throw new Error('Este asiento es un borrador: usa la edicion normal.');
    }
    if (actual.estado !== 'APROBADO') {
      throw new Error('Solo se pueden corregir asientos aprobados. Un asiento reversado ya fue compensado.');
    }

    const validado = this.validarParaAprobacion(input.asiento);

    // El periodo original tambien se valida: sin esto, mover la fecha a un mes abierto permitiria
    // alterar un periodo ya cerrado.
    await this.configuracionService.validarPeriodoParaMovimiento(actual.fecha);
    // Se derivan los periodos de la fecha en vez de leer el campo almacenado: asi la comparacion
    // no depende de que un registro antiguo tenga el periodo bien guardado.
    if (this.periodoDesdeFecha(validado.fecha) !== this.periodoDesdeFecha(actual.fecha)) {
      await this.configuracionService.validarPeriodoParaMovimiento(validado.fecha);
    }

    await this.validarCorreccionPermitida(actual, validado);

    const timestamp = Date.now();
    // El payload parte del asiento almacenado, no de lo que envia el cliente: el set() sobrescribe
    // el nodo completo y perderia numero, origen y punteros al subledger.
    const { id: _correccionId, ...payload } = this.normalizarAsiento({
      ...actual,
      fecha: validado.fecha,
      tipo: validado.tipo,
      glosa: validado.glosa,
      referencia: validado.referencia,
      lineas: validado.lineas,
      totalDebe: validado.totalDebe,
      totalHaber: validado.totalHaber,
      diferencia: validado.diferencia,
      estado: 'APROBADO',
      numero: actual.numero ?? null,
      aprobadoEn: actual.aprobadoEn ?? null,
      editadoEn: timestamp,
      editadoPor: this.authService.currentUser()?.uid ?? null,
      motivoUltimaEdicion: motivo,
      edicionesCount: Number(actual.edicionesCount ?? 0) + 1,
      ...this.audit.createMetadata('actualizar', actual, timestamp)
    });

    await set(this.getAsientoRef(asientoId), payload);
    await this.ajustarSaldos(actual, payload);

    await this.audit.recordSafe({
      action: 'actualizar',
      target: { module: 'contabilidad', entityType: 'asiento', entityId: asientoId, label: actual.numero ?? actual.glosa },
      summary: `Corrigio el asiento aprobado ${actual.numero ?? actual.glosa}: ${motivo}`,
      changesBefore: this.snapshotParaAuditoria(actual),
      changesAfter: { ...this.snapshotParaAuditoria(payload), motivo }
    });

    return asientoId;
  }

  /**
   * Reconstruye contabilidad/{tenant}/saldos desde los asientos. Red de seguridad ante fallos
   * parciales y herramienta de verificacion tras una correccion.
   */
  async recalcularSaldos(): Promise<RecalculoSaldosResult> {
    const snapshot = await get(this.getAsientosRef());
    const saldos: Record<string, Record<string, SaldoCuentaPeriodo>> = {};
    const timestamp = Date.now();
    let cuentas = 0;

    if (snapshot.exists()) {
      const asientos = snapshot.val() as Record<string, AsientoContable>;
      for (const asiento of Object.values(asientos)) {
        // Mismo filtro que ReportesContablesService.getAsientosReportables: un asiento REVERSADO
        // sigue aportando a los saldos y es su asiento inverso el que lo compensa. Excluirlo
        // dejaria el saldo con el signo cambiado.
        if (asiento?.estado !== 'APROBADO' && asiento?.estado !== 'REVERSADO') {
          continue;
        }

        const periodo = this.periodoDesdeFecha(asiento.fecha ?? '');
        const lineas = Array.isArray(asiento.lineas) ? asiento.lineas : [];
        for (const linea of lineas) {
          if (!linea?.cuentaId) {
            continue;
          }

          const porPeriodo = (saldos[periodo] ??= {});
          const existente = porPeriodo[linea.cuentaId];
          if (!existente) {
            cuentas += 1;
          }

          const debitos = this.roundToTwo(Number(existente?.debitos ?? 0) + Number(linea.debe || 0));
          const creditos = this.roundToTwo(Number(existente?.creditos ?? 0) + Number(linea.haber || 0));
          porPeriodo[linea.cuentaId] = {
            cuentaId: linea.cuentaId,
            codigoCuenta: linea.codigoCuenta ?? existente?.codigoCuenta ?? '',
            nombreCuenta: linea.nombreCuenta ?? existente?.nombreCuenta ?? '',
            periodo,
            debitos,
            creditos,
            saldo: this.roundToTwo(debitos - creditos),
            actualizadoEn: timestamp
          };
        }
      }
    }

    await set(ref(this.database, `${this.getTenantPath()}/saldos`), saldos);
    await this.audit.recordSafe({
      action: 'generar',
      target: { module: 'contabilidad', entityType: 'saldos', entityId: 'saldos', label: 'Saldos contables' },
      summary: `Recalculo los saldos contables: ${Object.keys(saldos).length} periodos, ${cuentas} cuentas.`
    });

    return { periodos: Object.keys(saldos).length, cuentas };
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

  /**
   * Aplica sobre los saldos la diferencia entre dos versiones de un asiento.
   * Con anterior=null se comporta como la acumulacion original de una aprobacion.
   * Resuelve en un solo recorrido el cambio de cuenta (la vieja recibe -X y la nueva +X),
   * el cambio de importe, el cambio de periodo y las lineas agregadas o eliminadas.
   */
  private async ajustarSaldos(anterior: AsientoContable | null, nuevo: AsientoContable | null): Promise<void> {
    const deltas = new Map<string, SaldoDelta>();
    this.acumularDeltas(deltas, anterior, -1);
    this.acumularDeltas(deltas, nuevo, 1);

    for (const delta of deltas.values()) {
      if (delta.debe === 0 && delta.haber === 0) {
        continue;
      }

      const saldoRef = ref(this.database, `${this.getTenantPath()}/saldos/${delta.periodo}/${delta.cuentaId}`);
      await runTransaction(saldoRef, (current: unknown) => {
        const actual = (current ?? {}) as Partial<SaldoCuentaPeriodo>;
        const debitos = this.roundToTwo(Number(actual.debitos ?? 0) + delta.debe);
        const creditos = this.roundToTwo(Number(actual.creditos ?? 0) + delta.haber);

        // La cuenta se quedo sin movimiento en el periodo: se borra el nodo para que el guard de
        // borrado de cuentas (PlanCuentasService) no siga viendo un saldo que ya no existe.
        if (debitos === 0 && creditos === 0) {
          return null;
        }

        return {
          cuentaId: delta.cuentaId,
          codigoCuenta: delta.codigoCuenta || actual.codigoCuenta || '',
          nombreCuenta: delta.nombreCuenta || actual.nombreCuenta || '',
          periodo: delta.periodo,
          debitos,
          creditos,
          saldo: this.roundToTwo(debitos - creditos),
          actualizadoEn: Date.now()
        };
      });
    }
  }

  private acumularDeltas(deltas: Map<string, SaldoDelta>, asiento: AsientoContable | null, signo: 1 | -1): void {
    if (!asiento) {
      return;
    }

    const periodo = this.periodoDesdeFecha(asiento.fecha ?? '');
    const lineas = Array.isArray(asiento.lineas) ? asiento.lineas : [];
    for (const linea of lineas) {
      if (!linea?.cuentaId) {
        continue;
      }

      const clave = `${periodo}|${linea.cuentaId}`;
      const acumulado = deltas.get(clave) ?? {
        periodo,
        cuentaId: linea.cuentaId,
        codigoCuenta: linea.codigoCuenta ?? '',
        nombreCuenta: linea.nombreCuenta ?? '',
        debe: 0,
        haber: 0
      };

      // La version nueva manda sobre los datos desnormalizados de la cuenta.
      if (signo === 1) {
        acumulado.codigoCuenta = linea.codigoCuenta ?? acumulado.codigoCuenta;
        acumulado.nombreCuenta = linea.nombreCuenta ?? acumulado.nombreCuenta;
      }
      acumulado.debe = this.roundToTwo(acumulado.debe + signo * Number(linea.debe || 0));
      acumulado.haber = this.roundToTwo(acumulado.haber + signo * Number(linea.haber || 0));
      deltas.set(clave, acumulado);
    }
  }

  /**
   * Un asiento generado por otro modulo (venta, rol de pago, compra, pago, banco) esta apuntado
   * desde su documento origen. El contador puede reasignar cuentas y repartir el importe en mas o
   * menos lineas, pero los totales y la fecha quedan clavados para que el mayor siga cuadrando
   * con el subledger.
   */
  private async validarCorreccionPermitida(actual: AsientoContable, nuevo: AsientoContable): Promise<void> {
    if (this.totalesBloqueados(actual)) {
      const totalDebeActual = this.roundToTwo(actual.totalDebe);
      const totalHaberActual = this.roundToTwo(actual.totalHaber);
      if (nuevo.totalDebe !== totalDebeActual || nuevo.totalHaber !== totalHaberActual) {
        throw new Error(
          `Este asiento proviene de otro modulo: puedes cambiar las cuentas y repartir el importe en otras lineas, ` +
          `pero los totales deben seguir en ${totalDebeActual.toFixed(2)} / ${totalHaberActual.toFixed(2)}.`
        );
      }
      if (nuevo.fecha !== actual.fecha) {
        throw new Error('La fecha de un asiento generado por otro modulo la define su documento origen.');
      }
    }

    const cxp = actual.cuentaPorPagarManual;
    if (!cxp?.documentoPorPagarId) {
      return;
    }

    // sincronizarDesdeAsientoManual solo crea el documento por pagar, nunca lo actualiza, y el
    // documento puede tener abonos: el credito neto sobre la cuenta de control no puede moverse.
    const cuentaControlId = await this.getCuentaPorPagarDefaultId();
    if (!cuentaControlId) {
      return;
    }

    const netoNuevo = this.roundToTwo(
      nuevo.lineas
        .filter((linea) => linea.cuentaId === cuentaControlId)
        .reduce((total, linea) => total + Number(linea.haber || 0) - Number(linea.debe || 0), 0)
    );
    const netoEsperado = this.roundToTwo(cxp.montoOriginal);
    if (netoNuevo !== netoEsperado) {
      throw new Error(
        `Este asiento genero la cuenta por pagar ${cxp.referencia || cxp.documentoPorPagarId}. ` +
        `El credito neto de la cuenta por pagar debe seguir en ${netoEsperado.toFixed(2)}. ` +
        `Para cambiarlo, anula el documento por pagar.`
      );
    }
  }

  /** Los asientos con origen automatico o de bancos tienen sus totales atados a un documento. */
  totalesBloqueados(asiento: AsientoContable): boolean {
    return asiento.origen !== 'MANUAL' || asiento.origenModulo === 'BANCOS';
  }

  private async getCuentaPorPagarDefaultId(): Promise<string | null> {
    // Se lee el nodo directo en vez de inyectar CuentasPorPagarService: ese servicio depende de
    // IntegracionContableService, que a su vez depende de este, y la inyeccion seria circular.
    const snapshot = await get(ref(this.database, `${this.getTenantPath()}/configuracion/cuentasPorPagar`));
    if (!snapshot.exists()) {
      return null;
    }
    const config = snapshot.val() as { cuentaPorPagarDefaultId?: string | null };
    return config?.cuentaPorPagarDefaultId ?? null;
  }

  private snapshotParaAuditoria(asiento: AsientoContable): Record<string, unknown> {
    return {
      fecha: asiento.fecha,
      glosa: asiento.glosa,
      referencia: asiento.referencia ?? '',
      totalDebe: asiento.totalDebe,
      totalHaber: asiento.totalHaber,
      lineas: (asiento.lineas ?? []).map((linea) => ({
        codigoCuenta: linea.codigoCuenta,
        nombreCuenta: linea.nombreCuenta,
        descripcion: linea.descripcion,
        debe: linea.debe,
        haber: linea.haber
      }))
    };
  }

  private generarLineaId(): string {
    return `lin_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }
}
