import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject } from '@angular/core';
import { Auth, signInWithCustomToken, signOut } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SITES_AUTH } from '../firebase/sites-firebase.tokens';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SitesFirebaseSessionService {
  private readonly primaryAuth = inject(AuthService);
  private readonly sitesAuth = inject<Auth>(SITES_AUTH);
  private readonly http = inject(HttpClient);
  private pending: Promise<void> | null = null;
  private sessionKey: string | null = null;

  constructor() {
    effect(() => {
      const userId = this.primaryAuth.currentUser()?.uid ?? null;
      const tenantId = this.primaryAuth.tenantId();
      if (!userId || !tenantId) {
        this.sessionKey = null;
        this.pending = null;
        if (this.sitesAuth.currentUser) {
          void signOut(this.sitesAuth);
        }
        return;
      }
      void this.connect(userId, tenantId);
    });
  }

  async ensureReady(): Promise<void> {
    await this.primaryAuth.waitForInitialBootstrap();
    const userId = this.primaryAuth.currentUser()?.uid;
    const tenantId = this.primaryAuth.getTenantId();
    if (!userId) {
      throw new Error('Debes iniciar sesion para administrar sitios.');
    }
    await this.connect(userId, tenantId);
  }

  private connect(userId: string, tenantId: string): Promise<void> {
    const key = `${tenantId}:${userId}`;
    if (this.sessionKey === key && this.sitesAuth.currentUser?.uid === userId) {
      return Promise.resolve();
    }
    if (this.pending && this.sessionKey === key) {
      return this.pending;
    }

    this.sessionKey = key;
    this.pending = firstValueFrom(
      this.http.post<{ token: string }>(`${environment.apiBaseUrl}/api/firebase/sites-token`, {})
    )
      .then(({ token }) => signInWithCustomToken(this.sitesAuth, token))
      .then(() => undefined)
      .catch((error) => {
        this.sessionKey = null;
        throw error;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }
}
