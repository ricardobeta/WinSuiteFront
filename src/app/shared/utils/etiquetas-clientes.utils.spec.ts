import { describe, expect, it } from 'vitest';

import { EtiquetaClienteConfig } from '../models/clientes.models';
import { normalizarValoresEtiquetasCliente, resolverEtiquetaCliente } from './etiquetas-clientes.utils';

const catalogo: EtiquetaClienteConfig[] = [
  { idEtiqueta: 'id-vip', nombre: 'VIP', color: 'amber', activa: true },
  { idEtiqueta: 'id-antigua', nombre: 'Anterior', color: 'slate', activa: false }
];

describe('etiquetas de clientes', () => {
  it('resuelve ids configurados y conserva el estado desactivado', () => {
    expect(resolverEtiquetaCliente('id-antigua', catalogo)).toMatchObject({
      nombre: 'Anterior', color: 'slate', historica: false, activa: false
    });
  });

  it('muestra valores libres como etiquetas historicas neutras', () => {
    expect(resolverEtiquetaCliente('Importado', catalogo)).toEqual({
      valor: 'Importado', nombre: 'Importado', color: 'slate', historica: true, activa: false
    });
  });

  it('migra coincidencias por nombre a ids y deduplica sin borrar historicas', () => {
    expect(normalizarValoresEtiquetasCliente([' vip ', 'id-vip', 'Importado'], catalogo))
      .toEqual(['id-vip', 'Importado']);
  });

  it('presenta con color configurado un valor historico cuyo nombre ya fue catalogado', () => {
    expect(resolverEtiquetaCliente('VIP', catalogo)).toMatchObject({
      nombre: 'VIP', color: 'amber', historica: false, activa: true
    });
  });
});
