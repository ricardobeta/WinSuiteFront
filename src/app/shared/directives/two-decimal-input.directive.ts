import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: 'input[appTwoDecimalInput]',
  standalone: true
})
export class TwoDecimalInputDirective {
  constructor(private readonly el: ElementRef<HTMLInputElement>) {}

  @HostListener('input')
  onInput(): void {
    const input = this.el.nativeElement;
    const raw = input.value.replace(/,/g, '.');
    const sanitized = raw.replace(/[^\d.]/g, '');

    const parts = sanitized.split('.');
    const integerPart = parts.shift() ?? '';
    const decimalPart = parts.join('').slice(0, 2);

    if (raw.endsWith('.') || raw.endsWith(',')) {
      input.value = integerPart ? `${integerPart}.` : '0.';
      return;
    }

    if (!decimalPart && sanitized.includes('.')) {
      input.value = integerPart ? `${integerPart}.` : '0.';
      return;
    }

    input.value = sanitized.includes('.') ? `${integerPart || '0'}.${decimalPart}` : integerPart;
  }

  @HostListener('blur')
  onBlur(): void {
    const input = this.el.nativeElement;
    const value = input.value.trim();

    if (!value) {
      return;
    }

    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      input.value = '';
      return;
    }

    const rounded = Math.round(parsed * 100) / 100;
    input.value = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }
}
