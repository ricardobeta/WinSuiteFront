import { ConfiguracionNominaContable, TipoRolNomina } from '../models/nomina.models';
import { PagoNominaDetalle } from '../models/pagos-nomina.models';

export interface PartidaPagoNomina {
  cuentaId: string;
  descripcion: string;
  debe: number;
  haber: number;
}

function round2(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Cuenta que el pago descarga en el DEBE. Es exactamente la que el asiento de aprobacion del rol
 * acredito, asi que cualquier cambio en construirLineasRol() debe reflejarse aqui o el pasivo
 * quedaria colgado en una cuenta y cancelado en otra.
 */
export function cuentaPasivoPorTipoRol(tipo: TipoRolNomina, config: ConfiguracionNominaContable): string {
  switch (tipo) {
    case 'UTILIDADES':
      return config.cuentaUtilidadesPorPagarId ?? '';
    case 'LIQUIDACION':
      return config.cuentaLiquidacionesPorPagarId ?? '';
    // Los roles de decimos liquidan su provision contra sueldos por pagar, igual que el mensual.
    default:
      return config.cuentaSueldosPorPagarId ?? '';
  }
}

/**
 * Solo el rol mensual reparte el neto entre dos pasivos: sueldos por pagar y beneficios sociales
 * por pagar (los decimos y fondos mensualizados). Los demas tipos concentran todo en un pasivo.
 */
export function usaCuentaBeneficios(tipo: TipoRolNomina): boolean {
  return (tipo ?? 'MENSUAL') === 'MENSUAL';
}

/**
 * Reparte lo que se paga entre los dos pasivos del rol mensual, en la misma proporcion en que se
 * devengaron. El residuo del redondeo cae siempre en sueldos para que montoSueldos +
 * montoBeneficios sea exactamente el monto pagado y la fila del empleado cuadre al centavo.
 */
export function repartirMontoPago(
  monto: number,
  neto: number,
  beneficios: number
): { montoSueldos: number; montoBeneficios: number } {
  const total = round2(monto);
  const netoNormalizado = round2(neto);
  const beneficiosNormalizados = Math.max(0, Math.min(round2(beneficios), netoNormalizado));
  if (total <= 0 || netoNormalizado <= 0 || beneficiosNormalizados <= 0) {
    return { montoSueldos: total, montoBeneficios: 0 };
  }
  const montoBeneficios = Math.min(
    round2(total * (beneficiosNormalizados / netoNormalizado)),
    total
  );
  return { montoSueldos: round2(total - montoBeneficios), montoBeneficios };
}

/**
 * Construye las partidas del pago sin depender de Firebase ni del plan de cuentas. La conversion a
 * AsientoContableLinea y la validacion de cuentas de movimiento quedan en el servicio.
 *
 * Cada empleado aporta su bloque completo DEBE/HABER con su nombre en todas las descripciones, en
 * lugar de un unico HABER sumarizado: asi el mayor de la cuenta del banco muestra a quien se le
 * pago cada valor sin abrir el auxiliar de nomina. Cada bloque cuadra por si mismo.
 */
export function construirPartidasPagoRol(
  rolTipo: TipoRolNomina,
  detalles: PagoNominaDetalle[],
  config: ConfiguracionNominaContable,
  cuentaContableBancoId: string,
  concepto: string
): PartidaPagoNomina[] {
  const partidas: PartidaPagoNomina[] = [];
  const cuentaPasivo = cuentaPasivoPorTipoRol(rolTipo, config);
  const cuentaBeneficios = config.cuentaBeneficiosSocialesPorPagarId ?? '';
  const glosa = concepto?.trim() || 'Pago de nomina';

  const agregar = (cuentaId: string, descripcion: string, debe: number, haber: number) => {
    const debeNormalizado = round2(debe);
    const haberNormalizado = round2(haber);
    if (debeNormalizado <= 0 && haberNormalizado <= 0) {
      return;
    }
    partidas.push({ cuentaId, descripcion, debe: debeNormalizado, haber: haberNormalizado });
  };

  for (const detalle of detalles) {
    // El DEBE se deriva del monto pagado y no de montoSueldos: asi el bloque del empleado cuadra
    // aunque el desglose llegue inconsistente desde un documento viejo o mal armado.
    const montoBeneficios = usaCuentaBeneficios(rolTipo)
      ? Math.max(0, Math.min(round2(detalle.montoBeneficios), round2(detalle.monto)))
      : 0;
    agregar(cuentaPasivo, descripcionEmpleado(glosa, detalle), round2(detalle.monto) - montoBeneficios, 0);
    agregar(cuentaBeneficios, descripcionEmpleado(glosa, detalle, '(beneficios)'), montoBeneficios, 0);
    agregar(cuentaContableBancoId, descripcionEmpleado(glosa, detalle), 0, detalle.monto);
  }

  return partidas;
}

/**
 * Descripcion de las lineas del empleado. La referencia de pago va al final cuando existe, para que
 * el mayor del banco permita rastrear la transferencia sin salir del asiento.
 */
export function descripcionEmpleado(glosa: string, detalle: PagoNominaDetalle, sufijo?: string): string {
  const referencia = detalle.referenciaPago?.trim();
  const base = `${glosa} - ${detalle.empleadoNombre}${sufijo ? ` ${sufijo}` : ''}`;
  return referencia ? `${base} · Ref ${referencia}` : base;
}
