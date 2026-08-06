import { describe, expect, it } from 'vitest';

import { OPERATIONAL_TABLES, isOperationalTableRegistered } from './operational-tables.registry';

describe('operational table registry', () => {
  it('no contiene identificadores duplicados ni inseguros para Firebase', () => {
    const keys = OPERATIONAL_TABLES.map((table) => `${table.moduleId}/${table.tableId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => /^[a-z0-9_-]+\/[a-z0-9_-]+$/.test(key))).toBe(true);
  });

  it('acepta tablas dinamicas de respuestas y rechaza tablas no registradas', () => {
    expect(isOperationalTableRegistered('sitio-web', 'respuestas-contacto')).toBe(true);
    expect(isOperationalTableRegistered('super-admin', 'empresas')).toBe(false);
  });
});
