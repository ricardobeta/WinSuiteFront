import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/**
 * Adaptador estricto para los campos de fecha de WinSuite.
 *
 * El adaptador nativo delega el texto a Date.parse(), que interpreta entradas parciales
 * de forma distinta entre navegadores. Aqui solo se acepta dd/MM/yyyy completo; mientras
 * el usuario escribe o vacia el campo no se fabrica una fecha diferente.
 */
@Injectable()
export class EcuadorDateAdapter extends NativeDateAdapter {
  override parse(value: unknown): Date | null {
    if (value instanceof Date) {
      return this.isValid(value) ? value : null;
    }
    if (typeof value === 'number') {
      const date = new Date(value);
      return this.isValid(date) ? date : null;
    }
    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }

    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    if (!match) {
      return null;
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day
      ? date
      : null;
  }

  override format(date: Date, displayFormat: unknown): string {
    if (displayFormat === 'DD/MM/YYYY') {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}/${date.getFullYear()}`;
    }
    return super.format(date, displayFormat as object);
  }
}
