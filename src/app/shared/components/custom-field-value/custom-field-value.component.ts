import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { CampoPersonalizado } from '../../models/clientes.models';

@Component({
  selector: 'app-custom-field-value',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (field.tipo === 'lista_multiple' && multipleValues.length > 0) {
      <span class="multiple-values" [attr.aria-label]="multipleValues.join(', ')">
        @for (item of multipleValues; track $index) {
          <span class="value-chip">{{ item }}</span>
        }
      </span>
    } @else {
      <span class="single-value" [title]="formattedValue">{{ formattedValue }}</span>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; max-width: 22rem; }
    .single-value { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .multiple-values { display: flex; flex-wrap: wrap; gap: .3rem; }
    .value-chip { display: inline-flex; max-width: 12rem; padding: .2rem .5rem; border-radius: 999px; background: var(--tc-surface-container-low); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .78rem; }
  `]
})
export class CustomFieldValueComponent {
  @Input({ required: true }) field!: CampoPersonalizado;
  @Input() value: unknown;

  get multipleValues(): string[] {
    if (this.field.tipo !== 'lista_multiple') return [];
    const values = Array.isArray(this.value)
      ? this.value
      : typeof this.value === 'string' && this.value.trim()
        ? this.value.split(',').map((item) => item.trim())
        : [];
    return values.map((item) => this.optionLabel(item)).filter((item) => item !== '—');
  }

  get formattedValue(): string {
    if (this.value === null || this.value === undefined || this.value === '') return '—';

    switch (this.field.tipo) {
      case 'booleano':
        return this.value === true || this.value === 'true' || this.value === 1 ? 'Sí' : 'No';
      case 'fecha':
        return this.formatDate(this.value);
      case 'lista_simple':
      case 'catalogo':
        return this.optionLabel(this.value);
      case 'lista_multiple':
        return this.multipleValues.length > 0 ? this.multipleValues.join(', ') : '—';
      case 'texto':
      case 'textarea':
        return this.primitiveLabel(this.value);
      default:
        return this.primitiveLabel(this.value);
    }
  }

  private optionLabel(value: unknown): string {
    const key = this.primitiveLabel(value);
    if (key === '—') return key;
    return this.field.opciones?.find((option) => option.clave === key)?.valor ?? key;
  }

  private primitiveLabel(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const label = record['valor'] ?? record['nombre'] ?? record['label'] ?? record['clave'];
      return label === undefined ? '—' : String(label);
    }
    return String(value);
  }

  private formatDate(value: unknown): string {
    if (typeof value === 'string') {
      const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
    }
    const date = new Date(value as string | number | Date);
    return Number.isNaN(date.getTime()) ? this.primitiveLabel(value) : new Intl.DateTimeFormat('es-EC').format(date);
  }
}
