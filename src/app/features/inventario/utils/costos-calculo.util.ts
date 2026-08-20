import {
  CostoAnalisisRow,
  CostoMovimientoValorizado,
  KardexEntry,
  MetodoCosteo,
} from '../models/inventario.models';

interface CapaCosto {
  cantidad: number;
  costoUnitario: number;
}

interface EstadoCosto {
  capas: CapaCosto[];
  saldoFisico: number;
  faltantePendiente: number;
}

interface ResultadoAplicacion {
  entrada: number;
  salida: number;
  valorEntrada: number;
  costoSalida: number;
  regularizacionNegativo: number;
  cantidadSinCosto: number;
  incluido: boolean;
  observacion: string;
}

export interface CalculoCostoProductoInput {
  productoId: string;
  producto: string;
  sku: string;
  movimientos: readonly KardexEntry[];
  metodo: MetodoCosteo;
  fechaDesde?: number;
  fechaHasta?: number;
  saldoRegistrado?: number | null;
}

export interface CalculoCostoProductoResultado {
  row: CostoAnalisisRow;
  movimientos: CostoMovimientoValorizado[];
}

const EPSILON_CANTIDAD = 0.000001;
const EPSILON_DINERO = 0.01;

export function calcularCostoProducto(
  input: CalculoCostoProductoInput,
): CalculoCostoProductoResultado {
  const estado: EstadoCosto = { capas: [], saldoFisico: 0, faltantePendiente: 0 };
  const movimientos = ordenarMovimientos(input.movimientos);
  const desde = input.fechaDesde ?? Number.NEGATIVE_INFINITY;
  const hasta = input.fechaHasta ?? Number.POSITIVE_INFINITY;

  for (const movimiento of movimientos) {
    if (movimiento.creadoEn >= desde) break;
    aplicarMovimiento(estado, movimiento, input.metodo);
  }

  const saldoInicial = limpiarCero(estado.saldoFisico);
  const valorInicial = valorEstado(estado);
  let entradas = 0;
  let valorEntradas = 0;
  let salidas = 0;
  let costoSalidas = 0;
  let costoVentas = 0;
  let cantidadSinCosto = 0;
  let movimientosPeriodo = 0;
  const detalle: CostoMovimientoValorizado[] = [];

  for (const movimiento of movimientos) {
    if (movimiento.creadoEn < desde || movimiento.creadoEn > hasta) continue;

    const aplicado = aplicarMovimiento(estado, movimiento, input.metodo);
    movimientosPeriodo += 1;
    entradas += aplicado.entrada;
    valorEntradas += aplicado.valorEntrada;
    salidas += aplicado.salida;
    costoSalidas += aplicado.costoSalida + aplicado.regularizacionNegativo;
    cantidadSinCosto += aplicado.cantidadSinCosto;

    if (esCostoDeVenta(movimiento)) {
      costoVentas += aplicado.costoSalida;
    }

    detalle.push({
      productoId: input.productoId,
      producto: input.producto,
      sku: input.sku,
      movimientoId: movimiento.id,
      fecha: movimiento.creadoEn,
      tipo: movimiento.tipo,
      motivo: movimiento.motivo,
      cantidadEntrada: aplicado.entrada,
      cantidadSalida: aplicado.salida,
      costoUnitarioOrigen: costoUnitarioMovimiento(movimiento),
      costoAplicado: aplicado.costoSalida + aplicado.regularizacionNegativo,
      saldoCantidad: limpiarCero(estado.saldoFisico),
      saldoValor: valorEstado(estado),
      incluidoEnValorizacion: aplicado.incluido,
      observacion: aplicado.observacion,
    });
  }

  const saldoFinal = limpiarCero(estado.saldoFisico);
  const valorTotal = valorEstado(estado);
  const cantidadValorizada = cantidadEstado(estado);
  const costoPromedio = cantidadValorizada > EPSILON_CANTIDAD ? valorTotal / cantidadValorizada : 0;
  const esperado = valorInicial + valorEntradas - costoSalidas;
  const diferenciaConciliacion = limpiarDinero(valorTotal - esperado);
  const saldoRegistrado = input.saldoRegistrado ?? null;
  const diferenciaStock =
    saldoRegistrado === null ? null : limpiarCantidad(saldoRegistrado - saldoFinal);
  const requiereRevision =
    cantidadSinCosto > EPSILON_CANTIDAD ||
    Math.abs(diferenciaConciliacion) > EPSILON_DINERO ||
    (diferenciaStock !== null && Math.abs(diferenciaStock) > EPSILON_CANTIDAD);

  return {
    row: {
      productoId: input.productoId,
      producto: input.producto,
      sku: input.sku,
      saldoInicial,
      valorInicial: limpiarDinero(valorInicial),
      entradas: limpiarCantidad(entradas),
      valorEntradas: limpiarDinero(valorEntradas),
      salidas: limpiarCantidad(salidas),
      costoSalidas: limpiarDinero(costoSalidas),
      costoVentas: limpiarDinero(costoVentas),
      saldoFinal,
      saldoRegistrado,
      diferenciaStock,
      costoPromedio: limpiarDinero(costoPromedio, 6),
      valorTotal: limpiarDinero(valorTotal),
      cogs: limpiarDinero(costoVentas),
      cantidadSinCosto: limpiarCantidad(cantidadSinCosto),
      diferenciaConciliacion,
      movimientosPeriodo,
      estado: requiereRevision ? 'REVISAR' : 'CONCILIADO',
    },
    movimientos: detalle,
  };
}

