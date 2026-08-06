import { Injectable, inject } from '@angular/core';
import { Database, get, ref, remove, set, update } from '@angular/fire/database';

import {
  ResolvedTableView,
  TableColumnDefinition,
  TablePreferenceIdentity,
  TableViewConfig
} from '../../shared/models/table-preferences.models';
import { AuthService } from './auth.service';
import {
  createDefaultTableView,
  normalizeVisibleColumnIds,
  reconcileTableView
} from '../../shared/utils/table-preferences.util';

@Injectable({ providedIn: 'root' })
export class TablePreferencesService {
  private static readonly SAFE_KEY = /^[a-z0-9_-]+$/;

  private readonly database = inject(Database);
  private readonly auth = inject(AuthService);

  async getResolvedView(
    identity: TablePreferenceIdentity,
    columns: readonly TableColumnDefinition[]
  ): Promise<ResolvedTableView> {
    await this.auth.waitForInitialBootstrap();
    this.assertIdentity(identity);

    const [personal, company] = await Promise.all([
      this.readConfig(this.userPath(identity)),
      this.readConfig(this.companyPath(identity))
    ]);

    if (personal) return this.resolve(personal, 'personal', columns);
    if (company) return this.resolve(company, 'company', columns);
    return this.defaultView(columns);
  }

  async savePersonal(
    identity: TablePreferenceIdentity,
    visibleColumnIds: readonly string[],
    columns: readonly TableColumnDefinition[]
  ): Promise<ResolvedTableView> {
    await this.auth.waitForInitialBootstrap();
    this.assertIdentity(identity);
    const payload = this.createPayload(visibleColumnIds, columns);
    await set(ref(this.database, this.userPath(identity)), payload);
    return this.resolve(payload, 'personal', columns);
  }

  async publishCompany(
    identity: TablePreferenceIdentity,
    visibleColumnIds: readonly string[],
    columns: readonly TableColumnDefinition[]
  ): Promise<ResolvedTableView> {
    await this.auth.waitForInitialBootstrap();
    this.assertIdentity(identity);
    if ((this.auth.currentProfile()?.role ?? '').toUpperCase() !== 'ADMIN') {
      throw new Error('Solo un administrador puede publicar la vista de la empresa.');
    }

    const payload = this.createPayload(visibleColumnIds, columns);
    await update(ref(this.database), {
      [this.companyPath(identity)]: payload,
      [this.userPath(identity)]: null
    });
    return this.resolve(payload, 'company', columns);
  }

  async resetPersonal(
    identity: TablePreferenceIdentity,
    columns: readonly TableColumnDefinition[]
  ): Promise<ResolvedTableView> {
    await this.auth.waitForInitialBootstrap();
    this.assertIdentity(identity);
    await remove(ref(this.database, this.userPath(identity)));
    return this.getResolvedView(identity, columns);
  }

  defaultView(columns: readonly TableColumnDefinition[]): ResolvedTableView {
    return createDefaultTableView(columns);
  }

  reconcile(
    view: ResolvedTableView,
    columns: readonly TableColumnDefinition[]
  ): ResolvedTableView {
    return reconcileTableView(view, columns);
  }

  private async readConfig(path: string): Promise<TableViewConfig | null> {
    const snapshot = await get(ref(this.database, path));
    if (!snapshot.exists()) return null;

    const raw = snapshot.val() as Partial<TableViewConfig>;
    if (raw.version !== 1 || !Array.isArray(raw.visibleColumnIds)) return null;
    const visibleColumnIds = raw.visibleColumnIds.filter(
      (value): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128
    );
    if (visibleColumnIds.length === 0) return null;

    return {
      version: 1,
      visibleColumnIds,
      updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : 0,
      updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : ''
    };
  }

  private createPayload(
    visibleColumnIds: readonly string[],
    columns: readonly TableColumnDefinition[]
  ): TableViewConfig {
    const normalized = normalizeVisibleColumnIds(visibleColumnIds, columns);
    const selectableCount = normalized.filter(
      (id) => !columns.find((column) => column.id === id)?.locked
    ).length;
    if (selectableCount === 0) {
      throw new Error('Selecciona al menos una columna de datos.');
    }

    const userId = this.auth.currentUser()?.uid;
    if (!userId) throw new Error('No se pudo identificar al usuario autenticado.');

    return {
      version: 1,
      visibleColumnIds: normalized,
      updatedAt: Date.now(),
      updatedBy: userId
    };
  }

  private resolve(
    config: TableViewConfig,
    source: ResolvedTableView['source'],
    columns: readonly TableColumnDefinition[]
  ): ResolvedTableView {
    return {
      visibleColumnIds: normalizeVisibleColumnIds(config.visibleColumnIds, columns),
      source,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy || null
    };
  }

  private companyPath(identity: TablePreferenceIdentity): string {
    return `${this.tenantRoot()}/company/${identity.moduleId}/${identity.tableId}`;
  }

  private userPath(identity: TablePreferenceIdentity): string {
    const userId = this.auth.currentUser()?.uid;
    if (!userId) throw new Error('No se pudo identificar al usuario autenticado.');
    return `${this.tenantRoot()}/users/${userId}/${identity.moduleId}/${identity.tableId}`;
  }

  private tenantRoot(): string {
    return `tablePreferences/${this.auth.getTenantId()}`;
  }

  private assertIdentity(identity: TablePreferenceIdentity): void {
    if (!TablePreferencesService.SAFE_KEY.test(identity.moduleId) ||
        !TablePreferencesService.SAFE_KEY.test(identity.tableId)) {
      throw new Error('El identificador de la tabla no es valido.');
    }
  }
}
