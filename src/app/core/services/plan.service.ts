import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ComplementoPlataforma,
  ConsumoEmpresa,
  LIMITE_DE_RECURSO,
  PlanEfectivo,
  PlanEmpresa,
  RECURSOS_MENSUALES,
  RecursoPlataforma,
  SIN_LIMITE
} from '../models/platform.models';

interface PlanActualResponse {
  plan: PlanEfectivo;
  uso: ConsumoEmpresa;
  planesDisponibles: PlanEmpresa[];
  complementos: ComplementoPlataforma[];
}

/** Consumo de un recurso ya resuelto para pintarlo. */
export interface EstadoRecurso {
  recurso: RecursoPlataforma;
  consumido: number;
  limite: number | null;
  bolsa: number;
  /** Porcentaje consumido, o null cuando el recurso no tiene tope. */
  porcentaje: number | null;
  agotado: boolean;
}

/**
 * Plan vigente de la empresa activa. Es solo informativo: quien decide si una operacion cabe
 * es siempre el backend. Sirve para avisar antes de que el usuario choque con el limite.
 */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly http = inject(HttpClient);

  readonly plan = signal<PlanEfectivo | null>(null);
  readonly uso = signal<ConsumoEmpresa | null>(null);
  readonly planesDisponibles = signal<PlanEmpresa[]>([]);
  readonly complementos = signal<ComplementoPlataforma[]>([]);
  readonly cargando = signal(false);

  readonly nombrePlan = computed(() => this.plan()?.planNombre ?? '—');
  readonly suspendida = computed(() => this.plan()?.estado === 'SUSPENDED');

  /** Estado de todos los recursos con tope, para la pagina de planes. */
  readonly recursos = computed<EstadoRecurso[]>(() => {
    const plan = this.plan();
    const uso = this.uso();
    if (!plan || !uso) return [];
    return (Object.keys(LIMITE_DE_RECURSO) as RecursoPlataforma[]).map((recurso) =>
      this.estadoDe(recurso, plan, uso),
    );
  });

  async refresh(): Promise<void> {
    this.cargando.set(true);
    try {
      const respuesta = await firstValueFrom(
        this.http.get<PlanActualResponse>(`${environment.apiBaseUrl}/api/tenants/current/plan`),
      );
      this.plan.set(respuesta.plan);
      this.uso.set(respuesta.uso);
      this.planesDisponibles.set(respuesta.planesDisponibles ?? []);
      this.complementos.set(respuesta.complementos ?? []);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Limpia el plan al cerrar sesion o al cambiar de empresa. */
  clear(): void {
    this.plan.set(null);
    this.uso.set(null);
    this.planesDisponibles.set([]);
    this.complementos.set([]);
  }

  estado(recurso: RecursoPlataforma): EstadoRecurso | null {
    const plan = this.plan();
    const uso = this.uso();
    return plan && uso ? this.estadoDe(recurso, plan, uso) : null;
  }

  /** true si el plan incluye el modulo indicado. */
  incluyeModulo(moduloId: string): boolean {
    const modulos = this.plan()?.modulos;
    return !modulos || modulos.length === 0 || modulos.includes(moduloId);
  }

  private estadoDe(recurso: RecursoPlataforma, plan: PlanEfectivo, uso: ConsumoEmpresa): EstadoRecurso {
    const mensual = RECURSOS_MENSUALES.includes(recurso);
    const consumido = (mensual ? uso.mensual[recurso] : uso.acumulado[recurso]) ?? 0;
    const bruto = plan.limites[LIMITE_DE_RECURSO[recurso]];
    const limite = typeof bruto === 'number' ? bruto : null;
    const bolsa = uso.bolsa[recurso] ?? 0;
    const sinTope = limite === null || limite === SIN_LIMITE;
    return {
      recurso,
      consumido,
      limite,
      bolsa,
      porcentaje: sinTope || limite <= 0 ? null : Math.min(100, Math.round((consumido / limite) * 100)),
      agotado: !sinTope && consumido >= limite + bolsa,
    };
  }
}
