import { TestBed } from '@angular/core/testing';
import { MAT_DATE_LOCALE } from '@angular/material/core';

import { EcuadorDateAdapter } from './ecuador-date.adapter';

describe('EcuadorDateAdapter', () => {
  let adapter: EcuadorDateAdapter;

  /** Lo que el usuario termina viendo en el campo tras salir de el. */
  function comoSeVe(texto: string): string | null {
    const fecha = adapter.parse(texto);
    return fecha ? adapter.format(fecha, 'DD/MM/YYYY') : null;
  }

  beforeEach(() => {
    // NativeDateAdapter inyecta MAT_DATE_LOCALE en un field initializer: hay que crearlo en contexto.
    TestBed.configureTestingModule({
      providers: [EcuadorDateAdapter, { provide: MAT_DATE_LOCALE, useValue: 'es-EC' }]
    });
    adapter = TestBed.inject(EcuadorDateAdapter);
  });

  it('formatea la fecha tecleada de corrido en el teclado numerico', () => {
    // Caso reportado: el contador escribe 8 digitos sin separadores.
    expect(comoSeVe('02122026')).toBe('02/12/2026');
    expect(comoSeVe('31122026')).toBe('31/12/2026');
  });

  it('acepta dos digitos de año escritos de corrido', () => {
    expect(comoSeVe('021226')).toBe('02/12/2026');
  });

  it('acepta un solo digito en dia o mes', () => {
    expect(comoSeVe('2/12/2026')).toBe('02/12/2026');
    expect(comoSeVe('2/1/2026')).toBe('02/01/2026');
  });

  it('acepta guion y punto como separadores', () => {
    expect(comoSeVe('02-12-2026')).toBe('02/12/2026');
    expect(comoSeVe('02.12.2026')).toBe('02/12/2026');
    expect(comoSeVe('02-12-26')).toBe('02/12/2026');
  });

  it('sigue aceptando el formato canonico', () => {
    expect(comoSeVe('02/12/2026')).toBe('02/12/2026');
  });

  it('entiende el ISO que llega al pegar datos de otros sistemas', () => {
    expect(comoSeVe('2026-12-02')).toBe('02/12/2026');
    // 8 digitos que no son un dd/MM valido se reintentan como yyyyMMdd.
    expect(comoSeVe('20261202')).toBe('02/12/2026');
  });

  it('rechaza fechas que el calendario no admite', () => {
    expect(adapter.parse('31022026')).toBeNull(); // 31 de febrero
    expect(adapter.parse('32122026')).toBeNull();
    expect(adapter.parse('02132026')).toBeNull(); // mes 13
  });

  it('no adivina cuando el texto es incompleto o no es una fecha', () => {
    expect(adapter.parse('0212')).toBeNull(); // sin año: adivinarlo seria peor que no parsear
    expect(adapter.parse('')).toBeNull();
    expect(adapter.parse('   ')).toBeNull();
    expect(adapter.parse('mañana')).toBeNull();
    expect(adapter.parse('02/12')).toBeNull();
  });

  it('deja pasar los valores que ya son fecha', () => {
    const fecha = new Date(2026, 11, 2);
    expect(adapter.parse(fecha)).toBe(fecha);
    expect(adapter.parse(new Date('invalida'))).toBeNull();
  });
});
