import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { TwoDecimalInputDirective } from './two-decimal-input.directive';

@Component({
  standalone: true,
  imports: [FormsModule, TwoDecimalInputDirective],
  template: `
    <input type="text" appTwoDecimalInput [(ngModel)]="monto" name="monto" />
    <input type="text" appTwoDecimalInput="4" [(ngModel)]="porcentaje" name="porcentaje" />
  `
})
class HostComponent {
  monto: string | number = 0;
  porcentaje: string | number = 0;
}

describe('TwoDecimalInputDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  /** Simula el tecleo: el navegador deja el texto en el input y emite `input`. */
  function teclear(texto: string, indice = 0): HTMLInputElement {
    const input = fixture.nativeElement.querySelectorAll('input')[indice] as HTMLInputElement;
    input.value = texto;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    return input;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('conserva el punto decimal recien tecleado', () => {
    // Es el bug reportado: con type="number" el binding reescribia el valor y borraba el punto.
    expect(teclear('600.').value).toBe('600.');
    expect(teclear('600.5').value).toBe('600.5');
  });

  it('convierte la coma del teclado numerico en punto, tambien en el modelo', () => {
    const input = teclear('600,5');

    expect(input.value).toBe('600.5');
    // Sin la reemision del evento el modelo se quedaria en "600,5" y Number() daria NaN al guardar.
    expect(Number(host.monto)).toBe(600.5);
    expect(Number.isNaN(Number(host.monto))).toBe(false);
  });

  it('descarta letras y signos que romperian el importe', () => {
    expect(teclear('6a0-0').value).toBe('600');
    expect(teclear('-50').value).toBe('50');
  });

  it('limita a dos decimales y antepone el cero', () => {
    expect(teclear('600.567').value).toBe('600.56');
    expect(teclear('.5').value).toBe('0.5');
  });

  it('permite mas decimales cuando se configuran', () => {
    expect(teclear('9.4567', 1).value).toBe('9.4567');
    expect(teclear('9.45678', 1).value).toBe('9.4567');
  });

  it('al salir del campo deja un numero utilizable', () => {
    const input = teclear('600.');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(input.value).toBe('600');
    expect(Number(host.monto)).toBe(600);
  });
});
