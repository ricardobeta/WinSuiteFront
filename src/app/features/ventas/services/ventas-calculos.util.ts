import { CarritoItem } from '../models/ventas.models';

export interface DesgloseIvaVenta {
  tarifa: number;
  baseImponible: number;
  impuesto: number;
  total: number;
}

export interface ResumenCalculoVenta {
  subtotalBruto: number;
  descuentoItems: number;
  subtotalNetoItems: number;
  descuentoGlobal: number;
  descuentoTotal: number;
  impuesto: number;
  desgloseIva: DesgloseIvaVenta[];
  total: number;
}

export function redondearVenta(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function obtenerTarifaIva(
  item: Pick<CarritoItem, 'ivaPorcentaje'>,
  impuestoPorDefecto: number
): number {
  if (Number.isFinite(item.ivaPorcentaje)) {
    return Math.max(0, item.ivaPorcentaje);
  }
  return Number.isFinite(impuestoPorDefecto) ? Math.max(0, impuestoPorDefecto) : 0;
}

export function calcularResumenVenta(
  items: CarritoItem[],
  descuentoGlobalPorcentaje: number,
  impuestoPorDefecto: number
): ResumenCalculoVenta {
  const calculados = items.map((item) => {
    const base = redondearVenta(item.precioUnitario * item.cantidad);
    const descuentoItem = redondearVenta(
      Math.min(base, base * (Math.max(0, item.descuentoItem) / 100))
    );
    const baseNeta = redondearVenta(Math.max(0, base - descuentoItem));

    return { item, base, descuentoItem, baseNeta };
  });

  const subtotalBruto = redondearVenta(
    calculados.reduce((acum, row) => acum + row.base, 0)
  );
  const descuentoItems = redondearVenta(
    calculados.reduce((acum, row) => acum + row.descuentoItem, 0)
  );
  const subtotalNetoItems = redondearVenta(
    calculados.reduce((acum, row) => acum + row.baseNeta, 0)
  );
  const descuentoGlobal = redondearVenta(
    Math.max(0, subtotalNetoItems * (Math.max(0, descuentoGlobalPorcentaje) / 100))
  );
  const descuentoTotal = redondearVenta(descuentoItems + descuentoGlobal);
  const filasIva = calculados.map((row) => {
    const proporcion = subtotalNetoItems > 0 ? row.baseNeta / subtotalNetoItems : 0;
    const descuentoGlobalItem = redondearVenta(descuentoGlobal * proporcion);
    const baseImponible = redondearVenta(Math.max(0, row.baseNeta - descuentoGlobalItem));
    const tarifa = obtenerTarifaIva(row.item, impuestoPorDefecto);
    const impuesto = redondearVenta(baseImponible * (tarifa / 100));

    return { tarifa, baseImponible, impuesto };
  });
  const impuesto = redondearVenta(
    filasIva.reduce((acum, row) => acum + row.impuesto, 0)
  );
  const desglosePorTarifa = new Map<number, DesgloseIvaVenta>();
  for (const row of filasIva) {
    const actual = desglosePorTarifa.get(row.tarifa);
    const baseImponible = redondearVenta((actual?.baseImponible ?? 0) + row.baseImponible);
    const impuestoTarifa = redondearVenta((actual?.impuesto ?? 0) + row.impuesto);
    desglosePorTarifa.set(row.tarifa, {
      tarifa: row.tarifa,
      baseImponible,
      impuesto: impuestoTarifa,
      total: redondearVenta(baseImponible + impuestoTarifa)
    });
  }
  const desgloseIva = [...desglosePorTarifa.values()]
    .sort((a, b) => a.tarifa - b.tarifa);
  const total = redondearVenta(
    Math.max(0, subtotalNetoItems - descuentoGlobal) + impuesto
  );

  return {
    subtotalBruto,
    descuentoItems,
    subtotalNetoItems,
    descuentoGlobal,
    descuentoTotal,
    impuesto,
    desgloseIva,
    total
  };
}
