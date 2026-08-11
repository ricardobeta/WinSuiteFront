import { describe, expect, it } from 'vitest';

import { ComprobanteCandidato, LineaElegible } from '../models/cumplimiento-sri.models';
import { candidateIsSelected, toggleCandidateSelection } from './cumplimiento-sri-selection.util';

describe('selección acumulada de cumplimiento SRI', () => {
  it('conserva comprobantes de páginas anteriores al elegir un candidato con tarifas mixtas', () => {
    const previous: LineaElegible = { facturaId: 'pagina-1', tarifa: 15, baseElegible: 100, ivaElegible: 15, sourceFingerprint: 'a' };
    const candidate = buildCandidate('pagina-2');

    const selected = toggleCandidateSelection([previous], candidate);

    expect(selected).toHaveLength(3);
    expect(selected[0]).toEqual(previous);
    expect(candidateIsSelected(selected, candidate)).toBe(true);
  });

  it('quita únicamente el candidato pulsado', () => {
    const previous: LineaElegible = { facturaId: 'otro-filtro', tarifa: 15, baseElegible: 80, ivaElegible: 12, sourceFingerprint: 'x' };
    const candidate = buildCandidate('actual');
    const withCandidate = toggleCandidateSelection([previous], candidate);

    expect(toggleCandidateSelection(withCandidate, candidate)).toEqual([previous]);
  });
});

function buildCandidate(id: string): ComprobanteCandidato {
  return {
    id, fechaEmision: 1, proveedorRuc: '1790012345001', proveedorNombre: 'Proveedor', codSustento: '01',
    tipoComprobante: '01', establecimiento: '001', puntoEmision: '002', secuencial: '000000001', autorizacion: '1',
    gruposIva: [
      { tarifa: 12, baseFuente: 50, ivaFuente: 6 },
      { tarifa: 15, baseFuente: 100, ivaFuente: 15 }
    ],
    sourceFingerprint: 'fingerprint', elegible: true, motivoBloqueo: '', advertencias: []
  };
}
