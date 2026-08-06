import { describe, expect, it } from 'vitest';

import { CampoPersonalizado } from '../../models/clientes.models';
import { CustomFieldValueComponent } from './custom-field-value.component';

function renderValue(field: CampoPersonalizado, value: unknown): CustomFieldValueComponent {
  const component = new CustomFieldValueComponent();
  component.field = field;
  component.value = value;
  return component;
}

describe('CustomFieldValueComponent', () => {
  it('presenta booleanos y valores vacios en lenguaje humano', () => {
    const field: CampoPersonalizado = { idCampo: 'activo', nombreMostrar: 'Activo', tipo: 'booleano' };
    expect(renderValue(field, true).formattedValue).toBe('Sí');
    expect(renderValue(field, false).formattedValue).toBe('No');
    expect(renderValue(field, null).formattedValue).toBe('—');
  });

  it('resuelve las etiquetas configuradas de listas simples y multiples', () => {
    const simple: CampoPersonalizado = {
      idCampo: 'sector',
      nombreMostrar: 'Sector',
      tipo: 'lista_simple',
      opciones: [{ clave: 'retail', valor: 'Comercio minorista' }]
    };
    const multiple: CampoPersonalizado = { ...simple, tipo: 'lista_multiple' };
    expect(renderValue(simple, 'retail').formattedValue).toBe('Comercio minorista');
    expect(renderValue(multiple, ['retail', 'otro']).multipleValues).toEqual([
      'Comercio minorista',
      'otro'
    ]);
  });

  it('formatea fechas sin desplazar fechas ISO por zona horaria', () => {
    const field: CampoPersonalizado = { idCampo: 'fecha', nombreMostrar: 'Fecha', tipo: 'fecha' };
    expect(renderValue(field, '2026-08-05').formattedValue).toBe('05/08/2026');
  });
});