export function calcularCostoSalidaDesdeMovimientos(
  movimientos: readonly KardexEntry[],
  cantidad: number,
  metodo: MetodoCosteo,
): number {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return 0;

  const estado: EstadoCosto = { capas: [], saldoFisico: 0, faltantePendiente: 0 };
  ordenarMovimientos(movimientos).forEach((movimiento) =>
    aplicarMovimiento(estado, movimiento, metodo),
  );
  return limpiarDinero(consumirCapas(estado.capas, cantidad, metodo).costo / cantidad, 6);
}

function aplicarMovimiento(
  estado: EstadoCosto,
  movimiento: KardexEntry,
  metodo: MetodoCosteo,
): ResultadoAplicacion {
  const cantidad = Math.abs(numeroSeguro(movimiento.cantidad));
  const base: ResultadoAplicacion = {
    entrada: 0,
    salida: 0,
    valorEntrada: 0,
    costoSalida: 0,
    regularizacionNegativo: 0,
    cantidadSinCosto: 0,
    incluido: true,
    observacion: '',
  };

  if (cantidad <= EPSILON_CANTIDAD) {
    return { ...base, incluido: false, observacion: 'Movimiento sin cantidad valorizable.' };
  }

  if (esTraslado(movimiento)) {
    return {
      ...base,
      incluido: false,
      observacion: 'Traslado interno excluido del costo consolidado.',
    };
  }

  const costoUnitario = costoUnitarioMovimiento(movimiento);

  if (esEntrada(movimiento)) {
    estado.saldoFisico += cantidad;
    let cantidadDisponible = cantidad;
    let regularizacionNegativo = 0;

    if (estado.faltantePendiente > EPSILON_CANTIDAD) {
      const regularizada = Math.min(estado.faltantePendiente, cantidadDisponible);
      estado.faltantePendiente -= regularizada;
      cantidadDisponible -= regularizada;
      regularizacionNegativo = regularizada * costoUnitario;
    }

    if (cantidadDisponible > EPSILON_CANTIDAD) {
      agregarEntrada(estado.capas, cantidadDisponible, costoUnitario, metodo);
    }

    return {
      ...base,
      entrada: cantidad,
      valorEntrada: cantidad * costoUnitario,
      regularizacionNegativo,
      observacion:
        regularizacionNegativo > 0
          ? 'Parte de la entrada regulariza una salida previa sin existencias.'
          : '',
    };
  }

  if (esSalida(movimiento)) {
    estado.saldoFisico -= cantidad;
    const consumo = consumirCapas(estado.capas, cantidad, metodo);
    estado.faltantePendiente += consumo.sinCosto;

    return {
      ...base,
      salida: cantidad,
      costoSalida: consumo.costo,
      cantidadSinCosto: consumo.sinCosto,
      observacion:
        consumo.sinCosto > EPSILON_CANTIDAD
          ? `${limpiarCantidad(consumo.sinCosto)} unidades salieron sin costo disponible.`
          : '',
    };
  }

  return { ...base, incluido: false, observacion: 'Tipo de movimiento no reconocido.' };
}

