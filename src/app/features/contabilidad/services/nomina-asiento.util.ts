import { ConfiguracionNominaContable, RolPagoDetalle, RolPagoLinea } from '../models/nomina.models';

export interface PartidaNominaMensual {
  cuentaId: string;
  descripcion: string;
  debe: number;
  haber: number;
}

interface AcumuladoPorCuenta {
  monto: number;
  nombres: Set<string>;
}

/**
 * Construye las partidas del rol mensual sin depender de Firebase ni del plan de cuentas. La
 * conversión a AsientoContableLinea y la validación de cuentas de movimiento quedan en el servicio.
 */
export function construirPartidasRolMensual(
  detalles: RolPagoDetalle[],
  config: ConfiguracionNominaContable
): PartidaNominaMensual[] {
  const partidas: PartidaNominaMensual[] = [];
  const round2 = (value: number) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  const sumar = (selector: (detalle: RolPagoDetalle) => number) =>
    round2(detalles.reduce((total, detalle) => total + Number(selector(detalle) || 0), 0));
  const agregar = (cuentaId: string, descripcion: string, debe: number, haber: number) => {
    const debeNormalizado = round2(debe);
    const haberNormalizado = round2(haber);
    if (debeNormalizado <= 0 && haberNormalizado <= 0) {
      return;
    }
    partidas.push({ cuentaId, descripcion, debe: debeNormalizado, haber: haberNormalizado });
  };

  const salariosPorCargo = new Map<string, { cargo: string; cuentaId: string; monto: number }>();
  for (const detalle of detalles) {
    const sueldo = round2((detalle.lineas ?? [])
      .filter((linea) => linea.origen === 'SUELDO')
      .reduce((total, linea) => total + linea.monto, 0));
    if (sueldo <= 0) {
      continue;
    }
    const cargo = detalle.cargo?.trim() || 'Cargo sin parametrizar';
    const key = detalle.cargoId || cargo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    const actual = salariosPorCargo.get(key);
    salariosPorCargo.set(key, {
      cargo,
      cuentaId: actual?.cuentaId || detalle.cuentaGastoSueldosId || '',
      monto: round2((actual?.monto ?? 0) + sueldo)
    });
  }
  for (const item of [...salariosPorCargo.values()].sort((a, b) => a.cargo.localeCompare(b.cargo, 'es', { sensitivity: 'base' }))) {
    agregar(item.cuentaId, `Sueldos y salarios · ${item.cargo}`, item.monto, 0);
  }

  const ingresosPorCuenta = agruparLineasPorCuenta(
    detalles,
    (linea) => linea.tipo === 'INGRESO' && linea.origen === 'RUBRO',
    config.cuentaGastoSueldosId,
    round2
  );
  for (const [cuentaId, acumulado] of ingresosPorCuenta) {
    agregar(cuentaId, descripcionAgrupada(acumulado.nombres, 'Otros ingresos de nómina'), acumulado.monto, 0);
  }

  const d13Mensualizado = sumar((detalle) => detalle.decimoTerceroMensualizado ?? 0);
  const d14Mensualizado = sumar((detalle) => detalle.decimoCuartoMensualizado ?? 0);
  const fondosMensualizados = sumar((detalle) => detalle.fondosReservaMensualizado ?? 0);
  const beneficiosMensualizados = round2(d13Mensualizado + d14Mensualizado + fondosMensualizados);
  const d13Provision = sumar((detalle) => detalle.decimoTerceroProvision);
  const d14Provision = sumar((detalle) => detalle.decimoCuartoProvision);
  const fondosProvision = sumar((detalle) => detalle.fondosReservaProvision);
  const vacacionesProvision = sumar((detalle) => detalle.vacacionesProvision);

  agregar(config.cuentaGastoDecimoTerceroId, 'Gasto décimo tercer sueldo', d13Mensualizado + d13Provision, 0);
  agregar(config.cuentaGastoDecimoCuartoId, 'Gasto décimo cuarto sueldo', d14Mensualizado + d14Provision, 0);
  agregar(config.cuentaGastoFondosReservaId, 'Gasto fondos de reserva', fondosMensualizados + fondosProvision, 0);
  agregar(config.cuentaGastoVacacionesId, 'Gasto vacaciones', vacacionesProvision, 0);

  const aportePersonal = sumar((detalle) => detalle.aportePersonalIess);
  const aportePatronal = sumar((detalle) => detalle.aportePatronalIess);
  const ccc = sumar((detalle) => detalle.contribucionCcc ?? 0);
  const costoPatronal = round2(aportePatronal + ccc);
  agregar(
    config.cuentaGastoAportePatronalId,
    ccc > 0 ? 'Aporte patronal IESS (incluye CCC)' : 'Aporte patronal IESS',
    costoPatronal,
    0
  );

  const descuentosPorCuenta = agruparLineasPorCuenta(
    detalles,
    (linea) => linea.tipo === 'DESCUENTO' && linea.origen === 'RUBRO',
    config.cuentaAnticiposEmpleadosId,
    round2
  );

  const neto = sumar((detalle) => detalle.netoPagar);
  const sueldosPorPagar = round2(neto - beneficiosMensualizados);
  if (sueldosPorPagar < 0) {
    throw new Error('Los beneficios mensualizados superan el neto del rol; revisa los descuentos antes de aprobar.');
  }
  agregar(config.cuentaSueldosPorPagarId, 'Sueldos por pagar', 0, sueldosPorPagar);
  agregar(config.cuentaBeneficiosSocialesPorPagarId, 'Beneficios sociales por pagar', 0, beneficiosMensualizados);
  agregar(config.cuentaIessPorPagarId, 'IESS por pagar', 0, aportePersonal + costoPatronal);

  for (const [cuentaId, acumulado] of descuentosPorCuenta) {
    agregar(cuentaId, descripcionAgrupada(acumulado.nombres, 'Descuentos a empleados'), 0, acumulado.monto);
  }

  agregar(config.cuentaDecimoTerceroPorPagarId, 'Décimo tercero por pagar', 0, d13Provision);
  agregar(config.cuentaDecimoCuartoPorPagarId, 'Décimo cuarto por pagar', 0, d14Provision);
  agregar(config.cuentaFondosReservaPorPagarId, 'Fondos de reserva por pagar', 0, fondosProvision);
  agregar(config.cuentaVacacionesPorPagarId, 'Vacaciones por pagar', 0, vacacionesProvision);

  return partidas;
}

function agruparLineasPorCuenta(
  detalles: RolPagoDetalle[],
  filtro: (linea: RolPagoLinea) => boolean,
  cuentaFallbackId: string,
  round2: (value: number) => number
): Map<string, AcumuladoPorCuenta> {
  const porCuenta = new Map<string, AcumuladoPorCuenta>();
  for (const detalle of detalles) {
    for (const linea of detalle.lineas ?? []) {
      if (!filtro(linea)) {
        continue;
      }
      const cuentaId = linea.cuentaContableId || cuentaFallbackId;
      const actual = porCuenta.get(cuentaId) ?? { monto: 0, nombres: new Set<string>() };
      actual.monto = round2(actual.monto + linea.monto);
      if (linea.nombre?.trim()) {
        actual.nombres.add(linea.nombre.trim());
      }
      porCuenta.set(cuentaId, actual);
    }
  }
  return porCuenta;
}

function descripcionAgrupada(nombres: Set<string>, fallback: string): string {
  return nombres.size === 1 ? [...nombres][0] : fallback;
}
