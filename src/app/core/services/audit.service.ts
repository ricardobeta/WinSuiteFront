import { Injectable, inject } from '@angular/core';
import {
  Database,
  DataSnapshot,
  get,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  set,
  update
} from '@angular/fire/database';
import { Observable } from 'rxjs';

import {
  AuditAction,
  AuditActor,
  AuditEvent,
  AuditMetadata,
  RecordAuditInput
} from '../models/audit.models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  private readonly database = inject(Database);
  private readonly auth = inject(AuthService);

  private getTenantId(): string {
    return this.auth.getTenantId();
  }

  private getEventsPath(): string {
    return `auditoria/${this.getTenantId()}/eventos`;
  }

  getRecentEvents(limit = 100): Observable<AuditEvent[]> {
    return new Observable<AuditEvent[]>((subscriber) => {
      const eventsQuery = query(ref(this.database, this.getEventsPath()), orderByChild('timestamp'), limitToLast(limit));
      const unsubscribe = onValue(
        eventsQuery,
        (snapshot) => subscriber.next(this.snapshotToEvents(snapshot).reverse()),
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getEventsForEntity(module: string, entityType: string, entityId: string): Promise<AuditEvent[]> {
    const snapshot = await get(ref(this.database, this.getEventsPath()));
    return this.snapshotToEvents(snapshot)
      .filter((event) => event.module === module && event.entityType === entityType && event.entityId === entityId)
      .sort((a, b) => b.timestamp - a.timestamp);
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
    const tenantId = this.getTenantId();
    const timestamp = Date.now();
    const actor = this.currentActor();
    const eventRef = push(ref(this.database, `auditoria/${tenantId}/eventos`));
    const event: Omit<AuditEvent, 'id'> = {
      tenantId,
      timestamp,
      userId: actor.userId,
      actor,
      action: input.action,
      origin: input.origin ?? 'frontend',
      module: input.target.module,
      entityType: input.target.entityType,
      entityId: input.target.entityId,
      target: input.target,
      summary: input.summary ?? this.defaultSummary(input.action, input.target.entityType, input.target.label),
      changesBefore: input.changesBefore ?? null,
      changesAfter: input.changesAfter ?? null
    };

    await set(eventRef, event);
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

  private snapshotToEvents(snapshot: DataSnapshot): AuditEvent[] {
    if (!snapshot.exists()) {
      return [];
    }

    const raw = snapshot.val() as Record<string, Omit<AuditEvent, 'id'>>;
    return Object.entries(raw)
      .map(([id, event]) => ({ ...event, id }))
      .sort((a, b) => a.timestamp - b.timestamp);
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
