import { RolPagoDetalle, RolPagoLinea } from '../../../contabilidad/models/nomina.models';
import { TasasIess } from '../../../contabilidad/services/nomina-calculos.util';
import { aportesIessDetalle } from './rol-detalle-desglose.util';

export type GrupoConsolidadoId =
  | 'INGRESOS'
  | 'DESCUENTOS'
  | 'PROVISIONES'
  | 'IESS'
  | 'RESUMEN';

export interface ColumnaConsolidada {
  clave: string;
  etiqueta: string;
  grupo: GrupoConsolidadoId;
  resumen?: boolean;
}

export interface GrupoConsolidado {
  id: GrupoConsolidadoId;
  etiqueta: string;
  columnas: ColumnaConsolidada[];
  columnaResumenClave: string;
  plegable: boolean;
}

export interface FilaConsolidada {
  id: string;
  empleadoNombre: string;
  cargo: string;
  departamento: string;
  valores: Record<string, number>;
  netoNegativo: boolean;
}

export interface MatrizRolConsolidado {
  grupos: GrupoConsolidado[];
  filas: FilaConsolidada[];
  totales: Record<string, number>;
}

interface RubroDetectado {
  clave: string;
  etiqueta: string;
  orden: number;
}

const CODIGO_IESS = 'IESS';

export function construirMatrizRolConsolidado(
  detalles: readonly RolPagoDetalle[],
  tasas: TasasIess
): MatrizRolConsolidado {
  const ingresos = detectarRubros(detalles, 'INGRESO');
  const descuentos = detectarRubros(detalles, 'DESCUENTO');
  const incluirProvision = {
    d13: detalles.some((detalle) => monto(detalle.decimoTerceroProvision) !== 0),
    d14: detalles.some((detalle) => monto(detalle.decimoCuartoProvision) !== 0),
    fondos: detalles.some((detalle) => monto(detalle.fondosReservaProvision) !== 0),
    vacaciones: detalles.some((detalle) => monto(detalle.vacacionesProvision) !== 0)
  };
  const aportes = detalles.map((detalle) => aportesIessDetalle(detalle, tasas));
  const incluirIess = aportes.some((item) =>
    item.aportePersonal !== 0 || item.aportePatronal !== 0 || item.contribucionCcc !== 0
  );

  const grupos: GrupoConsolidado[] = [
    crearGrupoDinamico('INGRESOS', 'Ingresos', ingresos, 'TOTAL_INGRESOS', 'Total ingresos'),
    {
      id: 'DESCUENTOS',
      etiqueta: 'Descuentos',
      columnas: [
        ...descuentos.map((rubro) => columna(rubro.clave, rubro.etiqueta, 'DESCUENTOS')),
        columna('IESS_PERSONAL', 'IESS personal', 'DESCUENTOS'),
        columna('TOTAL_DESCUENTOS', 'Total descuentos', 'DESCUENTOS', true)
      ],
      columnaResumenClave: 'TOTAL_DESCUENTOS',
      plegable: true
    }
  ];

  const columnasProvision: ColumnaConsolidada[] = [];
  if (incluirProvision.d13) columnasProvision.push(columna('PROV_D13', 'Décimo tercero', 'PROVISIONES'));
  if (incluirProvision.d14) columnasProvision.push(columna('PROV_D14', 'Décimo cuarto', 'PROVISIONES'));
  if (incluirProvision.fondos) columnasProvision.push(columna('PROV_FONDOS', 'Fondos de reserva', 'PROVISIONES'));
  if (incluirProvision.vacaciones) columnasProvision.push(columna('PROV_VACACIONES', 'Vacaciones', 'PROVISIONES'));
  if (columnasProvision.length > 0) {
    columnasProvision.push(columna('TOTAL_PROVISIONES', 'Total provisionado', 'PROVISIONES', true));
    grupos.push({
      id: 'PROVISIONES',
      etiqueta: 'Provisiones',
      columnas: columnasProvision,
      columnaResumenClave: 'TOTAL_PROVISIONES',
      plegable: true
    });
  }

  if (incluirIess) {
    grupos.push({
      id: 'IESS',
      etiqueta: 'IESS',
      columnas: [
        columna('IESS_PATRONAL', 'Aporte patronal', 'IESS'),
        columna('IESS_CCC', 'Contribución CCC', 'IESS'),
        columna('TOTAL_PATRONAL', 'Total patronal', 'IESS', true),
        columna('TOTAL_IESS_PAGAR', 'Total a pagar (personal + patronal)', 'IESS', true)
      ],
      columnaResumenClave: 'TOTAL_IESS_PAGAR',
      plegable: true
    });
  }

  grupos.push({
    id: 'RESUMEN',
    etiqueta: 'Resumen',
    columnas: [columna('NETO_PAGAR', 'Neto a pagar', 'RESUMEN', true)],
    columnaResumenClave: 'NETO_PAGAR',
    plegable: false
  });

  const filas = detalles.map((detalle, indice) => construirFila(detalle, aportes[indice], ingresos, descuentos));
  return { grupos, filas, totales: sumarFilasConsolidadas(filas, grupos.flatMap((grupo) => grupo.columnas)) };
}

