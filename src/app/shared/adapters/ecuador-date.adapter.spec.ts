import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ECUADOR_DATE_FORMATS, EcuadorDateAdapter } from './ecuador-date.adapter';

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

/**
 * Campo igual al de cualquier formulario de la app: matDatepicker sobre un control reactivo.
 * Lo que se prueba aqui no es el adaptador sino el cableado, porque el modo de romperlo es de
 * inyeccion: un componente que importa MatNativeDateModule (o llama a provideNativeDateAdapter)
 * reemplaza a este adaptador por el nativo solo dentro de si mismo, y ahi Date.parse deja de
 * entender lo que la gente teclea. Fue exactamente lo que paso en el formulario de compras.
 */
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule],
  template: `
    <mat-form-field>
      <input matInput [matDatepicker]="picker" [formControl]="fecha" />
      <mat-datepicker #picker></mat-datepicker>
    </mat-form-field>
  `
})
class CampoFechaHost {
  readonly fecha = new FormControl<Date | null>(null);
}

describe('EcuadorDateAdapter · fecha tecleada en un matDatepicker', () => {
  function teclear(texto: string): CampoFechaHost {
    TestBed.configureTestingModule({
      imports: [CampoFechaHost, NoopAnimationsModule],
      providers: [
        { provide: DateAdapter, useClass: EcuadorDateAdapter },
        { provide: MAT_DATE_LOCALE, useValue: 'es-EC' },
        { provide: MAT_DATE_FORMATS, useValue: ECUADOR_DATE_FORMATS }
      ]
    });
    const fixture = TestBed.createComponent(CampoFechaHost);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('registra en el control la fecha tecleada de corrido, sin abrir el calendario', () => {
    expect(teclear('02122026').fecha.value).toEqual(new Date(2026, 11, 2));
  });

  it('registra la fecha con separadores como dia/mes/año, no como mes/dia', () => {
    // Date.parse leeria "02/12/2026" como 12 de febrero: el dia y el mes al reves y sin avisar.
    expect(teclear('02/12/2026').fecha.value).toEqual(new Date(2026, 11, 2));
  });

  it('deja el control vacio mientras la fecha esta a medio teclear', () => {
    expect(teclear('0212').fecha.value).toBeNull();
  });
});
