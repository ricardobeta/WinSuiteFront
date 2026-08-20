import type { jsPDF as JsPdf } from 'jspdf';

import {
  CostoAnalisisFiltros,
  CostoAnalisisResultado,
  CostoMovimientoValorizado,
} from '../models/inventario.models';

const AZUL: [number, number, number] = [31, 78, 121];
const AZUL_CLARO: [number, number, number] = [231, 240, 247];
const TINTA: [number, number, number] = [32, 42, 52];
const SECUNDARIO: [number, number, number] = [82, 96, 109];
const BORDE: [number, number, number] = [215, 222, 228];
const VERDE_CLARO: [number, number, number] = [225, 241, 232];
const AMBAR_CLARO: [number, number, number] = [255, 241, 204];

export async function crearPdfResumenCostos(
  resultado: CostoAnalisisResultado,
  filtros: CostoAnalisisFiltros,
  simboloMoneda = '$',
): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  configurarDocumento(doc, 'Resumen de análisis de costos');
  dibujarEncabezado(
    doc,
    'Resumen de análisis de costos',
    'Valorización y conciliación por producto',
    filtros,
    resultado.generadoEn,
  );
  dibujarIndicadores(doc, resultado, simboloMoneda);

  autoTable(doc, {
    startY: 66,
    margin: { left: 10, right: 10, bottom: 16 },
    head: [
      [
        'SKU / producto',
        'Apertura',
        'Entradas',
        'Salidas',
        'Cierre valorizado',
        'Costo de ventas',
        'Verificación',
      ],
    ],
    body: resultado.rows.map((row) => [
      `${row.sku}\n${row.producto}`,
      `${cantidad(row.saldoInicial)} u.\n${dinero(row.valorInicial, simboloMoneda)}`,
      `${cantidad(row.entradas)} u.\n${dinero(row.valorEntradas, simboloMoneda)}`,
      `${cantidad(row.salidas)} u.\n${dinero(row.costoSalidas, simboloMoneda)}`,
      `${cantidad(row.saldoFinal)} u.\n${dinero(row.valorTotal, simboloMoneda)}\n${dinero(row.costoPromedio, simboloMoneda, 4)} / u.`,
      dinero(row.costoVentas, simboloMoneda),
      row.estado === 'CONCILIADO' ? 'Conciliado' : mensajeRevision(row, simboloMoneda),
    ]),
    foot: [
      [
        `${resultado.rows.length} productos`,
        dinero(resultado.valorInicialInventario, simboloMoneda),
        dinero(resultado.valorEntradasTotal, simboloMoneda),
        dinero(resultado.costoSalidasTotal, simboloMoneda),
        dinero(resultado.valorTotalInventario, simboloMoneda),
        dinero(resultado.cogsTotal, simboloMoneda),
        resultado.productosRevisar
          ? `${resultado.productosRevisar} por revisar`
          : 'Todo conciliado',
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      textColor: TINTA,
      lineColor: BORDE,
      lineWidth: 0.15,
      cellPadding: 2.2,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', minCellHeight: 9 },
    footStyles: { fillColor: AZUL_CLARO, textColor: TINTA, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 34 },
      2: { cellWidth: 34 },
      3: { cellWidth: 34 },
      4: { cellWidth: 43 },
      5: { cellWidth: 32 },
      6: { cellWidth: 47 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const revisar = resultado.rows[data.row.index]?.estado === 'REVISAR';
        data.cell.styles.fillColor = revisar ? AMBAR_CLARO : VERDE_CLARO;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  dibujarPieDePagina(doc, resultado.generadoEn);
  return doc.output('blob');
}

export async function crearPdfMovimientosCostos(
  movimientos: readonly CostoMovimientoValorizado[],
  filtros: CostoAnalisisFiltros,
  generadoEn: number,
  simboloMoneda = '$',
): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  configurarDocumento(doc, 'Movimientos valorizados de inventario');
  dibujarEncabezado(
    doc,
    'Movimientos valorizados',
    `${movimientos.length} movimientos con trazabilidad de costo y saldo`,
    filtros,
    generadoEn,
  );

  autoTable(doc, {
    startY: 40,
    margin: { left: 8, right: 8, bottom: 16 },
    head: [
      [
        'Fecha',
        'SKU / producto',
        'Tipo / motivo',
        'Entrada',
        'Salida',
        'Costo origen',
        'Costo aplicado',
        'Saldo unidades',
        'Saldo valorizado',
        'Control / referencia',
      ],
    ],
    body: movimientos.length
      ? movimientos.map((movimiento) => [
          formatearFechaHora(movimiento.fecha),
          `${movimiento.sku}\n${movimiento.producto}`,
          `${movimiento.tipo}\n${movimiento.motivo}`,
          movimiento.cantidadEntrada ? cantidad(movimiento.cantidadEntrada) : '—',
          movimiento.cantidadSalida ? cantidad(movimiento.cantidadSalida) : '—',
          dinero(movimiento.costoUnitarioOrigen, simboloMoneda, 4),
          dinero(movimiento.costoAplicado, simboloMoneda),
          cantidad(movimiento.saldoCantidad),
          dinero(movimiento.saldoValor, simboloMoneda),
          `${movimiento.incluidoEnValorizacion ? 'Incluido' : 'Excluido'}\n${movimiento.observacion || movimiento.movimientoId}`,
        ])
      : [['Sin movimientos en el periodo', '', '', '', '', '', '', '', '', '']],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.7,
      textColor: TINTA,
      lineColor: BORDE,
      lineWidth: 0.12,
      cellPadding: 1.7,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', minCellHeight: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 43 },
      2: { cellWidth: 32 },
      3: { cellWidth: 18 },
      4: { cellWidth: 18 },
      5: { cellWidth: 27 },
      6: { cellWidth: 27 },
      7: { cellWidth: 25 },
      8: { cellWidth: 30 },
      9: { cellWidth: 45 },
    },
  });

  dibujarPieDePagina(doc, generadoEn);
  return doc.output('blob');
}

export function nombreReporteCostos(prefijo: string, filtros: CostoAnalisisFiltros): string {
  const desde = formatearFechaArchivo(filtros.fechaDesde) || 'inicio';
  const hasta = formatearFechaArchivo(filtros.fechaHasta) || 'actual';
  return `${prefijo}-${filtros.metodo.toLowerCase()}-${desde}-${hasta}.pdf`;
}

function configurarDocumento(doc: JsPdf, titulo: string): void {
  doc.setProperties({
    title: titulo,
    subject: 'Valorización y conciliación del inventario',
    author: 'WinSuite',
    creator: 'WinSuite Inventario',
  });
}

function dibujarEncabezado(
  doc: JsPdf,
  titulo: string,
  subtitulo: string,
  filtros: CostoAnalisisFiltros,
  generadoEn: number,
): void {
  const ancho = doc.internal.pageSize.getWidth();
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, ancho, 29, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(titulo, 10, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(subtitulo, 10, 18);
  doc.text(
    `Periodo: ${formatearFechaCorta(filtros.fechaDesde)} — ${formatearFechaCorta(filtros.fechaHasta)}`,
    10,
    24,
  );
  doc.setFont('helvetica', 'bold');
  doc.text(etiquetaMetodo(filtros.metodo), ancho - 10, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado: ${formatearFechaHora(generadoEn)}`, ancho - 10, 19, { align: 'right' });
  if (filtros.metodo === 'LIFO') {
    doc.text('Simulación; no usar como reporte NIIF', ancho - 10, 24, { align: 'right' });
  }
}

function dibujarIndicadores(
  doc: JsPdf,
  resultado: CostoAnalisisResultado,
  simboloMoneda: string,
): void {
  const indicadores = [
    ['Inventario inicial', dinero(resultado.valorInicialInventario, simboloMoneda)],
    ['+ Entradas valorizadas', dinero(resultado.valorEntradasTotal, simboloMoneda)],
    ['− Costo de salidas', dinero(resultado.costoSalidasTotal, simboloMoneda)],
    ['= Inventario final', dinero(resultado.valorTotalInventario, simboloMoneda)],
  ];
  const ancho = doc.internal.pageSize.getWidth();
  const gap = 3;
  const anchoTarjeta = (ancho - 20 - gap * 3) / 4;

  indicadores.forEach(([etiqueta, valor], index) => {
    const x = 10 + index * (anchoTarjeta + gap);
    doc.setFillColor(index === 3 ? 231 : 246, index === 3 ? 240 : 248, index === 3 ? 247 : 250);
    doc.roundedRect(x, 33, anchoTarjeta, 20, 2, 2, 'F');
    doc.setTextColor(...SECUNDARIO);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(etiqueta, x + 4, 40);
    doc.setTextColor(...TINTA);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(valor, x + 4, 48);
  });

  doc.setTextColor(...SECUNDARIO);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    `Conciliación: ${dinero(resultado.diferenciaConciliacion, simboloMoneda)}  ·  ` +
      `Costo asociado a ventas: ${dinero(resultado.cogsTotal, simboloMoneda)}  ·  ` +
      `${resultado.productosRevisar} productos por revisar`,
    10,
    60,
  );
}

function dibujarPieDePagina(doc: JsPdf, generadoEn: number): void {
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    const ancho = doc.internal.pageSize.getWidth();
    const alto = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...BORDE);
    doc.line(10, alto - 11, ancho - 10, alto - 11);
    doc.setTextColor(...SECUNDARIO);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`WinSuite Inventario · ${formatearFechaHora(generadoEn)}`, 10, alto - 6);
    doc.text(`Página ${pagina} de ${paginas}`, ancho - 10, alto - 6, { align: 'right' });
  }
}

function mensajeRevision(
  row: CostoAnalisisResultado['rows'][number],
  simboloMoneda: string,
): string {
  const problemas: string[] = [];
  if (row.cantidadSinCosto > 0) problemas.push(`${cantidad(row.cantidadSinCosto)} u. sin costo`);
  if (row.diferenciaStock !== null && Math.abs(row.diferenciaStock) > 0.000001) {
    problemas.push(`Stock ${cantidad(row.diferenciaStock)}`);
  }
  if (Math.abs(row.diferenciaConciliacion) > 0.01) {
    problemas.push(`Valor ${dinero(row.diferenciaConciliacion, simboloMoneda)}`);
  }
  return problemas.join('\n') || 'Revisar movimientos';
}

function etiquetaMetodo(metodo: CostoAnalisisFiltros['metodo']): string {
  if (metodo === 'FIFO') return 'FIFO · primeras entradas';
  if (metodo === 'LIFO') return 'LIFO · simulación';
  return 'Promedio móvil';
}

function cantidad(value: number): string {
  return new Intl.NumberFormat('es-EC', { maximumFractionDigits: 4 }).format(Number(value || 0));
}

function dinero(value: number, simbolo: string, decimales = 2): string {
  return `${simbolo}${new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(Number(value || 0))}`;
}

function formatearFechaCorta(value?: number): string {
  if (!value) return 'Sin límite';
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'short' }).format(new Date(value));
}

function formatearFechaHora(value: number): string {
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function formatearFechaArchivo(value?: number): string {
  if (!value) return '';
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