function agregarEntrada(
  capas: CapaCosto[],
  cantidad: number,
  costoUnitario: number,
  metodo: MetodoCosteo,
): void {
  if (metodo !== 'PROMEDIO') {
    capas.push({ cantidad, costoUnitario });
    return;
  }

  const cantidadAnterior = cantidadEstado({ capas, saldoFisico: 0, faltantePendiente: 0 });
  const valorAnterior = valorCapas(capas);
  const cantidadTotal = cantidadAnterior + cantidad;
  const costoPromedio =
    cantidadTotal > 0 ? (valorAnterior + cantidad * costoUnitario) / cantidadTotal : 0;
  capas.splice(0, capas.length, { cantidad: cantidadTotal, costoUnitario: costoPromedio });
}

function consumirCapas(
  capas: CapaCosto[],
  cantidad: number,
  metodo: MetodoCosteo,
): { costo: number; sinCosto: number } {
  let restante = cantidad;
  let costo = 0;

  while (restante > EPSILON_CANTIDAD && capas.length > 0) {
    const indice = metodo === 'LIFO' ? capas.length - 1 : 0;
    const capa = capas[indice];
    const consumida = Math.min(capa.cantidad, restante);
    costo += consumida * capa.costoUnitario;
    capa.cantidad -= consumida;
    restante -= consumida;

    if (capa.cantidad <= EPSILON_CANTIDAD) capas.splice(indice, 1);
  }

  return { costo, sinCosto: Math.max(0, restante) };
}

function esEntrada(movimiento: KardexEntry): boolean {
  return (
    movimiento.tipo === 'ENTRADA' ||
    (movimiento.tipo === 'AJUSTE' && numeroSeguro(movimiento.cantidad) > 0)
  );
}

function esSalida(movimiento: KardexEntry): boolean {
  return (
    movimiento.tipo === 'SALIDA' ||
    (movimiento.tipo === 'AJUSTE' && numeroSeguro(movimiento.cantidad) < 0)
  );
}

function esTraslado(movimiento: KardexEntry): boolean {
  return (
    movimiento.tipo === 'TRASLADO' ||
    movimiento.motivo === 'TRASLADO_ENTRADA' ||
    movimiento.motivo === 'TRASLADO_SALIDA'
  );
}

function esCostoDeVenta(movimiento: KardexEntry): boolean {
  return movimiento.motivo === 'VENTA' || movimiento.motivo === 'RECETA_VENTA';
}

function costoUnitarioMovimiento(movimiento: KardexEntry): number {
  const cantidad = Math.abs(numeroSeguro(movimiento.cantidad));
  const unitario = Number(movimiento.costoUnitario);
  if (Number.isFinite(unitario) && unitario >= 0) return unitario;
  const total = Number(movimiento.costoTotal);
  return cantidad > 0 && Number.isFinite(total) && total >= 0 ? total / cantidad : 0;
}

function ordenarMovimientos(movimientos: readonly KardexEntry[]): KardexEntry[] {
  return [...movimientos].sort(
    (a, b) => a.creadoEn - b.creadoEn || String(a.id ?? '').localeCompare(String(b.id ?? '')),
  );
}

function cantidadEstado(estado: EstadoCosto): number {
  return estado.capas.reduce((total, capa) => total + capa.cantidad, 0);
}

function valorEstado(estado: EstadoCosto): number {
  return limpiarDinero(valorCapas(estado.capas), 8);
}

function valorCapas(capas: readonly CapaCosto[]): number {
  return capas.reduce((total, capa) => total + capa.cantidad * capa.costoUnitario, 0);
}

function numeroSeguro(value: unknown): number {
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : 0;
}

function limpiarCero(value: number): number {
  return Math.abs(value) <= EPSILON_CANTIDAD ? 0 : limpiarCantidad(value);
}

function limpiarCantidad(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function limpiarDinero(value: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
