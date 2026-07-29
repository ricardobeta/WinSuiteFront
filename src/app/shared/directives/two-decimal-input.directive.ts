import { Directive, ElementRef, HostListener, Input } from '@angular/core';

/**
 * Normaliza un input de importes escrito a mano: acepta la coma del teclado numerico como separador
 * decimal, descarta cualquier otro caracter y limita los decimales.
 *
 * Va sobre `<input type="text" inputmode="decimal">`, nunca sobre `type="number"`: con el input
 * numerico el navegador rechaza la coma y, al escribir "600.", el valor queda incompleto y el
 * binding lo reescribe borrando el punto recien tecleado.
 *
 * Uso: `appTwoDecimalInput` (2 decimales) o `appTwoDecimalInput="4"` para mas precision.
 */
@Directive({
  selector: 'input[appTwoDecimalInput]',
  standalone: true
})
export class TwoDecimalInputDirective {
  /** Decimales permitidos. El atributo sin valor (uso historico) equivale a 2. */
  @Input('appTwoDecimalInput') decimales: string | number = 2;

  /** Evita procesar el evento que la propia directiva reemite tras normalizar. */
  private reemitiendo = false;

  constructor(private readonly el: ElementRef<HTMLInputElement>) {}

  @HostListener('input')
  onInput(): void {
    if (this.reemitiendo) {
      return;
    }

    const input = this.el.nativeElement;
    const original = input.value;
    const normalizado = this.normalizar(original);
    if (normalizado === original) {
      return;
    }

    // El cursor se mide desde el final: al reescribir el valor el navegador lo manda al final, y
    // asi editar en medio de la cifra no obliga a reposicionarlo a mano.
    const desdeElFinal = original.length - (input.selectionStart ?? original.length);
    input.value = normalizado;
    const posicion = Math.max(0, normalizado.length - desdeElFinal);
    input.setSelectionRange?.(posicion, posicion);

    // Se reemite para que el ControlValueAccessor lea el texto ya normalizado. Sin esto el modelo
    // puede quedarse con lo crudo ("60,5") y romper el Number() del guardado.
    this.reemitiendo = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    this.reemitiendo = false;
  }

  @HostListener('blur')
  onBlur(): void {
    const input = this.el.nativeElement;
    const value = input.value.trim();
    if (!value) {
      return;
    }

    const parsed = Number.parseFloat(value);
    const limpio = Number.isFinite(parsed) ? String(this.redondear(parsed)) : '';
    if (limpio === input.value) {
      return;
    }

    input.value = limpio;
    this.reemitiendo = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    this.reemitiendo = false;
  }

  /**
   * Deja pasar un decimal a medio escribir ("600.") en lugar de descartarlo: es el estado natural
   * mientras se teclea y borrarlo es justo lo que hacia inutilizable al teclado numerico.
   */
  private normalizar(valor: string): string {
    const conPunto = valor.replace(/,/g, '.');
    const soloNumeros = conPunto.replace(/[^\d.]/g, '');
    const partes = soloNumeros.split('.');
    const entero = partes.shift() ?? '';
    const decimal = partes.join('').slice(0, this.maxDecimales());

    if (!soloNumeros.includes('.')) {
      return entero;
    }
    return `${entero || '0'}.${decimal}`;
  }

  private maxDecimales(): number {
    const valor = Number(this.decimales);
    return Number.isFinite(valor) && valor > 0 ? valor : 2;
  }

  private redondear(valor: number): number {
    const factor = 10 ** this.maxDecimales();
    return Math.round(valor * factor) / factor;
  }
}
