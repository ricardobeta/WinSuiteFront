import {
  CargoNomina,
  DepartamentoNomina,
  EmpleadoNomina,
  VistaPreviaImportacionCatalogosNomina
} from '../models/nomina.models';

export function normalizarNombreCatalogoNomina(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es');
}

export function valoresUnicosCatalogoNomina(values: string[]): string[] {
  const unicos = new Map<string, string>();
  for (const value of values) {
    const nombre = value?.trim();
    if (!nombre) {
      continue;
    }
    const clave = normalizarNombreCatalogoNomina(nombre);
    if (!unicos.has(clave)) {
      unicos.set(clave, nombre);
    }
  }
  return [...unicos.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

export function prepararVistaPreviaCatalogosNomina(
  empleados: EmpleadoNomina[],
  cargos: CargoNomina[],
  departamentos: DepartamentoNomina[]
): VistaPreviaImportacionCatalogosNomina {
  const cargosExistentes = new Set(cargos.map((item) => normalizarNombreCatalogoNomina(item.nombre)));
  const departamentosExistentes = new Set(departamentos.map((item) => normalizarNombreCatalogoNomina(item.nombre)));
  const cargosNuevos = valoresUnicosCatalogoNomina(
    empleados.filter((item) => !item.cargoId).map((item) => item.cargo)
  ).filter((nombre) => !cargosExistentes.has(normalizarNombreCatalogoNomina(nombre)));
  const departamentosNuevos = valoresUnicosCatalogoNomina(
    empleados.filter((item) => !item.departamentoId).map((item) => item.departamento ?? '')
  ).filter((nombre) => !departamentosExistentes.has(normalizarNombreCatalogoNomina(nombre)));
  const empleadosPorVincular = empleados.filter((item) =>
    (!item.cargoId && !!item.cargo?.trim()) || (!item.departamentoId && !!item.departamento?.trim())
  ).length;
  return { cargos: cargosNuevos, departamentos: departamentosNuevos, empleadosPorVincular };
}
