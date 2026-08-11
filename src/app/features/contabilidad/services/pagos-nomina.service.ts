import { Injectable, inject } from '@angular/core';
import { Database, equalTo, get, orderByChild, push, query, ref, runTransaction, set, update } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import { CuentaBancaria } from '../models/bancos.models';
import { AsientoContable, AsientoContableLinea, CuentaContable, ModoAsientoAutomatico } from '../models/contabilidad.models';
import { ConfiguracionNominaContable, EstadoPagoRol, RolPago, RolPagoDetalle } from '../models/nomina.models';
import {
  PagoNomina,
  PagoNominaDetalle,
  RegistrarPagoNominaInput,
  ResumenPagoNomina,
  SaldoPagoEmpleado
} from '../models/pagos-nomina.models';
import { AsientosContablesService } from './asientos-contables.service';
import { IntegracionContableService } from './integracion-contable.service';
import { PlanCuentasService } from './plan-cuentas.service';
import { construirPartidasPagoRol, repartirMontoPago, usaCuentaBeneficios } from './pagos-nomina-asiento.util';

/**
 * Pago de un rol aprobado: la segunda mitad del ciclo de nomina. Aprobar el rol devenga el pasivo
 * (sueldos y beneficios sociales por pagar); este servicio lo cancela el dia que sale el dinero,
 * contra la cuenta contable del banco que hizo la transferencia.
 *
 * El pago individual y el masivo comparten el mismo documento: pagar a una persona es un documento
 * con un solo detalle. Un rol admite varios pagos hasta cubrir su neto, porque en la practica casi
 * siempre queda alguien fuera de la transferencia.
 *
 * No inyecta NominaService a proposito: es NominaService quien depende de este servicio para
 * impedir que un rol con pagos vivos se reverse, y la dependencia inversa cerraria el ciclo de DI.
 * Por eso lee rolesPago y rolesPagoDetalles directo de la base.
 */
