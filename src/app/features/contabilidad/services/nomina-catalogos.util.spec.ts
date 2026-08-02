import { describe, expect, it } from 'vitest';

import { CargoNomina, DepartamentoNomina, EmpleadoNomina } from '../models/nomina.models';
import { normalizarNombreCatalogoNomina, prepararVistaPreviaCatalogosNomina } from './nomina-catalogos.util';

const empleadoBase: EmpleadoNomina = {
  cedula: '0102030405', nombres: 'Ana', apellidos: 'Pérez', cargo: 'Maestro', departamento: 'Obra',
  fechaIngreso: '2025-01-01', sueldoBase: 1000, estado: 'ACTIVO'
};

describe('catálogos de nómina', () => {
  it('normaliza espacios, mayúsculas y acentos para evitar duplicados equivalentes', () => {
    expect(normalizarNombreCatalogoNomina('  Administración  GENERAL ')).toBe('administracion general');
  });

  it('prepara una importación única e idempotente', () => {
    const empleados: EmpleadoNomina[] = [
      empleadoBase,
      { ...empleadoBase, cedula: '0102030406', cargo: ' maestro ', departamento: 'Óbra' },
      { ...empleadoBase, cedula: '0102030407', cargo: 'Asistente', departamento: '' }
    ];
    const preview = prepararVistaPreviaCatalogosNomina(empleados, [], []);
    expect(preview).toEqual({ cargos: ['Asistente', 'Maestro'], departamentos: ['Obra'], empleadosPorVincular: 3 });

    const cargos: CargoNomina[] = [
      { id: 'maestro', nombre: 'Maestro', cuentaGastoSueldosId: '', activo: true },
      { id: 'asistente', nombre: 'Asistente', cuentaGastoSueldosId: '', activo: true }
    ];
    const departamentos: DepartamentoNomina[] = [{ id: 'obra', nombre: 'Obra', activo: true }];
    const vinculados = empleados.map((item) => ({
      ...item,
      cargoId: normalizarNombreCatalogoNomina(item.cargo) === 'maestro' ? 'maestro' : 'asistente',
      departamentoId: item.departamento ? 'obra' : ''
    }));
    expect(prepararVistaPreviaCatalogosNomina(vinculados, cargos, departamentos))
      .toEqual({ cargos: [], departamentos: [], empleadosPorVincular: 0 });
  });
});
