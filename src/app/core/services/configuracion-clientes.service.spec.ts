import { describe, expect, it } from 'vitest';

import {
  normalizarConfiguracionClientes,
  ordenFormularioPredeterminado,
  textoComparableEtiqueta
} from './configuracion-clientes.service';
import { CampoPersonalizado } from '../../shared/models/clientes.models';

describe('normalizarConfiguracionClientes', () => {
  it('crea una configuracion segura cuando el tenant aun no tiene datos', () => {
    expect(normalizarConfiguracionClientes(null)).toEqual({
      camposPersonalizados: [],
      catalogoEtiquetas: [],
      ordenFormulario: ['nombreCompleto', 'email', 'telefono', 'direccion', 'identificacion', 'etiquetas']
    });
  });

  it('mantiene el orden historico de campos y los agrega al final del formulario', () => {
    const configuracion = normalizarConfiguracionClientes({
      camposPersonalizados: [
        { idCampo: 'segundo', nombreMostrar: 'Segundo', tipo: 'texto', orden: 2 },
        { idCampo: 'primero', nombreMostrar: 'Primero', tipo: 'fecha', orden: 1 }
      ]
    });

    expect(configuracion.camposPersonalizados.map((campo) => campo.idCampo)).toEqual(['primero', 'segundo']);
    expect(configuracion.ordenFormulario.slice(-2)).toEqual(['custom:primero', 'custom:segundo']);
  });

  it('elimina referencias desconocidas y duplicadas sin perder campos validos', () => {
    const configuracion = normalizarConfiguracionClientes({
      camposPersonalizados: [{ idCampo: 'sector', nombreMostrar: 'Sector', tipo: 'texto' }],
      ordenFormulario: ['etiquetas', 'custom:sector', 'etiquetas', 'custom:borrado', 'nombreCompleto']
    });

    expect(configuracion.ordenFormulario).toEqual([
      'etiquetas', 'custom:sector', 'nombreCompleto', 'email', 'telefono', 'direccion', 'identificacion'
    ]);
  });

  it('normaliza etiquetas, colores desconocidos y estados antiguos', () => {
    const configuracion = normalizarConfiguracionClientes({
      catalogoEtiquetas: [
        { idEtiqueta: 'vip', nombre: ' VIP ', color: 'rose' },
        { idEtiqueta: 'otra', nombre: 'vip', color: 'blue', activa: false },
        { idEtiqueta: 'lead', nombre: 'Prospecto', color: 'inventado', activa: false }
      ]
    });

    expect(configuracion.catalogoEtiquetas).toEqual([
      { idEtiqueta: 'vip', nombre: 'VIP', color: 'rose', activa: true },
      { idEtiqueta: 'lead', nombre: 'Prospecto', color: 'teal', activa: false }
    ]);
  });
});

describe('helpers de configuracion de clientes', () => {
  it('compara nombres sin diferencias de acentos, mayusculas o espacios', () => {
    expect(textoComparableEtiqueta('  Atención   VIP ')).toBe('atencion vip');
  });

  it('construye el orden predeterminado usando el orden de los campos', () => {
    const campos: CampoPersonalizado[] = [
      { idCampo: 'b', nombreMostrar: 'B', tipo: 'texto', orden: 2 },
      { idCampo: 'a', nombreMostrar: 'A', tipo: 'texto', orden: 1 }
    ];
    expect(ordenFormularioPredeterminado(campos).slice(-2)).toEqual(['custom:a', 'custom:b']);
  });
});
