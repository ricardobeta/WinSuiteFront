import { ComprobanteCandidato, LineaElegible } from '../models/cumplimiento-sri.models';

export function candidateIsSelected(lines: readonly LineaElegible[], candidate: ComprobanteCandidato): boolean {
  return candidate.gruposIva.length > 0 && candidate.gruposIva.every((group) =>
    lines.some((line) => line.facturaId === candidate.id && Number(line.tarifa) === Number(group.tarifa)));
}

/** Solo modifica las líneas del candidato recibido; conserva las selecciones de otros filtros y páginas. */
export function toggleCandidateSelection(lines: readonly LineaElegible[], candidate: ComprobanteCandidato): LineaElegible[] {
  if (!candidate.elegible) return [...lines];
  const others = lines.filter((line) => line.facturaId !== candidate.id);
  if (candidateIsSelected(lines, candidate)) return others;
  return [...others, ...candidate.gruposIva.map((group) => ({
    facturaId: candidate.id,
    tarifa: group.tarifa,
    baseElegible: group.baseFuente,
    ivaElegible: group.ivaFuente,
    sourceFingerprint: candidate.sourceFingerprint
  }))];
}
