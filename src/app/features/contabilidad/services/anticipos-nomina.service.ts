import { Injectable, inject } from '@angular/core';
import { Database, equalTo, get, onValue, orderByChild, push, query, ref, runTransaction, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import {
  AnticipoNomina,
  AnticipoNominaDetalle,
  anticipoAfectaNomina,
  ComprobanteEntregaAnticipo,
  RegistrarAnticipoInput,
  ResumenAnticipoNomina
} from '../models/anticipos-nomina.models';
import { AsientoContable, AsientoContableLinea, CuentaContable, ModoAsientoAutomatico } from '../models/contabilidad.models';
import { RolPago } from '../models/nomina.models';
import { AsientosContablesService } from './asientos-contables.service';
import { IntegracionContableService } from './integracion-contable.service';
import { PlanCuentasService } from './plan-cuentas.service';

/**
 * Auxiliar de anticipos de sueldo. Un anticipo es la entrega de dinero al empleado antes del rol:
 * se contabiliza el dia que sale la plata (DEBE anticipos a empleados / HABER caja-banco) y se
 * descuenta integramente en el rol mensual del periodo indicado, donde el asiento del rol acredita
 * la cuenta de anticipos y cancela el activo.
 *
 * Los anticipos individuales y los masivos comparten el mismo documento: uno individual es un
 * documento con un solo detalle.
 *
 * No inyecta NominaService a proposito: es NominaService quien depende de este servicio para
 * inyectar el descuento al generar el rol, y la dependencia inversa cerraria el ciclo de DI.
 */
@Injectable({
  providedIn: 'root'
})
export class AnticiposNominaService {
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

  getAnticipos(): Observable<AnticipoNomina[]> {
    return new Observable<AnticipoNomina[]>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, `${this.getNominaPath()}/anticipos`),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, AnticipoNomina>;
          subscriber.next(Object.entries(raw)
            .map(([id, anticipo]) => ({ ...anticipo, id }))
            .sort((a, b) => (b.creadoEn ?? 0) - (a.creadoEn ?? 0)));
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getAnticipoDetalle(anticipoId: string): Promise<ResumenAnticipoNomina | null> {
    const [cabecera, detalles] = await Promise.all([
      get(ref(this.database, `${this.getNominaPath()}/anticipos/${anticipoId}`)),
      get(ref(this.database, `${this.getNominaPath()}/anticiposDetalles/${anticipoId}`))
    ]);
    if (!cabecera.exists()) {
      return null;
    }
    return {
      anticipo: { ...(cabecera.val() as AnticipoNomina), id: anticipoId },
      detalles: this.detallesDesdeSnapshot(detalles.val())
    };
  }

  /**
   * Propone las lineas del asiento sin guardarlas, en modo lenient.
   *
   * Cada empleado aporta su par completo DEBE/HABER con su nombre en ambas descripciones, en lugar
   * de un unico HABER sumarizado: asi el mayor de la cuenta de caja/banco muestra a quien se le
   * entregó cada valor sin tener que abrir el auxiliar de anticipos. Cada par cuadra por si mismo.
   *
   * Las cuentas que falten quedan vacias para que el contador las complete en el dialogo de revision.
   */
  async construirLineasAnticipo(
    input: Pick<RegistrarAnticipoInput, 'periodo' | 'concepto' | 'cuentaAnticipoId' | 'cuentaOrigenId'>,
    detalles: AnticipoNominaDetalle[]
  ): Promise<AsientoContableLinea[]> {
    const cuentas = await this.planCuentasService.getCuentasOnce();
    const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id ?? '', cuenta]));
    const concepto = this.conceptoEfectivo(input.concepto, input.periodo);

    const lineas: AsientoContableLinea[] = [];
    for (const detalle of detalles) {
      const descripcion = `${concepto} - ${detalle.empleadoNombre}`;
      this.agregarLinea(lineas, cuentasPorId, input.cuentaAnticipoId, descripcion, detalle.monto, 0);
      this.agregarLinea(lineas, cuentasPorId, input.cuentaOrigenId, descripcion, 0, detalle.monto);
    }
    return lineas;
  }

  /** Guarda una propuesta editable. Nunca crea asiento ni la expone como descuento del rol. */
  async guardarBorrador(
    input: RegistrarAnticipoInput,
    detalles: AnticipoNominaDetalle[],
    anticipoId?: string
  ): Promise<string> {
    if (!/^\d{4}-\d{2}$/.test(input.periodo)) {
      throw new Error('Selecciona un periodo valido para el anticipo.');
    }
    if (!input.fecha) {
      throw new Error('Selecciona la fecha de entrega del anticipo.');
    }
    const validos = detalles.filter((detalle) => this.roundToTwo(detalle.monto) > 0);
    if (validos.length === 0) {
      throw new Error('Selecciona al menos un empleado con monto mayor a cero.');
    }

    const anio = input.periodo.slice(0, 4);
    const total = this.roundToTwo(validos.reduce((suma, detalle) => suma + detalle.monto, 0));
    const timestamp = Date.now();
    const existente = anticipoId ? await this.getAnticipoDetalle(anticipoId) : null;
    if (anticipoId && !existente) {
      throw new Error('El borrador ya no existe.');
    }
    if (existente && existente.anticipo.estado !== 'BORRADOR') {
      throw new Error('Solo se pueden editar anticipos en borrador.');
    }

    const id = anticipoId || push(ref(this.database, `${this.getNominaPath()}/anticipos`)).key;
    if (!id) {
      throw new Error('No se pudo generar el identificador del anticipo.');
    }

    const anticipo: AnticipoNomina = {
      numero: existente?.anticipo.numero || await this.reservarNumero(anio),
      periodo: input.periodo,
      fecha: input.fecha,
      concepto: this.conceptoEfectivo(input.concepto, input.periodo),
      cuentaAnticipoId: input.cuentaAnticipoId,
      cuentaOrigenId: input.cuentaOrigenId,
      total,
      totalEmpleados: validos.length,
      estado: 'BORRADOR',
      modoAsiento: existente?.anticipo.modoAsiento ?? await this.getModoAsiento(),
      asientoId: null,
      asientoReversionId: null,
      comprobanteEntrega: existente?.anticipo.comprobanteEntrega ?? null,
      rolId: null,
      rolNumero: null,
      creadoEn: existente?.anticipo.creadoEn ?? timestamp,
      actualizadoEn: timestamp,
      registradoEn: null,
      descontadoEn: null,
      anuladoEn: null,
      confirmacionToken: null,
      confirmacionEn: null
    };

    const detallesUpdates: Record<string, AnticipoNominaDetalle> = {};
    for (const detalle of validos) {
      detallesUpdates[detalle.empleadoId] = {
        ...detalle,
        monto: this.roundToTwo(detalle.monto),
        observacion: detalle.observacion?.trim() || '',
        rolId: null,
        descontadoEn: null
      };
    }
    await update(ref(this.database, this.getNominaPath()), {
      [`anticipos/${id}`]: anticipo,
      [`anticiposDetalles/${id}`]: detallesUpdates
    });

    return id;
  }

  async actualizarBorrador(
    anticipoId: string,
    input: RegistrarAnticipoInput,
    detalles: AnticipoNominaDetalle[]
  ): Promise<string> {
    return this.guardarBorrador(input, detalles, anticipoId);
  }

  /** Vincula el unico respaldo consolidado. El archivo ya fue validado y subido por Archivos. */
  async adjuntarComprobanteEntrega(anticipoId: string, comprobante: ComprobanteEntregaAnticipo): Promise<void> {
    const resumen = await this.getAnticipoDetalle(anticipoId);
    if (!resumen || resumen.anticipo.estado !== 'BORRADOR') {
      throw new Error('El comprobante solo se puede cambiar mientras el anticipo esta en borrador.');
    }
    await update(ref(this.database, `${this.getNominaPath()}/anticipos/${anticipoId}`), {
      comprobanteEntrega: comprobante,
      actualizadoEn: Date.now()
    });
  }

  async removerComprobanteEntrega(anticipoId: string): Promise<void> {
    const resumen = await this.getAnticipoDetalle(anticipoId);
    if (!resumen || resumen.anticipo.estado !== 'BORRADOR') {
      throw new Error('El comprobante solo se puede cambiar mientras el anticipo esta en borrador.');
    }
    await update(ref(this.database, `${this.getNominaPath()}/anticipos/${anticipoId}`), {
      comprobanteEntrega: null,
      actualizadoEn: Date.now()
    });
  }

  /**
   * Confirma que el dinero salio. Un bloqueo transaccional evita dobles asientos y el vinculo por
   * origen permite terminar limpiamente un reintento si el asiento se creo antes de actualizar la
   * cabecera.
   */
  async confirmarEntrega(anticipoId: string, lineasConfirmadas?: AsientoContableLinea[]): Promise<string> {
    const token = `${this.authService.currentUser()?.uid ?? 'usuario'}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const cabeceraRef = ref(this.database, `${this.getNominaPath()}/anticipos/${anticipoId}`);
    const ahora = Date.now();
    const bloqueo = await runTransaction(cabeceraRef, (actual: AnticipoNomina | null) => {
      if (!actual || actual.estado === 'REGISTRADO' || actual.estado === 'DESCONTADO') {
        return;
      }
      if (actual.estado !== 'BORRADOR') {
        return;
      }
      const bloqueoVigente = !!actual.confirmacionToken
        && ahora - Number(actual.confirmacionEn ?? 0) < 5 * 60 * 1000;
      if (bloqueoVigente) {
        return;
      }
      return { ...actual, confirmacionToken: token, confirmacionEn: ahora };
    });

    if (!bloqueo.committed) {
      const actual = await this.getAnticipoDetalle(anticipoId);
      if (actual?.anticipo.estado === 'REGISTRADO' || actual?.anticipo.estado === 'DESCONTADO') {
        return anticipoId;
      }
      throw new Error('Otra sesion esta confirmando este anticipo. Espera un momento y vuelve a intentar.');
    }

    try {
      const resumen = await this.getAnticipoDetalle(anticipoId);
      if (!resumen || resumen.anticipo.confirmacionToken !== token) {
        throw new Error('No se pudo asegurar la confirmacion del anticipo.');
      }
      const anticipo = resumen.anticipo;
      const validos = resumen.detalles.filter((detalle) => this.roundToTwo(detalle.monto) > 0);
      if (!/^\d{4}-\d{2}$/.test(anticipo.periodo) || !anticipo.fecha || validos.length === 0) {
        throw new Error('El borrador esta incompleto. Revisa el periodo, la fecha y los empleados.');
      }
      await this.validarPeriodoDisponible(anticipo.periodo);

      const contabilidadActiva = await this.integracionContable.contabilidadActiva();
      if (contabilidadActiva && !lineasConfirmadas?.length) {
        throw new Error('Revisa y confirma el asiento antes de registrar la entrega.');
      }
      const modoAsiento = await this.getModoAsiento();
      let asientoId = await this.getAsientoIdPorOrigen(anticipoId);
      if (!asientoId && contabilidadActiva) {
        asientoId = await this.guardarAsiento(anticipo, anticipoId, lineasConfirmadas!, modoAsiento);
      }

      const registradoEn = Date.now();
      await update(cabeceraRef, {
        estado: 'REGISTRADO',
        modoAsiento,
        asientoId: asientoId ?? null,
        actualizadoEn: registradoEn,
        registradoEn,
        confirmacionToken: null,
        confirmacionEn: null
      });
      return anticipoId;
    } catch (error) {
      await runTransaction(cabeceraRef, (actual: AnticipoNomina | null) => {
        if (!actual || actual.confirmacionToken !== token || actual.estado !== 'BORRADOR') {
          return;
        }
        return { ...actual, confirmacionToken: null, confirmacionEn: null };
      });
      throw error;
    }
  }

  async descartarBorrador(anticipoId: string): Promise<void> {
    const resumen = await this.getAnticipoDetalle(anticipoId);
    if (!resumen || resumen.anticipo.estado !== 'BORRADOR') {
      throw new Error('Solo se pueden descartar anticipos en borrador.');
    }
    const timestamp = Date.now();
    await update(ref(this.database, `${this.getNominaPath()}/anticipos/${anticipoId}`), {
      estado: 'ANULADO',
      actualizadoEn: timestamp,
      anuladoEn: timestamp,
      confirmacionToken: null,
      confirmacionEn: null
    });
  }

  /** Camino compatible para consumidores anteriores: persiste primero y confirma el mismo ID. */
  async registrarAnticipo(
    input: RegistrarAnticipoInput,
    detalles: AnticipoNominaDetalle[],
    lineasConfirmadas?: AsientoContableLinea[]
  ): Promise<string> {
    const anticipoId = await this.guardarBorrador(input, detalles);
    await this.confirmarEntrega(anticipoId, lineasConfirmadas);

    return anticipoId;
  }

  /**
   * Anula un anticipo que todavia no se descontó, generando el asiento de reverso. Si ya se
   * descontó hay que reversar antes el rol, porque el rol aprobado ya acreditó la cuenta.
   */
  async anularAnticipo(anticipoId: string): Promise<void> {
    const resumen = await this.getAnticipoDetalle(anticipoId);
    if (!resumen) {
      throw new Error('El anticipo ya no existe.');
    }
    if (resumen.anticipo.estado === 'ANULADO') {
      throw new Error('El anticipo ya esta anulado.');
    }
    if (resumen.anticipo.estado === 'BORRADOR') {
      await this.descartarBorrador(anticipoId);
      return;
    }
    if (resumen.anticipo.estado === 'DESCONTADO') {
      throw new Error('El anticipo ya se descontó en un rol aprobado. Reversa primero el rol.');
    }

    const timestamp = Date.now();
    let asientoReversionId: string | null = null;

    if (resumen.anticipo.asientoId) {
      const original = await this.asientosService.getAsientoById(resumen.anticipo.asientoId);
      if (!original) {
        throw new Error('No se encontro el asiento original del anticipo para reversarlo.');
      }
      const reverso = this.asientosService.crearReverso(original);
      asientoReversionId = await this.asientosService.aprobarAsiento({
        ...reverso,
        glosa: `Reverso anticipo ${resumen.anticipo.numero}`,
        referencia: resumen.anticipo.numero,
        origen: 'REVERSO_ANTICIPO_NOMINA',
        origenTipo: 'REVERSO_ANTICIPO_NOMINA',
        origenId: anticipoId,
        origenNumero: resumen.anticipo.numero,
        origenModulo: 'NOMINA'
      });
      await this.asientosService.marcarReversado(resumen.anticipo.asientoId);
    }

    // Se libera el vinculo origen->asiento para que el anticipo pueda volver a registrarse limpio.
    await set(this.getAsientoOrigenRef('ANTICIPO_NOMINA', anticipoId), null);
    await update(ref(this.database, `${this.getNominaPath()}/anticipos/${anticipoId}`), {
      estado: 'ANULADO',
      asientoReversionId,
      actualizadoEn: timestamp,
      anuladoEn: timestamp
    });
  }

  /** Anticipos REGISTRADOS del periodo, sumados por empleado. Lo consume la generacion del rol. */
  async getPendientesPorEmpleado(periodo: string): Promise<Map<string, number>> {
    const pendientes = new Map<string, number>();
    for (const resumen of await this.getRegistradosDelPeriodo(periodo)) {
      for (const detalle of resumen.detalles) {
        const acumulado = pendientes.get(detalle.empleadoId) ?? 0;
        pendientes.set(detalle.empleadoId, this.roundToTwo(acumulado + detalle.monto));
      }
    }
    return pendientes;
  }

  /**
   * Marca como descontados los anticipos del periodo cuyos empleados conservan en el rol una linea
   * de anticipo que cubre el monto pendiente. Si el contador borró o redujo la linea a mano, el
   * anticipo sigue REGISTRADO y reaparece en el siguiente rol en lugar de perderse.
   */
  async marcarDescontados(periodo: string, cubiertoPorEmpleado: Map<string, number>, rol: RolPago): Promise<void> {
    const timestamp = Date.now();
    for (const resumen of await this.getRegistradosDelPeriodo(periodo)) {
      const anticipoId = resumen.anticipo.id ?? '';
      const empleadosCubiertos = resumen.detalles.filter((detalle) =>
        this.roundToTwo(cubiertoPorEmpleado.get(detalle.empleadoId) ?? 0) >= this.roundToTwo(detalle.monto)
      );
      if (empleadosCubiertos.length === 0) {
        continue;
      }

      const updates: Record<string, unknown> = {};
      for (const detalle of empleadosCubiertos) {
        updates[`${detalle.empleadoId}/rolId`] = rol.id ?? null;
        updates[`${detalle.empleadoId}/descontadoEn`] = timestamp;
      }
      await update(ref(this.database, `${this.getNominaPath()}/anticiposDetalles/${anticipoId}`), updates);

      // La cabecera pasa a DESCONTADO solo cuando todos sus empleados quedaron cubiertos.
      if (empleadosCubiertos.length === resumen.detalles.length) {
        await update(ref(this.database, `${this.getNominaPath()}/anticipos/${anticipoId}`), {
          estado: 'DESCONTADO',
          rolId: rol.id ?? null,
          rolNumero: rol.numero ?? null,
          actualizadoEn: timestamp,
          descontadoEn: timestamp
        });
      }
    }
  }

  /** Devuelve a REGISTRADO los anticipos descontados por un rol que se anuló o reversó. */
  async liberarDescontados(rolId: string, periodo: string): Promise<void> {
    const snapshot = await get(query(
      ref(this.database, `${this.getNominaPath()}/anticipos`),
      orderByChild('periodo'),
      equalTo(periodo)
    ));
    if (!snapshot.exists()) {
      return;
    }

    const raw = snapshot.val() as Record<string, AnticipoNomina>;
    const timestamp = Date.now();
    for (const [anticipoId, anticipo] of Object.entries(raw)) {
      if (anticipo.estado === 'ANULADO') {
        continue;
      }
      const detallesSnapshot = await get(ref(this.database, `${this.getNominaPath()}/anticiposDetalles/${anticipoId}`));
      const detalles = this.detallesDesdeSnapshot(detallesSnapshot.val());
      const afectados = detalles.filter((detalle) => detalle.rolId === rolId);
      if (afectados.length === 0) {
        continue;
      }

      const updates: Record<string, unknown> = {};
      for (const detalle of afectados) {
        updates[`${detalle.empleadoId}/rolId`] = null;
        updates[`${detalle.empleadoId}/descontadoEn`] = null;
      }
      await update(ref(this.database, `${this.getNominaPath()}/anticiposDetalles/${anticipoId}`), updates);
      await update(ref(this.database, `${this.getNominaPath()}/anticipos/${anticipoId}`), {
        estado: 'REGISTRADO',
        rolId: null,
        rolNumero: null,
        actualizadoEn: timestamp,
        descontadoEn: null
      });
    }
  }

  /** Documentos REGISTRADOS del periodo con sus detalles todavia pendientes de descuento. */
  private async getRegistradosDelPeriodo(periodo: string): Promise<ResumenAnticipoNomina[]> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/anticipos`));
    if (!snapshot.exists()) {
      return [];
    }

    const raw = snapshot.val() as Record<string, AnticipoNomina>;
    const resumenes: ResumenAnticipoNomina[] = [];
    for (const [id, anticipo] of Object.entries(raw)) {
      if (anticipo.periodo !== periodo || !anticipoAfectaNomina(anticipo.estado)) {
        continue;
      }
      const detallesSnapshot = await get(ref(this.database, `${this.getNominaPath()}/anticiposDetalles/${id}`));
      const detalles = this.detallesDesdeSnapshot(detallesSnapshot.val()).filter((detalle) => !detalle.rolId);
      if (detalles.length > 0) {
        resumenes.push({ anticipo: { ...anticipo, id }, detalles });
      }
    }
    return resumenes;
  }

  /**
   * Un rol mensual aprobado ya cerró el periodo: registrar un anticipo ahi dejaria un activo que
   * nadie descuenta. Con el rol en borrador si se permite, y el detalle del rol ofrece traerlo.
   */
  private async validarPeriodoDisponible(periodo: string): Promise<void> {
    const rol = await this.buscarRolMensual(periodo);
    if (rol?.estado === 'APROBADO') {
      throw new Error(`El rol mensual de ${periodo} ya esta aprobado: registra el anticipo en el siguiente periodo.`);
    }
  }

  /** Rol mensual vigente del periodo, si existe. Lo usa la pantalla para avisar antes de registrar. */
  async buscarRolMensual(periodo: string): Promise<RolPago | null> {
    const snapshot = await get(query(
      ref(this.database, `${this.getNominaPath()}/rolesPago`),
      orderByChild('periodo'),
      equalTo(periodo)
    ));
    if (!snapshot.exists()) {
      return null;
    }
    const raw = snapshot.val() as Record<string, RolPago>;
    const encontrado = Object.entries(raw)
      .map(([id, rol]) => ({ ...rol, id }))
      .find((rol) => (rol.tipo ?? 'MENSUAL') === 'MENSUAL' && rol.estado !== 'ANULADO');
    return encontrado ?? null;
  }

  /** Modo de asiento configurado en nomina; se lee directo para no depender de NominaService. */
  private async getModoAsiento(): Promise<ModoAsientoAutomatico> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/configuracion/modoAsiento`));
    return snapshot.val() === 'APROBADO' ? 'APROBADO' : 'BORRADOR';
  }

  private async getAsientoIdPorOrigen(anticipoId: string): Promise<string | null> {
    const snapshot = await get(this.getAsientoOrigenRef('ANTICIPO_NOMINA', anticipoId));
    const asientoId = snapshot.child('asientoId').val();
    return typeof asientoId === 'string' && asientoId ? asientoId : null;
  }

  private async guardarAsiento(
    anticipo: AnticipoNomina,
    anticipoId: string,
    lineas: AsientoContableLinea[],
    modoAsiento: AnticipoNomina['modoAsiento']
  ): Promise<string> {
    const asiento: AsientoContable = {
      fecha: anticipo.fecha,
      periodo: '',
      tipo: 'AJUSTE',
      glosa: `${anticipo.concepto} (${anticipo.totalEmpleados} empleado${anticipo.totalEmpleados === 1 ? '' : 's'})`,
      referencia: anticipo.numero,
      estado: 'BORRADOR',
      origen: 'ANTICIPO_NOMINA',
      origenTipo: 'ANTICIPO_NOMINA',
      origenId: anticipoId,
      origenNumero: anticipo.numero,
      origenModulo: 'NOMINA',
      lineas,
      totalDebe: 0,
      totalHaber: 0,
      diferencia: 0
    };

    const asientoId = modoAsiento === 'APROBADO'
      ? await this.asientosService.aprobarAsiento(asiento)
      : await this.asientosService.guardarBorrador(asiento);

    await set(this.getAsientoOrigenRef('ANTICIPO_NOMINA', anticipoId), {
      asientoId,
      origenTipo: 'ANTICIPO_NOMINA',
      origenId: anticipoId,
      origenNumero: anticipo.numero,
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

  private detallesDesdeSnapshot(value: unknown): AnticipoNominaDetalle[] {
    if (!value) {
      return [];
    }
    const raw = value as Record<string, AnticipoNominaDetalle>;
    return Object.entries(raw)
      .map(([empleadoId, detalle]) => ({ ...detalle, empleadoId }))
      .sort((a, b) => a.empleadoNombre.localeCompare(b.empleadoNombre));
  }

  private conceptoEfectivo(concepto: string, periodo: string): string {
    return concepto?.trim() || `Anticipo de sueldo ${periodo}`;
  }

  private getAsientoOrigenRef(origenTipo: 'ANTICIPO_NOMINA' | 'REVERSO_ANTICIPO_NOMINA', anticipoId: string) {
    return ref(this.database, `${this.getTenantPath()}/asientosOrigen/${origenTipo}/${anticipoId}`);
  }

  private async reservarNumero(anio: string): Promise<string> {
    const result = await runTransaction(
      ref(this.database, `${this.getNominaPath()}/secuencias/anticipos/${anio}`),
      (current: unknown) => (typeof current === 'number' ? current : 0) + 1
    );
    const secuencia = typeof result.snapshot.val() === 'number' ? Number(result.snapshot.val()) : 1;
    return `ANT-${anio}-${String(secuencia).padStart(5, '0')}`;
  }

  private roundToTwo(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}