@Injectable({
  providedIn: 'root'
})
export class PagosNominaService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly asientosService = inject(AsientosContablesService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly integracionContable = inject(IntegracionContableService);

  private getNominaPath(): string {
    return `nomina/${this.authService.getTenantId()}`;
  }

  private getTenantPath(): string {
    return `contabilidad/${this.authService.getTenantId()}`;
  }

  /** Pagos de un rol, del mas reciente al mas antiguo. Incluye los anulados, como historial. */
  async getPagosPorRol(rolId: string): Promise<ResumenPagoNomina[]> {
    const snapshot = await get(query(
      ref(this.database, `${this.getNominaPath()}/pagosNomina`),
      orderByChild('rolId'),
      equalTo(rolId)
    ));
    if (!snapshot.exists()) {
      return [];
    }

    const raw = snapshot.val() as Record<string, PagoNomina>;
    const resumenes: ResumenPagoNomina[] = [];
    for (const [id, pago] of Object.entries(raw)) {
      const detalles = await get(ref(this.database, `${this.getNominaPath()}/pagosNominaDetalles/${id}`));
      resumenes.push({ pago: { ...pago, id }, detalles: this.detallesDesdeSnapshot(detalles.val()) });
    }
    return resumenes.sort((a, b) => (b.pago.creadoEn ?? 0) - (a.pago.creadoEn ?? 0));
  }

  async getPagoDetalle(pagoId: string): Promise<ResumenPagoNomina | null> {
    const [cabecera, detalles] = await Promise.all([
      get(ref(this.database, `${this.getNominaPath()}/pagosNomina/${pagoId}`)),
      get(ref(this.database, `${this.getNominaPath()}/pagosNominaDetalles/${pagoId}`))
    ]);
    if (!cabecera.exists()) {
      return null;
    }
    return {
      pago: { ...(cabecera.val() as PagoNomina), id: pagoId },
      detalles: this.detallesDesdeSnapshot(detalles.val())
    };
  }

  /**
   * Lo que se le debe a cada empleado del rol y lo que ya cobro. Se recalcula desde los documentos
   * vivos en lugar de leer un acumulado desnormalizado: anular un pago devuelve el saldo solo, sin
   * depender de que un contador haya quedado a medio camino.
   */
  async getSaldosPorEmpleado(rolId: string): Promise<Map<string, SaldoPagoEmpleado>> {
    const [detallesRol, pagos] = await Promise.all([
      this.getDetallesRol(rolId),
      this.getPagosPorRol(rolId)
    ]);

    const saldos = new Map<string, SaldoPagoEmpleado>();
    for (const detalle of detallesRol) {
      saldos.set(detalle.empleadoId, {
        empleadoId: detalle.empleadoId,
        neto: this.roundToTwo(detalle.netoPagar),
        pagado: 0,
        saldo: this.roundToTwo(detalle.netoPagar),
        beneficios: this.beneficiosMensualizados(detalle)
      });
    }

    for (const resumen of pagos) {
      if (resumen.pago.estado !== 'REGISTRADO') {
        continue;
      }
      for (const detalle of resumen.detalles) {
        const saldo = saldos.get(detalle.empleadoId);
        if (!saldo) {
          continue;
        }
        saldo.pagado = this.roundToTwo(saldo.pagado + detalle.monto);
        saldo.saldo = this.roundToTwo(Math.max(0, saldo.neto - saldo.pagado));
      }
    }
    return saldos;
  }

  /**
   * Arma los detalles del pago repartiendo cada monto entre los dos pasivos del rol. Lo usa el
   * wizard para previsualizar y el registro para persistir, de modo que ambos vean el mismo corte.
   */
  construirDetallesPago(
    rolTipo: RolPago['tipo'],
    seleccion: Array<{ empleadoId: string; monto: number; referenciaPago?: string; observacion?: string }>,
    detallesRol: RolPagoDetalle[],
    saldos: Map<string, SaldoPagoEmpleado>
  ): PagoNominaDetalle[] {
    const porEmpleado = new Map(detallesRol.map((detalle) => [detalle.empleadoId, detalle]));
    const detalles: PagoNominaDetalle[] = [];

    for (const item of seleccion) {
      const detalleRol = porEmpleado.get(item.empleadoId);
      const monto = this.roundToTwo(item.monto);
      if (!detalleRol || monto <= 0) {
        continue;
      }
      const saldo = saldos.get(item.empleadoId);
      const neto = this.roundToTwo(saldo?.neto ?? detalleRol.netoPagar);
      const beneficios = usaCuentaBeneficios(rolTipo ?? 'MENSUAL')
        ? (saldo?.beneficios ?? this.beneficiosMensualizados(detalleRol))
        : 0;
      const reparto = repartirMontoPago(monto, neto, beneficios);

      detalles.push({
        empleadoId: item.empleadoId,
        empleadoNombre: detalleRol.empleadoNombre,
        cargo: detalleRol.cargo ?? '',
        netoRol: neto,
        pagadoAntes: this.roundToTwo(saldo?.pagado ?? 0),
        monto,
        montoSueldos: reparto.montoSueldos,
        montoBeneficios: reparto.montoBeneficios,
        referenciaPago: item.referenciaPago?.trim() || '',
        observacion: item.observacion?.trim() || ''
      });
    }
    return detalles;
  }

  /**
   * Propone las lineas del asiento sin guardarlas, en modo lenient: las cuentas que falten quedan
   * vacias para que el contador las complete en el dialogo de revision.
   */
  async construirLineasPago(
    rolTipo: RolPago['tipo'],
    detalles: PagoNominaDetalle[],
    cuentaContableBancoId: string,
    concepto: string
  ): Promise<AsientoContableLinea[]> {
    const [config, cuentas] = await Promise.all([
      this.getConfiguracionNomina(),
      this.planCuentasService.getCuentasOnce()
    ]);
    const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id ?? '', cuenta]));

    const lineas: AsientoContableLinea[] = [];
    for (const partida of construirPartidasPagoRol(rolTipo ?? 'MENSUAL', detalles, config, cuentaContableBancoId, concepto)) {
      this.agregarLinea(lineas, cuentasPorId, partida.cuentaId, partida.descripcion, partida.debe, partida.haber);
    }
    return lineas;
  }

  /**
   * @param lineasConfirmadas Lineas revisadas por el contador en el dialogo. Si no vienen (o la
   * contabilidad esta desactivada) el pago se registra sin asiento.
   */
  async registrarPago(
    input: RegistrarPagoNominaInput,
    detalles: PagoNominaDetalle[],
    lineasConfirmadas?: AsientoContableLinea[]
  ): Promise<string> {
    if (!input.fecha) {
      throw new Error('Selecciona la fecha en que salio el dinero.');
    }
    const validos = detalles.filter((detalle) => this.roundToTwo(detalle.monto) > 0);
    if (validos.length === 0) {
      throw new Error('Selecciona al menos un empleado con monto mayor a cero.');
    }

    const rol = await this.getRol(input.rolId);
    if (!rol) {
      throw new Error('El rol de pago ya no existe.');
    }
    if (rol.estado !== 'APROBADO') {
      throw new Error('Solo se puede pagar un rol aprobado: el rol todavia no devengo el pasivo.');
    }

    const cuentaBancaria = await this.getCuentaBancaria(input.cuentaBancariaId);
    if (!cuentaBancaria) {
      throw new Error('Selecciona la cuenta bancaria desde la que se hizo el pago.');
    }
    if (!cuentaBancaria.cuentaContableId) {
      throw new Error(`La cuenta bancaria ${cuentaBancaria.nombre} no tiene cuenta contable asociada. Asignala en Bancos antes de pagar.`);
    }

    // Se relee el saldo en lugar de confiar en lo que trae la pantalla: entre que se abrio el
    // wizard y se confirmo, otra sesion pudo haber pagado a los mismos empleados.
    const saldos = await this.getSaldosPorEmpleado(input.rolId);
    for (const detalle of validos) {
      const saldo = saldos.get(detalle.empleadoId);
      if (!saldo) {
        throw new Error(`${detalle.empleadoNombre} no forma parte de este rol.`);
      }
      if (this.roundToTwo(detalle.monto) > saldo.saldo) {
        throw new Error(
          `El pago de ${detalle.empleadoNombre} (${detalle.monto.toFixed(2)}) supera su saldo pendiente `
          + `de ${saldo.saldo.toFixed(2)}. Vuelve a abrir la pantalla para ver los saldos actualizados.`
        );
      }
    }

    const modoAsiento = await this.getModoAsiento();
    const anio = input.fecha.slice(0, 4);
    const total = this.roundToTwo(validos.reduce((suma, detalle) => suma + detalle.monto, 0));
    const timestamp = Date.now();

    const pago: PagoNomina = {
      numero: await this.reservarNumero(anio),
      rolId: input.rolId,
      rolNumero: rol.numero ?? null,
      rolTipo: rol.tipo ?? 'MENSUAL',
      periodo: rol.periodo,
      fecha: input.fecha,
      cuentaBancariaId: input.cuentaBancariaId,
      bancoNombre: cuentaBancaria.bancoNombre || cuentaBancaria.nombre,
      numeroCuentaBanco: cuentaBancaria.numeroCuenta ?? '',
      cuentaContableBancoId: cuentaBancaria.cuentaContableId,
      formaPago: input.formaPago,
      referencia: input.referencia?.trim() || '',
      concepto: this.conceptoEfectivo(input.concepto, rol),
      total,
      totalEmpleados: validos.length,
      estado: 'REGISTRADO',
      modoAsiento,
      asientoId: null,
      asientoReversionId: null,
      creadoEn: timestamp,
      actualizadoEn: timestamp,
      anuladoEn: null
    };

    // push() sin valor solo reserva la clave en el cliente: sirve para referenciar el pago desde el
    // asiento antes de escribirlo.
    const pagoRef = push(ref(this.database, `${this.getNominaPath()}/pagosNomina`));
    const pagoId = pagoRef.key!;

    // El asiento va primero: si el periodo contable esta cerrado o falta una cuenta, la operacion
    // falla sin dejar un pago huerfano que nadie contabilizo.
    const asientoId = lineasConfirmadas?.length && (await this.integracionContable.contabilidadActiva())
      ? await this.guardarAsiento(pago, pagoId, lineasConfirmadas, modoAsiento)
      : null;

    await set(pagoRef, { ...pago, asientoId });

    const detallesUpdates: Record<string, PagoNominaDetalle> = {};
    for (const detalle of validos) {
      detallesUpdates[detalle.empleadoId] = {
        ...detalle,
        monto: this.roundToTwo(detalle.monto),
        montoSueldos: this.roundToTwo(detalle.montoSueldos),
        montoBeneficios: this.roundToTwo(detalle.montoBeneficios),
        referenciaPago: detalle.referenciaPago?.trim() || '',
        observacion: detalle.observacion?.trim() || ''
      };
    }
    await set(ref(this.database, `${this.getNominaPath()}/pagosNominaDetalles/${pagoId}`), detallesUpdates);

    await this.actualizarEstadoPagoRol(input.rolId);
    return pagoId;
  }

  /** Anula un pago registrado por error y devuelve el saldo a los empleados que incluia. */
  async anularPago(pagoId: string): Promise<void> {
    const resumen = await this.getPagoDetalle(pagoId);
    if (!resumen) {
      throw new Error('El pago ya no existe.');
    }
    if (resumen.pago.estado === 'ANULADO') {
      throw new Error('El pago ya esta anulado.');
    }

    const timestamp = Date.now();
    let asientoReversionId: string | null = null;

    if (resumen.pago.asientoId) {
      const original = await this.asientosService.getAsientoById(resumen.pago.asientoId);
      if (!original) {
        throw new Error('No se encontro el asiento original del pago para reversarlo.');
      }
      const reverso = this.asientosService.crearReverso(original);
      asientoReversionId = await this.asientosService.aprobarAsiento({
        ...reverso,
        glosa: `Reverso pago ${resumen.pago.numero}`,
        referencia: resumen.pago.numero,
        origen: 'REVERSO_PAGO_NOMINA',
        origenTipo: 'REVERSO_PAGO_NOMINA',
        origenId: pagoId,
        origenNumero: resumen.pago.numero,
        origenModulo: 'NOMINA'
      });
      await this.asientosService.marcarReversado(resumen.pago.asientoId);
    }

    // Se libera el vinculo origen->asiento para que el pago pueda volver a registrarse limpio.
    await set(this.getAsientoOrigenRef('PAGO_NOMINA', pagoId), null);
    await update(ref(this.database, `${this.getNominaPath()}/pagosNomina/${pagoId}`), {
      estado: 'ANULADO',
      asientoReversionId,
      actualizadoEn: timestamp,
      anuladoEn: timestamp
    });
    await this.actualizarEstadoPagoRol(resumen.pago.rolId);
  }

  /** Pagos vivos de un rol. Lo consulta NominaService antes de permitir una reversion. */
  async tienePagosRegistrados(rolId: string): Promise<boolean> {
    const pagos = await this.getPagosPorRol(rolId);
    return pagos.some((resumen) => resumen.pago.estado === 'REGISTRADO');
  }

  /**
   * Recalcula el resumen de pago del rol desde los documentos vivos. PAGADO admite un centavo de
   * tolerancia porque el prorrateo de varios parciales puede dejar migajas de redondeo.
   */
  private async actualizarEstadoPagoRol(rolId: string): Promise<void> {
    const [rol, pagos] = await Promise.all([this.getRol(rolId), this.getPagosPorRol(rolId)]);
    if (!rol) {
      return;
    }
    const totalPagado = this.roundToTwo(pagos
      .filter((resumen) => resumen.pago.estado === 'REGISTRADO')
      .reduce((total, resumen) => total + resumen.pago.total, 0));
    const ultimoPagoEn = pagos
      .filter((resumen) => resumen.pago.estado === 'REGISTRADO')
      .reduce((ultimo, resumen) => Math.max(ultimo, resumen.pago.creadoEn ?? 0), 0);

    let estadoPago: EstadoPagoRol = 'PENDIENTE';
    if (totalPagado > 0) {
      estadoPago = totalPagado + 0.01 >= this.roundToTwo(rol.totalNetoPagar) ? 'PAGADO' : 'PARCIAL';
    }

    await update(ref(this.database, `${this.getNominaPath()}/rolesPago/${rolId}`), {
      estadoPago,
      totalPagado,
      ultimoPagoEn: ultimoPagoEn || null,
      actualizadoEn: Date.now()
    });
  }

  private async guardarAsiento(
    pago: PagoNomina,
    pagoId: string,
    lineas: AsientoContableLinea[],
    modoAsiento: ModoAsientoAutomatico
  ): Promise<string> {
    const asiento: AsientoContable = {
      fecha: pago.fecha,
      periodo: '',
      tipo: 'AJUSTE',
      glosa: `${pago.concepto} (${pago.totalEmpleados} empleado${pago.totalEmpleados === 1 ? '' : 's'})`,
      referencia: pago.referencia || pago.numero,
      estado: 'BORRADOR',
      origen: 'PAGO_NOMINA',
      origenTipo: 'PAGO_NOMINA',
      origenId: pagoId,
      origenNumero: pago.numero,
      origenModulo: 'NOMINA',
      lineas,
      totalDebe: 0,
      totalHaber: 0,
      diferencia: 0
    };

    const asientoId = modoAsiento === 'APROBADO'
      ? await this.asientosService.aprobarAsiento(asiento)
      : await this.asientosService.guardarBorrador(asiento);

    await set(this.getAsientoOrigenRef('PAGO_NOMINA', pagoId), {
      asientoId,
      origenTipo: 'PAGO_NOMINA',
      origenId: pagoId,
      origenNumero: pago.numero,
      creadoEn: Date.now()
    });
    return asientoId;
  }

  /**
   * Cuando la cuenta falta o no permite movimiento, la linea sale sin cuenta en lugar de lanzar,
   * para que el dialogo de revision la muestre resaltada y el contador la seleccione.
   */
  private agregarLinea(
    lineas: AsientoContableLinea[],
    cuentasPorId: Map<string, CuentaContable>,
    cuentaId: string,
    descripcion: string,
    debe: number,
    haber: number
  ): void {
    const debeNormalizado = this.roundToTwo(debe);
    const haberNormalizado = this.roundToTwo(haber);
    if (debeNormalizado <= 0 && haberNormalizado <= 0) {
      return;
    }
    const cuenta = cuentasPorId.get(cuentaId);
    const usable = !!cuenta && cuenta.estado === 'ACTIVA' && cuenta.permiteMovimiento;
    lineas.push({
      id: `lin_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      cuentaId: usable ? cuentaId : '',
      codigoCuenta: usable ? cuenta!.codigo : '',
      nombreCuenta: usable ? cuenta!.nombre : '',
      descripcion,
      debe: debeNormalizado,
      haber: haberNormalizado
    });
  }

  async getRol(rolId: string): Promise<RolPago | null> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/rolesPago/${rolId}`));
    if (!snapshot.exists()) {
      return null;
    }
    const rol = snapshot.val() as RolPago;
    return { ...rol, id: rolId, tipo: rol.tipo ?? 'MENSUAL' };
  }

  async getDetallesRol(rolId: string): Promise<RolPagoDetalle[]> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/rolesPagoDetalles/${rolId}`));
    if (!snapshot.exists()) {
      return [];
    }
    const raw = snapshot.val() as Record<string, RolPagoDetalle>;
    return Object.values(raw).sort((a, b) => a.empleadoNombre.localeCompare(b.empleadoNombre));
  }

  /** Parte del neto que corresponde a decimos y fondos mensualizados: el pasivo de beneficios. */
  private beneficiosMensualizados(detalle: RolPagoDetalle): number {
    return this.roundToTwo(
      (detalle.decimoTerceroMensualizado ?? 0)
      + (detalle.decimoCuartoMensualizado ?? 0)
      + (detalle.fondosReservaMensualizado ?? 0)
    );
  }

  /**
   * Configuracion de nomina leida directo, para no depender de NominaService. Solo se replican los
   * respaldos de las cuentas que el pago usa: son los mismos que aplica normalizarConfiguracion()
   * al armar el asiento del rol, y sin ellos un tenant antiguo veria filas sin cuenta que en
   * realidad si estan configuradas.
   */
  private async getConfiguracionNomina(): Promise<ConfiguracionNominaContable> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/configuracion`));
    const raw = (snapshot.val() ?? {}) as Partial<ConfiguracionNominaContable>;
    return {
      ...raw,
      cuentaSueldosPorPagarId: raw.cuentaSueldosPorPagarId ?? '',
      cuentaBeneficiosSocialesPorPagarId: raw.cuentaBeneficiosSocialesPorPagarId ?? '',
      cuentaUtilidadesPorPagarId: raw.cuentaUtilidadesPorPagarId ?? '',
      cuentaLiquidacionesPorPagarId: raw.cuentaLiquidacionesPorPagarId || raw.cuentaSueldosPorPagarId || ''
    } as ConfiguracionNominaContable;
  }

  private async getModoAsiento(): Promise<ModoAsientoAutomatico> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/configuracion/modoAsiento`));
    return snapshot.val() === 'APROBADO' ? 'APROBADO' : 'BORRADOR';
  }

  /**
   * Cuenta bancaria leida directo del nodo de bancos. Se evita inyectar BancosCuentasService para
   * no arrastrar su Observable en un flujo que solo necesita una lectura puntual.
   */
  private async getCuentaBancaria(cuentaBancariaId: string): Promise<CuentaBancaria | null> {
    if (!cuentaBancariaId) {
      return null;
    }
    const snapshot = await get(ref(this.database, `${this.getTenantPath()}/bancos/cuentasBancarias/${cuentaBancariaId}`));
    return snapshot.exists() ? { ...(snapshot.val() as CuentaBancaria), id: cuentaBancariaId } : null;
  }

  private detallesDesdeSnapshot(value: unknown): PagoNominaDetalle[] {
    if (!value) {
      return [];
    }
    const raw = value as Record<string, PagoNominaDetalle>;
    return Object.entries(raw)
      .map(([empleadoId, detalle]) => ({ ...detalle, empleadoId }))
      .sort((a, b) => a.empleadoNombre.localeCompare(b.empleadoNombre));
  }

  private conceptoEfectivo(concepto: string, rol: RolPago): string {
    return concepto?.trim() || `Pago rol ${rol.numero ?? rol.periodo}`;
  }

  private getAsientoOrigenRef(origenTipo: 'PAGO_NOMINA' | 'REVERSO_PAGO_NOMINA', pagoId: string) {
    return ref(this.database, `${this.getTenantPath()}/asientosOrigen/${origenTipo}/${pagoId}`);
  }

  private async reservarNumero(anio: string): Promise<string> {
    const result = await runTransaction(
      ref(this.database, `${this.getNominaPath()}/secuencias/pagosNomina/${anio}`),
      (current: unknown) => (typeof current === 'number' ? current : 0) + 1
    );
    const secuencia = typeof result.snapshot.val() === 'number' ? Number(result.snapshot.val()) : 1;
    return `PGN-${anio}-${String(secuencia).padStart(5, '0')}`;
  }

  private roundToTwo(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}
