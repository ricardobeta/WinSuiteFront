import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, tap } from 'rxjs';
import { getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

import { environment } from '../../../environments/environment';
import { CompanyNotification, NotificationPreferences, NotificationSummary } from '../models/notification.models';

@Injectable({ providedIn: 'root' })
export class CompanyNotificationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/tenants/current/notifications`;
  readonly items = signal<CompanyNotification[]>([]);
  readonly unreadCount = signal(0);

  load(limit = 30) {
    return this.http.get<NotificationSummary>(this.baseUrl, { params: { limit } }).pipe(
      tap(summary => { this.items.set(summary.items); this.unreadCount.set(summary.unreadCount); })
    );
  }

  markRead(item: CompanyNotification): void {
    if (item.readAt) return;
    item.readAt = Date.now();
    this.items.update(items => [...items]);
    this.unreadCount.update(value => Math.max(0, value - 1));
    this.http.post<void>(`${this.baseUrl}/${encodeURIComponent(item.id)}/read`, {}).subscribe();
  }

  markAllRead(): void {
    const now = Date.now();
    this.items.update(items => items.map(item => ({ ...item, readAt: item.readAt ?? now })));
    this.unreadCount.set(0);
    this.http.post<void>(`${this.baseUrl}/read-all`, {}).subscribe();
  }

  getPreferences() { return this.http.get<NotificationPreferences>(`${this.baseUrl}/preferences`); }
  savePreferences(value: NotificationPreferences) { return this.http.put<NotificationPreferences>(`${this.baseUrl}/preferences`, value); }

  async enablePush(): Promise<void> {
    if (!('Notification' in window) || !(await isSupported())) throw new Error('PUSH_NOT_SUPPORTED');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('PUSH_DENIED');
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(getApp());
    const token = environment.firebaseVapidKey
      ? await getToken(messaging, { serviceWorkerRegistration: registration, vapidKey: environment.firebaseVapidKey })
      : await getToken(messaging, { serviceWorkerRegistration: registration });
    if (!token) throw new Error('PUSH_TOKEN_EMPTY');
    let installationId = localStorage.getItem('winsuite.notificationInstallationId');
    if (!installationId) {
      installationId = crypto.randomUUID();
      localStorage.setItem('winsuite.notificationInstallationId', installationId);
    }
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/devices`, {
      installationId, token, platform: navigator.userAgent
    }));
  }
}
