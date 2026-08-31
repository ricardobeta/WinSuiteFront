import { Injectable, inject } from '@angular/core';
import { Database, get, limitToLast, onValue, orderByChild, push, query, ref, runTransaction, set, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { AuditService } from '../../../core/services/audit.service';
import { CampoPersonalizado } from '../../../shared/models/clientes.models';
import {
  AnticipoNomina,
  AnticipoNominaDetalle,
  CambioPeriodoAnticipoResultado,
  RolSincronizadoCambioPeriodo
} from '../models/anticipos-nomina.models';
import { AsientoContable, AsientoContableLinea, CuentaContable, TipoCuenta } from '../models/contabilidad.models';
import {
  AcumuladoEmpleado,
  AporteAcumuladoNomina,
  CargoNomina,
  CausalTerminacionNomina,
  ConceptoProvision,
  ConfiguracionNominaContable,
  CuentaNominaKey,
  DepartamentoNomina,
  DesgloseProvisiones,
  DesgloseProvisionesEmpleado,
  EmpleadoNomina,
  LiquidacionEmpleado,
  LiquidacionNomina,
  MotivoSalidaNomina,
  RepartoUtilidades,
  RepartoUtilidadesEmpleado,
  RubroLiquidacion,
  SaldoInicialLaboralEmpleado,
  SaldoProvisionEmpleado,
  PreparacionNomina,
  RequisitoNomina,
  ResultadoImportacionCatalogosNomina,
  ResumenRolPago,
  RolPago,
  RolPagoDetalle,
  RegionNomina,
  RolPagoLinea,
  RubroNomina,
  TipoRolNomina,
  VistaPreviaImportacionCatalogosNomina
} from '../models/nomina.models';
import { AnticiposNominaService } from './anticipos-nomina.service';
import { PagosNominaService } from './pagos-nomina.service';
import { AsientosContablesService } from './asientos-contables.service';
import { ConfiguracionContableService } from './configuracion-contable.service';
import { IntegracionContableService } from './integracion-contable.service';
import {
  PORCENTAJE_CCC_DEFECTO,
  TasasIess,
  calcularAportesIess,
  calcularDiasFondosReservaPeriodo,
  calcularDiasTrabajadosPeriodo,
  calcularDevengadosLegales,
  calcularProporcionalMensual
} from './nomina-calculos.util';
import { PlanCuentasService } from './plan-cuentas.service';
import { construirPartidasLiquidacion, construirPartidasRolMensual } from './nomina-asiento.util';
import {
  normalizarNombreCatalogoNomina,
  prepararVistaPreviaCatalogosNomina,
  valoresUnicosCatalogoNomina
} from './nomina-catalogos.util';
import {
  calcularDiasFondosReservaHastaSalida,
  calcularDiasTrabajadosHastaSalida,
  calcularIndemnizacionesLiquidacion,
  normalizarCausalTerminacion
} from './nomina-liquidacion.util';

/** Valida la unica mutacion admitida sobre un anticipo ya entregado. */
export function validarCambioPeriodoAnticipo(
  anticipo: Pick<AnticipoNomina, 'estado' | 'periodo'>,
  nuevoPeriodo: string
): string {
  const normalizado = (nuevoPeriodo ?? '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalizado)) {
    throw new Error('Selecciona un periodo valido en formato AAAA-MM.');
  }
  if (anticipo.estado !== 'REGISTRADO') {
    throw new Error('Solo se puede cambiar el periodo de un anticipo registrado y pendiente de descuento.');
  }
  if (anticipo.periodo === normalizado) {
    throw new Error('El nuevo periodo debe ser diferente del periodo actual.');
  }
  return normalizado;
}

/** Mueve los montos del documento entre mapas agregados sin alterar sus detalles congelados. */
export function prepararPendientesReprogramados(
  pendientesAnterior: ReadonlyMap<string, number>,
  pendientesDestino: ReadonlyMap<string, number>,
  detalles: readonly AnticipoNominaDetalle[]
): { anterior: Map<string, number>; destino: Map<string, number> } {
  const anterior = new Map(pendientesAnterior);
  const destino = new Map(pendientesDestino);
  const movidos = new Map<string, number>();
  const redondear = (valor: number) => Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
  for (const detalle of detalles) {
    movidos.set(detalle.empleadoId, redondear((movidos.get(detalle.empleadoId) ?? 0) + Number(detalle.monto ?? 0)));
  }
  for (const [empleadoId, monto] of movidos) {
    const restante = redondear((anterior.get(empleadoId) ?? 0) - monto);
    if (restante > 0) {
      anterior.set(empleadoId, restante);
    } else {
      anterior.delete(empleadoId);
    }
    destino.set(empleadoId, redondear((destino.get(empleadoId) ?? 0) + monto));
  }
  return { anterior, destino };
}

/** Sustituye cualquier agregado ANTIC anterior por la linea autoritativa del periodo. */
export function reemplazarLineaAnticipoRol(
  detalle: RolPagoDetalle,
  lineaAnticipo: RolPagoLinea | null
): RolPagoDetalle {
  const restantes = (detalle.lineas ?? [])
    .filter((linea) => linea.codigo !== NominaService.CODIGO_RUBRO_ANTICIPO)
    .map((linea) => ({ ...linea }));
  return { ...detalle, lineas: lineaAnticipo ? [...restantes, lineaAnticipo] : restantes };
}

/** Patch minimo de cabecera: deliberadamente no incluye fecha, asiento, monto ni concepto. */
export function construirPatchCambioPeriodoAnticipo(
  anticipoId: string,
  periodo: string,
  timestamp: number,
  usuarioId: string
): Record<string, unknown> {
  return {
    [`anticipos/${anticipoId}/periodo`]: periodo,
    [`anticipos/${anticipoId}/actualizadoEn`]: timestamp,
    [`anticipos/${anticipoId}/actualizadoPor`]: usuarioId,
    [`anticipos/${anticipoId}/ultimaAccion`]: 'actualizar'
  };
}

@Injectable({
  providedIn: 'root'
})
export class NominaService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly audit = inject(AuditService);
  private readonly asientosService = inject(AsientosContablesService);
  private readonly planCuentasService = inject(PlanCuentasService);
  private readonly integracionContable = inject(IntegracionContableService);
  private readonly configuracionContable = inject(ConfiguracionContableService);
  private readonly anticiposService = inject(AnticiposNominaService);
  private readonly pagosService = inject(PagosNominaService);

  /** Codigo del rubro de anticipo: es la bisagra entre el auxiliar de anticipos y el rol. */
  static readonly CODIGO_RUBRO_ANTICIPO = 'ANTIC';

  /**
   * Palabras clave por cuenta, en orden de preferencia y acotadas al tipo contable correcto.
   * Gana la primera cuenta cuyo nombre contenga todos los terminos del patron.
   */
  private readonly patronesCuentas: Array<{ key: CuentaNominaKey; tipos: TipoCuenta[]; patrones: string[][] }> = [
    { key: 'cuentaGastoSueldosId', tipos: ['GASTO', 'COSTO'], patrones: [['sueldo', 'administrativ'], ['gasto', 'sueldo'], ['mano de obra'], ['remuneracion'], ['sueldo']] },
    { key: 'cuentaGastoBeneficiosSocialesId', tipos: ['GASTO', 'COSTO'], patrones: [['beneficio', 'social'], ['provision'], ['decimo']] },
    { key: 'cuentaGastoDecimoTerceroId', tipos: ['GASTO', 'COSTO'], patrones: [['decimo', 'tercer'], ['decimo', 'tercero'], ['beneficio', 'social']] },
    { key: 'cuentaGastoDecimoCuartoId', tipos: ['GASTO', 'COSTO'], patrones: [['decimo', 'cuart'], ['decimo', 'cuarto'], ['beneficio', 'social']] },
    { key: 'cuentaGastoFondosReservaId', tipos: ['GASTO', 'COSTO'], patrones: [['fondo', 'reserva'], ['beneficio', 'social']] },
    { key: 'cuentaGastoVacacionesId', tipos: ['GASTO', 'COSTO'], patrones: [['vacacion'], ['beneficio', 'social']] },
    { key: 'cuentaGastoAportePatronalId', tipos: ['GASTO', 'COSTO'], patrones: [['aporte', 'patronal'], ['iess'], ['seguridad', 'social'], ['beneficio', 'social']] },
    { key: 'cuentaGastoDesahucioId', tipos: ['GASTO', 'COSTO'], patrones: [['desahucio'], ['indemnizacion'], ['beneficio', 'social']] },
    { key: 'cuentaGastoIndemnizacionId', tipos: ['GASTO', 'COSTO'], patrones: [['indemnizacion', 'laboral'], ['indemnizacion'], ['beneficio', 'social']] },
    { key: 'cuentaSueldosPorPagarId', tipos: ['PASIVO'], patrones: [['sueldo', 'por pagar'], ['remuneracion', 'por pagar'], ['nomina', 'por pagar']] },
    { key: 'cuentaIessPorPagarId', tipos: ['PASIVO'], patrones: [['iess', 'por pagar'], ['iess'], ['seguridad', 'social']] },
    { key: 'cuentaBeneficiosSocialesPorPagarId', tipos: ['PASIVO'], patrones: [['beneficio', 'social', 'por pagar'], ['beneficio', 'por pagar']] },
    { key: 'cuentaAnticiposEmpleadosId', tipos: ['ACTIVO'], patrones: [['anticipo', 'empleado'], ['anticipo', 'personal'], ['anticipo', 'sueldo'], ['anticipo']] },
    { key: 'cuentaPrestamosEmpleadosId', tipos: ['ACTIVO'], patrones: [['prestamo', 'empleado'], ['prestamo', 'personal'], ['prestamo']] },
    { key: 'cuentaDecimosPorPagarId', tipos: ['PASIVO'], patrones: [['decimo', 'por pagar'], ['decimo'], ['beneficio', 'social']] },
    { key: 'cuentaDecimoTerceroPorPagarId', tipos: ['PASIVO'], patrones: [['decimo', 'tercer', 'por pagar'], ['decimo', 'tercero']] },
    { key: 'cuentaDecimoCuartoPorPagarId', tipos: ['PASIVO'], patrones: [['decimo', 'cuart', 'por pagar'], ['decimo', 'cuarto']] },
    { key: 'cuentaFondosReservaPorPagarId', tipos: ['PASIVO'], patrones: [['fondo', 'reserva'], ['beneficio', 'social']] },
    { key: 'cuentaVacacionesPorPagarId', tipos: ['PASIVO'], patrones: [['vacacion'], ['beneficio', 'social']] },
    { key: 'cuentaUtilidadesPorPagarId', tipos: ['PASIVO'], patrones: [['utilidad', 'por pagar'], ['participacion', 'trabajador'], ['utilidad'], ['beneficio', 'social']] },
    { key: 'cuentaLiquidacionesPorPagarId', tipos: ['PASIVO'], patrones: [['liquidacion', 'por pagar'], ['finiquito', 'por pagar'], ['sueldo', 'por pagar']] }
  ];

  private getTenantPath(): string {
    return `contabilidad/${this.authService.getTenantId()}`;
  }

  private getNominaPath(): string {
    return `nomina/${this.authService.getTenantId()}`;
  }

  getCargos(): Observable<CargoNomina[]> {
    return this.observarCatalogo<CargoNomina>('cargos');
  }

  getDepartamentos(): Observable<DepartamentoNomina[]> {
    return this.observarCatalogo<DepartamentoNomina>('departamentos');
  }

  async getCargosOnce(): Promise<CargoNomina[]> {
    return this.leerCatalogo<CargoNomina>('cargos');
  }

  async getDepartamentosOnce(): Promise<DepartamentoNomina[]> {
    return this.leerCatalogo<DepartamentoNomina>('departamentos');
  }

  async guardarCargo(cargo: CargoNomina): Promise<string> {
    const nombre = cargo.nombre.trim();
    if (!nombre) {
      throw new Error('Ingresa el nombre del cargo.');
    }
    await this.validarNombreCatalogoUnico('cargos', nombre, cargo.id);
    if (cargo.cuentaGastoSueldosId) {
      const cuenta = (await this.planCuentasService.getCuentasOnce())
        .find((item) => item.id === cargo.cuentaGastoSueldosId);
      if (!cuenta) {
        throw new Error('La cuenta de sueldos seleccionada ya no existe.');
      }
      this.validarCuentaMovimiento(cuenta, `sueldos del cargo ${nombre}`);
    }

    const timestamp = Date.now();
    const id = cargo.id ?? push(ref(this.database, `${this.getNominaPath()}/cargos`)).key!;
    await set(ref(this.database, `${this.getNominaPath()}/cargos/${id}`), {
      nombre,
      cuentaGastoSueldosId: cargo.cuentaGastoSueldosId || '',
      activo: cargo.activo ?? true,
      creadoEn: cargo.creadoEn ?? timestamp,
      actualizadoEn: timestamp
    });
    await this.sincronizarNombreCatalogoEnEmpleados('cargoId', id, 'cargo', nombre);
    return id;
  }

  async guardarDepartamento(departamento: DepartamentoNomina): Promise<string> {
    const nombre = departamento.nombre.trim();
    if (!nombre) {
      throw new Error('Ingresa el nombre del departamento.');
    }
    await this.validarNombreCatalogoUnico('departamentos', nombre, departamento.id);
    const timestamp = Date.now();
    const id = departamento.id ?? push(ref(this.database, `${this.getNominaPath()}/departamentos`)).key!;
    await set(ref(this.database, `${this.getNominaPath()}/departamentos/${id}`), {
      nombre,
      activo: departamento.activo ?? true,
      creadoEn: departamento.creadoEn ?? timestamp,
      actualizadoEn: timestamp
    });
    await this.sincronizarNombreCatalogoEnEmpleados('departamentoId', id, 'departamento', nombre);
    return id;
  }

  async cambiarEstadoCargo(cargoId: string, activo: boolean): Promise<void> {
    await update(ref(this.database, `${this.getNominaPath()}/cargos/${cargoId}`), {
      activo,
      actualizadoEn: Date.now()
    });
  }

  async cambiarEstadoDepartamento(departamentoId: string, activo: boolean): Promise<void> {
    await update(ref(this.database, `${this.getNominaPath()}/departamentos/${departamentoId}`), {
      activo,
      actualizadoEn: Date.now()
    });
  }

  async prepararImportacionCatalogos(): Promise<VistaPreviaImportacionCatalogosNomina> {
    const [empleados, cargos, departamentos] = await Promise.all([
      this.getEmpleadosOnce(),
      this.getCargosOnce(),
      this.getDepartamentosOnce()
    ]);
    return prepararVistaPreviaCatalogosNomina(empleados, cargos, departamentos);
  }

  async importarCatalogosExistentes(): Promise<ResultadoImportacionCatalogosNomina> {
    const [empleados, cargos, departamentos] = await Promise.all([
      this.getEmpleadosOnce(),
      this.getCargosOnce(),
      this.getDepartamentosOnce()
    ]);
    const timestamp = Date.now();
    const updates: Record<string, unknown> = {};
    const cargosPorNombre = new Map(cargos.map((item) => [normalizarNombreCatalogoNomina(item.nombre), item.id!]));
    const departamentosPorNombre = new Map(departamentos.map((item) => [normalizarNombreCatalogoNomina(item.nombre), item.id!]));
    let cargosCreados = 0;
    let departamentosCreados = 0;

    for (const nombre of valoresUnicosCatalogoNomina(empleados.map((item) => item.cargo))) {
      const clave = normalizarNombreCatalogoNomina(nombre);
      if (cargosPorNombre.has(clave)) {
        continue;
      }
      const id = push(ref(this.database, `${this.getNominaPath()}/cargos`)).key!;
      cargosPorNombre.set(clave, id);
      updates[`${this.getNominaPath()}/cargos/${id}`] = {
        nombre,
        cuentaGastoSueldosId: '',
        activo: true,
        creadoEn: timestamp,
        actualizadoEn: timestamp
      };
      cargosCreados += 1;
    }

    for (const nombre of valoresUnicosCatalogoNomina(empleados.map((item) => item.departamento ?? ''))) {
      const clave = normalizarNombreCatalogoNomina(nombre);
      if (departamentosPorNombre.has(clave)) {
        continue;
      }
      const id = push(ref(this.database, `${this.getNominaPath()}/departamentos`)).key!;
      departamentosPorNombre.set(clave, id);
      updates[`${this.getNominaPath()}/departamentos/${id}`] = {
        nombre,
        activo: true,
        creadoEn: timestamp,
        actualizadoEn: timestamp
      };
      departamentosCreados += 1;
    }

    let empleadosVinculados = 0;
    for (const empleado of empleados) {
      if (!empleado.id) {
        continue;
      }
      let vinculado = false;
      if (!empleado.cargoId && empleado.cargo?.trim()) {
        const cargoId = cargosPorNombre.get(normalizarNombreCatalogoNomina(empleado.cargo));
        if (cargoId) {
          updates[`${this.getNominaPath()}/empleados/${empleado.id}/cargoId`] = cargoId;
          vinculado = true;
        }
      }
      if (!empleado.departamentoId && empleado.departamento?.trim()) {
        const departamentoId = departamentosPorNombre.get(normalizarNombreCatalogoNomina(empleado.departamento));
        if (departamentoId) {
          updates[`${this.getNominaPath()}/empleados/${empleado.id}/departamentoId`] = departamentoId;
          vinculado = true;
        }
      }
      if (vinculado) {
        updates[`${this.getNominaPath()}/empleados/${empleado.id}/actualizadoEn`] = timestamp;
        empleadosVinculados += 1;
      }
    }

    if (Object.keys(updates).length > 0) {
      await update(ref(this.database), updates);
    }
    return { cargosCreados, departamentosCreados, empleadosVinculados };
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
    if (!empleado.cargoId) {
      throw new Error('Selecciona un cargo parametrizado para el empleado.');
    }
    const [cargos, departamentos] = await Promise.all([this.getCargosOnce(), this.getDepartamentosOnce()]);
    const cargo = cargos.find((item) => item.id === empleado.cargoId);
    if (!cargo) {
      throw new Error('El cargo seleccionado ya no existe.');
    }
    const departamento = empleado.departamentoId
      ? departamentos.find((item) => item.id === empleado.departamentoId)
      : undefined;
    if (empleado.departamentoId && !departamento) {
      throw new Error('El departamento seleccionado ya no existe.');
    }
    const payload: EmpleadoNomina = {
      ...empleado,
      cedula: empleado.cedula.replace(/\D/g, '').slice(0, 10),
      nombres: empleado.nombres.trim(),
      apellidos: empleado.apellidos.trim(),
      email: empleado.email?.trim() ?? '',
      telefono: empleado.telefono?.trim() ?? '',
      cargoId: cargo.id,
      cargo: cargo.nombre,
      departamentoId: departamento?.id ?? '',
      departamento: departamento?.nombre ?? '',
      sueldoBase: this.roundToTwo(empleado.sueldoBase),
      estado: empleado.estado ?? 'ACTIVO',
      modoDecimoTercero: empleado.modoDecimoTercero ?? 'ACUMULADO',
      modoDecimoCuarto: empleado.modoDecimoCuarto ?? 'ACUMULADO',
      modoFondosReserva: empleado.modoFondosReserva ?? 'ACUMULADO',
      regimenFondosReserva: empleado.regimenFondosReserva === 'CONSTRUCCION'
        || empleado.regimenFondosReserva === 'SERVICIOS_COMPLEMENTARIOS'
        ? empleado.regimenFondosReserva
        : 'GENERAL',
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

  async getSaldoInicialLaboral(empleadoId: string): Promise<SaldoInicialLaboralEmpleado | null> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/saldosInicialesLaborales/${empleadoId}`));
    return snapshot.exists() ? this.normalizarSaldoInicial(empleadoId, snapshot.val()) : null;
  }

  async guardarSaldoInicialLaboral(saldo: SaldoInicialLaboralEmpleado): Promise<void> {
    const empleado = await this.getEmpleadoById(saldo.empleadoId);
    if (!empleado) throw new Error('El empleado ya no existe.');
    if (!saldo.fechaCorte || saldo.fechaCorte < empleado.fechaIngreso) {
      throw new Error('La fecha de corte debe ser igual o posterior al ingreso del empleado.');
    }
    const normalizado = this.normalizarSaldoInicial(saldo.empleadoId, saldo);
    const tieneValores = normalizado.decimoTerceroPendiente > 0
      || normalizado.decimoCuartoPendiente > 0
      || normalizado.fondosReservaPendiente > 0
      || normalizado.diasVacacionesPendientes > 0
      || normalizado.valorVacacionesPendiente > 0;
    if (!tieneValores && !normalizado.confirmadoSinSaldos) {
      throw new Error('Confirma expresamente que el empleado no tiene saldos anteriores.');
    }
    const timestamp = Date.now();
    await set(ref(this.database, `${this.getNominaPath()}/saldosInicialesLaborales/${saldo.empleadoId}`), {
      ...normalizado,
      creadoEn: saldo.creadoEn ?? timestamp,
      actualizadoEn: timestamp
    });
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

  /**
   * Guarda la configuracion permitiendo avance parcial: solo se validan las cuentas que el
   * contador ya eligio. La exigencia de tenerlas todas se aplica al aprobar el rol, que es
   * cuando realmente se necesitan para armar el asiento.
   */
  async guardarConfiguracion(configuracion: ConfiguracionNominaContable): Promise<void> {
    await this.validarCuentasSeleccionadas(configuracion);
    await set(ref(this.database, `${this.getNominaPath()}/configuracion`), {
      ...this.getDefaultConfiguracion(),
      ...configuracion,
      porcentajeAportePersonalIess: this.roundToFour(configuracion.porcentajeAportePersonalIess),
      porcentajeAportePatronalIess: this.roundToFour(configuracion.porcentajeAportePatronalIess),
      porcentajeContribucionCcc: this.roundToFour(configuracion.porcentajeContribucionCcc),
      salarioBasicoUnificado: this.roundToTwo(configuracion.salarioBasicoUnificado),
      actualizadoEn: Date.now()
    });
  }

  /**
   * Propone una cuenta del plan para cada casilla vacia, buscando por palabras clave dentro
   * del tipo contable que corresponde. Nunca pisa una cuenta ya elegida ni guarda por su
   * cuenta: devuelve la propuesta para que el contador la revise y confirme.
   */
  async sugerirCuentas(actual: ConfiguracionNominaContable): Promise<{ configuracion: ConfiguracionNominaContable; asignadas: number }> {
    const cuentas = (await this.planCuentasService.getCuentasOnce())
      .filter((cuenta) => cuenta.estado === 'ACTIVA' && cuenta.permiteMovimiento);
    const configuracion: ConfiguracionNominaContable = { ...actual };
    let asignadas = 0;

    for (const regla of this.patronesCuentas) {
      if (configuracion[regla.key]) {
        continue;
      }
      const candidatas = cuentas.filter((cuenta) => regla.tipos.includes(cuenta.tipo));
      const elegida = this.buscarCuentaPorPatrones(candidatas, regla.patrones);
      if (elegida?.id) {
        configuracion[regla.key] = elegida.id;
        asignadas += 1;
      }
    }

    return { configuracion, asignadas };
  }

  /**
   * Evalua todos los requisitos para generar un rol de una sola pasada y sin lanzar errores,
   * para que el contador vea el checklist completo antes de intentar generar en lugar de
   * chocar con un error tardio al aprobar.
   */
  async evaluarPreparacion(periodo: string): Promise<PreparacionNomina> {
    // Siembra idempotente: sin rubros el editor del rol queda sin nada que agregar, y hasta ahora
    // solo se sembraban si el contador entraba a la pagina de Rubros y lo pedia a mano.
    await this.sembrarRubrosPorDefecto().catch(() => undefined);

    const [config, rubros, empleados, cuentas] = await Promise.all([
      this.getConfiguracionOnce(),
      this.getRubrosOnce(),
      this.getEmpleadosOnce(),
      this.planCuentasService.getCuentasOnce()
    ]);
    const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id ?? '', cuenta]));

    const cuentasFaltantes = this.etiquetasCuentas
      .filter(([key]) => {
        const cuenta = cuentasPorId.get(config[key]);
        return !cuenta || cuenta.estado !== 'ACTIVA' || !cuenta.permiteMovimiento;
      })
      .map(([, nombre]) => nombre);

    const activos = empleados.filter((empleado) =>
      empleado.estado === 'ACTIVO' && calcularDiasTrabajadosPeriodo(empleado.fechaIngreso, periodo) > 0
    );
    const rubrosActivos = rubros.filter((rubro) => rubro.activo);
    const rutaConfiguracion = '/workspace/contabilidad/configuracion';
    const paramsConfiguracion = { tab: 'integraciones', panel: 'nomina' };

    // El SBU es la base del decimo cuarto: hace falta tanto si la empresa lo provisiona como si
    // algun trabajador lo mensualiza, porque en ambos casos hay que devengarlo.
    const mensualizanDecimoCuarto = activos.filter(
      (empleado) => (empleado.modoDecimoCuarto ?? config.modoDecimos) === 'MENSUALIZADO'
    ).length;
    const requiereSbu = config.provisionarDecimoCuarto || mensualizanDecimoCuarto > 0;
    const iessDefinido = config.porcentajeAportePersonalIess > 0 && config.porcentajeAportePatronalIess > 0;
    const faltaSbu = requiereSbu && config.salarioBasicoUnificado <= 0;

    const requisitos: RequisitoNomina[] = [
      {
        item: 'CUENTAS',
        etiqueta: 'Cuentas contables de nomina',
        ok: cuentasFaltantes.length === 0,
        // Informativo: configurarlas de antemano ahorra trabajo, pero el rol se genera igual y las
        // cuentas que falten se eligen en el dialogo de revision del asiento al aprobar.
        bloqueante: false,
        detalle: cuentasFaltantes.length === 0
          ? 'Las 10 cuentas estan configuradas y permiten movimiento.'
          : `Sin configurar: ${cuentasFaltantes.join(', ')}. Puedes generar el rol igual y elegirlas al revisar el asiento.`,
        rutaResolver: rutaConfiguracion,
        queryParams: paramsConfiguracion
      },
      {
        item: 'REGLAS',
        etiqueta: 'Porcentajes IESS y provisiones',
        ok: iessDefinido && !faltaSbu,
        detalle: !iessDefinido
          ? 'Define los porcentajes de aporte personal y patronal del IESS.'
          : faltaSbu
            ? (config.provisionarDecimoCuarto
              ? 'Provisionas decimo cuarto pero falta el salario basico unificado.'
              : `${mensualizanDecimoCuarto} empleado(s) mensualizan el decimo cuarto y falta el salario basico unificado: se les pagaria cero.`)
            : `Aporte personal ${config.porcentajeAportePersonalIess}%, patronal ${config.porcentajeAportePatronalIess}% y CCC ${this.tasasIess(config).ccc}%.`,
        rutaResolver: rutaConfiguracion,
        queryParams: paramsConfiguracion
      },
      {
        item: 'RUBROS',
        etiqueta: 'Rubros de ingresos y descuentos',
        ok: rubrosActivos.length > 0,
        detalle: rubrosActivos.length > 0
          ? `${rubrosActivos.length} rubros activos disponibles.`
          : 'Sin rubros activos no podras agregar horas extra ni descuentos al rol.',
        rutaResolver: '/workspace/contabilidad/nomina/rubros'
      },
      {
        item: 'EMPLEADOS',
        etiqueta: 'Empleados activos',
        ok: activos.length > 0,
        detalle: activos.length > 0
          ? `${activos.length} empleados con días trabajados entrarán al rol.`
          : 'No hay empleados activos con días trabajados en el período seleccionado.',
        rutaResolver: '/workspace/contabilidad/nomina/empleados'
      },
      await this.evaluarPeriodo(periodo)
    ];

    // Solo los requisitos bloqueantes deciden si se puede generar; el resto queda como aviso.
    return {
      listo: requisitos.every((requisito) => requisito.ok || requisito.bloqueante === false),
      requisitos
    };
  }

  private async evaluarPeriodo(periodo: string): Promise<RequisitoNomina> {
    const requisito: RequisitoNomina = {
      item: 'PERIODO',
      etiqueta: 'Periodo contable abierto',
      ok: true,
      detalle: `El periodo ${periodo} acepta movimientos.`,
      rutaResolver: '/workspace/contabilidad/configuracion',
      queryParams: { tab: 'periodos' }
    };

    // Si la contabilidad esta desactivada el rol se aprueba sin asiento, asi que el periodo no aplica.
    if (!(await this.integracionContable.contabilidadActiva())) {
      return { ...requisito, detalle: 'La contabilidad automatica esta desactivada: el rol se aprobara sin asiento.' };
    }

    try {
      await this.configuracionContable.validarPeriodoParaMovimiento(`${periodo}-01`);
      return requisito;
    } catch (error) {
      return {
        ...requisito,
        ok: false,
        detalle: error instanceof Error ? error.message : `No se pudo validar el periodo ${periodo}.`
      };
    }
  }

  private buscarCuentaPorPatrones(cuentas: CuentaContable[], patrones: string[][]): CuentaContable | null {
    for (const patron of patrones) {
      const match = cuentas.find((cuenta) => {
        const nombre = this.normalizarTexto(cuenta.nombre);
        return patron.every((termino) => nombre.includes(termino));
      });
      if (match) {
        return match;
      }
    }
    return null;
  }

  private normalizarTexto(value: string): string {
    return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
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
      incluyeBaseIndemnizacion: rubro.tipo === 'INGRESO'
        ? (rubro.incluyeBaseIndemnizacion ?? !!rubro.afectaIess)
        : false,
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
      { codigo: 'HEXTRA25', nombre: 'Horas suplementarias (recargo 25%)', tipo: 'INGRESO', afectaIess: true, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 1 },
      { codigo: 'HEXTRA50', nombre: 'Horas suplementarias nocturnas (recargo 50%)', tipo: 'INGRESO', afectaIess: true, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 2 },
      { codigo: 'HEXTRA100', nombre: 'Horas extraordinarias (recargo 100%)', tipo: 'INGRESO', afectaIess: true, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 3 },
      { codigo: 'COMIS', nombre: 'Comisiones', tipo: 'INGRESO', afectaIess: true, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 4 },
      { codigo: 'BONO', nombre: 'Bono', tipo: 'INGRESO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 5 },
      { codigo: 'FRESERVA', nombre: 'Fondos de reserva mensualizados', tipo: 'INGRESO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 6 },
      { codigo: 'D13MENS', nombre: 'Decimo tercero mensualizado', tipo: 'INGRESO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 7 },
      { codigo: 'D14MENS', nombre: 'Decimo cuarto mensualizado', tipo: 'INGRESO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 8 },
      { codigo: 'OTROSING', nombre: 'Otros ingresos', tipo: 'INGRESO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 9 },
      { codigo: 'ANTIC', nombre: 'Anticipo de sueldo', tipo: 'DESCUENTO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 10 },
      { codigo: 'PREST', nombre: 'Cuota prestamo empresa', tipo: 'DESCUENTO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 11 },
      { codigo: 'IESSQUIRO', nombre: 'Prestamo quirografario IESS', tipo: 'DESCUENTO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 12 },
      { codigo: 'IMPRENTA', nombre: 'Retencion impuesto a la renta', tipo: 'DESCUENTO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 13 },
      { codigo: 'MULTA', nombre: 'Multa', tipo: 'DESCUENTO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 14 },
      { codigo: 'OTROSDES', nombre: 'Otros descuentos', tipo: 'DESCUENTO', afectaIess: false, modoCalculo: 'MANUAL', valorReferencia: 0, cuentaContableId: '', activo: true, orden: 15 }
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
            .map(([id, rol]) => this.normalizarRol(rol, id))
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
      rol: this.normalizarRol(rolSnapshot.val() as RolPago, rolId),
      detalles: Object.values(detallesRaw)
        .map((detalle) => this.normalizarDetalle(detalle))
        .sort((a, b) => a.empleadoNombre.localeCompare(b.empleadoNombre))
    };
  }

  /** Los roles guardados antes de existir los tipos de rol se leen como MENSUAL. */
  private normalizarRol(rol: RolPago, id: string): RolPago {
    return { ...rol, id, tipo: rol.tipo ?? 'MENSUAL' };
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

    const existente = await this.buscarRolPorPeriodo(periodo, 'MENSUAL');
    if (existente) {
      throw new Error(`Ya existe un rol de pago mensual para ${periodo}.`);
    }

    const [config, empleados, cargos, departamentos] = await Promise.all([
      this.getConfiguracionOnce(),
      this.getEmpleadosOnce(),
      this.getCargosOnce(),
      this.getDepartamentosOnce()
    ]);
    const activos = empleados.filter((empleado) =>
      empleado.estado === 'ACTIVO' && calcularDiasTrabajadosPeriodo(empleado.fechaIngreso, periodo) > 0
    );
    if (activos.length === 0) {
      throw new Error('No hay empleados activos con días trabajados en el período seleccionado.');
    }

    const rubros = await this.getRubrosOnce();
    const rubrosAutomaticos = rubros.filter((rubro) => rubro.activo && rubro.modoCalculo !== 'MANUAL');
    // Los anticipos entregados durante el periodo se descuentan integramente en este rol.
    const anticipos = await this.anticiposService.getPendientesPorEmpleado(periodo);
    const rubroAnticipo = rubros.find((rubro) => rubro.codigo === NominaService.CODIGO_RUBRO_ANTICIPO) ?? null;
    const cargosPorId = new Map(cargos.map((cargo) => [cargo.id ?? '', cargo]));
    const cargosPorNombre = new Map(cargos.map((cargo) => [normalizarNombreCatalogoNomina(cargo.nombre), cargo]));
    const departamentosPorId = new Map(departamentos.map((departamento) => [departamento.id ?? '', departamento]));
    const detalles = activos.map((empleado) => this.calcularDetalle(
      empleado,
      rubrosAutomaticos,
      config,
      periodo,
      this.crearLineaAnticipo(anticipos.get(empleado.id ?? '') ?? 0, rubroAnticipo, config),
      cargosPorId.get(empleado.cargoId ?? '')
        ?? cargosPorNombre.get(normalizarNombreCatalogoNomina(empleado.cargo ?? '')),
      departamentosPorId.get(empleado.departamentoId ?? '')
    ));
    return this.persistirRol('MENSUAL', periodo, fechaPago, detalles, config);
  }

  /**
   * Rol de pago de decimo tercero o cuarto. Paga lo acumulado en el periodo de calculo legal, que no
   * coincide con el año calendario: D13 va de diciembre a noviembre y D14 depende de la region
   * (Sierra ago-jul, Costa mar-feb). Los montos salen del historial de acumulados, no de una formula
   * sobre el sueldo actual, para que un cambio de sueldo a mitad de año no distorsione lo ya ganado.
   */
  async generarRolDecimos(tipo: 'DECIMO_TERCERO' | 'DECIMO_CUARTO', periodo: string, fechaPago: string): Promise<string> {
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      throw new Error('Selecciona un periodo valido para generar el rol.');
    }
    if (!fechaPago) {
      throw new Error('Selecciona la fecha de pago.');
    }

    const existente = await this.buscarRolPorPeriodo(periodo, tipo);
    if (existente) {
      throw new Error(`Ya existe un rol de ${this.etiquetasTipoRol[tipo].toLowerCase()} para ${periodo}.`);
    }

    const config = await this.getConfiguracionOnce();
    if (config.modoDecimos === 'MENSUALIZADO') {
      throw new Error('Los decimos estan configurados como mensualizados: ya se pagan en cada rol mensual.');
    }

    const meses = this.mesesPeriodoDecimo(tipo, periodo, config.region);
    const acumulados = await this.getAportesEnMeses(meses);
    const empleados = new Map((await this.getEmpleadosOnce()).map((empleado) => [empleado.id ?? '', empleado]));

    const detalles: RolPagoDetalle[] = [];
    for (const [empleadoId, aportes] of acumulados) {
      const empleado = empleados.get(empleadoId);
      const monto = this.roundToTwo(aportes.reduce(
        (total, aporte) => total + (tipo === 'DECIMO_TERCERO' ? aporte.decimoTerceroProvision : aporte.decimoCuartoProvision),
        0
      ));
      if (monto <= 0) {
        continue;
      }

      const nombre = empleado
        ? `${empleado.apellidos} ${empleado.nombres}`.trim()
        : 'Empleado retirado';
      detalles.push(this.detalleConceptoUnico(
        empleadoId,
        nombre,
        empleado?.cargo ?? '',
        tipo === 'DECIMO_TERCERO' ? 'D13' : 'D14',
        `${this.etiquetasTipoRol[tipo]} ${meses[0]} a ${meses[meses.length - 1]}`,
        monto,
        ''
      ));
    }

    if (detalles.length === 0) {
      throw new Error(`No hay provisiones acumuladas de ${this.etiquetasTipoRol[tipo].toLowerCase()} para ${meses[0]} a ${meses[meses.length - 1]}.`);
    }

    return this.persistirRol(tipo, periodo, fechaPago, detalles, config);
  }

  /**
   * Meses del periodo de calculo legal que termina en el periodo de pago indicado.
   * D13: diciembre a noviembre. D14: Sierra agosto-julio, Costa marzo-febrero.
   */
  private mesesPeriodoDecimo(tipo: 'DECIMO_TERCERO' | 'DECIMO_CUARTO', periodoPago: string, region: RegionNomina): string[] {
    const mesFin = tipo === 'DECIMO_TERCERO' ? 11 : (region === 'COSTA' ? 2 : 7);
    const anioPago = Number(periodoPago.slice(0, 4));
    const mesPago = Number(periodoPago.slice(5, 7));
    // Si el pago ocurre antes del cierre del ciclo, el ciclo que se liquida es el del año anterior.
    const anioFin = mesPago >= mesFin ? anioPago : anioPago - 1;

    const meses: string[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const fecha = new Date(anioFin, mesFin - 1 - i, 1);
      meses.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`);
    }
    return meses;
  }

  /** Aportes de roles MENSUALES aprobados dentro de los meses indicados, agrupados por empleado. */
  private async getAportesEnMeses(meses: string[]): Promise<Map<string, AporteAcumuladoNomina[]>> {
    const anios = [...new Set(meses.map((mes) => mes.slice(0, 4)))];
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/acumulados`));
    const porEmpleado = new Map<string, AporteAcumuladoNomina[]>();
    if (!snapshot.exists()) {
      return porEmpleado;
    }

    const raw = snapshot.val() as Record<string, Record<string, Record<string, AporteAcumuladoNomina>>>;
    const mesesValidos = new Set(meses);
    for (const [empleadoId, porAnio] of Object.entries(raw)) {
      const aportes = anios
        .flatMap((anio) => Object.values(porAnio?.[anio] ?? {}))
        .filter((aporte) => aporte.tipo === 'MENSUAL' && mesesValidos.has(aporte.periodo))
        .sort((a, b) => a.periodo.localeCompare(b.periodo));
      if (aportes.length > 0) {
        porEmpleado.set(empleadoId, aportes);
      }
    }
    return porEmpleado;
  }

  /**
   * Detalle de un rol que paga un solo concepto ya devengado (decimos, utilidades). No aporta a
   * IESS ni genera provisiones nuevas: se arma con totales fijos para que `recalcularDetalle` no le
   * agregue aportes ni beneficios encima.
   */
  private detalleConceptoUnico(
    empleadoId: string,
    empleadoNombre: string,
    cargo: string,
    codigo: string,
    nombre: string,
    monto: number,
    cuentaContableId: string
  ): RolPagoDetalle {
    return {
      id: empleadoId,
      empleadoId,
      empleadoNombre,
      cargo,
      sueldoBase: 0,
      lineas: [{
        rubroId: '',
        codigo,
        nombre,
        tipo: 'INGRESO',
        afectaIess: false,
        cuentaContableId,
        monto,
        origen: 'SISTEMA',
        editable: false
      }],
      ingresosAdicionales: monto,
      aportePersonalIess: 0,
      aportePatronalIess: 0,
      anticipos: 0,
      prestamos: 0,
      otrosDescuentos: 0,
      decimoTerceroProvision: 0,
      decimoCuartoProvision: 0,
      fondosReservaProvision: 0,
      vacacionesProvision: 0,
      totalIngresos: monto,
      totalDescuentos: 0,
      totalBeneficios: 0,
      netoPagar: monto
    };
  }

  /**
   * Reparto del 15% de utilidades: 10% en proporcion al tiempo trabajado y 5% en proporcion a las
   * cargas familiares (ponderadas tambien por tiempo). Si nadie tiene cargas registradas, ese 5% se
   * reparte con el mismo criterio de tiempo, que es lo que corresponde cuando no hay beneficiarios.
   * Lo que exceda el techo de 24 SBU por trabajador no se paga: se transfiere al IESS.
   */
  async calcularRepartoUtilidades(anio: string, utilidadBase: number): Promise<RepartoUtilidades> {
    const base = this.roundToTwo(utilidadBase);
    if (base <= 0) {
      throw new Error('Ingresa la utilidad del ejercicio para repartir.');
    }

    const config = await this.getConfiguracionOnce();
    const acumulados = await this.getAcumuladosEmpleados(anio);
    const empleadosFicha = new Map((await this.getEmpleadosOnce()).map((empleado) => [empleado.id ?? '', empleado]));

    const participantes = acumulados
      .map((acumulado) => ({
        empleadoId: acumulado.empleadoId,
        empleadoNombre: acumulado.empleadoNombre,
        diasTrabajados: this.sumar(
          acumulado.aportes.filter((aporte) => aporte.tipo === 'MENSUAL'),
          (aporte) => aporte.diasTrabajados
        ),
        cargasFamiliares: Number(empleadosFicha.get(acumulado.empleadoId)?.cargasFamiliares ?? 0)
      }))
      .filter((participante) => participante.diasTrabajados > 0);

    if (participantes.length === 0) {
      throw new Error(`No hay roles mensuales aprobados en ${anio} para repartir utilidades.`);
    }

    const monto10 = this.roundToTwo(base * 0.10);
    const monto5 = this.roundToTwo(base * 0.05);
    const totalDias = participantes.reduce((total, p) => total + p.diasTrabajados, 0);
    const totalPonderadoCargas = participantes.reduce((total, p) => total + p.diasTrabajados * p.cargasFamiliares, 0);
    const techoPorEmpleado = config.salarioBasicoUnificado > 0
      ? this.roundToTwo(config.salarioBasicoUnificado * 24)
      : 0;

    const empleados: RepartoUtilidadesEmpleado[] = participantes.map((participante) => {
      const porTiempo = this.roundToTwo(monto10 * (participante.diasTrabajados / totalDias));
      const porCargas = totalPonderadoCargas > 0
        ? this.roundToTwo(monto5 * ((participante.diasTrabajados * participante.cargasFamiliares) / totalPonderadoCargas))
        : this.roundToTwo(monto5 * (participante.diasTrabajados / totalDias));
      const bruto = this.roundToTwo(porTiempo + porCargas);
      const excedente = techoPorEmpleado > 0 && bruto > techoPorEmpleado
        ? this.roundToTwo(bruto - techoPorEmpleado)
        : 0;

      return {
        ...participante,
        porTiempo,
        porCargas,
        total: this.roundToTwo(bruto - excedente),
        excedente
      };
    });

    return {
      anio,
      utilidadBase: base,
      monto10,
      monto5,
      totalDias,
      techoPorEmpleado,
      empleados,
      totalRepartido: this.sumar(empleados, (empleado) => empleado.total),
      totalExcedente: this.sumar(empleados, (empleado) => empleado.excedente)
    };
  }

  async generarRolUtilidades(anio: string, utilidadBase: number, fechaPago: string): Promise<string> {
    if (!fechaPago) {
      throw new Error('Selecciona la fecha de pago.');
    }
    const periodo = fechaPago.slice(0, 7);
    const existente = await this.buscarRolPorPeriodo(periodo, 'UTILIDADES');
    if (existente) {
      throw new Error(`Ya existe un rol de utilidades para ${periodo}.`);
    }

    const reparto = await this.calcularRepartoUtilidades(anio, utilidadBase);
    const config = await this.getConfiguracionOnce();
    const empleadosFicha = new Map((await this.getEmpleadosOnce()).map((empleado) => [empleado.id ?? '', empleado]));

    const detalles = reparto.empleados
      .filter((empleado) => empleado.total > 0)
      .map((empleado) => this.detalleConceptoUnico(
        empleado.empleadoId,
        empleado.empleadoNombre,
        empleadosFicha.get(empleado.empleadoId)?.cargo ?? '',
        'UTIL',
        `Utilidades ${anio} (${empleado.diasTrabajados} dias, ${empleado.cargasFamiliares} cargas)`,
        empleado.total,
        config.cuentaUtilidadesPorPagarId
      ));

    if (detalles.length === 0) {
      throw new Error('El reparto no genero montos a pagar.');
    }

    return this.persistirRol('UTILIDADES', periodo, fechaPago, detalles, config);
  }

  /**
   * Finiquito de un empleado. Liquida lo devengado y no pagado (decimos, vacaciones, fondos) tomado
   * del historial de acumulados, y suma las indemnizaciones que correspondan al motivo de salida.
   * Devuelve el calculo para revisarlo antes de generar el rol.
   */
  private async calcularLiquidacionLegacy(
    empleadoId: string,
    fechaSalida: string,
    motivoSalida: MotivoSalidaNomina
  ): Promise<any> {
    const empleado = await this.getEmpleadoById(empleadoId);
    if (!empleado) {
      throw new Error('El empleado no existe.');
    }
    if (!fechaSalida) {
      throw new Error('Ingresa la fecha de salida.');
    }
    if (fechaSalida < empleado.fechaIngreso) {
      throw new Error('La fecha de salida no puede ser anterior a la fecha de ingreso.');
    }

    const config = await this.getConfiguracionOnce();
    const aniosServicio = this.aniosServicio(empleado.fechaIngreso, fechaSalida);
    const ultimaRemuneracion = this.roundToTwo(empleado.sueldoBase);

    // Saldos pendientes: lo acumulado en los años que toca el periodo de servicio, menos lo pagado.
    const anios = this.aniosEntre(empleado.fechaIngreso, fechaSalida);
    const saldos = { decimoTercero: 0, decimoCuarto: 0, fondosReserva: 0, vacaciones: 0 };
    for (const anio of anios) {
      const desglose = await this.getDesgloseProvisiones(anio);
      const empleadoDesglose = desglose.empleados.find((item) => item.empleadoId === empleadoId);
      for (const saldo of empleadoDesglose?.saldos ?? []) {
        if (saldo.concepto === 'DECIMO_TERCERO') saldos.decimoTercero += saldo.saldo;
        if (saldo.concepto === 'DECIMO_CUARTO') saldos.decimoCuarto += saldo.saldo;
        if (saldo.concepto === 'FONDOS_RESERVA') saldos.fondosReserva += saldo.saldo;
        if (saldo.concepto === 'VACACIONES') saldos.vacaciones += saldo.saldo;
      }
    }

    const rubros: RubroLiquidacion[] = [];
    this.agregarRubroLiquidacion(rubros, 'D13PROP', 'Decimo tercero proporcional', saldos.decimoTercero, 'Saldo provisionado no pagado', config.cuentaDecimosPorPagarId);
    this.agregarRubroLiquidacion(rubros, 'D14PROP', 'Decimo cuarto proporcional', saldos.decimoCuarto, 'Saldo provisionado no pagado', config.cuentaDecimosPorPagarId);
    this.agregarRubroLiquidacion(rubros, 'VACNOG', 'Vacaciones no gozadas', saldos.vacaciones, 'Saldo provisionado no pagado', config.cuentaVacacionesPorPagarId);
    this.agregarRubroLiquidacion(rubros, 'FRESPEND', 'Fondos de reserva pendientes', saldos.fondosReserva, 'Saldo provisionado no pagado', config.cuentaFondosReservaPorPagarId);

    if (motivoSalida === 'DESAHUCIO') {
      // Bonificacion por desahucio: 25% de la ultima remuneracion por cada año de servicio.
      const bonificacion = this.roundToTwo(ultimaRemuneracion * 0.25 * aniosServicio);
      this.agregarRubroLiquidacion(rubros, 'DESAHUCIO', 'Bonificacion por desahucio', bonificacion, `25% x ${aniosServicio} años de servicio`, config.cuentaGastoBeneficiosSocialesId);
    }

    if (motivoSalida === 'DESPIDO_INTEMPESTIVO') {
      // Escala del Codigo del Trabajo: hasta 3 años, 3 remuneraciones; luego una por año, tope 25.
      const remuneraciones = aniosServicio <= 3 ? 3 : Math.min(25, aniosServicio);
      const indemnizacion = this.roundToTwo(ultimaRemuneracion * remuneraciones);
      this.agregarRubroLiquidacion(rubros, 'DESPIDO', 'Indemnizacion por despido intempestivo', indemnizacion, `${remuneraciones} remuneraciones`, config.cuentaGastoBeneficiosSocialesId);
    }

    const totalIngresos = this.sumar(rubros.filter((rubro) => rubro.tipo === 'INGRESO'), (rubro) => rubro.monto);
    const totalDescuentos = this.sumar(rubros.filter((rubro) => rubro.tipo === 'DESCUENTO'), (rubro) => rubro.monto);

    return {
      empleadoId,
      empleadoNombre: `${empleado.apellidos} ${empleado.nombres}`.trim(),
      fechaIngreso: empleado.fechaIngreso,
      fechaSalida,
      motivoSalida,
      aniosServicio,
      ultimaRemuneracion,
      rubros,
      totalIngresos,
      totalDescuentos,
      netoPagar: this.roundToTwo(totalIngresos - totalDescuentos)
    };
  }

  /**
   * Genera el rol de finiquito y marca al empleado como inactivo con su fecha y motivo de salida,
   * para que deje de entrar en los roles mensuales siguientes.
   */
  private async generarRolLiquidacionLegacy(
    empleadoId: string,
    fechaSalida: string,
    motivoSalida: MotivoSalidaNomina,
    fechaPago: string
  ): Promise<string> {
    const liquidacion = await this.calcularLiquidacionLegacy(empleadoId, fechaSalida, motivoSalida);
    if (liquidacion.netoPagar <= 0) {
      throw new Error('La liquidacion no tiene valores a pagar.');
    }

    const config = await this.getConfiguracionOnce();
    const periodo = (fechaPago || fechaSalida).slice(0, 7);
    const empleado = await this.getEmpleadoById(empleadoId);

    const detalle: RolPagoDetalle = {
      id: empleadoId,
      empleadoId,
      empleadoNombre: liquidacion.empleadoNombre,
      cargo: empleado?.cargo ?? '',
      sueldoBase: 0,
      lineas: liquidacion.rubros.map((rubro: RubroLiquidacion) => ({
        rubroId: '',
        codigo: rubro.codigo,
        nombre: rubro.nombre,
        tipo: rubro.tipo,
        afectaIess: false,
        cuentaContableId: this.cuentaRubroLiquidacion.get(rubro.codigo) ?? '',
        monto: rubro.monto,
        origen: 'SISTEMA',
        editable: false
      })),
      ingresosAdicionales: liquidacion.totalIngresos,
      aportePersonalIess: 0,
      aportePatronalIess: 0,
      anticipos: 0,
      prestamos: 0,
      otrosDescuentos: liquidacion.totalDescuentos,
      decimoTerceroProvision: 0,
      decimoCuartoProvision: 0,
      fondosReservaProvision: 0,
      vacacionesProvision: 0,
      totalIngresos: liquidacion.totalIngresos,
      totalDescuentos: liquidacion.totalDescuentos,
      totalBeneficios: 0,
      netoPagar: liquidacion.netoPagar
    };

    const rolId = await this.persistirRol('LIQUIDACION', periodo, fechaPago || fechaSalida, [detalle], config);
    await update(ref(this.database, `${this.getNominaPath()}/empleados/${empleadoId}`), {
      estado: 'INACTIVO',
      fechaSalida,
      motivoSalida,
      actualizadoEn: Date.now()
    });
    return rolId;
  }

  /** Cuenta contable con la que se imputa cada rubro del finiquito, resuelta al calcular. */
  private readonly cuentaRubroLiquidacion = new Map<string, string>();

  private agregarRubroLiquidacion(
    rubros: RubroLiquidacion[],
    codigo: string,
    nombre: string,
    monto: number,
    detalle: string,
    cuentaContableId: string
  ): void {
    const valor = this.roundToTwo(monto);
    if (valor <= 0) {
      return;
    }
    this.cuentaRubroLiquidacion.set(codigo, cuentaContableId ?? '');
    rubros.push({
      codigo,
      nombre,
      tipo: 'INGRESO',
      monto: valor,
      valorCalculado: valor,
      origen: 'WINSUITE',
      cuentaContableId: cuentaContableId ?? '',
      detalle
    });
  }

  /** Años completos de servicio; el año en curso cuenta solo si ya se cumplio el aniversario. */
  private aniosServicio(fechaIngreso: string, fechaSalida: string): number {
    const ingreso = new Date(fechaIngreso);
    const salida = new Date(fechaSalida);
    let anios = salida.getFullYear() - ingreso.getFullYear();
    const cumplioAniversario = salida.getMonth() > ingreso.getMonth()
      || (salida.getMonth() === ingreso.getMonth() && salida.getDate() >= ingreso.getDate());
    if (!cumplioAniversario) {
      anios -= 1;
    }
    return Math.max(0, anios);
  }

  private aniosEntre(desde: string, hasta: string): string[] {
    const inicio = Number(desde.slice(0, 4));
    const fin = Number(hasta.slice(0, 4));
    const anios: string[] = [];
    for (let anio = inicio; anio <= fin; anio += 1) {
      anios.push(String(anio));
    }
    return anios;
  }

  async calcularLiquidacion(
    empleadoId: string,
    fechaSalida: string,
    motivoSalida: MotivoSalidaNomina,
    ajustes: RubroLiquidacion[] = []
  ): Promise<LiquidacionEmpleado> {
    const empleado = await this.getEmpleadoById(empleadoId);
    if (!empleado) throw new Error('El empleado no existe.');
    if (!fechaSalida) throw new Error('Ingresa la fecha de salida.');
    if (fechaSalida < empleado.fechaIngreso) throw new Error('La fecha de salida no puede ser anterior a la fecha de ingreso.');

    const saldoInicial = await this.getSaldoInicialLaboral(empleadoId);
    if (!saldoInicial) {
      throw new Error('Configura o confirma en cero los saldos laborales iniciales del empleado antes de liquidarlo.');
    }
    if (saldoInicial.fechaCorte > fechaSalida) {
      throw new Error('La fecha de corte de los saldos iniciales no puede ser posterior a la fecha de salida.');
    }
    const causalTerminacion = normalizarCausalTerminacion(motivoSalida);
    const periodo = fechaSalida.slice(0, 7);
    const [config, rubrosConfigurados, cargos, departamentos, movimientos, anticipos, conflictoMensual] = await Promise.all([
      this.getConfiguracionOnce(),
      this.getRubrosOnce(),
      this.getCargosOnce(),
      this.getDepartamentosOnce(),
      this.getMovimientosProvisionLiquidacion(empleadoId, saldoInicial.fechaCorte, fechaSalida),
      this.anticiposService.getPendientesPorEmpleado(periodo),
      this.getRolMensualEmpleado(periodo, empleadoId)
    ]);
    if (conflictoMensual?.rol.estado === 'APROBADO') {
      throw new Error(`El empleado ya consta en el rol mensual aprobado ${conflictoMensual.rol.numero ?? periodo}. Reversa ese rol antes de liquidarlo.`);
    }

    const cargo = cargos.find((item) => item.id === empleado.cargoId);
    const departamento = departamentos.find((item) => item.id === empleado.departamentoId);
    const rubrosAutomaticos = rubrosConfigurados.filter((rubro) => rubro.activo && rubro.modoCalculo !== 'MANUAL');
    const rubroAnticipo = rubrosConfigurados.find((rubro) => rubro.codigo === NominaService.CODIGO_RUBRO_ANTICIPO) ?? null;
    const detalleMes = this.calcularDetalle(
      empleado,
      rubrosAutomaticos,
      { ...config, provisionarDecimoTercero: true, provisionarDecimoCuarto: true, provisionarFondosReserva: true, provisionarVacaciones: true },
      periodo,
      this.crearLineaAnticipo(anticipos.get(empleadoId) ?? 0, rubroAnticipo, config),
      cargo,
      departamento,
      fechaSalida
    );
    const ultimaRemuneracion = this.roundToTwo(empleado.sueldoBase + rubrosAutomaticos
      .filter((rubro) => rubro.tipo === 'INGRESO' && (rubro.incluyeBaseIndemnizacion ?? rubro.afectaIess))
      .reduce((total, rubro) => total + (rubro.modoCalculo === 'PORCENTAJE_SUELDO'
        ? empleado.sueldoBase * Number(rubro.valorReferencia ?? 0) / 100
        : Number(rubro.valorReferencia ?? 0)), 0));
    const indemnizaciones = calcularIndemnizacionesLiquidacion(empleado.fechaIngreso, fechaSalida, ultimaRemuneracion, causalTerminacion);

    const rubros: RubroLiquidacion[] = [];
    for (const linea of detalleMes.lineas.filter((item) => item.origen !== 'SISTEMA')) {
      this.agregarRubroLiquidacionCompleto(
        rubros,
        linea.origen === 'SUELDO' ? 'SUELDO_ULTIMO' : linea.codigo,
        linea.origen === 'SUELDO' ? 'Sueldo proporcional del ultimo mes' : linea.nombre,
        linea.monto,
        linea.tipo,
        linea.tipo === 'DESCUENTO' ? 'DESCUENTO' : 'ULTIMO_MES',
        linea.origen === 'SUELDO'
          ? (cargo?.cuentaGastoSueldosId ?? '')
          : (linea.cuentaContableId || (linea.tipo === 'DESCUENTO' ? config.cuentaPrestamosEmpleadosId : config.cuentaGastoSueldosId)),
        linea.origen === 'SUELDO'
          ? `${detalleMes.diasTrabajadosPeriodo ?? 0} dias de ${empleado.sueldoBase.toFixed(2)}`
          : 'Rubro automatico proporcional del ultimo mes',
        linea.afectaIess
      );
    }
    this.agregarRubroLiquidacionCompleto(rubros, 'IESS_PERSONAL', 'Aporte personal IESS', detalleMes.aportePersonalIess, 'DESCUENTO', 'DESCUENTO', config.cuentaIessPorPagarId, 'Aporte sobre la base gravada del ultimo mes');
    this.agregarBeneficioPorOrigen(rubros, 'D13', 'Decimo tercero', saldoInicial.decimoTerceroPendiente, movimientos.decimoTercero, (detalleMes.decimoTerceroMensualizado ?? 0) + detalleMes.decimoTerceroProvision, config.cuentaDecimoTerceroPorPagarId, config.cuentaGastoDecimoTerceroId);
    this.agregarBeneficioPorOrigen(rubros, 'D14', 'Decimo cuarto', saldoInicial.decimoCuartoPendiente, movimientos.decimoCuarto, (detalleMes.decimoCuartoMensualizado ?? 0) + detalleMes.decimoCuartoProvision, config.cuentaDecimoCuartoPorPagarId, config.cuentaGastoDecimoCuartoId);
    this.agregarBeneficioPorOrigen(rubros, 'FRES', 'Fondos de reserva', saldoInicial.fondosReservaPendiente, movimientos.fondosReserva, (detalleMes.fondosReservaMensualizado ?? 0) + detalleMes.fondosReservaProvision, config.cuentaFondosReservaPorPagarId, config.cuentaGastoFondosReservaId);
    this.agregarBeneficioPorOrigen(rubros, 'VAC', 'Vacaciones no gozadas', saldoInicial.valorVacacionesPendiente, movimientos.vacaciones, detalleMes.vacacionesProvision, config.cuentaVacacionesPorPagarId, config.cuentaGastoVacacionesId);
    this.agregarRubroLiquidacionCompleto(rubros, 'DESAHUCIO', 'Bonificacion por desahucio', indemnizaciones.bonificacionDesahucio, 'INGRESO', 'INDEMNIZACION', config.cuentaGastoDesahucioId, `25% por ${indemnizaciones.aniosCompletos} anos completos`);
    this.agregarRubroLiquidacionCompleto(rubros, 'INDEMNIZACION', 'Indemnizacion por terminacion', indemnizaciones.indemnizacionDespido, 'INGRESO', 'INDEMNIZACION', config.cuentaGastoIndemnizacionId, `${Math.min(25, Math.max(3, indemnizaciones.aniosParaDespido))} remuneraciones`);

    const calculoAportes = this.aplicarAjustesYAportes(rubros, ajustes, config);
    const rubrosAjustados = calculoAportes.rubros;
    const totalIngresos = this.sumar(rubrosAjustados.filter((rubro) => rubro.tipo === 'INGRESO'), (rubro) => rubro.monto);
    const totalDescuentos = this.sumar(rubrosAjustados.filter((rubro) => rubro.tipo === 'DESCUENTO'), (rubro) => rubro.monto);
    const sueldoUltimoMes = rubrosAjustados.find((rubro) => rubro.codigo === 'SUELDO_ULTIMO')?.monto ?? detalleMes.sueldoBase;
    return {
      empleadoId,
      empleadoNombre: `${empleado.apellidos} ${empleado.nombres}`.trim(),
      fechaIngreso: empleado.fechaIngreso,
      fechaSalida,
      motivoSalida: causalTerminacion,
      causalTerminacion,
      aniosServicio: indemnizaciones.aniosCompletos,
      aniosCompletosServicio: indemnizaciones.aniosCompletos,
      ultimaRemuneracion,
      diasTrabajadosUltimoMes: detalleMes.diasTrabajadosPeriodo ?? 0,
      sueldoUltimoMes,
      baseImponibleIess: calculoAportes.baseImponibleIess,
      aportePersonalIess: calculoAportes.aportePersonalIess,
      aportePatronalIess: calculoAportes.aportePatronalIess,
      contribucionCcc: calculoAportes.contribucionCcc,
      saldoInicial,
      rolesConsiderados: movimientos.rolesConsiderados,
      rubros: rubrosAjustados,
      totalIngresos,
      totalDescuentos,
      netoPagar: this.roundToTwo(totalIngresos - totalDescuentos)
    };
  }

  /** Expone respaldos heredados para que la pantalla no los oculte como si fueran cuentas nuevas. */
  async getRespaldosConfiguracionOnce(): Promise<string[]> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/configuracion`));
    if (!snapshot.exists()) return [];
    const raw = snapshot.val() as Partial<ConfiguracionNominaContable>;
    const respaldos: string[] = [];
    if (!raw.cuentaGastoDesahucioId && raw.cuentaGastoBeneficiosSocialesId) {
      respaldos.push('Gasto por desahucio usa temporalmente Gasto de beneficios sociales.');
    }
    if (!raw.cuentaGastoIndemnizacionId && raw.cuentaGastoBeneficiosSocialesId) {
      respaldos.push('Gasto por indemnizacion usa temporalmente Gasto de beneficios sociales.');
    }
    if (!raw.cuentaLiquidacionesPorPagarId && raw.cuentaSueldosPorPagarId) {
      respaldos.push('Liquidaciones por pagar usa temporalmente Sueldos por pagar.');
    }
    return respaldos;
  }

  async generarRolLiquidacion(empleadoId: string, fechaSalida: string, motivoSalida: MotivoSalidaNomina, fechaPago: string): Promise<string> {
    return this.guardarBorradorLiquidacion(empleadoId, fechaSalida, motivoSalida, fechaPago);
  }

  async guardarBorradorLiquidacion(
    empleadoId: string,
    fechaSalida: string,
    motivoSalida: MotivoSalidaNomina,
    fechaPago: string,
    ajustes: RubroLiquidacion[] = []
  ): Promise<string> {
    if (!fechaPago) throw new Error('Selecciona la fecha de pago.');
    if (fechaPago < fechaSalida) throw new Error('La fecha de pago no puede ser anterior a la fecha de salida.');
    const existente = await this.getLiquidacionBorradorEmpleado(empleadoId);
    if (existente) throw new Error(`Ya existe una liquidacion en borrador para este empleado (${existente.rolId}).`);
    const liquidacion = await this.calcularLiquidacion(empleadoId, fechaSalida, motivoSalida, ajustes);
    if (liquidacion.netoPagar <= 0) throw new Error('La liquidacion no tiene valores a pagar.');

    const [config, empleado, cargos] = await Promise.all([this.getConfiguracionOnce(), this.getEmpleadoById(empleadoId), this.getCargosOnce()]);
    if (!empleado) throw new Error('El empleado ya no existe.');
    const cargo = cargos.find((item) => item.id === empleado.cargoId);
    const periodo = fechaSalida.slice(0, 7);
    const detalle = this.crearDetalleLiquidacion(liquidacion, empleado, cargo?.cuentaGastoSueldosId ?? '');
    const timestamp = Date.now();
    const rolId = push(ref(this.database, `${this.getNominaPath()}/rolesPago`)).key!;
    const rol: RolPago = {
      periodo,
      tipo: 'LIQUIDACION',
      fechaPago,
      estado: 'BORRADOR',
      modoAsiento: config.modoAsiento,
      numero: await this.reservarNumero('LIQUIDACION', periodo.slice(0, 4)),
      ...this.calcularTotales([detalle]),
      totalEmpleados: 1,
      asientoId: null,
      asientoReversionId: null,
      creadoEn: timestamp,
      actualizadoEn: timestamp,
      aprobadoEn: null,
      anuladoEn: null,
      reversadoEn: null
    };
    const conflicto = await this.getRolMensualEmpleado(periodo, empleadoId);
    if (conflicto?.rol.estado === 'APROBADO') throw new Error('El rol mensual del periodo ya esta aprobado; reversalo antes de liquidar.');
    const expediente: LiquidacionNomina = {
      ...liquidacion,
      rolId,
      fechaPago,
      estado: 'BORRADOR',
      asientoId: null,
      detalleRolMensualRetirado: conflicto?.detalle ?? null,
      rolMensualId: conflicto?.rol.id ?? null,
      configuracionCongelada: { ...config, camposPersonalizados: [] },
      cargoId: empleado.cargoId,
      cargo: empleado.cargo,
      departamentoId: empleado.departamentoId,
      departamento: empleado.departamento,
      cuentaGastoSueldosId: cargo?.cuentaGastoSueldosId ?? '',
      creadoEn: timestamp,
      actualizadoEn: timestamp,
      aprobadoEn: null,
      anuladoEn: null
    };
    const updates: Record<string, unknown> = {
      [`${this.getNominaPath()}/rolesPago/${rolId}`]: rol,
      [`${this.getNominaPath()}/rolesPagoDetalles/${rolId}/${empleadoId}`]: detalle,
      [`${this.getNominaPath()}/liquidaciones/${rolId}`]: expediente,
      [`${this.getNominaPath()}/empleados/${empleadoId}/estado`]: 'EN_LIQUIDACION',
      [`${this.getNominaPath()}/empleados/${empleadoId}/actualizadoEn`]: timestamp
    };
    if (conflicto?.rol.id) {
      updates[`${this.getNominaPath()}/rolesPagoDetalles/${conflicto.rol.id}/${empleadoId}`] = null;
      Object.assign(updates, this.updatesTotalesRol(conflicto.rol.id, conflicto.detalles.filter((item) => item.empleadoId !== empleadoId), timestamp));
    }
    await update(ref(this.database), this.paraFirebase(updates));
    return rolId;
  }

  async getLiquidacionByRolId(rolId: string): Promise<LiquidacionNomina | null> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/liquidaciones/${rolId}`));
    return snapshot.exists() ? { ...snapshot.val() as LiquidacionNomina, id: rolId, rolId } : null;
  }

  async actualizarBorradorLiquidacion(rolId: string, fechaPago: string, ajustes: RubroLiquidacion[]): Promise<void> {
    const [expediente, resumen] = await Promise.all([this.getLiquidacionByRolId(rolId), this.getRolPagoDetalle(rolId)]);
    if (!expediente || !resumen || expediente.estado !== 'BORRADOR' || resumen.rol.estado !== 'BORRADOR') {
      throw new Error('La liquidacion ya no esta disponible para editar.');
    }
    if (!fechaPago || fechaPago < expediente.fechaSalida) {
      throw new Error('La fecha de pago no puede ser anterior a la fecha de salida.');
    }
    const empleado = await this.getEmpleadoById(expediente.empleadoId);
    if (!empleado) throw new Error('El empleado ya no existe.');

    const configCongelada = this.normalizarConfiguracion(expediente.configuracionCongelada);
    const calculados = expediente.rubros.map((rubro) => ({
      ...rubro,
      monto: rubro.valorCalculado,
      ajustado: false,
      justificacionAjuste: ''
    }));
    const aportes = this.aplicarAjustesYAportes(calculados, ajustes, configCongelada);
    const totalIngresos = this.sumar(aportes.rubros.filter((rubro) => rubro.tipo === 'INGRESO'), (rubro) => rubro.monto);
    const totalDescuentos = this.sumar(aportes.rubros.filter((rubro) => rubro.tipo === 'DESCUENTO'), (rubro) => rubro.monto);
    const actualizada: LiquidacionNomina = {
      ...expediente,
      fechaPago,
      sueldoUltimoMes: aportes.rubros.find((rubro) => rubro.codigo === 'SUELDO_ULTIMO')?.monto ?? expediente.sueldoUltimoMes,
      baseImponibleIess: aportes.baseImponibleIess,
      aportePersonalIess: aportes.aportePersonalIess,
      aportePatronalIess: aportes.aportePatronalIess,
      contribucionCcc: aportes.contribucionCcc,
      rubros: aportes.rubros,
      totalIngresos,
      totalDescuentos,
      netoPagar: this.roundToTwo(totalIngresos - totalDescuentos),
      actualizadoEn: Date.now()
    };
    if (actualizada.netoPagar <= 0) throw new Error('La liquidacion no tiene valores a pagar.');
    const detalle = this.crearDetalleLiquidacion(actualizada, empleado, expediente.cuentaGastoSueldosId ?? '');
    const { id: _id, ...expedientePersistible } = actualizada;
    const { id: _rolId, ...rolPersistible } = resumen.rol;
    await update(ref(this.database), this.paraFirebase({
      [`${this.getNominaPath()}/liquidaciones/${rolId}`]: expedientePersistible,
      [`${this.getNominaPath()}/rolesPagoDetalles/${rolId}/${expediente.empleadoId}`]: detalle,
      [`${this.getNominaPath()}/rolesPago/${rolId}`]: {
        ...rolPersistible,
        fechaPago,
        ...this.calcularTotales([detalle]),
        totalEmpleados: 1,
        actualizadoEn: actualizada.actualizadoEn
      }
    }));
  }

  private agregarRubroLiquidacionCompleto(
    rubros: RubroLiquidacion[],
    codigo: string,
    nombre: string,
    monto: number,
    tipo: RubroLiquidacion['tipo'],
    origen: RubroLiquidacion['origen'],
    cuentaContableId: string,
    detalle: string,
    afectaIess = false
  ): void {
    const valor = this.roundToTwo(monto);
    if (valor <= 0) return;
    rubros.push({ codigo, nombre, tipo, monto: valor, valorCalculado: valor, origen, cuentaContableId: cuentaContableId ?? '', afectaIess, detalle });
  }

  private agregarBeneficioPorOrigen(
    rubros: RubroLiquidacion[],
    codigo: string,
    nombre: string,
    saldoInicial: number,
    saldoWinsuite: number,
    ultimoMes: number,
    cuentaProvision: string,
    cuentaGasto: string
  ): void {
    this.agregarRubroLiquidacionCompleto(rubros, `${codigo}_INICIAL`, `${nombre} - saldo inicial`, saldoInicial, 'INGRESO', 'SALDO_INICIAL', cuentaProvision, 'Saldo declarado a la fecha de corte');
    this.agregarRubroLiquidacionCompleto(rubros, `${codigo}_WINSUITE`, `${nombre} - acumulado WinSuite`, saldoWinsuite, 'INGRESO', 'WINSUITE', cuentaProvision, 'Provisiones aprobadas menos pagos posteriores al corte');
    this.agregarRubroLiquidacionCompleto(rubros, `${codigo}_ULTIMO`, `${nombre} - ultimo mes`, ultimoMes, 'INGRESO', 'ULTIMO_MES', cuentaGasto, 'Proporcional causado hasta la fecha de salida');
  }

  private aplicarAjustesLiquidacion(calculados: RubroLiquidacion[], ajustes: RubroLiquidacion[]): RubroLiquidacion[] {
    if (ajustes.length === 0) return calculados;
    const porCodigo = new Map(ajustes.map((rubro) => [rubro.codigo, rubro]));
    const resultado = calculados.map((calculado) => {
      const ajuste = porCodigo.get(calculado.codigo);
      if (!ajuste) return calculado;
      const monto = this.roundToTwo(Math.max(0, Number(ajuste.monto) || 0));
      const modificado = monto !== calculado.valorCalculado;
      const justificacion = ajuste.justificacionAjuste?.trim() ?? '';
      if (modificado && !justificacion) throw new Error(`Justifica el ajuste de ${calculado.nombre}.`);
      return { ...calculado, monto, ajustado: modificado, justificacionAjuste: modificado ? justificacion : '' };
    });
    for (const ajuste of ajustes.filter((item) => !calculados.some((calculado) => calculado.codigo === item.codigo))) {
      const monto = this.roundToTwo(Math.max(0, Number(ajuste.monto) || 0));
      if (monto <= 0) continue;
      if (!ajuste.justificacionAjuste?.trim()) throw new Error(`Justifica el rubro adicional ${ajuste.nombre}.`);
      resultado.push({
        ...ajuste,
        codigo: ajuste.codigo || `AJUSTE_${resultado.length + 1}`,
        origen: ajuste.tipo === 'DESCUENTO' ? 'DESCUENTO' : 'AJUSTE',
        valorCalculado: 0,
        monto,
        ajustado: true,
        justificacionAjuste: ajuste.justificacionAjuste.trim()
      });
    }
    return resultado;
  }

  private aplicarAjustesYAportes(
    calculados: RubroLiquidacion[],
    ajustes: RubroLiquidacion[],
    config: ConfiguracionNominaContable
  ): { rubros: RubroLiquidacion[]; baseImponibleIess: number; aportePersonalIess: number; aportePatronalIess: number; contribucionCcc: number } {
    const rubrosSinIess = calculados.filter((rubro) => rubro.codigo !== 'IESS_PERSONAL');
    const ajustesSinIess = ajustes.filter((rubro) => rubro.codigo !== 'IESS_PERSONAL');
    const rubros = this.aplicarAjustesLiquidacion(rubrosSinIess, ajustesSinIess);
    const baseImponibleIess = this.sumar(
      rubros.filter((rubro) => rubro.tipo === 'INGRESO' && rubro.afectaIess),
      (rubro) => rubro.monto
    );
    const aportePersonalCalculado = this.roundToTwo(baseImponibleIess * Number(config.porcentajeAportePersonalIess || 0) / 100);
    const aportePatronalIess = this.roundToTwo(baseImponibleIess * Number(config.porcentajeAportePatronalIess || 0) / 100);
    const contribucionCcc = this.roundToTwo(baseImponibleIess * Number(config.porcentajeContribucionCcc || 0) / 100);
    let aportePersonalIess = aportePersonalCalculado;
    if (aportePersonalCalculado > 0) {
      const anterior = calculados.find((rubro) => rubro.codigo === 'IESS_PERSONAL');
      const esperado: RubroLiquidacion = {
        codigo: 'IESS_PERSONAL',
        nombre: anterior?.nombre ?? 'Aporte personal IESS',
        tipo: 'DESCUENTO',
        monto: aportePersonalCalculado,
        detalle: 'Aporte sobre la base gravada ajustada del ultimo mes',
        origen: 'DESCUENTO',
        valorCalculado: aportePersonalCalculado,
        cuentaContableId: anterior?.cuentaContableId ?? config.cuentaIessPorPagarId,
        afectaIess: false
      };
      const candidatoIess = ajustes.find((rubro) => rubro.codigo === 'IESS_PERSONAL');
      const ajusteIess = candidatoIess && (
        this.roundToTwo(candidatoIess.monto) !== this.roundToTwo(candidatoIess.valorCalculado)
        || !!candidatoIess.justificacionAjuste?.trim()
      ) ? candidatoIess : null;
      const iessAjustado = this.aplicarAjustesLiquidacion([esperado], ajusteIess ? [ajusteIess] : []);
      rubros.push(...iessAjustado);
      aportePersonalIess = iessAjustado[0]?.monto ?? aportePersonalCalculado;
    }
    return { rubros, baseImponibleIess, aportePersonalIess, aportePatronalIess, contribucionCcc };
  }

  private crearDetalleLiquidacion(liquidacion: LiquidacionEmpleado, empleado: EmpleadoNomina, cuentaGastoSueldosId: string): RolPagoDetalle {
    return {
      id: empleado.id ?? liquidacion.empleadoId,
      empleadoId: liquidacion.empleadoId,
      empleadoNombre: liquidacion.empleadoNombre,
      cargoId: empleado.cargoId,
      cargo: empleado.cargo,
      departamentoId: empleado.departamentoId,
      departamento: empleado.departamento,
      cuentaGastoSueldosId,
      sueldoMensual: empleado.sueldoBase,
      diasTrabajadosPeriodo: liquidacion.diasTrabajadosUltimoMes,
      sueldoBase: liquidacion.sueldoUltimoMes,
      baseImponibleIess: liquidacion.baseImponibleIess,
      modoDecimoTercero: empleado.modoDecimoTercero,
      modoDecimoCuarto: empleado.modoDecimoCuarto,
      modoFondosReserva: empleado.modoFondosReserva,
      regimenFondosReserva: empleado.regimenFondosReserva,
      lineas: liquidacion.rubros.map((rubro: RubroLiquidacion) => ({
        rubroId: '', codigo: rubro.codigo, nombre: rubro.nombre, tipo: rubro.tipo,
        afectaIess: !!rubro.afectaIess,
        cuentaContableId: rubro.cuentaContableId, monto: rubro.monto, origen: 'SISTEMA', editable: false,
        origenLiquidacion: rubro.origen, valorCalculadoLiquidacion: rubro.valorCalculado,
        justificacionAjuste: rubro.justificacionAjuste
      })),
      ingresosAdicionales: this.roundToTwo(liquidacion.totalIngresos - liquidacion.sueldoUltimoMes),
      aportePersonalIess: liquidacion.aportePersonalIess,
      aportePatronalIess: liquidacion.aportePatronalIess,
      contribucionCcc: liquidacion.contribucionCcc,
      anticipos: this.sumar(liquidacion.rubros.filter((rubro) => rubro.codigo === NominaService.CODIGO_RUBRO_ANTICIPO), (rubro) => rubro.monto),
      prestamos: 0,
      otrosDescuentos: this.roundToTwo(liquidacion.totalDescuentos - liquidacion.aportePersonalIess),
      decimoTerceroProvision: 0,
      decimoCuartoProvision: 0,
      fondosReservaProvision: 0,
      vacacionesProvision: 0,
      totalIngresos: liquidacion.totalIngresos,
      totalDescuentos: liquidacion.totalDescuentos,
      totalBeneficios: this.sumar(liquidacion.rubros.filter((rubro) => /^(D13|D14|FRES|VAC)_/.test(rubro.codigo)), (rubro) => rubro.monto),
      netoPagar: liquidacion.netoPagar
    };
  }

  private async getMovimientosProvisionLiquidacion(empleadoId: string, fechaCorte: string, fechaSalida: string): Promise<{
    decimoTercero: number;
    decimoCuarto: number;
    fondosReserva: number;
    vacaciones: number;
    rolesConsiderados: string[];
  }> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/acumulados/${empleadoId}`));
    const aportes = snapshot.exists()
      ? Object.values(snapshot.val() as Record<string, Record<string, AporteAcumuladoNomina>>).flatMap((porAnio) => Object.values(porAnio ?? {}))
      : [];
    const aplicables = aportes.filter((aporte) => {
      const fecha = aporte.fechaPago || `${aporte.periodo}-30`;
      return fecha > fechaCorte && fecha <= fechaSalida && aporte.tipo !== 'LIQUIDACION';
    });
    const mensuales = aplicables.filter((aporte) => aporte.tipo === 'MENSUAL');
    const d13Pagado = this.sumar(aplicables, (aporte) => aporte.tipo === 'DECIMO_TERCERO' ? aporte.totalIngresos : (aporte.decimoTerceroPagado ?? 0));
    const d14Pagado = this.sumar(aplicables, (aporte) => aporte.tipo === 'DECIMO_CUARTO' ? aporte.totalIngresos : (aporte.decimoCuartoPagado ?? 0));
    return {
      decimoTercero: Math.max(0, this.roundToTwo(this.sumar(mensuales, (aporte) => aporte.decimoTerceroProvision) - d13Pagado)),
      decimoCuarto: Math.max(0, this.roundToTwo(this.sumar(mensuales, (aporte) => aporte.decimoCuartoProvision) - d14Pagado)),
      fondosReserva: Math.max(0, this.roundToTwo(this.sumar(mensuales, (aporte) => aporte.fondosReservaProvision) - this.sumar(aplicables, (aporte) => aporte.fondosReservaPagado ?? 0))),
      vacaciones: Math.max(0, this.roundToTwo(this.sumar(mensuales, (aporte) => aporte.vacacionesProvision) - this.sumar(aplicables, (aporte) => aporte.vacacionesPagado ?? 0))),
      rolesConsiderados: aplicables.map((aporte) => aporte.rolId)
    };
  }

  private async getRolMensualEmpleado(periodo: string, empleadoId: string): Promise<{
    rol: RolPago;
    detalle: RolPagoDetalle;
    detalles: RolPagoDetalle[];
  } | null> {
    const rol = await this.buscarRolPorPeriodo(periodo, 'MENSUAL');
    if (!rol?.id) return null;
    const resumen = await this.getRolPagoDetalle(rol.id);
    const detalle = resumen?.detalles.find((item) => item.empleadoId === empleadoId);
    return resumen && detalle ? { rol: resumen.rol, detalle, detalles: resumen.detalles } : null;
  }

  async getLiquidacionBorradorEmpleado(empleadoId: string): Promise<LiquidacionNomina | null> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/liquidaciones`));
    if (!snapshot.exists()) return null;
    const match = Object.entries(snapshot.val() as Record<string, LiquidacionNomina>)
      .find(([, liquidacion]) => liquidacion.empleadoId === empleadoId && liquidacion.estado === 'BORRADOR');
    return match ? { ...match[1], id: match[0], rolId: match[0] } : null;
  }

  private updatesTotalesRol(rolId: string, detalles: RolPagoDetalle[], timestamp: number): Record<string, unknown> {
    const totales = this.calcularTotales(detalles);
    return Object.fromEntries(Object.entries({ ...totales, totalEmpleados: detalles.length, actualizadoEn: timestamp })
      .map(([campo, valor]) => [`${this.getNominaPath()}/rolesPago/${rolId}/${campo}`, valor]));
  }

  /** Crea el rol y sus detalles. Comun a todos los tipos de rol (mensual, decimos, utilidades, liquidacion). */
  private async persistirRol(
    tipo: TipoRolNomina,
    periodo: string,
    fechaPago: string,
    detalles: RolPagoDetalle[],
    config: ConfiguracionNominaContable
  ): Promise<string> {
    const timestamp = Date.now();
    const rol: RolPago = {
      periodo,
      tipo,
      fechaPago,
      estado: 'BORRADOR',
      modoAsiento: config.modoAsiento,
      numero: await this.reservarNumero(tipo, periodo.slice(0, 4)),
      ...this.calcularTotales(detalles),
      totalEmpleados: detalles.length,
      asientoId: null,
      asientoReversionId: null,
      creadoEn: timestamp,
      actualizadoEn: timestamp,
      aprobadoEn: null,
      anuladoEn: null,
      reversadoEn: null
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
    // La liquidacion queda congelada en su flujo especializado. El editor generico no conoce
    // saldos iniciales, conciliacion ni indemnizaciones y no debe reconstruirla como rol mensual.
    const actuales = rol.tipo === 'LIQUIDACION'
      ? (await this.getRolPagoDetalle(rolId))?.detalles ?? []
      : detalles;
    const recalculados = rol.tipo === 'LIQUIDACION'
      ? actuales
      : actuales.map((detalle) => this.recalcularDetalle(detalle, config));
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

  /**
   * Mueve un anticipo ya entregado a otro rol mensual sin tocar su fecha ni su asiento. Los roles
   * en borrador de ambos periodos se reconstruyen desde los anticipos REGISTRADOS vigentes para
   * que una linea agregada antigua no termine descontando el mismo dinero dos veces.
   */
  async cambiarPeriodoDescuento(
    anticipoId: string,
    nuevoPeriodo: string
  ): Promise<CambioPeriodoAnticipoResultado> {
    const resumen = await this.anticiposService.getAnticipoDetalle(anticipoId);
    if (!resumen) {
      throw new Error('El anticipo ya no existe.');
    }
    const anticipo = resumen.anticipo;
    const periodoNormalizado = validarCambioPeriodoAnticipo(anticipo, nuevoPeriodo);

    const periodoAnterior = anticipo.periodo;
    const [rolAnterior, rolDestino, pendientesAnterior, pendientesDestino, config, rubros] = await Promise.all([
      this.anticiposService.buscarRolMensual(periodoAnterior),
      this.anticiposService.buscarRolMensual(periodoNormalizado),
      this.anticiposService.getPendientesPorEmpleado(periodoAnterior),
      this.anticiposService.getPendientesPorEmpleado(periodoNormalizado),
      this.getConfiguracionOnce(),
      this.getRubrosOnce()
    ]);

    if (rolDestino?.estado === 'APROBADO') {
      throw new Error(`El rol mensual de ${periodoNormalizado} ya esta aprobado. Elige otro periodo.`);
    }

    const pendientesReprogramados = prepararPendientesReprogramados(
      pendientesAnterior,
      pendientesDestino,
      resumen.detalles
    );

    const rubroAnticipo = rubros.find((rubro) => rubro.codigo === NominaService.CODIGO_RUBRO_ANTICIPO) ?? null;
    const rolesSincronizados: RolSincronizadoCambioPeriodo[] = [];
    const rolesPreparados: Array<{ rol: RolPago; detalles: RolPagoDetalle[] }> = [];
    const candidatos = [
      { rol: rolAnterior, pendientes: pendientesReprogramados.anterior, esDestino: false },
      { rol: rolDestino, pendientes: pendientesReprogramados.destino, esDestino: true }
    ];

    for (const candidato of candidatos) {
      const rol = candidato.rol;
      if (!rol?.id || rol.estado !== 'BORRADOR') {
        continue;
      }
      const detalleRol = await this.getRolPagoDetalle(rol.id);
      if (!detalleRol || detalleRol.rol.estado !== 'BORRADOR') {
        throw new Error(`El rol ${rol.numero ?? rol.periodo} cambio mientras se preparaba la reprogramacion. Vuelve a intentar.`);
      }

      if (candidato.esDestino) {
        const empleadosRol = new Set(detalleRol.detalles.map((detalle) => detalle.empleadoId));
        const faltantes = resumen.detalles
          .filter((detalle) => !empleadosRol.has(detalle.empleadoId))
          .map((detalle) => detalle.empleadoNombre);
        if (faltantes.length > 0) {
          const muestra = faltantes.slice(0, 3).join(', ');
          const resto = faltantes.length > 3 ? ` y ${faltantes.length - 3} mas` : '';
          throw new Error(
            `No se puede cambiar el periodo: ${muestra}${resto} no pertenece${faltantes.length === 1 ? '' : 'n'} al rol borrador ${rol.numero ?? rol.periodo}.`
          );
        }
      }

      const recalculados = detalleRol.detalles.map((detalle) => {
        const lineaAnticipo = this.crearLineaAnticipo(
          candidato.pendientes.get(detalle.empleadoId) ?? 0,
          rubroAnticipo,
          config
        );
        return this.recalcularDetalle(reemplazarLineaAnticipoRol(detalle, lineaAnticipo), config);
      });
      rolesPreparados.push({ rol: detalleRol.rol, detalles: recalculados });
      rolesSincronizados.push({ id: rol.id, periodo: rol.periodo, numero: rol.numero ?? null });
    }

    const timestamp = Date.now();
    const actor = this.audit.currentActor();
    const updates = construirPatchCambioPeriodoAnticipo(
      anticipoId,
      periodoNormalizado,
      timestamp,
      actor.userId
    );

    for (const preparado of rolesPreparados) {
      const rolId = preparado.rol.id!;
      const detallesPorId: Record<string, RolPagoDetalle> = {};
      for (const detalle of preparado.detalles) {
        detallesPorId[detalle.id] = detalle;
      }
      updates[`rolesPagoDetalles/${rolId}`] = detallesPorId;
      const totales = this.calcularTotales(preparado.detalles);
      for (const [campo, valor] of Object.entries(totales)) {
        updates[`rolesPago/${rolId}/${campo}`] = valor;
      }
      updates[`rolesPago/${rolId}/totalEmpleados`] = preparado.detalles.length;
      updates[`rolesPago/${rolId}/actualizadoEn`] = timestamp;
    }

    await update(ref(this.database, this.getNominaPath()), updates);
    await this.audit.recordSafe({
      action: 'actualizar',
      target: {
        module: 'nomina',
        entityType: 'anticipo_nomina',
        entityId: anticipoId,
        label: anticipo.numero
      },
      summary: `Cambio el periodo de descuento del anticipo ${anticipo.numero} de ${periodoAnterior} a ${periodoNormalizado}`,
      changesBefore: { periodo: periodoAnterior },
      changesAfter: {
        periodo: periodoNormalizado,
        rolesSincronizados: rolesSincronizados.map((rol) => rol.numero ?? rol.periodo)
      }
    });

    return { periodoAnterior, periodoNuevo: periodoNormalizado, rolesSincronizados };
  }

  /**
   * Propone las lineas del asiento del rol en modo lenient: las cuentas que falten en la
   * configuracion quedan vacias en lugar de reventar, para que el contador las complete en el
   * dialogo de revision antes de aprobar (mismo flujo que compras y cuentas por pagar).
   */
  async construirLineasRolPago(rolId: string): Promise<AsientoContableLinea[]> {
    const resumen = await this.getRolPagoDetalle(rolId);
    if (!resumen) {
      throw new Error('El rol de pago ya no existe.');
    }
    const config = await this.getConfiguracionOnce();
    const cuentas = await this.planCuentasService.getCuentasOnce();
    const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id ?? '', cuenta]));
    const detalles = await this.resolverCuentasCargoDetalles(resumen.detalles);
    return this.construirLineasRol(resumen.rol, detalles, config, cuentasPorId, true);
  }

  /**
   * @param lineasConfirmadas Lineas revisadas por el contador en el dialogo. Si vienen, se usan tal
   * cual y se omite la validacion estricta de cuentas: el usuario ya resolvio los huecos a mano.
   */
  async aprobarRolPago(rolId: string, lineasConfirmadas?: AsientoContableLinea[]): Promise<void> {
    const resumen = await this.getRolPagoDetalle(rolId);
    if (!resumen) {
      throw new Error('El rol de pago ya no existe.');
    }
    if (resumen.rol.estado === 'ANULADO') {
      throw new Error('No se puede aprobar un rol anulado.');
    }

    const asientoExistente = await get(this.getAsientoOrigenRef(rolId));
    if (asientoExistente.exists()) {
      await this.marcarAprobado(resumen, { asientoId: String(asientoExistente.val()?.asientoId ?? '') });
      return;
    }

    const config = await this.getConfiguracionOnce();

    // Gate de contabilidad: si está desactivada, el rol se aprueba sin generar asiento.
    if (!(await this.integracionContable.contabilidadActiva())) {
      await this.marcarAprobado(resumen, { asientoId: null });
      return;
    }

    let lineas: AsientoContableLinea[];
    if (lineasConfirmadas?.length) {
      lineas = lineasConfirmadas;
    } else {
      const detalles = await this.resolverCuentasCargoDetalles(resumen.detalles);
      lineas = this.construirLineasRol(resumen.rol, detalles, config, await this.crearContexto(config), false);
    }
    const asiento = this.crearAsientoRol(resumen.rol, lineas);
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
    await this.marcarAprobado(resumen, { asientoId, modoAsiento: config.modoAsiento });
  }

  /**
   * Cierra la aprobacion por cualquiera de sus caminos (con asiento, sin asiento o con asiento ya
   * existente) y deja el aporte del rol en el historial anual del empleado.
   */
  private async marcarAprobado(resumen: ResumenRolPago, patch: Record<string, unknown>): Promise<void> {
    const timestamp = Date.now();
    if ((resumen.rol.tipo ?? 'MENSUAL') === 'LIQUIDACION') {
      const liquidacion = await this.getLiquidacionByRolId(resumen.rol.id ?? '');
      if (!liquidacion) throw new Error('No se encontro el expediente de la liquidacion.');
      await update(ref(this.database), this.paraFirebase({
        [`${this.getNominaPath()}/rolesPago/${resumen.rol.id}`]: { ...resumen.rol, ...patch, estado: 'APROBADO', actualizadoEn: timestamp, aprobadoEn: timestamp },
        [`${this.getNominaPath()}/liquidaciones/${resumen.rol.id}/estado`]: 'APROBADA',
        [`${this.getNominaPath()}/liquidaciones/${resumen.rol.id}/asientoId`]: patch['asientoId'] ?? null,
        [`${this.getNominaPath()}/liquidaciones/${resumen.rol.id}/actualizadoEn`]: timestamp,
        [`${this.getNominaPath()}/liquidaciones/${resumen.rol.id}/aprobadoEn`]: timestamp,
        [`${this.getNominaPath()}/empleados/${liquidacion.empleadoId}/estado`]: 'INACTIVO',
        [`${this.getNominaPath()}/empleados/${liquidacion.empleadoId}/fechaSalida`]: liquidacion.fechaSalida,
        [`${this.getNominaPath()}/empleados/${liquidacion.empleadoId}/motivoSalida`]: liquidacion.causalTerminacion,
        [`${this.getNominaPath()}/empleados/${liquidacion.empleadoId}/actualizadoEn`]: timestamp
      }));
    } else {
      await update(ref(this.database, `${this.getNominaPath()}/rolesPago/${resumen.rol.id}`), {
        ...patch,
        estado: 'APROBADO',
        actualizadoEn: timestamp,
        aprobadoEn: timestamp
      });
    }
    await this.registrarAcumulados(resumen);
    await this.descontarAnticipos(resumen);
  }

  /**
   * Cierra los anticipos que este rol acaba de descontar. Solo cuenta lo que el rol realmente
   * descuenta: si el contador borró o redujo la linea de anticipo de un empleado, su anticipo
   * sigue pendiente y reaparece en el siguiente rol en lugar de darse por cobrado.
   */
  private async descontarAnticipos(resumen: ResumenRolPago): Promise<void> {
    if (!['MENSUAL', 'LIQUIDACION'].includes(resumen.rol.tipo ?? 'MENSUAL')) {
      return;
    }
    const cubierto = new Map<string, number>();
    for (const detalle of resumen.detalles) {
      const monto = this.roundToTwo((detalle.lineas ?? [])
        .filter((linea) => linea.tipo === 'DESCUENTO' && linea.codigo === NominaService.CODIGO_RUBRO_ANTICIPO)
        .reduce((total, linea) => total + linea.monto, 0));
      if (monto > 0) {
        cubierto.set(detalle.empleadoId, monto);
      }
    }
    if (cubierto.size === 0) {
      return;
    }
    await this.anticiposService.marcarDescontados(resumen.rol.periodo, cubierto, resumen.rol);
  }

  /**
   * Escribe el aporte de cada empleado bajo acumulados/{empleadoId}/{anio}/{rolId}. Se indexa por
   * rolId para que reaprobar o reversar el mismo rol sustituya su aporte en lugar de duplicarlo.
   */
  private async registrarAcumulados(resumen: ResumenRolPago): Promise<void> {
    const rol = resumen.rol;
    const anio = rol.periodo.slice(0, 4);
    const empleados = new Map((await this.getEmpleadosOnce()).map((empleado) => [empleado.id ?? '', empleado]));
    const timestamp = Date.now();
    const updates: Record<string, AporteAcumuladoNomina> = {};

    for (const detalle of resumen.detalles) {
      const ingresosGravados = this.roundToTwo((detalle.lineas ?? [])
        .filter((linea) => linea.tipo === 'INGRESO' && linea.afectaIess)
        .reduce((total, linea) => total + linea.monto, 0));

      updates[`${detalle.empleadoId}/${anio}/${rol.id}`] = {
        rolId: rol.id ?? '',
        rolNumero: rol.numero ?? '',
        tipo: rol.tipo ?? 'MENSUAL',
        periodo: rol.periodo,
        fechaPago: rol.fechaPago,
        ingresosGravados,
        totalIngresos: detalle.totalIngresos,
        aportePersonalIess: detalle.aportePersonalIess,
        aportePatronalIess: detalle.aportePatronalIess,
        decimoTerceroProvision: detalle.decimoTerceroProvision,
        decimoCuartoProvision: detalle.decimoCuartoProvision,
        fondosReservaProvision: detalle.fondosReservaProvision,
        vacacionesProvision: detalle.vacacionesProvision,
        decimoTerceroPagado: this.sumar((detalle.lineas ?? []).filter((linea) => linea.codigo.startsWith('D13_')), (linea) => linea.monto),
        decimoCuartoPagado: this.sumar((detalle.lineas ?? []).filter((linea) => linea.codigo.startsWith('D14_')), (linea) => linea.monto),
        fondosReservaPagado: this.sumar((detalle.lineas ?? []).filter((linea) => linea.codigo.startsWith('FRES_')), (linea) => linea.monto),
        vacacionesPagado: this.sumar((detalle.lineas ?? []).filter((linea) => linea.codigo.startsWith('VAC_')), (linea) => linea.monto),
        // Solo el rol mensual aporta tiempo de servicio; los demas liquidan lo ya acumulado.
        diasTrabajados: (rol.tipo ?? 'MENSUAL') === 'MENSUAL'
          ? detalle.diasTrabajadosPeriodo
            ?? calcularDiasTrabajadosPeriodo(empleados.get(detalle.empleadoId)?.fechaIngreso, rol.periodo)
          : 0,
        registradoEn: timestamp
      };
    }

    if (Object.keys(updates).length > 0) {
      await update(ref(this.database, `${this.getNominaPath()}/acumulados`), updates);
    }
  }

  private async borrarAcumulados(resumen: ResumenRolPago): Promise<void> {
    const anio = resumen.rol.periodo.slice(0, 4);
    const updates: Record<string, null> = {};
    for (const detalle of resumen.detalles) {
      updates[`${detalle.empleadoId}/${anio}/${resumen.rol.id}`] = null;
    }
    if (Object.keys(updates).length > 0) {
      await update(ref(this.database, `${this.getNominaPath()}/acumulados`), updates);
    }
  }

  async getAcumuladosEmpleados(anio: string): Promise<AcumuladoEmpleado[]> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/acumulados`));
    if (!snapshot.exists()) {
      return [];
    }
    const empleados = new Map((await this.getEmpleadosOnce())
      .map((empleado) => [empleado.id ?? '', `${empleado.apellidos} ${empleado.nombres}`.trim()]));
    const raw = snapshot.val() as Record<string, Record<string, Record<string, AporteAcumuladoNomina>>>;

    return Object.entries(raw)
      .map(([empleadoId, porAnio]) => ({
        empleadoId,
        empleadoNombre: empleados.get(empleadoId) ?? 'Empleado retirado',
        anio,
        aportes: Object.values(porAnio?.[anio] ?? {})
          .sort((a, b) => a.periodo.localeCompare(b.periodo))
      }))
      .filter((acumulado) => acumulado.aportes.length > 0)
      .sort((a, b) => a.empleadoNombre.localeCompare(b.empleadoNombre));
  }

  /**
   * Desglose de provisiones por empleado y concepto: cuanto se acumulo, cuanto se pago y que saldo
   * queda. Es la pantalla que responde "cuanto llevo de decimo tercero de este empleado" sin tener
   * que recorrer el mayor cuenta por cuenta, y la que debe cuadrar con el rol de decimos.
   */
  async getDesgloseProvisiones(anio: string): Promise<DesgloseProvisiones> {
    const acumulados = await this.getAcumuladosEmpleados(anio);

    const empleados: DesgloseProvisionesEmpleado[] = acumulados.map((acumulado) => {
      const mensuales = acumulado.aportes.filter((aporte) => aporte.tipo === 'MENSUAL');
      const acumuladoPorConcepto: Record<ConceptoProvision, number> = {
        DECIMO_TERCERO: this.sumar(mensuales, (aporte) => aporte.decimoTerceroProvision),
        DECIMO_CUARTO: this.sumar(mensuales, (aporte) => aporte.decimoCuartoProvision),
        FONDOS_RESERVA: this.sumar(mensuales, (aporte) => aporte.fondosReservaProvision),
        VACACIONES: this.sumar(mensuales, (aporte) => aporte.vacacionesProvision)
      };
      // Lo pagado sale de los roles de decimos ya aprobados. Fondos y vacaciones aun no tienen rol
      // propio de pago: se liquidan en el finiquito, asi que hoy su pagado es cero.
      const pagadoPorConcepto: Record<ConceptoProvision, number> = {
        DECIMO_TERCERO: this.sumar(acumulado.aportes, (a) => (a.tipo === 'DECIMO_TERCERO' ? a.totalIngresos : 0) + (a.decimoTerceroPagado ?? 0)),
        DECIMO_CUARTO: this.sumar(acumulado.aportes, (a) => (a.tipo === 'DECIMO_CUARTO' ? a.totalIngresos : 0) + (a.decimoCuartoPagado ?? 0)),
        FONDOS_RESERVA: this.sumar(acumulado.aportes, (a) => a.fondosReservaPagado ?? 0),
        VACACIONES: this.sumar(acumulado.aportes, (a) => a.vacacionesPagado ?? 0)
      };

      return {
        empleadoId: acumulado.empleadoId,
        empleadoNombre: acumulado.empleadoNombre,
        saldos: this.conceptosProvision.map((concepto) => ({
          concepto,
          acumulado: acumuladoPorConcepto[concepto],
          pagado: pagadoPorConcepto[concepto],
          saldo: this.roundToTwo(acumuladoPorConcepto[concepto] - pagadoPorConcepto[concepto])
        })),
        aportes: acumulado.aportes
      };
    });

    const totalesPorConcepto: SaldoProvisionEmpleado[] = this.conceptosProvision.map((concepto) => {
      const saldos = empleados.map((empleado) => empleado.saldos.find((saldo) => saldo.concepto === concepto)!);
      return {
        concepto,
        acumulado: this.sumar(saldos, (saldo) => saldo.acumulado),
        pagado: this.sumar(saldos, (saldo) => saldo.pagado),
        saldo: this.sumar(saldos, (saldo) => saldo.saldo)
      };
    });

    return { anio, empleados, totalesPorConcepto };
  }

  readonly conceptosProvision: ConceptoProvision[] = ['DECIMO_TERCERO', 'DECIMO_CUARTO', 'FONDOS_RESERVA', 'VACACIONES'];

  readonly etiquetasConcepto: Record<ConceptoProvision, string> = {
    DECIMO_TERCERO: 'Décimo tercero',
    DECIMO_CUARTO: 'Décimo cuarto',
    FONDOS_RESERVA: 'Fondos de reserva',
    VACACIONES: 'Vacaciones'
  };

  /** Base de calculo de cada provision, para explicarla en pantalla en vez de mostrar solo la cifra. */
  readonly basesCalculoProvision: Record<ConceptoProvision, string> = {
    DECIMO_TERCERO: 'Total de ingresos del mes / 12',
    DECIMO_CUARTO: 'SBU / 12, proporcional a días trabajados',
    FONDOS_RESERVA: 'Doceava parte del ingreso con derecho',
    VACACIONES: 'Total de ingresos del mes / 24'
  };

  private sumar<T>(items: T[], valor: (item: T) => number): number {
    return this.roundToTwo(items.reduce((total, item) => total + (valor(item) || 0), 0));
  }

  async anularRolPago(rolId: string): Promise<void> {
    const resumen = await this.getRolPagoDetalle(rolId);
    if (!resumen) {
      return;
    }
    if (resumen.rol.estado === 'APROBADO') {
      throw new Error('El rol aprobado debe reversarse contablemente antes de anularse.');
    }
    if ((resumen.rol.tipo ?? 'MENSUAL') === 'LIQUIDACION') {
      throw new Error('Cancela la liquidacion desde su pantalla para restaurar correctamente al empleado.');
    }
    await update(ref(this.database, `${this.getNominaPath()}/rolesPago/${rolId}`), {
      estado: 'ANULADO',
      actualizadoEn: Date.now(),
      anuladoEn: Date.now()
    });
    await this.anticiposService.liberarDescontados(rolId, resumen.rol.periodo);
  }

  async cancelarLiquidacionBorrador(rolId: string): Promise<void> {
    const [liquidacion, resumen] = await Promise.all([this.getLiquidacionByRolId(rolId), this.getRolPagoDetalle(rolId)]);
    if (!liquidacion || !resumen || liquidacion.estado !== 'BORRADOR' || resumen.rol.estado !== 'BORRADOR') {
      throw new Error('Solo se puede cancelar una liquidacion en borrador.');
    }
    const timestamp = Date.now();
    const updates: Record<string, unknown> = {
      [`${this.getNominaPath()}/rolesPago/${rolId}/estado`]: 'ANULADO',
      [`${this.getNominaPath()}/rolesPago/${rolId}/actualizadoEn`]: timestamp,
      [`${this.getNominaPath()}/rolesPago/${rolId}/anuladoEn`]: timestamp,
      [`${this.getNominaPath()}/liquidaciones/${rolId}/estado`]: 'ANULADA',
      [`${this.getNominaPath()}/liquidaciones/${rolId}/actualizadoEn`]: timestamp,
      [`${this.getNominaPath()}/liquidaciones/${rolId}/anuladoEn`]: timestamp,
      [`${this.getNominaPath()}/empleados/${liquidacion.empleadoId}/estado`]: 'ACTIVO',
      [`${this.getNominaPath()}/empleados/${liquidacion.empleadoId}/actualizadoEn`]: timestamp
    };
    if (liquidacion.rolMensualId && liquidacion.detalleRolMensualRetirado) {
      const mensual = await this.getRolPagoDetalle(liquidacion.rolMensualId);
      if (!mensual || mensual.rol.estado !== 'BORRADOR') {
        throw new Error('El rol mensual relacionado ya no esta en borrador; reversalo antes de cancelar la liquidacion.');
      }
      const detalles = [...mensual.detalles.filter((item) => item.empleadoId !== liquidacion.empleadoId), liquidacion.detalleRolMensualRetirado];
      updates[`${this.getNominaPath()}/rolesPagoDetalles/${liquidacion.rolMensualId}/${liquidacion.empleadoId}`] = liquidacion.detalleRolMensualRetirado;
      Object.assign(updates, this.updatesTotalesRol(liquidacion.rolMensualId, detalles, timestamp));
    }
    await update(ref(this.database), this.paraFirebase(updates));
  }

  /**
   * Deshace un rol aprobado: genera el asiento inverso, marca el original como REVERSADO y retira
   * los aportes del historial anual. Antes un rol aprobado era un callejon sin salida.
   */
  async reversarRolPago(rolId: string): Promise<void> {
    const resumen = await this.getRolPagoDetalle(rolId);
    if (!resumen) {
      throw new Error('El rol de pago ya no existe.');
    }
    if (resumen.rol.estado !== 'APROBADO') {
      throw new Error('Solo se puede reversar un rol aprobado.');
    }
    // Reversar el devengo con el pago vivo dejaria el pasivo en negativo: el asiento del pago
    // seguiria descargando una cuenta que ya nadie acredito.
    if (await this.pagosService.tienePagosRegistrados(rolId)) {
      throw new Error('El rol tiene pagos registrados. Anulalos antes de reversar el rol.');
    }

    const timestamp = Date.now();
    let asientoReversionId: string | null = null;

    if (resumen.rol.asientoId) {
      const original = await this.asientosService.getAsientoById(resumen.rol.asientoId);
      if (!original) {
        throw new Error('No se encontro el asiento original del rol para reversarlo.');
      }
      const reverso = this.asientosService.crearReverso(original);
      asientoReversionId = await this.asientosService.aprobarAsiento({
        ...reverso,
        glosa: `Reverso ${this.etiquetasTipoRol[resumen.rol.tipo ?? 'MENSUAL']} ${resumen.rol.periodo}`,
        origen: 'ROL_PAGO',
        origenTipo: 'ROL_PAGO',
        origenId: rolId,
        origenNumero: resumen.rol.numero ?? null,
        origenModulo: 'NOMINA'
      });
      await this.asientosService.marcarReversado(resumen.rol.asientoId);
    }

    await this.borrarAcumulados(resumen);
    // Los anticipos que descontaba este rol vuelven a quedar pendientes.
    await this.anticiposService.liberarDescontados(rolId, resumen.rol.periodo);
    // Se libera el vinculo origen->asiento para que el rol pueda regenerarse limpio si hace falta.
    await set(this.getAsientoOrigenRef(rolId), null);
    await update(ref(this.database, `${this.getNominaPath()}/rolesPago/${rolId}`), {
      estado: 'ANULADO',
      asientoReversionId,
      actualizadoEn: timestamp,
      anuladoEn: timestamp,
      reversadoEn: timestamp
    });
    if ((resumen.rol.tipo ?? 'MENSUAL') === 'LIQUIDACION') {
      const liquidacion = await this.getLiquidacionByRolId(rolId);
      if (liquidacion) {
        await update(ref(this.database), {
          [`${this.getNominaPath()}/liquidaciones/${rolId}/estado`]: 'ANULADA',
          [`${this.getNominaPath()}/liquidaciones/${rolId}/asientoId`]: null,
          [`${this.getNominaPath()}/liquidaciones/${rolId}/actualizadoEn`]: timestamp,
          [`${this.getNominaPath()}/liquidaciones/${rolId}/anuladoEn`]: timestamp,
          [`${this.getNominaPath()}/empleados/${liquidacion.empleadoId}/estado`]: 'EN_LIQUIDACION',
          [`${this.getNominaPath()}/empleados/${liquidacion.empleadoId}/actualizadoEn`]: timestamp
        });
      }
    }
  }

  getDefaultConfiguracion(): ConfiguracionNominaContable {
    return {
      modoAsiento: 'BORRADOR',
      porcentajeAportePersonalIess: 9.45,
      porcentajeAportePatronalIess: 11.15,
      porcentajeContribucionCcc: PORCENTAJE_CCC_DEFECTO,
      salarioBasicoUnificado: 0,
      region: 'SIERRA',
      modoDecimos: 'ACUMULADO',
      provisionarDecimoTercero: true,
      provisionarDecimoCuarto: false,
      provisionarFondosReserva: false,
      provisionarVacaciones: true,
      cuentaGastoSueldosId: '',
      cuentaGastoBeneficiosSocialesId: '',
      cuentaGastoDecimoTerceroId: '',
      cuentaGastoDecimoCuartoId: '',
      cuentaGastoFondosReservaId: '',
      cuentaGastoVacacionesId: '',
      cuentaGastoAportePatronalId: '',
      cuentaGastoDesahucioId: '',
      cuentaGastoIndemnizacionId: '',
      cuentaSueldosPorPagarId: '',
      cuentaIessPorPagarId: '',
      cuentaBeneficiosSocialesPorPagarId: '',
      cuentaAnticiposEmpleadosId: '',
      cuentaPrestamosEmpleadosId: '',
      cuentaDecimosPorPagarId: '',
      cuentaDecimoTerceroPorPagarId: '',
      cuentaDecimoCuartoPorPagarId: '',
      cuentaFondosReservaPorPagarId: '',
      cuentaVacacionesPorPagarId: '',
      cuentaUtilidadesPorPagarId: '',
      cuentaLiquidacionesPorPagarId: '',
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

  /** Un periodo admite un rol vigente por tipo: el mensual de diciembre convive con el de decimo tercero. */
  private async buscarRolPorPeriodo(periodo: string, tipo: TipoRolNomina): Promise<RolPago | null> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/rolesPago`));
    if (!snapshot.exists()) {
      return null;
    }
    const raw = snapshot.val() as Record<string, RolPago>;
    const match = Object.entries(raw)
      .find(([, rol]) => rol.periodo === periodo && (rol.tipo ?? 'MENSUAL') === tipo && rol.estado !== 'ANULADO');
    return match ? this.normalizarRol(match[1], match[0]) : null;
  }

  /**
   * Linea de descuento por anticipo entregado en el periodo. Va como origen RUBRO, no SISTEMA:
   * recalcularDetalle descarta y regenera todas las lineas SISTEMA, asi que un anticipo marcado
   * como SISTEMA desapareceria al primer guardado del borrador.
   */
  crearLineaAnticipo(
    monto: number,
    rubroAnticipo: RubroNomina | null,
    config: ConfiguracionNominaContable
  ): RolPagoLinea | null {
    const montoNormalizado = this.roundToTwo(monto);
    if (montoNormalizado <= 0) {
      return null;
    }
    return {
      rubroId: rubroAnticipo?.id ?? '',
      codigo: NominaService.CODIGO_RUBRO_ANTICIPO,
      nombre: rubroAnticipo?.nombre ?? 'Anticipo de sueldo',
      tipo: 'DESCUENTO',
      afectaIess: false,
      cuentaContableId: rubroAnticipo?.cuentaContableId || config.cuentaAnticiposEmpleadosId || '',
      monto: montoNormalizado,
      origen: 'RUBRO',
      editable: true
    };
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

  private calcularDetalle(
    empleado: EmpleadoNomina,
    rubrosAutomaticos: RubroNomina[],
    config: ConfiguracionNominaContable,
    periodo: string,
    lineaAnticipo: RolPagoLinea | null = null,
    cargo?: CargoNomina,
    departamento?: DepartamentoNomina,
    fechaSalida?: string
  ): RolPagoDetalle {
    const sueldoMensual = this.roundToTwo(empleado.sueldoBase);
    const diasTrabajadosPeriodo = fechaSalida
      ? calcularDiasTrabajadosHastaSalida(empleado.fechaIngreso, fechaSalida)
      : calcularDiasTrabajadosPeriodo(empleado.fechaIngreso, periodo);
    const factorProporcional = diasTrabajadosPeriodo / 30;
    const sueldoBase = calcularProporcionalMensual(sueldoMensual, diasTrabajadosPeriodo);
    const diasFondosReservaPeriodo = fechaSalida
      ? calcularDiasFondosReservaHastaSalida(
        empleado.fechaIngreso,
        fechaSalida,
        empleado.regimenFondosReserva ?? 'GENERAL'
      )
      : calcularDiasFondosReservaPeriodo(
        empleado.fechaIngreso,
        periodo,
        empleado.regimenFondosReserva ?? 'GENERAL'
      );
    const lineas: RolPagoLinea[] = [this.crearLineaSueldo(sueldoBase)];

    for (const rubro of rubrosAutomaticos) {
      const monto = rubro.modoCalculo === 'PORCENTAJE_SUELDO'
        ? this.roundToTwo(sueldoBase * (Number(rubro.valorReferencia ?? 0) / 100))
        : this.roundToTwo(
          Number(rubro.valorReferencia ?? 0)
          * (rubro.tipo === 'INGRESO' ? factorProporcional : 1)
        );
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

    if (lineaAnticipo) {
      lineas.push({ ...lineaAnticipo });
    }

    const detalleBase: RolPagoDetalle = {
      id: empleado.id ?? `emp_${Date.now()}`,
      empleadoId: empleado.id ?? '',
      empleadoNombre: `${empleado.apellidos} ${empleado.nombres}`.trim(),
      cargoId: cargo?.id ?? empleado.cargoId,
      cargo: cargo?.nombre ?? empleado.cargo,
      departamentoId: departamento?.id ?? empleado.departamentoId,
      departamento: departamento?.nombre ?? empleado.departamento ?? '',
      cuentaGastoSueldosId: cargo?.cuentaGastoSueldosId ?? '',
      sueldoMensual,
      diasTrabajadosPeriodo,
      diasFondosReservaPeriodo,
      sueldoBase,
      modoDecimoTercero: empleado.modoDecimoTercero ?? config.modoDecimos,
      modoDecimoCuarto: empleado.modoDecimoCuarto ?? config.modoDecimos,
      modoFondosReserva: empleado.modoFondosReserva ?? config.modoDecimos,
      regimenFondosReserva: empleado.regimenFondosReserva ?? 'GENERAL',
      aplicaFondosReserva: diasFondosReservaPeriodo > 0,
      decimoTerceroMensualizado: 0,
      decimoCuartoMensualizado: 0,
      fondosReservaMensualizado: 0,
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
   * Recalcula IESS, decimos, fondos y totales a partir de las lineas editables del detalle.
   * Se usa tanto al generar el rol como al guardar ediciones del borrador.
   *
   * Decimos y fondos de reserva siguen la eleccion de CADA empleado (mensualizado vs acumulado),
   * no una politica de la empresa: lo mensualizado se paga en este rol como ingreso que no afecta
   * IESS, y lo acumulado se provisiona. Los fondos de reserva usan la clasificación congelada de
   * cada trabajador: régimen general o trabajo directo de construcción.
   */
  /**
   * Tasas de la planilla en el formato que espera `calcularAportesIess`. El CCC cae al 1% legal si
   * la configuracion del tenant es anterior a que existiera el campo.
   */
  tasasIess(config: ConfiguracionNominaContable): TasasIess {
    return {
      personal: config.porcentajeAportePersonalIess,
      patronal: config.porcentajeAportePatronalIess,
      ccc: config.porcentajeContribucionCcc ?? PORCENTAJE_CCC_DEFECTO
    };
  }

  recalcularDetalle(detalle: RolPagoDetalle, config: ConfiguracionNominaContable): RolPagoDetalle {
    const sueldoLinea = detalle.lineas.find((linea) => linea.origen === 'SUELDO');
    const sueldoBase = this.roundToTwo(sueldoLinea?.monto ?? detalle.sueldoBase);

    // Lineas editables/base, excluyendo las de sistema (IESS y mensualizados) que se regeneran aqui.
    const lineasNegocio = detalle.lineas
      .filter((linea) => linea.origen !== 'SISTEMA')
      .map((linea) => ({ ...linea, monto: this.roundToTwo(linea.monto) }));

    const ingresos = lineasNegocio.filter((linea) => linea.tipo === 'INGRESO');
    const descuentosManuales = lineasNegocio.filter((linea) => linea.tipo === 'DESCUENTO');

    // Base de calculo: solo la remuneracion del mes. Lo mensualizado se suma despues para que no
    // se retroalimente (un decimo mensualizado no genera mas decimo).
    const baseRemuneracion = this.roundToTwo(ingresos.reduce((total, linea) => total + linea.monto, 0));
    const baseIess = this.roundToTwo(ingresos.filter((linea) => linea.afectaIess).reduce((total, linea) => total + linea.monto, 0));
    // Los aportes se truncan concepto por concepto, no se redondean: asi cuadran contra la planilla.
    const aportes = calcularAportesIess(baseIess, this.tasasIess(config));
    const aportePersonalIess = aportes.aportePersonal;
    const aportePatronalIess = aportes.aportePatronal;
    const contribucionCcc = aportes.contribucionCcc;

    const diasTrabajados = Math.max(0, Math.min(30, detalle.diasTrabajadosPeriodo ?? 30));
    const diasFondos = Math.max(
      0,
      Math.min(
        diasTrabajados,
        detalle.diasFondosReservaPeriodo ?? (detalle.aplicaFondosReserva ? diasTrabajados : 0)
      )
    );
    const modoD13 = detalle.modoDecimoTercero ?? config.modoDecimos;
    const modoD14 = detalle.modoDecimoCuarto ?? config.modoDecimos;
    const modoFondos = detalle.modoFondosReserva ?? config.modoDecimos;

    /*
     * Mensualizar y provisionar son dos destinos del MISMO devengado, no dos calculos distintos:
     * el flag `provisionar*` de la empresa decide que hacer con lo acumulado, pero si el trabajador
     * eligio mensualizar hay que devengarlo igual o su rol saldria sin ese rubro. Antes el flag
     * apagaba el calculo entero y un empleado que mensualizaba el decimo cuarto cobraba cero.
     */
    const devengado = calcularDevengadosLegales({
      baseRemuneracion,
      salarioBasicoUnificado: config.salarioBasicoUnificado,
      diasTrabajados,
      diasFondosReserva: diasFondos,
      calcularDecimoTercero: config.provisionarDecimoTercero || modoD13 === 'MENSUALIZADO',
      calcularDecimoCuarto: config.provisionarDecimoCuarto || modoD14 === 'MENSUALIZADO',
      calcularFondosReserva: config.provisionarFondosReserva
        || modoFondos === 'MENSUALIZADO'
        || detalle.regimenFondosReserva === 'CONSTRUCCION'
        || detalle.regimenFondosReserva === 'SERVICIOS_COMPLEMENTARIOS',
      calcularVacaciones: config.provisionarVacaciones
    });

    const decimoTerceroMensualizado = modoD13 === 'MENSUALIZADO' ? devengado.decimoTercero : 0;
    const decimoCuartoMensualizado = modoD14 === 'MENSUALIZADO' ? devengado.decimoCuarto : 0;
    const fondosReservaMensualizado = modoFondos === 'MENSUALIZADO' ? devengado.fondosReserva : 0;

    // Las vacaciones no se mensualizan: se gozan o se liquidan, por eso siempre se provisionan.
    const decimoTerceroProvision = this.roundToTwo(devengado.decimoTercero - decimoTerceroMensualizado);
    const decimoCuartoProvision = this.roundToTwo(devengado.decimoCuarto - decimoCuartoMensualizado);
    const fondosReservaProvision = this.roundToTwo(devengado.fondosReserva - fondosReservaMensualizado);
    const vacacionesProvision = devengado.vacaciones;
    const totalBeneficios = this.roundToTwo(decimoTerceroProvision + decimoCuartoProvision + fondosReservaProvision + vacacionesProvision);

    const lineasSistema: RolPagoLinea[] = [];
    this.agregarLineaMensualizada(lineasSistema, 'D13MENS', 'Decimo tercero mensualizado', decimoTerceroMensualizado, config);
    this.agregarLineaMensualizada(lineasSistema, 'D14MENS', 'Decimo cuarto mensualizado', decimoCuartoMensualizado, config);
    this.agregarLineaMensualizada(lineasSistema, 'FRESERVA', 'Fondos de reserva mensualizados', fondosReservaMensualizado, config);

    const totalMensualizado = this.roundToTwo(decimoTerceroMensualizado + decimoCuartoMensualizado + fondosReservaMensualizado);
    const totalIngresos = this.roundToTwo(baseRemuneracion + totalMensualizado);

    const totalDescuentosManuales = this.roundToTwo(descuentosManuales.reduce((total, linea) => total + linea.monto, 0));
    const totalDescuentos = this.roundToTwo(aportePersonalIess + totalDescuentosManuales);
    // El anticipo se separa del resto de descuentos para que el rol lo muestre como tal y para
    // que totalAnticipos del rol cuadre contra el auxiliar de anticipos.
    const totalAnticipos = this.roundToTwo(descuentosManuales
      .filter((linea) => linea.codigo === NominaService.CODIGO_RUBRO_ANTICIPO)
      .reduce((total, linea) => total + linea.monto, 0));

    if (aportePersonalIess > 0) {
      lineasSistema.push({
        rubroId: '',
        codigo: 'IESS',
        nombre: 'Aporte personal IESS',
        tipo: 'DESCUENTO',
        afectaIess: false,
        cuentaContableId: config.cuentaIessPorPagarId ?? '',
        monto: aportePersonalIess,
        origen: 'SISTEMA',
        editable: false
      });
    }

    return {
      ...detalle,
      sueldoBase,
      lineas: [...lineasNegocio, ...lineasSistema],
      ingresosAdicionales: this.roundToTwo(totalIngresos - sueldoBase),
      baseImponibleIess: baseIess,
      aportePersonalIess,
      aportePatronalIess,
      contribucionCcc,
      anticipos: totalAnticipos,
      prestamos: 0,
      otrosDescuentos: this.roundToTwo(totalDescuentosManuales - totalAnticipos),
      decimoTerceroProvision,
      decimoCuartoProvision,
      fondosReservaProvision,
      vacacionesProvision,
      decimoTerceroMensualizado,
      decimoCuartoMensualizado,
      fondosReservaMensualizado,
      totalIngresos,
      totalDescuentos,
      totalBeneficios,
      netoPagar: this.roundToTwo(totalIngresos - totalDescuentos)
    };
  }

  /**
   * Lo mensualizado se paga con el sueldo pero no forma parte de la base de aportes: entra como
   * ingreso que no afecta IESS y se imputa a gasto de beneficios sociales, no a gasto de sueldos.
   */
  private agregarLineaMensualizada(
    lineas: RolPagoLinea[],
    codigo: string,
    nombre: string,
    monto: number,
    config: ConfiguracionNominaContable
  ): void {
    if (monto <= 0) {
      return;
    }
    lineas.push({
      rubroId: '',
      codigo,
      nombre,
      tipo: 'INGRESO',
      afectaIess: false,
      cuentaContableId: config.cuentaGastoBeneficiosSocialesId ?? '',
      monto,
      origen: 'SISTEMA',
      editable: false
    });
  }

  private calcularTotales(detalles: RolPagoDetalle[]): Omit<RolPago, 'periodo' | 'tipo' | 'fechaPago' | 'estado' | 'modoAsiento' | 'totalEmpleados'> {
    return {
      totalIngresos: this.roundToTwo(detalles.reduce((total, d) => total + d.totalIngresos, 0)),
      totalAportePersonalIess: this.roundToTwo(detalles.reduce((total, d) => total + d.aportePersonalIess, 0)),
      totalAportePatronalIess: this.roundToTwo(detalles.reduce((total, d) => total + d.aportePatronalIess, 0)),
      totalContribucionCcc: this.roundToTwo(detalles.reduce((total, d) => total + (d.contribucionCcc ?? 0), 0)),
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

  private construirLineasRol(
    rol: RolPago,
    detalles: RolPagoDetalle[],
    config: ConfiguracionNominaContable,
    cuentasPorId: Map<string, CuentaContable>,
    lenient: boolean
  ): AsientoContableLinea[] {
    const lineas: AsientoContableLinea[] = [];
    const totals = this.calcularTotales(detalles);

    // Los decimos no generan gasto nuevo: liquidan la provision acumulada contra sueldos por pagar.
    const tipoRol = rol.tipo ?? 'MENSUAL';
    if (tipoRol === 'DECIMO_TERCERO' || tipoRol === 'DECIMO_CUARTO') {
      const etiqueta = this.etiquetasTipoRol[tipoRol];
      const cuentaProvision = tipoRol === 'DECIMO_TERCERO'
        ? config.cuentaDecimoTerceroPorPagarId
        : config.cuentaDecimoCuartoPorPagarId;
      this.addLinea(lineas, cuentasPorId, cuentaProvision, `${etiqueta} - provision liquidada`, totals.totalNetoPagar, 0, lenient);
      this.addLinea(lineas, cuentasPorId, config.cuentaSueldosPorPagarId, `${etiqueta} por pagar`, 0, totals.totalNetoPagar, lenient);
      return lineas;
    }

    // Las utilidades no se provisionan mes a mes: el gasto nace al declarar el reparto del ejercicio.
    if (tipoRol === 'UTILIDADES') {
      this.addLinea(lineas, cuentasPorId, config.cuentaGastoBeneficiosSocialesId, 'Participacion trabajadores 15%', totals.totalNetoPagar, 0, lenient);
      this.addLinea(lineas, cuentasPorId, config.cuentaUtilidadesPorPagarId, 'Utilidades por pagar', 0, totals.totalNetoPagar, lenient);
      return lineas;
    }

    // Finiquito: cada rubro se imputa a la cuenta que le corresponde (provision acumulada o gasto
    // nuevo por indemnizaciones) y el neto queda como sueldos por pagar.
    if (tipoRol === 'LIQUIDACION') {
      for (const partida of construirPartidasLiquidacion(detalles, config)) {
        this.addLinea(lineas, cuentasPorId, partida.cuentaId, partida.descripcion, partida.debe, partida.haber, lenient);
      }
      return lineas;
    }

    for (const partida of construirPartidasRolMensual(detalles, config)) {
      this.addLinea(
        lineas,
        cuentasPorId,
        partida.cuentaId,
        partida.descripcion,
        partida.debe,
        partida.haber,
        lenient
      );
    }
    this.validarBalanceLineas(lineas);
    return lineas;
  }

  /** Etiqueta legible del tipo de rol, para glosas de asiento y textos de pantalla. */
  readonly etiquetasTipoRol: Record<TipoRolNomina, string> = {
    MENSUAL: 'Rol de pago',
    DECIMO_TERCERO: 'Decimo tercero',
    DECIMO_CUARTO: 'Decimo cuarto',
    UTILIDADES: 'Utilidades',
    LIQUIDACION: 'Liquidacion'
  };

  private crearAsientoRol(rol: RolPago, lineas: AsientoContableLinea[]): AsientoContable {
    return {
      fecha: rol.fechaPago,
      periodo: '',
      tipo: 'AJUSTE',
      glosa: `${this.etiquetasTipoRol[rol.tipo ?? 'MENSUAL']} ${rol.periodo}`,
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

  private async resolverCuentasCargoDetalles(detalles: RolPagoDetalle[]): Promise<RolPagoDetalle[]> {
    if (detalles.every((detalle) => !!detalle.cuentaGastoSueldosId)) {
      return detalles;
    }
    const cargos = await this.getCargosOnce();
    const porId = new Map(cargos.map((cargo) => [cargo.id ?? '', cargo]));
    const porNombre = new Map(cargos.map((cargo) => [normalizarNombreCatalogoNomina(cargo.nombre), cargo]));
    return detalles.map((detalle) => {
      if (detalle.cuentaGastoSueldosId) {
        return detalle;
      }
      const cargo = porId.get(detalle.cargoId ?? '')
        ?? porNombre.get(normalizarNombreCatalogoNomina(detalle.cargo ?? ''));
      return cargo
        ? { ...detalle, cargoId: cargo.id, cargo: cargo.nombre, cuentaGastoSueldosId: cargo.cuentaGastoSueldosId || '' }
        : detalle;
    });
  }

  private validarBalanceLineas(lineas: AsientoContableLinea[]): void {
    const debe = this.roundToTwo(lineas.reduce((total, linea) => total + linea.debe, 0));
    const haber = this.roundToTwo(lineas.reduce((total, linea) => total + linea.haber, 0));
    if (this.roundToTwo(debe - haber) !== 0) {
      throw new Error(`El asiento propuesto no cuadra: debe ${debe.toFixed(2)} y haber ${haber.toFixed(2)}.`);
    }
  }

  /**
   * @param lenient Cuando la cuenta falta o no es de movimiento, deja la linea sin cuenta en lugar
   * de lanzar, para que el dialogo de revision la muestre y el contador la seleccione.
   */
  private addLinea(
    lineas: AsientoContableLinea[],
    cuentasPorId: Map<string, CuentaContable>,
    cuentaId: string,
    descripcion: string,
    debe: number,
    haber: number,
    lenient: boolean
  ): void {
    const debeNormalizado = this.roundToTwo(debe);
    const haberNormalizado = this.roundToTwo(haber);
    if (debeNormalizado <= 0 && haberNormalizado <= 0) {
      return;
    }
    const cuenta = cuentasPorId.get(cuentaId);
    const usable = !!cuenta && cuenta.estado === 'ACTIVA' && cuenta.permiteMovimiento;
    if (!usable && !lenient) {
      if (!cuenta) {
        throw new Error(`Falta configurar la cuenta para ${descripcion}.`);
      }
      this.validarCuentaMovimiento(cuenta, descripcion);
    }
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

  /** Etiqueta legible de cada cuenta de nomina, usada en validaciones y en el checklist. */
  private readonly etiquetasCuentas: Array<[CuentaNominaKey, string]> = [
    ['cuentaGastoSueldosId', 'gasto sueldos'],
    ['cuentaGastoBeneficiosSocialesId', 'gasto beneficios sociales'],
    ['cuentaGastoDecimoTerceroId', 'gasto decimo tercero'],
    ['cuentaGastoDecimoCuartoId', 'gasto decimo cuarto'],
    ['cuentaGastoFondosReservaId', 'gasto fondos de reserva'],
    ['cuentaGastoVacacionesId', 'gasto vacaciones'],
    ['cuentaGastoAportePatronalId', 'gasto aporte patronal'],
    ['cuentaGastoDesahucioId', 'gasto desahucio'],
    ['cuentaGastoIndemnizacionId', 'gasto indemnizaciones'],
    ['cuentaSueldosPorPagarId', 'sueldos por pagar'],
    ['cuentaIessPorPagarId', 'IESS por pagar'],
    ['cuentaBeneficiosSocialesPorPagarId', 'beneficios sociales por pagar'],
    ['cuentaAnticiposEmpleadosId', 'anticipos empleados'],
    ['cuentaPrestamosEmpleadosId', 'prestamos empleados'],
    ['cuentaDecimoTerceroPorPagarId', 'decimo tercero por pagar'],
    ['cuentaDecimoCuartoPorPagarId', 'decimo cuarto por pagar'],
    ['cuentaFondosReservaPorPagarId', 'fondos reserva por pagar'],
    ['cuentaVacacionesPorPagarId', 'vacaciones por pagar']
    , ['cuentaLiquidacionesPorPagarId', 'liquidaciones por pagar']
  ];

  private async validarCuentasConfiguracion(config: ConfiguracionNominaContable): Promise<void> {
    const cuentas = await this.planCuentasService.getCuentasOnce();
    const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id ?? '', cuenta]));
    for (const [key, nombre] of this.etiquetasCuentas) {
      const cuentaId = config[key];
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

  /** Valida unicamente las cuentas ya elegidas, para permitir guardar la configuracion a medias. */
  private async validarCuentasSeleccionadas(config: ConfiguracionNominaContable): Promise<void> {
    const seleccionadas = this.etiquetasCuentas.filter(([key]) => !!config[key]);
    if (seleccionadas.length === 0) {
      return;
    }
    const cuentas = await this.planCuentasService.getCuentasOnce();
    const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id ?? '', cuenta]));
    for (const [key, nombre] of seleccionadas) {
      const cuenta = cuentasPorId.get(config[key]);
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

  /** Prefijo del numero de rol por tipo, para que el contador distinga un D13 de un rol mensual. */
  private readonly prefijosNumero: Record<TipoRolNomina, string> = {
    MENSUAL: 'NOM',
    DECIMO_TERCERO: 'D13',
    DECIMO_CUARTO: 'D14',
    UTILIDADES: 'UTL',
    LIQUIDACION: 'LIQ'
  };

  private async reservarNumero(tipo: TipoRolNomina, anio: string): Promise<string> {
    const prefijo = this.prefijosNumero[tipo];
    // La secuencia MENSUAL conserva su ruta original para no reiniciar la numeracion existente.
    const rutaSecuencia = tipo === 'MENSUAL'
      ? `${this.getNominaPath()}/secuencias/rolesPago/${anio}`
      : `${this.getNominaPath()}/secuencias/rolesPago/${tipo}/${anio}`;
    const result = await runTransaction(ref(this.database, rutaSecuencia), (current: unknown) => {
      const actual = typeof current === 'number' ? current : 0;
      return actual + 1;
    });
    const secuencia = typeof result.snapshot.val() === 'number' ? Number(result.snapshot.val()) : 1;
    return `${prefijo}-${anio}-${String(secuencia).padStart(5, '0')}`;
  }

  private normalizarConfiguracion(value: unknown): ConfiguracionNominaContable {
    const raw = value as Partial<ConfiguracionNominaContable> | null;
    return {
      ...this.getDefaultConfiguracion(),
      ...raw,
      modoAsiento: raw?.modoAsiento ?? 'BORRADOR',
      cuentaGastoDecimoTerceroId: raw?.cuentaGastoDecimoTerceroId ?? raw?.cuentaGastoBeneficiosSocialesId ?? '',
      cuentaGastoDecimoCuartoId: raw?.cuentaGastoDecimoCuartoId ?? raw?.cuentaGastoBeneficiosSocialesId ?? '',
      cuentaGastoFondosReservaId: raw?.cuentaGastoFondosReservaId ?? raw?.cuentaGastoBeneficiosSocialesId ?? '',
      cuentaGastoVacacionesId: raw?.cuentaGastoVacacionesId ?? raw?.cuentaGastoBeneficiosSocialesId ?? '',
      cuentaGastoDesahucioId: raw?.cuentaGastoDesahucioId ?? raw?.cuentaGastoBeneficiosSocialesId ?? '',
      cuentaGastoIndemnizacionId: raw?.cuentaGastoIndemnizacionId ?? raw?.cuentaGastoBeneficiosSocialesId ?? '',
      cuentaDecimoTerceroPorPagarId: raw?.cuentaDecimoTerceroPorPagarId ?? raw?.cuentaDecimosPorPagarId ?? '',
      cuentaDecimoCuartoPorPagarId: raw?.cuentaDecimoCuartoPorPagarId ?? raw?.cuentaDecimosPorPagarId ?? '',
      cuentaLiquidacionesPorPagarId: raw?.cuentaLiquidacionesPorPagarId ?? raw?.cuentaSueldosPorPagarId ?? '',
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

  private normalizarSaldoInicial(empleadoId: string, value: unknown): SaldoInicialLaboralEmpleado {
    const raw = value as Partial<SaldoInicialLaboralEmpleado> | null;
    return {
      empleadoId,
      fechaCorte: raw?.fechaCorte ?? '',
      decimoTerceroPendiente: this.roundToTwo(Math.max(0, Number(raw?.decimoTerceroPendiente) || 0)),
      decimoCuartoPendiente: this.roundToTwo(Math.max(0, Number(raw?.decimoCuartoPendiente) || 0)),
      fondosReservaPendiente: this.roundToTwo(Math.max(0, Number(raw?.fondosReservaPendiente) || 0)),
      diasVacacionesPendientes: this.roundToTwo(Math.max(0, Number(raw?.diasVacacionesPendientes) || 0)),
      valorVacacionesPendiente: this.roundToTwo(Math.max(0, Number(raw?.valorVacacionesPendiente) || 0)),
      confirmadoSinSaldos: !!raw?.confirmadoSinSaldos,
      observacion: raw?.observacion?.trim() ?? '',
      referenciaDocumental: raw?.referenciaDocumental?.trim() ?? '',
      creadoEn: raw?.creadoEn,
      actualizadoEn: raw?.actualizadoEn
    };
  }

  private paraFirebase<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private observarCatalogo<T extends { id?: string; nombre: string }>(coleccion: 'cargos' | 'departamentos'): Observable<T[]> {
    return new Observable<T[]>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, `${this.getNominaPath()}/${coleccion}`),
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }
          const raw = snapshot.val() as Record<string, T>;
          subscriber.next(Object.entries(raw)
            .map(([id, item]) => ({ ...item, id }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })));
        },
        (error) => subscriber.error(error)
      );
      return () => unsubscribe();
    });
  }

  private async leerCatalogo<T extends { id?: string; nombre: string }>(coleccion: 'cargos' | 'departamentos'): Promise<T[]> {
    const snapshot = await get(ref(this.database, `${this.getNominaPath()}/${coleccion}`));
    if (!snapshot.exists()) {
      return [];
    }
    const raw = snapshot.val() as Record<string, T>;
    return Object.entries(raw)
      .map(([id, item]) => ({ ...item, id }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }

  private async validarNombreCatalogoUnico(
    coleccion: 'cargos' | 'departamentos',
    nombre: string,
    itemId?: string
  ): Promise<void> {
    const items = await this.leerCatalogo<{ id?: string; nombre: string }>(coleccion);
    const clave = normalizarNombreCatalogoNomina(nombre);
    if (items.some((item) => item.id !== itemId && normalizarNombreCatalogoNomina(item.nombre) === clave)) {
      throw new Error(`Ya existe ${coleccion === 'cargos' ? 'un cargo' : 'un departamento'} con ese nombre.`);
    }
  }

  private async sincronizarNombreCatalogoEnEmpleados(
    campoId: 'cargoId' | 'departamentoId',
    id: string,
    campoNombre: 'cargo' | 'departamento',
    nombre: string
  ): Promise<void> {
    const empleados = await this.getEmpleadosOnce();
    const updates: Record<string, unknown> = {};
    const timestamp = Date.now();
    for (const empleado of empleados.filter((item) => item[campoId] === id && item.id)) {
      updates[`${this.getNominaPath()}/empleados/${empleado.id}/${campoNombre}`] = nombre;
      updates[`${this.getNominaPath()}/empleados/${empleado.id}/actualizadoEn`] = timestamp;
    }
    if (Object.keys(updates).length > 0) {
      await update(ref(this.database), updates);
    }
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
    if (!empleado.cargoId) {
      throw new Error('Selecciona un cargo parametrizado para el empleado.');
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
