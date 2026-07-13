import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Database,
  ref,
  update
} from '@angular/fire/database';
import { Observable, firstValueFrom, map } from 'rxjs';

import {
  AuditAction,
  AuditActor,
  AuditEvent,
  AuditMetadata,
  AuditPageResult,
  RecordAuditInput
} from '../models/audit.models';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

interface AuditApiPage {
  items: Array<{ id: string; event: Omit<AuditEvent, 'id'> }>;
  nextCursor: string | null;
  hasMore: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  private readonly database = inject(Database);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/audit/events`;

  getRecentEvents(limit = 100): Observable<AuditEvent[]> {
    return this.getEventsPage(limit).pipe(map((page) => page.items));
  }

  async getEventsForEntity(module: string, entityType: string, entityId: string): Promise<AuditEvent[]> {
    let params = new HttpParams()
      .set('limit', '100')
      .set('module', module)
      .set('entityType', entityType)
      .set('entityId', entityId);
    const page = await firstValueFrom(
      this.http.get<AuditApiPage>(`${this.apiUrl}/entity`, { params }).pipe(
        map((result) => result.items.map((item) => ({ ...item.event, id: item.id })))
      )
    );
    return page.sort((a, b) => b.timestamp - a.timestamp);
  }

  getEventsPage(limit = 50, cursor: string | null = null, module = ''): Observable<AuditPageResult> {
    let params = new HttpParams().set('limit', String(Math.max(1, Math.min(limit, 100))));
    if (cursor) {
      params = params.set('cursor', cursor);
    }
    if (module.trim()) {
      params = params.set('module', module.trim());
    }

    return this.http.get<AuditApiPage>(this.apiUrl, { params }).pipe(
      map((page) => ({
        items: page.items.map((item) => ({ ...item.event, id: item.id })),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore
      }))
    );
  }

  createMetadata(action: AuditAction, existing?: Partial<AuditMetadata> | null, timestamp = Date.now()): AuditMetadata {
    const userId = this.currentActor().userId;
    const creadoEn = existing?.creadoEn ?? timestamp;
    const creadoPor = existing?.creadoPor ?? userId;

    return {
      creadoEn,
      creadoPor,
      actualizadoEn: timestamp,
      actualizadoPor: userId,
      ultimaAccion: action
    };
  }

  async updateMetadata(path: string, action: AuditAction, existing?: Partial<AuditMetadata> | null): Promise<void> {
    await update(ref(this.database, path), this.createMetadata(action, existing));
  }

  async record(input: RecordAuditInput): Promise<void> {
    await firstValueFrom(this.http.post<void>(this.apiUrl, {
      action: input.action,
      target: input.target,
      summary: input.summary ?? this.defaultSummary(input.action, input.target.entityType, input.target.label),
      changesBefore: input.changesBefore ?? null,
      changesAfter: input.changesAfter ?? null
    }));
  }

  async recordSafe(input: RecordAuditInput): Promise<void> {
    try {
      await this.record(input);
    } catch (error) {
      console.warn('No se pudo registrar la auditoria de la accion.', error);
    }
  }

  currentActor(): AuditActor {
    const user = this.auth.currentUser();
    const profile = this.auth.currentProfile();
    const userId = user?.uid ?? 'sistema';

    return {
      userId,
      email: profile?.email ?? user?.email ?? null,
      fullName: profile?.fullName ?? user?.displayName ?? null,
      role: profile?.role ?? null
    };
  }

  private defaultSummary(action: AuditAction, entityType: string, label?: string | null): string {
    const target = label ? `${entityType} ${label}` : entityType;
    return `${this.labelAction(action)} ${target}`.trim();
  }

  private labelAction(action: AuditAction): string {
    const labels: Record<AuditAction, string> = {
      crear: 'Creo',
      actualizar: 'Actualizo',
      eliminar: 'Elimino',
      aprobar: 'Aprobo',
      reversar: 'Reverso',
      importar: 'Importo',
      generar: 'Genero',
      publicar: 'Publico',
      configurar: 'Configuro'
    };

    return labels[action];
  }
}
