import { CostoAnalisisResultado } from '../models/inventario.models';
import {
  crearPdfMovimientosCostos,
  crearPdfResumenCostos,
  nombreReporteCostos,
} from './costos-reporte.util';

describe('costos-reporte', () => {
  const resultado: CostoAnalisisResultado = {
    rows: [
      {
        productoId: 'p1',
        producto: 'Café premium',
        sku: 'CAF-1',
        saldoInicial: 10,
        valorInicial: 50,
        entradas: 2,
        valorEntradas: 12,
        salidas: 4,
        costoSalidas: 20,
        costoVentas: 20,
        saldoFinal: 8,
        saldoRegistrado: 8,
        diferenciaStock: 0,
        costoPromedio: 5.25,
        valorTotal: 42,
        cogs: 20,
        cantidadSinCosto: 0,
        diferenciaConciliacion: 0,
        movimientosPeriodo: 1,
        estado: 'CONCILIADO',
      },
    ],
    movimientos: [
      {
        productoId: 'p1',
        producto: 'Café premium',
        sku: 'CAF-1',
        movimientoId: 'm1',
        fecha: Date.UTC(2026, 0, 15, 12),
        tipo: 'SALIDA',
        motivo: 'VENTA',
        cantidadEntrada: 0,
        cantidadSalida: 4,
        costoUnitarioOrigen: 5,
        costoAplicado: 20,
        saldoCantidad: 8,
        saldoValor: 42,
        incluidoEnValorizacion: true,
        observacion: '',
      },
    ],
    valorInicialInventario: 50,
    valorEntradasTotal: 12,
    costoSalidasTotal: 20,
    valorTotalInventario: 42,
    cogsTotal: 20,
    diferenciaConciliacion: 0,
    productosRevisar: 0,
    esCorteActual: true,
    generadoEn: Date.UTC(2026, 0, 15, 12),
  };

  it('genera el resumen como un PDF descargable', async () => {
    const pdf = await crearPdfResumenCostos(resultado, { metodo: 'FIFO' });
    expect(pdf.type).toBe('application/pdf');
    expect(pdf.size).toBeGreaterThan(1000);
  });

  it('genera el detalle valorizado como un PDF descargable', async () => {
    const pdf = await crearPdfMovimientosCostos(
      resultado.movimientos,
      { metodo: 'FIFO' },
      resultado.generadoEn,
    );
    expect(pdf.type).toBe('application/pdf');
    expect(pdf.size).toBeGreaterThan(1000);
  });

  it('construye nombres PDF trazables', () => {
    expect(
      nombreReporteCostos('costos-resumen', {
        metodo: 'PROMEDIO',
        fechaDesde: new Date(2026, 0, 1).getTime(),
        fechaHasta: new Date(2026, 0, 31).getTime(),
      }),
    ).toBe('costos-resumen-promedio-2026-01-01-2026-01-31.pdf');
  });
});
