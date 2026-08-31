import { describe, expect, it } from 'vitest';

import { construirGlosaPago, fechaPagoLocal, precargarAbonosPago, referenciaDocumentoPago } from './pago-proveedor-form.utils';

describe('utilidades del pago a proveedor', () => {
  it('convierte una fecha ISO a la medianoche local sin desplazar el día', () => {
    expect(fechaPagoLocal('2026-07-18')).toBe(new Date(2026, 6, 18).getTime());
  });

  it('compone la glosa con facturas aplicadas y referencia', () => {
    expect(construirGlosaPago([
      { id: 'a', origenNumero: '001-001-000000123', saldoPendiente: 10 },
      { id: 'b', numero: 'CXP-0002', saldoPendiente: 20 }
    ], { a: 10, b: 5 }, 'TRX-99')).toBe('Factura 001-001-000000123, CXP-0002; Referencia TRX-99');
  });

  it('usa el número fiscal de una factura existente aunque origenNumero tenga el consecutivo FC', () => {
    const facturaExistente = {
      id: 'a', numero: 'CXP-0126', origenNumero: 'FC-0125', origenTipo: 'FACTURA_COMPRA',
      glosa: 'Factura compra 002-001-000825849', saldoPendiente: 661.71
    };

    expect(referenciaDocumentoPago(facturaExistente)).toBe('002-001-000825849');
    expect(construirGlosaPago([facturaExistente], { a: 661.71 }, '106226873'))
      .toBe('Factura 002-001-000825849; Referencia 106226873');
  });

  it('precarga solo los documentos seleccionados con su saldo vigente', () => {
    expect(precargarAbonosPago([
      { id: 'a', saldoPendiente: 10.456 },
      { id: 'b', saldoPendiente: 20 }
    ], ['b'])).toEqual({ b: 20 });
  });
});
