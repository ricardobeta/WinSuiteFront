import { isoADate } from '../../../../shared/utils/fecha-input.util';

export interface DocumentoPagoSeleccionable {
  id?: string;
  numero?: string;
  origenNumero?: string | null;
  saldoPendiente: number;
}

export function fechaPagoLocal(iso: string): number | null {
  return isoADate(iso)?.getTime() ?? null;
}

export function referenciaDocumentoPago(documento: DocumentoPagoSeleccionable): string {
  return documento.origenNumero || documento.numero || 'Documento sin referencia';
}

export function construirGlosaPago(
  documentos: DocumentoPagoSeleccionable[],
  abonos: Record<string, number>,
  referencia: string
): string {
  const facturas = documentos
    .filter((documento) => documento.id && Number(abonos[documento.id] ?? 0) > 0)
    .map(referenciaDocumentoPago);
  const partes = facturas.length ? [`Factura ${facturas.join(', ')}`] : [];
  if (referencia.trim()) {
    partes.push(`Referencia ${referencia.trim()}`);
  }
  return partes.join('; ');
}

export function precargarAbonosPago(documentos: DocumentoPagoSeleccionable[], ids: string[]): Record<string, number> {
  const seleccionados = new Set(ids);
  return documentos.reduce<Record<string, number>>((abonos, documento) => {
    if (documento.id && seleccionados.has(documento.id)) {
      abonos[documento.id] = Math.round((Number(documento.saldoPendiente || 0) + Number.EPSILON) * 100) / 100;
    }
    return abonos;
  }, {});
}
