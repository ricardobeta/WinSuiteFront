import { Injectable, inject } from '@angular/core';
import { Database, get, ref, remove, set } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import { cloneDefaultDashboardLayout } from '../config/dashboard-defaults';
import { DashboardLayoutConfig, DashboardLayoutItem } from '../models/dashboard.models';

@Injectable({
  providedIn: 'root'
})
export class DashboardConfigService {
  private readonly database = inject(Database);
  private readonly auth = inject(AuthService);

  async getResolvedLayout(): Promise<DashboardLayoutConfig> {
    await this.auth.waitForInitialBootstrap();

    const userLayout = await this.readLayout(this.userLayoutPath());
    if (userLayout) {
      return userLayout;
    }

    const tenantLayout = await this.readLayout(this.defaultLayoutPath());
    if (tenantLayout) {
      return tenantLayout;
    }

    return cloneDefaultDashboardLayout();
  }

  async saveUserLayout(items: DashboardLayoutItem[]): Promise<void> {
    await this.auth.waitForInitialBootstrap();
    await set(ref(this.database, this.userLayoutPath()), this.createPayload(items));
  }

  async publishTenantDefault(items: DashboardLayoutItem[]): Promise<void> {
    await this.auth.waitForInitialBootstrap();
    await set(ref(this.database, this.defaultLayoutPath()), this.createPayload(items));
  }

  async resetUserLayout(): Promise<DashboardLayoutConfig> {
    await this.auth.waitForInitialBootstrap();
    await remove(ref(this.database, this.userLayoutPath()));
    return this.getResolvedLayout();
  }

  private async readLayout(path: string): Promise<DashboardLayoutConfig | null> {
    const snapshot = await get(ref(this.database, path));
    if (!snapshot.exists()) {
      return null;
    }

    const raw = snapshot.val() as Partial<DashboardLayoutConfig>;
    if (!Array.isArray(raw.items)) {
      return null;
    }

    return {
      version: 1,
      updatedAt: Number(raw.updatedAt ?? 0),
      updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
      items: raw.items
        .filter((item): item is DashboardLayoutItem => this.isValidLayoutItem(item))
        .map((item) => ({ ...item }))
    };
  }

  private createPayload(items: DashboardLayoutItem[]): DashboardLayoutConfig {
    return {
      version: 1,
      updatedAt: Date.now(),
      updatedBy: this.auth.currentUser()?.uid ?? null,
      items: items.map((item) => ({
        instanceId: item.instanceId,
        widgetId: item.widgetId,
        x: Number(item.x ?? 0),
        y: Number(item.y ?? 0),
        cols: Number(item.cols ?? 3),
        rows: Number(item.rows ?? 2)
      }))
    };
  }

  private isValidLayoutItem(value: unknown): value is DashboardLayoutItem {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const item = value as Partial<DashboardLayoutItem>;
    return (
      typeof item.instanceId === 'string' &&
      typeof item.widgetId === 'string' &&
      Number.isFinite(Number(item.x)) &&
      Number.isFinite(Number(item.y)) &&
      Number.isFinite(Number(item.cols)) &&
      Number.isFinite(Number(item.rows))
    );
  }

  private getTenantPath(): string {
    return `dashboard/${this.auth.getTenantId()}`;
  }

  private defaultLayoutPath(): string {
    return `${this.getTenantPath()}/defaultLayout`;
  }

  private userLayoutPath(): string {
    const userId = this.auth.currentUser()?.uid;
    if (!userId) {
      throw new Error('No se pudo resolver el usuario autenticado para el dashboard.');
    }

    return `${this.getTenantPath()}/users/${userId}/layout`;
  }
}
