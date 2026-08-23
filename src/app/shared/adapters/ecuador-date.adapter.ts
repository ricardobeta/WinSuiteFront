import { Injectable } from '@angular/core';
import { MatDateFormats, NativeDateAdapter } from '@angular/material/core';

/**
 * Formatos que acompañan al adaptador. Viven junto a el a proposito: separarlos permitiria proveer
 * uno sin el otro, que es justamente como se rompen los datepickers.
 */
export const ECUADOR_DATE_FORMATS: MatDateFormats = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};

/**
 * Adaptador de fechas de WinSuit (dd/MM/yyyy, Ecuador).
 *
 * El adaptador nativo delega el texto a Date.parse(), que interpreta entradas parciales de forma
 * distinta entre navegadores. Aqui se aceptan solo formas completas y sin ambiguedad, pero
 * tolerando como teclea la gente: los contadores escriben la fecha de corrido ("02122026") o con
 * un solo digito ("2/12/2026"), y ambas deben quedar como 02/12/2026 al salir del campo.
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

    const texto = value.trim();

    // ISO (yyyy-MM-dd): aparece al pegar datos de otros sistemas. Va primero porque empieza por año.
    const iso = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(texto);
    if (iso) {
      return this.construir(Number(iso[3]), Number(iso[2]), Number(iso[1]));
    }

    // Con separador: acepta /, - o . y uno o dos digitos en dia y mes ("2/12/2026", "02-12-26").
    const conSeparador = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(texto);
    if (conSeparador) {
      return this.construir(
        Number(conSeparador[1]),
        Number(conSeparador[2]),
        this.anioCompleto(conSeparador[3])
      );
    }

    // Solo digitos, tecleado de corrido en el teclado numerico.
    if (/^\d+$/.test(texto)) {
      return this.parsearCorrido(texto);
    }

    return null;
  }

  override format(date: Date, displayFormat: unknown): string {
    if (displayFormat === 'DD/MM/YYYY') {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}/${date.getFullYear()}`;
    }
    return super.format(date, displayFormat as object);
  }

  /**
   * 8 digitos se leen como ddMMyyyy, que es como se dicta una fecha aqui. Si eso da un mes
   * imposible se reintenta como yyyyMMdd, que es la unica otra lectura razonable y no colisiona:
   * ninguna fecha valida en un formato lo es tambien en el otro.
   */
  private parsearCorrido(digitos: string): Date | null {
    if (digitos.length === 8) {
      return this.construir(
        Number(digitos.slice(0, 2)),
        Number(digitos.slice(2, 4)),
        Number(digitos.slice(4, 8))
      ) ?? this.construir(
        Number(digitos.slice(6, 8)),
        Number(digitos.slice(4, 6)),
        Number(digitos.slice(0, 4))
      );
    }
    if (digitos.length === 6) {
      return this.construir(
        Number(digitos.slice(0, 2)),
        Number(digitos.slice(2, 4)),
        this.anioCompleto(digitos.slice(4, 6))
      );
    }
    // 4 digitos (ddMM) quedan fuera a proposito: adivinar el año silenciosamente es peor que no parsear.
    return null;
  }

  /** Construye la fecha solo si el calendario la respeta: descarta 31/02 y meses fuera de rango. */
  private construir(dia: number, mes: number, anio: number): Date | null {
    const date = new Date(anio, mes - 1, dia);
    return date.getFullYear() === anio && date.getMonth() === mes - 1 && date.getDate() === dia
      ? date
      : null;
  }

  private anioCompleto(anio: string): number {
    return anio.length === 2 ? 2000 + Number(anio) : Number(anio);
  }
}
