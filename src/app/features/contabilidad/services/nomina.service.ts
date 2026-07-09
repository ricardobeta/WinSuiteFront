import { Injectable, inject } from '@angular/core';
import { Database, get, limitToLast, onValue, orderByChild, push, query, ref, runTransaction, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { CampoPersonalizado } from '../../../shared/models/clientes.models';
import { AsientoContable, AsientoContableLinea, CuentaContable } from '../models/contabilidad.models';
import {
  ConfiguracionNominaContable,
  EmpleadoNomina,
  ResumenRolPago,
  RolPago,
  RolPagoDetalle,
  RolPagoLinea,
  RubroNomina
} from '../models/nomina.models';
import { AsientosContablesService } from './asientos-contables.service';
import { IntegracionContableService } from './integracion-contable.service';
import { PlanCuentasService } from './plan-cuentas.service';

@Injectable({
  providedIn: 'root'
})
export class NominaService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly asientosService = inject(AsientosContablesService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly integracionContable = inject(IntegracionContableService);

  private getTenantPath(): string {
    return `contabilidad/${this.authService.getTenantId()}`;
  }

  private getNominaPath(): string {
    return `nomina/${this.authService.getTenantId()}`;
  }

  getEmpleados(): Observable<EmpleadoNomina[]> {
    return new Observable<EmpleadoNomina[]>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, `${this.getNominaPath()}/empleados`),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, EmpleadoNomina>;
          subscriber.next(Object.entries(raw)
            .map(([id, empleado]) => ({ ...empleado, id }))
            .sort((a, b) => `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`)));
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async guardarEmpleado(empleado: EmpleadoNomina): Promise<string> {
    const timestamp = Date.now();
    const payload: EmpleadoNomina = {
      ...empleado,
      cedula: empleado.cedula.replace(/\D/g, '').slice(0, 10),
      nombres: empleado.nombres.trim(),
      apellidos: empleado.apellidos.trim(),
      email: empleado.email?.trim() ?? '',
      telefono: empleado.telefono?.trim() ?? '',
      cargo: empleado.cargo.trim(),
      departamento: empleado.departamento?.trim() ?? '',
      sueldoBase: this.roundToTwo(empleado.sueldoBase),
      estado: empleado.estado ?? 'ACTIVO',
      camposPersonalizados: empleado.camposPersonalizados ?? {},
      creadoEn: empleado.creadoEn ?? timestamp,
      actualizadoEn: timestamp
    };

    this.validarEmpleado(payload);
    const { id, ...data } = payload;
    if (id) {
      await set(ref(this.database, `${this.getNominaPath()}/empleados/${id}`), data);
      return id;
    }

    const empleadoRef = push(ref(this.database, `${this.getNominaPath()}/empleados`));
    await set(empleadoRef, data);
    return empleadoRef.key!;
  }

  async cambiarEstadoEmpleado(empleadoId: string, estado: EmpleadoNomina['estado']): Promise<void> {
    await update(ref(this.database, `${this.getNominaPath()}/empleados/${empleadoId}`), {
      estado,
      actualizadoEn: Date.now()
    });
  }

  async getEmpleadoById(empleadoId: string): Promise<EmpleadoNomina | null> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/empleados/${empleadoId}`));
    return snapshot.exists() ? { ...snapshot.val() as EmpleadoNomina, id: empleadoId } : null;
  }

  getConfiguracion(): Observable<ConfiguracionNominaContable> {
    return new Observable<ConfiguracionNominaContable>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, `${this.getNominaPath()}/configuracion`),
        (snapshot) => subscriber.next(snapshot.exists() ? this.normalizarConfiguracion(snapshot.val()) : this.getDefaultConfiguracion()),
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getConfiguracionOnce(): Promise<ConfiguracionNominaContable> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/configuracion`));
    return snapshot.exists() ? this.normalizarConfiguracion(snapshot.val()) : this.getDefaultConfiguracion();
  }

  async guardarConfiguracion(configuracion: ConfiguracionNominaContable): Promise<void> {
    await this.validarCuentasConfiguracion(configuracion);
    await set(ref(this.database, `${this.getNominaPath()}/configuracion`), {
      ...this.getDefaultConfiguracion(),
      ...configuracion,
      porcentajeAportePersonalIess: this.roundToFour(configuracion.porcentajeAportePersonalIess),
      porcentajeAportePatronalIess: this.roundToFour(configuracion.porcentajeAportePatronalIess),
      salarioBasicoUnificado: this.roundToTwo(configuracion.salarioBasicoUnificado),
      actualizadoEn: Date.now()
    });
  }

  async agregarCampo(campo: CampoPersonalizado): Promise<void> {
    const config = await this.getConfiguracionOnce();
    const camposPersonalizados = [...(config.camposPersonalizados ?? []), campo]
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    await this.guardarConfiguracionCampos({ ...config, camposPersonalizados });
  }

  async eliminarCampo(idCampo: string): Promise<void> {
    const config = await this.getConfiguracionOnce();
    const camposPersonalizados = (config.camposPersonalizados ?? []).filter((campo) => campo.idCampo !== idCampo);
    await this.guardarConfiguracionCampos({ ...config, camposPersonalizados });
  }

  private async guardarConfiguracionCampos(configuracion: ConfiguracionNominaContable): Promise<void> {
    await set(ref(this.database, `${this.getNominaPath()}/configuracion`), {
      ...this.getDefaultConfiguracion(),
      ...configuracion,
      camposPersonalizados: configuracion.camposPersonalizados ?? [],
      actualizadoEn: Date.now()
    });
  }

  getRubros(): Observable<RubroNomina[]> {
    return new Observable<RubroNomina[]>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, `${this.getNominaPath()}/rubros`),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, RubroNomina>;
          subscriber.next(Object.entries(raw)
            .map(([id, rubro]) => ({ ...rubro, id }))
            .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre)));
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getRubrosOnce(): Promise<RubroNomina[]> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/rubros`));
    if (!snapshot.exists()) {
      return [];
    }
    const raw = snapshot.val() as Record<string, RubroNomina>;
    return Object.entries(raw)
      .map(([id, rubro]) => ({ ...rubro, id }))
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre));
  }

  async guardarRubro(rubro: RubroNomina): Promise<string> {
    const timestamp = Date.now();
    const codigo = rubro.codigo.trim().toUpperCase();
    const nombre = rubro.nombre.trim();
    if (!codigo) {
      throw new Error('Ingresa el codigo del rubro.');
    }
    if (!nombre) {
      throw new Error('Ingresa el nombre del rubro.');
    }
    const modoCalculo = rubro.modoCalculo ?? 'MANUAL';
    if (modoCalculo !== 'MANUAL' && !(Number(rubro.valorReferencia) > 0)) {
      throw new Error('Ingresa un valor de referencia mayor a cero para el modo de calculo elegido.');
    }

    const payload: Omit<RubroNomina, 'id'> = {
      codigo,
      nombre,
      tipo: rubro.tipo === 'DESCUENTO' ? 'DESCUENTO' : 'INGRESO',
      afectaIess: rubro.tipo === 'INGRESO' ? !!rubro.afectaIess : false,
      modoCalculo,
      valorReferencia: modoCalculo === 'MANUAL' ? 0 : this.roundToTwo(rubro.valorReferencia ?? 0),
      cuentaContableId: rubro.cuentaContableId ?? '',
      sistema: !!rubro.sistema,
      activo: rubro.activo ?? true,
      orden: rubro.orden ?? 0,
      creadoEn: rubro.creadoEn ?? timestamp,
      actualizadoEn: timestamp
    };

    if (rubro.id) {
      await set(ref(this.database, `${this.getNominaPath()}/rubros/${rubro.id}`), payload);
      return rubro.id;
    }

    const rubroRef = push(ref(this.database, `${this.getNominaPath()}/rubros`));
    await set(rubroRef, payload);
    return rubroRef.key!;
  }

  async eliminarRubro(rubroId: string): Promise<void> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/rubros/${rubroId}`));
    if (snapshot.exists() && (snapshot.val() as RubroNomina).sistema) {
      throw new Error('Los rubros del sistema no se pueden eliminar.');
    }
    await set(ref(this.database, `${this.getNominaPath()}/rubros/${rubroId}`), null);
  }

  async sembrarRubrosPorDefecto(): Promise<void> {
    const existentes = await this.getRubrosOnce();
    if (existentes.length > 0) {
      return;
    }
    const timestamp = Date.now();
    const base: Array<Omit<RubroNomina, 'id'>> = [
      { codigo: 'HEXTRA', nombre: 'Horas extra', tipo: 'INGRESO', afectaIess: true, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 1 },
      { codigo: 'COMIS', nombre: 'Comisiones', tipo: 'INGRESO', afectaIess: true, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 2 },
      { codigo: 'BONO', nombre: 'Bono', tipo: 'INGRESO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 3 },
      { codigo: 'OTROSING', nombre: 'Otros ingresos', tipo: 'INGRESO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 4 },
      { codigo: 'ANTIC', nombre: 'Anticipo', tipo: 'DESCUENTO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 5 },
      { codigo: 'PREST', nombre: 'Cuota prestamo', tipo: 'DESCUENTO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 6 },
      { codigo: 'MULTA', nombre: 'Multa', tipo: 'DESCUENTO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 7 },
      { codigo: 'OTROSDES', nombre: 'Otros descuentos', tipo: 'DESCUENTO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 8 }
    ];
    const updates: Record<string, Omit<RubroNomina, 'id'>> = {};
    for (const rubro of base) {
      const rubroRef = push(ref(this.database, `${this.getNominaPath()}/rubros`));
      updates[rubroRef.key!] = { ...rubro, sistema: false, creadoEn: timestamp, actualizadoEn: timestamp };
    }
    await update(ref(this.database, `${this.getNominaPath()}/rubros`), updates);
  }

  getRolesPago(): Observable<RolPago[]> {
    return new Observable<RolPago[]>((subscriber) => {
      const unsubscribe = onValue(
        query(
          ref(this.database, `${this.getNominaPath()}/rolesPago`),
          orderByChild('periodo'),
          limitToLast(120)
        ),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const raw = snapshot.val() as Record<string, RolPago>;
          subscriber.next(Object.entries(raw)
            .map(([id, rol]) => ({ ...rol, id }))
            .sort((a, b) => b.periodo.localeCompare(a.periodo) || (b.numero ?? '').localeCompare(a.numero ?? '')));
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getRolPagoDetalle(rolId: string): Promise<ResumenRolPago | null> {
    const rolSnapshot = await get(ref(this.database, `${this.getNominaPath()}/rolesPago/${rolId}`));
    if (!rolSnapshot.exists()) {
      return null;
    }

    const detallesSnapshot = await get(ref(this.database, `${this.getNominaPath()}/rolesPagoDetalles/${rolId}`));
    const detallesRaw = detallesSnapshot.exists() ? detallesSnapshot.val() as Record<string, RolPagoDetalle> : {};
    return {
      rol: { ...rolSnapshot.val() as RolPago, id: rolId },
      detalles: Object.values(detallesRaw)
        .map((detalle) => this.normalizarDetalle(detalle))
        .sort((a, b) => a.empleadoNombre.localeCompare(b.empleadoNombre))
    };
  }

  private normalizarDetalle(detalle: RolPagoDetalle): RolPagoDetalle {
    if (Array.isArray(detalle.lineas) && detalle.lineas.length > 0) {
      return { ...detalle, lineas: detalle.lineas };
    }

    // Rol legacy sin lineas: derivar lineas desde los campos fijos.
    const lineas: RolPagoLinea[] = [
      this.crearLineaSueldo(detalle.sueldoBase)
    ];
    if (detalle.ingresosAdicionales > 0) {
      lineas.push({ rubroId: '', codigo: 'INGADIC', nombre: 'Ingresos adicionales', tipo: 'INGRESO', afectaIess: true, cuentaContableId: '', monto: detalle.ingresosAdicionales, origen: 'RUBRO', editable: true });
    }
    const descuentoManual = this.roundToTwo((detalle.anticipos ?? 0) + (detalle.prestamos ?? 0) + (detalle.otrosDescuentos ?? 0));
    if (descuentoManual > 0) {
      lineas.push({ rubroId: '', codigo: 'DESCUENTO', nombre: 'Descuentos', tipo: 'DESCUENTO', afectaIess: false, cuentaContableId: '', monto: descuentoManual, origen: 'RUBRO', editable: true });
    }
    if (detalle.aportePersonalIess > 0) {
      lineas.push({ rubroId: '', codigo: 'IESS', nombre: 'Aporte personal IESS', tipo: 'DESCUENTO', afectaIess: false, cuentaContableId: '', monto: detalle.aportePersonalIess, origen: 'SISTEMA', editable: false });
    }
    return { ...detalle, lineas };
  }

  async generarRolPago(periodo: string, fechaPago: string): Promise<string> {
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      throw new Error('Selecciona un periodo valido para generar el rol.');
    }
    if (!fechaPago) {
      throw new Error('Selecciona la fecha de pago.');
    }

    const existente = await this.buscarRolPorPeriodo(periodo);
    if (existente) {
      throw new Error(`Ya existe un rol de pago para ${periodo}.`);
    }

    const config = await this.getConfiguracionOnce();
    const empleados = await this.getEmpleadosOnce();
    const activos = empleados.filter((empleado) => empleado.estado === 'ACTIVO');
    if (activos.length === 0) {
      throw new Error('No hay empleados activos para generar el rol.');
    }

    const rubros = await this.getRubrosOnce();
    const rubrosAutomaticos = rubros.filter((rubro) => rubro.activo && rubro.modoCalculo !== 'MANUAL');
    const detalles = activos.map((empleado) => this.calcularDetalle(empleado, rubrosAutomaticos, config));
    const timestamp = Date.now();
    const rol: RolPago = {
      periodo,
      fechaPago,
      estado: 'BORRADOR',
      modoAsiento: config.modoAsiento,
      numero: await this.reservarNumero(periodo.slice(0, 4)),
      ...this.calcularTotales(detalles),
      totalEmpleados: detalles.length,
      asientoId: null,
      creadoEn: timestamp,
      actualizadoEn: timestamp,
      aprobadoEn: null,
      anuladoEn: null
    };

    const rolRef = push(ref(this.database, `${this.getNominaPath()}/rolesPago`));
    await set(rolRef, rol);
    const detallesUpdates: Record<string, RolPagoDetalle> = {};
    for (const detalle of detalles) {
      detallesUpdates[detalle.id] = detalle;
    }
    await set(ref(this.database, `${this.getNominaPath()}/rolesPagoDetalles/${rolRef.key}`), detallesUpdates);
    return rolRef.key!;
  }

  async actualizarDetallesRol(rolId: string, detalles: RolPagoDetalle[]): Promise<void> {
    const rolSnapshot = await get(ref(this.database, `${this.getNominaPath()}/rolesPago/${rolId}`));
    if (!rolSnapshot.exists()) {
      throw new Error('El rol de pago ya no existe.');
    }
    const rol = rolSnapshot.val() as RolPago;
    if (rol.estado !== 'BORRADOR') {
      throw new Error('Solo se puede editar un rol en estado borrador.');
    }

    const config = await this.getConfiguracionOnce();
    const recalculados = detalles.map((detalle) => this.recalcularDetalle(detalle, config));
    const detallesUpdates: Record<string, RolPagoDetalle> = {};
    for (const detalle of recalculados) {
      detallesUpdates[detalle.id] = detalle;
    }
    await set(ref(this.database, `${this.getNominaPath()}/rolesPagoDetalles/${rolId}`), detallesUpdates);
    await update(ref(this.database, `${this.getNominaPath()}/rolesPago/${rolId}`), {
      ...this.calcularTotales(recalculados),
      totalEmpleados: recalculados.length,
      actualizadoEn: Date.now()
    });
  }

  async aprobarRolPago(rolId: string): Promise<void> {
    const resumen = await this.getRolPagoDetalle(rolId);
    if (!resumen) {
      throw new Error('El rol de pago ya no existe.');
    }
    if (resumen.rol.estado === 'ANULADO') {
      throw new Error('No se puede aprobar un rol anulado.');
    }

    const asientoExistente = await get(this.getAsientoOrigenRef(rolId));
    if (asientoExistente.exists()) {
      await update(ref(this.database, `${this.getNominaPath()}/rolesPago/${rolId}`), {
        estado: 'APROBADO',
        asientoId: String(asientoExistente.val()?.asientoId ?? ''),
        actualizadoEn: Date.now(),
        aprobadoEn: Date.now()
      });
      return;
    }

    const config = await this.getConfiguracionOnce();

    // Gate de contabilidad: si está desactivada, el rol se aprueba sin generar asiento.
    if (!(await this.integracionContable.contabilidadActiva())) {
      await update(ref(this.database, `${this.getNominaPath()}/rolesPago/${rolId}`), {
        estado: 'APROBADO',
        asientoId: null,
        actualizadoEn: Date.now(),
        aprobadoEn: Date.now()
      });
      return;
    }

    const contexto = await this.crearContexto(config);
    const asiento = this.crearAsientoRol(resumen.rol, resumen.detalles, config, contexto);
    const asientoId = config.modoAsiento === 'APROBADO'
      ? await this.asientosService.aprobarAsiento(asiento)
      : await this.asientosService.guardarBorrador(asiento);

    await set(this.getAsientoOrigenRef(rolId), {
      asientoId,
      origenTipo: 'ROL_PAGO',
      origenId: rolId,
      origenNumero: resumen.rol.numero ?? null,
      creadoEn: Date.now()
    });
    await update(ref(this.database, `${this.getNominaPath()}/rolesPago/${rolId}`), {
      estado: 'APROBADO',
      modoAsiento: config.modoAsiento,
      asientoId,
      actualizadoEn: Date.now(),
      aprobadoEn: Date.now()
    });
  }

  async anularRolPago(rolId: string): Promise<void> {
    const resumen = await this.getRolPagoDetalle(rolId);
    if (!resumen) {
      return;
    }
    if (resumen.rol.estado === 'APROBADO') {
      throw new Error('El rol aprobado debe reversarse contablemente antes de anularse.');
    }
    await update(ref(this.database, `${this.getNominaPath()}/rolesPago/${rolId}`), {
      estado: 'ANULADO',
      actualizadoEn: Date.now(),
      anuladoEn: Date.now()
    });
  }

  getDefaultConfiguracion(): ConfiguracionNominaContable {
    return {
      modoAsiento: 'BORRADOR',
      porcentajeAportePersonalIess: 9.45,
      porcentajeAportePatronalIess: 11.15,
      salarioBasicoUnificado: 0,
      provisionarDecimoTercero: true,
      provisionarDecimoCuarto: false,
      provisionarFondosReserva: false,
      provisionarVacaciones: true,
      cuentaGastoSueldosId: '',
      cuentaGastoBeneficiosSocialesId: '',
      cuentaGastoAportePatronalId: '',
      cuentaSueldosPorPagarId: '',
      cuentaIessPorPagarId: '',
      cuentaAnticiposEmpleadosId: '',
      cuentaPrestamosEmpleadosId: '',
      cuentaDecimosPorPagarId: '',
      cuentaFondosReservaPorPagarId: '',
      cuentaVacacionesPorPagarId: '',
      camposPersonalizados: []
    };
  }

  private async getEmpleadosOnce(): Promise<EmpleadoNomina[]> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/empleados`));
    if (!snapshot.exists()) {
      return [];
    }
    const raw = snapshot.val() as Record<string, EmpleadoNomina>;
    return Object.entries(raw).map(([id, empleado]) => ({ ...empleado, id }));
  }

  private async buscarRolPorPeriodo(periodo: string): Promise<RolPago | null> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/rolesPago`));
    if (!snapshot.exists()) {
      return null;
    }
    const raw = snapshot.val() as Record<string, RolPago>;
    const match = Object.entries(raw).find(([, rol]) => rol.periodo === periodo && rol.estado !== 'ANULADO');
    return match ? { ...match[1], id: match[0] } : null;
  }

  private crearLineaSueldo(sueldoBase: number): RolPagoLinea {
    return {
      rubroId: '',
      codigo: 'SUELDO',
      nombre: 'Sueldo base',
      tipo: 'INGRESO',
      afectaIess: true,
      cuentaContableId: '',
      monto: this.roundToTwo(sueldoBase),
      origen: 'SUELDO',
      editable: false
    };
  }

  private calcularDetalle(empleado: EmpleadoNomina, rubrosAutomaticos: RubroNomina[], config: ConfiguracionNominaContable): RolPagoDetalle {
    const sueldoBase = this.roundToTwo(empleado.sueldoBase);
    const lineas: RolPagoLinea[] = [this.crearLineaSueldo(sueldoBase)];

    for (const rubro of rubrosAutomaticos) {
      const monto = rubro.modoCalculo === 'PORCENTAJE_SUELDO'
        ? this.roundToTwo(sueldoBase * (Number(rubro.valorReferencia ?? 0) / 100))
        : this.roundToTwo(Number(rubro.valorReferencia ?? 0));
      if (monto <= 0) {
        continue;
      }
      lineas.push({
        rubroId: rubro.id ?? '',
        codigo: rubro.codigo,
        nombre: rubro.nombre,
        tipo: rubro.tipo,
        afectaIess: rubro.tipo === 'INGRESO' ? !!rubro.afectaIess : false,
        cuentaContableId: rubro.cuentaContableId ?? '',
        monto,
        origen: 'RUBRO',
        editable: true
      });
    }

    const detalleBase: RolPagoDetalle = {
      id: empleado.id ?? `emp_${Date.now()}`,
      empleadoId: empleado.id ?? '',
      empleadoNombre: `${empleado.apellidos} ${empleado.nombres}`.trim(),
      cargo: empleado.cargo,
      sueldoBase,
      lineas,
      ingresosAdicionales: 0,
      aportePersonalIess: 0,
      aportePatronalIess: 0,
      anticipos: 0,
      prestamos: 0,
      otrosDescuentos: 0,
      decimoTerceroProvision: 0,
      decimoCuartoProvision: 0,
      fondosReservaProvision: 0,
      vacacionesProvision: 0,
      totalIngresos: 0,
      totalDescuentos: 0,
      totalBeneficios: 0,
      netoPagar: 0
    };
    return this.recalcularDetalle(detalleBase, config);
  }

  /**
   * Recalcula IESS, provisiones y totales a partir de las lineas editables del detalle.
   * Se usa tanto al generar el rol como al guardar ediciones del borrador.
   */
  recalcularDetalle(detalle: RolPagoDetalle, config: ConfiguracionNominaContable): RolPagoDetalle {
    const sueldoLinea = detalle.lineas.find((linea) => linea.origen === 'SUELDO');
    const sueldoBase = this.roundToTwo(sueldoLinea?.monto ?? detalle.sueldoBase);

    // Lineas editables/base, excluyendo la linea de sistema (IESS) que se regenera aqui.
    const lineasNegocio = detalle.lineas
      .filter((linea) => linea.origen !== 'SISTEMA')
      .map((linea) => ({ ...linea, monto: this.roundToTwo(linea.monto) }));

    const ingresos = lineasNegocio.filter((linea) => linea.tipo === 'INGRESO');
    const descuentosManuales = lineasNegocio.filter((linea) => linea.tipo === 'DESCUENTO');

    const totalIngresos = this.roundToTwo(ingresos.reduce((total, linea) => total + linea.monto, 0));
    const baseIess = this.roundToTwo(ingresos.filter((linea) => linea.afectaIess).reduce((total, linea) => total + linea.monto, 0));
    const aportePersonalIess = this.roundToTwo(baseIess * (config.porcentajeAportePersonalIess / 100));
    const aportePatronalIess = this.roundToTwo(baseIess * (config.porcentajeAportePatronalIess / 100));

    const decimoTerceroProvision = config.provisionarDecimoTercero ? this.roundToTwo(totalIngresos / 12) : 0;
    const decimoCuartoProvision = config.provisionarDecimoCuarto && config.salarioBasicoUnificado > 0 ? this.roundToTwo(config.salarioBasicoUnificado / 12) : 0;
    const fondosReservaProvision = config.provisionarFondosReserva ? this.roundToTwo(totalIngresos * 0.0833) : 0;
    const vacacionesProvision = config.provisionarVacaciones ? this.roundToTwo(totalIngresos / 24) : 0;
    const totalBeneficios = this.roundToTwo(decimoTerceroProvision + decimoCuartoProvision + fondosReservaProvision + vacacionesProvision);

    const totalDescuentosManuales = this.roundToTwo(descuentosManuales.reduce((total, linea) => total + linea.monto, 0));
    const totalDescuentos = this.roundToTwo(aportePersonalIess + totalDescuentosManuales);

    const lineaIess: RolPagoLinea = {
      rubroId: '',
      codigo: 'IESS',
      nombre: 'Aporte personal IESS',
      tipo: 'DESCUENTO',
      afectaIess: false,
      cuentaContableId: config.cuentaIessPorPagarId ?? '',
      monto: aportePersonalIess,
      origen: 'SISTEMA',
      editable: false
    };
    const lineas = aportePersonalIess > 0 ? [...lineasNegocio, lineaIess] : [...lineasNegocio];

    return {
      ...detalle,
      sueldoBase,
      lineas,
      ingresosAdicionales: this.roundToTwo(totalIngresos - sueldoBase),
      aportePersonalIess,
      aportePatronalIess,
      anticipos: 0,
      prestamos: 0,
      otrosDescuentos: totalDescuentosManuales,
      decimoTerceroProvision,
      decimoCuartoProvision,
      fondosReservaProvision,
      vacacionesProvision,
      totalIngresos,
      totalDescuentos,
      totalBeneficios,
      netoPagar: this.roundToTwo(totalIngresos - totalDescuentos)
    };
  }

  private calcularTotales(detalles: RolPagoDetalle[]): Omit<RolPago, 'periodo' | 'fechaPago' | 'estado' | 'modoAsiento' | 'totalEmpleados'> {
    return {
      totalIngresos: this.roundToTwo(detalles.reduce((total, d) => total + d.totalIngresos, 0)),
      totalAportePersonalIess: this.roundToTwo(detalles.reduce((total, d) => total + d.aportePersonalIess, 0)),
      totalAportePatronalIess: this.roundToTwo(detalles.reduce((total, d) => total + d.aportePatronalIess, 0)),
      totalAnticipos: this.roundToTwo(detalles.reduce((total, d) => total + d.anticipos, 0)),
      totalPrestamos: this.roundToTwo(detalles.reduce((total, d) => total + d.prestamos, 0)),
      totalOtrosDescuentos: this.roundToTwo(detalles.reduce((total, d) => total + d.otrosDescuentos, 0)),
      totalBeneficios: this.roundToTwo(detalles.reduce((total, d) => total + d.totalBeneficios, 0)),
      totalNetoPagar: this.roundToTwo(detalles.reduce((total, d) => total + d.netoPagar, 0))
    };
  }

  private async crearContexto(config: ConfiguracionNominaContable) {
    await this.validarCuentasConfiguracion(config);
    const cuentas = await this.planCuentasService.getCuentasOnce();
    return new Map(cuentas.map((cuenta) => [cuenta.id ?? '', cuenta]));
  }

  private crearAsientoRol(
    rol: RolPago,
    detalles: RolPagoDetalle[],
    config: ConfiguracionNominaContable,
    cuentasPorId: Map<string, CuentaContable>
  ): AsientoContable {
    const lineas: AsientoContableLinea[] = [];
    const totals = this.calcularTotales(detalles);
    const decimos = this.roundToTwo(detalles.reduce((total, d) => total + d.decimoTerceroProvision + d.decimoCuartoProvision, 0));
    const fondos = this.roundToTwo(detalles.reduce((total, d) => total + d.fondosReservaProvision, 0));
    const vacaciones = this.roundToTwo(detalles.reduce((total, d) => total + d.vacacionesProvision, 0));

    // Gasto sueldos e ingresos: agrupados por cuenta contable del rubro (fallback a gasto sueldos).
    const gastoIngresosPorCuenta = this.agruparLineasPorCuenta(
      detalles,
      (linea) => linea.tipo === 'INGRESO',
      config.cuentaGastoSueldosId
    );
    for (const [cuentaId, monto] of gastoIngresosPorCuenta) {
      this.addLinea(lineas, cuentasPorId, cuentaId, 'Gasto sueldos y salarios', monto, 0);
    }

    this.addLinea(lineas, cuentasPorId, config.cuentaGastoAportePatronalId, 'Aporte patronal IESS', totals.totalAportePatronalIess, 0);
    this.addLinea(lineas, cuentasPorId, config.cuentaGastoBeneficiosSocialesId, 'Provision beneficios sociales', totals.totalBeneficios, 0);

    this.addLinea(lineas, cuentasPorId, config.cuentaSueldosPorPagarId, 'Sueldos por pagar', 0, totals.totalNetoPagar);
    this.addLinea(lineas, cuentasPorId, config.cuentaIessPorPagarId, 'IESS por pagar', 0, this.roundToTwo(totals.totalAportePersonalIess + totals.totalAportePatronalIess));

    // Descuentos manuales (anticipos, prestamos, multas, etc.): agrupados por cuenta del rubro
    // (fallback a la cuenta de anticipos empleados).
    const descuentosPorCuenta = this.agruparLineasPorCuenta(
      detalles,
      (linea) => linea.tipo === 'DESCUENTO' && linea.origen === 'RUBRO',
      config.cuentaAnticiposEmpleadosId
    );
    for (const [cuentaId, monto] of descuentosPorCuenta) {
      this.addLinea(lineas, cuentasPorId, cuentaId, 'Descuentos a empleados', 0, monto);
    }

    this.addLinea(lineas, cuentasPorId, config.cuentaDecimosPorPagarId, 'Decimos por pagar', 0, decimos);
    this.addLinea(lineas, cuentasPorId, config.cuentaFondosReservaPorPagarId, 'Fondos de reserva por pagar', 0, fondos);
    this.addLinea(lineas, cuentasPorId, config.cuentaVacacionesPorPagarId, 'Vacaciones por pagar', 0, vacaciones);

    return {
      fecha: rol.fechaPago,
      periodo: '',
      tipo: 'AJUSTE',
      glosa: `Rol de pago ${rol.periodo}`,
      referencia: rol.numero ?? rol.periodo,
      estado: 'BORRADOR',
      origen: 'ROL_PAGO',
      origenTipo: 'ROL_PAGO',
      origenId: rol.id ?? null,
      origenNumero: rol.numero ?? rol.periodo,
      origenModulo: 'NOMINA',
      lineas,
      totalDebe: 0,
      totalHaber: 0,
      diferencia: 0
    };
  }

  private agruparLineasPorCuenta(
    detalles: RolPagoDetalle[],
    filtro: (linea: RolPagoLinea) => boolean,
    cuentaFallbackId: string
  ): Map<string, number> {
    const porCuenta = new Map<string, number>();
    for (const detalle of detalles) {
      for (const linea of detalle.lineas ?? []) {
        if (!filtro(linea)) {
          continue;
        }
        const cuentaId = linea.cuentaContableId || cuentaFallbackId;
        porCuenta.set(cuentaId, this.roundToTwo((porCuenta.get(cuentaId) ?? 0) + linea.monto));
      }
    }
    return porCuenta;
  }

  private addLinea(
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
    if (!cuenta) {
      throw new Error(`Falta configurar la cuenta para ${descripcion}.`);
    }
    this.validarCuentaMovimiento(cuenta, descripcion);
    lineas.push({
      id: `lin_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      cuentaId,
      codigoCuenta: cuenta.codigo,
      nombreCuenta: cuenta.nombre,
      descripcion,
      debe: debeNormalizado,
      haber: haberNormalizado
    });
  }

  private async validarCuentasConfiguracion(config: ConfiguracionNominaContable): Promise<void> {
    const cuentas = await this.planCuentasService.getCuentasOnce();
    const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id ?? '', cuenta]));
    const obligatorias: Array<[string, string]> = [
      [config.cuentaGastoSueldosId, 'gasto sueldos'],
      [config.cuentaGastoBeneficiosSocialesId, 'gasto beneficios sociales'],
      [config.cuentaGastoAportePatronalId, 'gasto aporte patronal'],
      [config.cuentaSueldosPorPagarId, 'sueldos por pagar'],
      [config.cuentaIessPorPagarId, 'IESS por pagar'],
      [config.cuentaAnticiposEmpleadosId, 'anticipos empleados'],
      [config.cuentaPrestamosEmpleadosId, 'prestamos empleados'],
      [config.cuentaDecimosPorPagarId, 'decimos por pagar'],
      [config.cuentaFondosReservaPorPagarId, 'fondos reserva por pagar'],
      [config.cuentaVacacionesPorPagarId, 'vacaciones por pagar']
    ];
    for (const [cuentaId, nombre] of obligatorias) {
      if (!cuentaId) {
        throw new Error(`Falta configurar la cuenta de ${nombre}.`);
      }
      const cuenta = cuentasPorId.get(cuentaId);
      if (!cuenta) {
        throw new Error(`La cuenta configurada para ${nombre} no existe.`);
      }
      this.validarCuentaMovimiento(cuenta, nombre);
    }
  }

  private validarCuentaMovimiento(cuenta: CuentaContable, nombre: string): void {
    if (cuenta.estado !== 'ACTIVA' || !cuenta.permiteMovimiento) {
      throw new Error(`La cuenta de ${nombre} debe estar activa y permitir movimiento.`);
    }
  }

  private getAsientoOrigenRef(rolId: string) {
    return ref(this.database, `${this.getTenantPath()}/asientosOrigen/ROL_PAGO/${rolId}`);
  }

  private async reservarNumero(anio: string): Promise<string> {
    const contadorRef = ref(this.database, `${this.getNominaPath()}/secuencias/rolesPago/${anio}`);
    const result = await runTransaction(contadorRef, (current: unknown) => {
      const actual = typeof current === 'number' ? current : 0;
      return actual + 1;
    });
    const secuencia = typeof result.snapshot.val() === 'number' ? Number(result.snapshot.val()) : 1;
    return `NOM-${anio}-${String(secuencia).padStart(5, '0')}`;
  }

  private normalizarConfiguracion(value: unknown): ConfiguracionNominaContable {
    const raw = value as Partial<ConfiguracionNominaContable> | null;
    return {
      ...this.getDefaultConfiguracion(),
      ...raw,
      modoAsiento: raw?.modoAsiento ?? 'BORRADOR',
      camposPersonalizados: this.normalizarCampos(raw?.camposPersonalizados)
    };
  }

  private normalizarCampos(value: unknown): CampoPersonalizado[] {
    const campos = Array.isArray(value) ? value as CampoPersonalizado[] : [];
    return campos
      .filter((campo) => !!campo?.idCampo && !!campo?.nombreMostrar && !!campo?.tipo)
      .map((campo) => ({
        idCampo: campo.idCampo,
        nombreMostrar: campo.nombreMostrar,
        tipo: campo.tipo,
        requerido: campo.requerido,
        orden: campo.orden,
        visibleEnLista: campo.visibleEnLista,
        activo: campo.activo,
        opciones: Array.isArray(campo.opciones)
          ? campo.opciones
            .filter((opcion) => opcion && opcion.clave !== undefined && opcion.valor !== undefined)
            .map((opcion) => ({ clave: opcion.clave, valor: opcion.valor }))
          : undefined
      }));
  }

  private validarEmpleado(empleado: EmpleadoNomina): void {
    if (!/^\d{10}$/.test(empleado.cedula)) {
      throw new Error('Ingresa una cedula valida de 10 digitos.');
    }
    if (!empleado.nombres || !empleado.apellidos) {
      throw new Error('Ingresa nombres y apellidos del empleado.');
    }
    if (!empleado.cargo) {
      throw new Error('Ingresa el cargo del empleado.');
    }
    if (!empleado.fechaIngreso) {
      throw new Error('Ingresa la fecha de ingreso.');
    }
    if (empleado.sueldoBase <= 0) {
      throw new Error('El sueldo base debe ser mayor a cero.');
    }
  }

  private roundToTwo(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private roundToFour(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000;
  }
}
