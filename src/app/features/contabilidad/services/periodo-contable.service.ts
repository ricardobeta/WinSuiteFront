import { Injectable, inject } from '@angular/core';

import { AuthService } from '../../../core/services/auth.service';

/** Pantallas de contabilidad que recuerdan su propio período de forma independiente. */
export type PeriodoScope = 'asientos' | 'compras' | 'cuentas-por-pagar';

const FORMATO_PERIODO = /^\d{4}-\d{2}$/;

/**
 * Recuerda el último período (`"YYYY-MM"`) consultado en cada pantalla de contabilidad,
 * persistiéndolo en localStorage segmentado por tenant. Así el usuario no tiene que volver a
 * seleccionar el período cada vez que entra: se precarga el guardado (o el mes actual la primera
 * vez) y la pantalla puede consultar automáticamente.
 */
@Injectable({ providedIn: 'root' })
export class PeriodoContableService {
  private readonly authService = inject(AuthService);

  /** Período guardado para esa pantalla, o null si no hay ninguno válido. */
  getPeriodo(scope: PeriodoScope): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const guardado = localStorage.getItem(this.getStorageKey(scope));
      return guardado && FORMATO_PERIODO.test(guardado) ? guardado : null;
    } catch {
      return null;
    }
  }

  /** Guarda el período si tiene formato `"YYYY-MM"`; ignora valores vacíos o inválidos. */
  setPeriodo(scope: PeriodoScope, periodo: string): void {
    if (typeof localStorage === 'undefined' || !periodo || !FORMATO_PERIODO.test(periodo)) {
      return;
    }
    try {
      localStorage.setItem(this.getStorageKey(scope), periodo);
    } catch {
      // Almacenamiento no disponible (modo privado, cuota, etc.): degradar silenciosamente.
    }
  }

  /** Período inicial de una pantalla: el guardado o, si no hay, el mes actual. */
  getPeriodoInicial(scope: PeriodoScope): string {
    return this.getPeriodo(scope) ?? this.mesActual();
  }

  /** Mes en curso en formato `"YYYY-MM"`. */
  mesActual(): string {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  }

  private getStorageKey(scope: PeriodoScope): string {
    const tenantId = this.authService.getTenantId();
    return `winsuite.contabilidad.periodo.${scope}.${tenantId}`;
  }
}