export function sumarFilasConsolidadas(
  filas: readonly FilaConsolidada[],
  columnas: readonly ColumnaConsolidada[]
): Record<string, number> {
  const totales: Record<string, number> = {};
  for (const columnaActual of columnas) {
    totales[columnaActual.clave] = redondear(filas.reduce(
      (total, fila) => total + monto(fila.valores[columnaActual.clave]),
      0
    ));
  }
  return totales;
}

function construirFila(
  detalle: RolPagoDetalle,
  iess: ReturnType<typeof aportesIessDetalle>,
  ingresos: readonly RubroDetectado[],
  descuentos: readonly RubroDetectado[]
): FilaConsolidada {
  const valores: Record<string, number> = {};
  for (const rubro of [...ingresos, ...descuentos]) valores[rubro.clave] = 0;

  for (const linea of detalle.lineas ?? []) {
    if (linea.tipo === 'DESCUENTO' && linea.codigo === CODIGO_IESS) continue;
    const clave = claveRubro(linea);
    if (clave in valores) valores[clave] = redondear(valores[clave] + monto(linea.monto));
  }

  Object.assign(valores, {
    TOTAL_INGRESOS: monto(detalle.totalIngresos),
    PROV_D13: monto(detalle.decimoTerceroProvision),
    PROV_D14: monto(detalle.decimoCuartoProvision),
    PROV_FONDOS: monto(detalle.fondosReservaProvision),
    PROV_VACACIONES: monto(detalle.vacacionesProvision),
    TOTAL_PROVISIONES: monto(detalle.totalBeneficios),
    IESS_BASE: iess.baseImponible,
    IESS_PERSONAL: iess.aportePersonal,
    IESS_PATRONAL: iess.aportePatronal,
    IESS_CCC: iess.contribucionCcc,
    TOTAL_PATRONAL: iess.costoPatronal,
    TOTAL_IESS_PAGAR: redondear(iess.aportePersonal + iess.costoPatronal),
    TOTAL_DESCUENTOS: monto(detalle.totalDescuentos),
    NETO_PAGAR: monto(detalle.netoPagar)
  });

  return {
    id: detalle.id || detalle.empleadoId,
    empleadoNombre: detalle.empleadoNombre,
    cargo: detalle.cargo ?? '',
    departamento: detalle.departamento ?? '',
    valores,
    netoNegativo: monto(detalle.netoPagar) < 0
  };
}

function detectarRubros(
  detalles: readonly RolPagoDetalle[],
  tipo: 'INGRESO' | 'DESCUENTO'
): RubroDetectado[] {
  const detectados = new Map<string, RubroDetectado>();
  detalles.forEach((detalle, detalleIndice) => {
    (detalle.lineas ?? []).forEach((linea, lineaIndice) => {
      if (linea.tipo !== tipo || (tipo === 'DESCUENTO' && linea.codigo === CODIGO_IESS)) return;
      const clave = claveRubro(linea);
      const orden = linea.origen === 'SUELDO' ? -1 : detalleIndice * 10_000 + lineaIndice;
      const existente = detectados.get(clave);
      if (!existente || orden < existente.orden) {
        detectados.set(clave, {
          clave,
          etiqueta: linea.origen === 'SUELDO' ? 'Sueldo del período' : linea.nombre,
          orden
        });
      }
    });
  });
  return [...detectados.values()].sort((a, b) => a.orden - b.orden || a.etiqueta.localeCompare(b.etiqueta));
}

function crearGrupoDinamico(
  id: 'INGRESOS' | 'DESCUENTOS',
  etiqueta: string,
  rubros: readonly RubroDetectado[],
  totalClave: string,
  totalEtiqueta: string
): GrupoConsolidado {
  return {
    id,
    etiqueta,
    columnas: [
      ...rubros.map((rubro) => columna(rubro.clave, rubro.etiqueta, id)),
      columna(totalClave, totalEtiqueta, id, true)
    ],
    columnaResumenClave: totalClave,
    plegable: true
  };
}

function claveRubro(linea: RolPagoLinea): string {
  if (linea.origen === 'SUELDO') return 'RUBRO:SUELDO';
  const identidad = linea.rubroId?.trim()
    ? `ID:${linea.rubroId.trim()}`
    : `COD:${linea.codigo?.trim() || linea.nombre?.trim() || 'SIN_CODIGO'}`;
  return `RUBRO:${linea.tipo}:${identidad}`;
}

function columna(
  clave: string,
  etiqueta: string,
  grupo: GrupoConsolidadoId,
  resumen = false
): ColumnaConsolidada {
  return { clave, etiqueta, grupo, resumen };
}

function monto(valor: number | null | undefined): number {
  return Number(valor) || 0;
}

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
