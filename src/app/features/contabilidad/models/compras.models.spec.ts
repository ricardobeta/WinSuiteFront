import { describe, expect, it } from 'vitest';

import { autorizacionDocumentoModificadoValida } from './compras.models';

describe('autorizacionDocumentoModificadoValida', () => {
  it('acepta autorizaciones numericas de 3 a 49 digitos', () => {
    expect(autorizacionDocumentoModificadoValida('123')).toBe(true);
    expect(autorizacionDocumentoModificadoValida('0107202601179001234500110010020000012341234567811')).toBe(true);
  });

  it('rechaza valores vacios, parciales o no numericos', () => {
    expect(autorizacionDocumentoModificadoValida('')).toBe(false);
    expect(autorizacionDocumentoModificadoValida('12')).toBe(false);
    expect(autorizacionDocumentoModificadoValida('001-002-123')).toBe(false);
    expect(autorizacionDocumentoModificadoValida('123A')).toBe(false);
    expect(autorizacionDocumentoModificadoValida('1'.repeat(50))).toBe(false);
  });
});
