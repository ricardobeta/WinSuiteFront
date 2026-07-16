import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithPopup,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

import {
  AppUserProfile,
  CompanySummary,
  LoginPayload,
  RegisterUserPayload,
  TenantApiResponse,
  TenantSessionResponse
} from '../models/auth.models';
import { RoleDefinition } from '../models/rbac.models';
import { TenantApiService } from './tenant-api.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private static readonly TENANT_STORAGE_KEY = 'winsuite.tenantId';

  private readonly auth = inject(Auth);
  private readonly tenantApi = inject(TenantApiService);

  readonly currentUser = signal<User | null>(this.auth.currentUser);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly authToken = signal<string | null>(null);
  readonly tenantId = signal<string | null>(null);
  readonly currentProfile = signal<AppUserProfile | null>(null);
  readonly roles = signal<RoleDefinition[]>([]);
  readonly companies = signal<CompanySummary[]>([]);
  readonly currentTenant = signal<TenantApiResponse | null>(null);
  readonly activeModules = signal<string[]>([]);
  readonly ownedCompanyLimit = signal(2);
  readonly ownedCompanyCount = signal(0);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  private readonly http = inject(HttpClient);
  private authStateReadyResolver: (() => void) | null = null;
  private readonly authStateReady = new Promise<void>((resolve) => {
    this.authStateReadyResolver = resolve;
  });
  private initialBootstrapResolver: (() => void) | null = null;
  private initialBootstrapResolved = false;
  private readonly initialBootstrapReady = new Promise<void>((resolve) => {
    this.initialBootstrapResolver = resolve;
  });
  private bootstrapInFlight: Promise<void> | null = null;

  constructor() {
    this.restoreTenantFromStorage();

    this.auth.onAuthStateChanged(async (user) => {
      this.currentUser.set(user);
      this.authStateReadyResolver?.();
      this.authStateReadyResolver = null;

      try {
        if (!user) {
          this.authToken.set(null);
          this.tenantId.set(null);
          this.currentProfile.set(null);
          this.roles.set([]);
          this.companies.set([]);
          this.currentTenant.set(null);
          this.activeModules.set([]);
          this.clearTenantFromStorage();
          return;
        }

        try {
          const token = await user.getIdToken();
          this.authToken.set(token);
        } catch {
          this.authToken.set(null);
        }

        await this.hydrateTenantId(user);
        await this.loadAuthorizationContext(user.uid);
      } finally {
        if (!this.initialBootstrapResolved) {
          this.initialBootstrapResolved = true;
          this.initialBootstrapResolver?.();
          this.initialBootstrapResolver = null;
        }
      }
    });

  }

  async login(payload: LoginPayload): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await signInWithEmailAndPassword(this.auth, payload.email, payload.password);
      const token = await this.auth.currentUser?.getIdToken();
      if (token) {
        this.authToken.set(token);
      }
      await this.bootstrapSession();

    } catch (error: unknown) {
      this.error.set(this.toReadableAuthError(error));
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async register(user: RegisterUserPayload): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const credential = await createUserWithEmailAndPassword(
        this.auth,
        user.email,
        user.password
      );

      await updateProfile(credential.user, { displayName: user.fullName });

      const token = await credential.user.getIdToken();
      this.authToken.set(token);
      await this.bootstrapSession();
    } catch (error: unknown) {
      this.error.set(this.toReadableAuthError(error));
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async loginWithGoogle(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(this.auth, provider);
      await this.bootstrapSession();
    } catch (error: unknown) {
      this.error.set(this.toReadableAuthError(error));
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async linkGoogleAccount(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Debes iniciar sesion para vincular Google.');
    await linkWithPopup(user, new GoogleAuthProvider());
  }

  async switchCompany(tenantId: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<TenantSessionResponse>(`${environment.apiBaseUrl}/api/auth/session/switch`, { tenantId })
    );
    await this.activateSession(response);
  }

  async createCompany(name: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<TenantSessionResponse>(`${environment.apiBaseUrl}/api/auth/companies`, { name })
    );
    await this.activateSession(response);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.authToken.set(null);
    this.tenantId.set(null);
    this.currentProfile.set(null);
    this.roles.set([]);
    this.companies.set([]);
    this.currentTenant.set(null);
    this.activeModules.set([]);
    this.clearTenantFromStorage();
  }

  async getToken(): Promise<string | null> {
    await this.authStateReady;

    const user = this.auth.currentUser;
    if (!user) {
      this.authToken.set(null);
      return null;
    }

    try {
      const tokenResult = await user.getIdTokenResult();
      const claimTenantId = tokenResult.claims['tenantId'];

      const token =
        typeof claimTenantId === 'string' && claimTenantId.trim().length > 0
          ? tokenResult.token
          : await user.getIdToken(true);

      this.authToken.set(token);
      return token;
    } catch {
      const fallbackToken = await user.getIdToken();
      this.authToken.set(fallbackToken);
      return fallbackToken;
    }
  }

  async waitForInitialBootstrap(): Promise<void> {
    await this.initialBootstrapReady;
  }

  async verifyAuth(): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<{tenantId: string | null, userId: string, email: string, message: string}>(
        `${environment.apiBaseUrl}/api/auth/verify`,
        null
      )
    );

    const tenantId = this.normalizeTenantId(response.tenantId);
    if (!tenantId) {
      this.clearTenantFromStorage();
      throw new Error('No se pudo identificar la empresa asociada a tu cuenta.');
    }

    this.tenantId.set(tenantId);
    this.persistTenantInStorage(tenantId);
  }

  getTenantId(): string {
    const tenantId = this.normalizeTenantId(this.tenantId());

    if (tenantId) {
      return tenantId;
    }

    const currentTenantId = this.normalizeTenantId(this.currentUser()?.tenantId ?? null);
    if (currentTenantId) {
      return currentTenantId;
    }

    const cachedTenantId = this.normalizeTenantId(this.readTenantFromStorage());
    if (cachedTenantId) {
      this.tenantId.set(cachedTenantId);
      return cachedTenantId;
    }

    throw new Error('No se pudo identificar la empresa asociada al usuario autenticado.');
  }

  private async hydrateTenantId(user: User): Promise<void> {
    try {
      const tokenResult = await user.getIdTokenResult();
      const claimTenantId = tokenResult.claims['tenantId'];

      const tenantId = this.normalizeTenantId(claimTenantId);
      if (tenantId) {
        this.tenantId.set(tenantId);
        this.persistTenantInStorage(tenantId);
        return;
      }
    } catch {
      // Ignore and fallback to backend verification.
    }

    try {
      await this.bootstrapSession();
    } catch {
      // Keep cached tenantId if available; consumers can retry later.
      const cachedTenantId = this.normalizeTenantId(this.readTenantFromStorage());
      if (cachedTenantId) {
        this.tenantId.set(cachedTenantId);
      }
    }
  }

  private persistTenantInStorage(tenantId: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(AuthService.TENANT_STORAGE_KEY, tenantId);
  }

  private readTenantFromStorage(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const tenantId = this.normalizeTenantId(localStorage.getItem(AuthService.TENANT_STORAGE_KEY));
    if (!tenantId) {
      this.clearTenantFromStorage();
    }

    return tenantId;
  }

  private restoreTenantFromStorage(): void {
    const tenantId = this.readTenantFromStorage();

    if (tenantId) {
      this.tenantId.set(tenantId);
    }
  }

  private clearTenantFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(AuthService.TENANT_STORAGE_KEY);
  }

  private normalizeTenantId(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const tenantId = value.trim();
    if (!tenantId || tenantId === 'null' || tenantId === 'undefined') {
      return null;
    }

    return tenantId;
  }

  clearError(): void {
    this.error.set(null);
  }

  private async loadAuthorizationContext(userId: string): Promise<void> {
    try {
      const context = await firstValueFrom(this.tenantApi.getAuthorizationContext());
      this.roles.set(context.roles ?? []);
      this.currentTenant.set(context.tenant);
      this.activeModules.set(context.tenant.activeModules ?? []);
      this.currentProfile.set(context.profile?.userId === userId ? context.profile : null);
    } catch {
      this.currentProfile.set(null);
      this.roles.set([]);
      this.currentTenant.set(null);
      this.activeModules.set([]);
    }
  }

  private async bootstrapSession(): Promise<void> {
    if (this.bootstrapInFlight) {
      return this.bootstrapInFlight;
    }
    this.bootstrapInFlight = this.performBootstrapSession();
    try {
      await this.bootstrapInFlight;
    } finally {
      this.bootstrapInFlight = null;
    }
  }

  private async performBootstrapSession(): Promise<void> {
    const preferredTenantId = this.normalizeTenantId(this.readTenantFromStorage());
    const response = await firstValueFrom(
      this.http.post<TenantSessionResponse>(`${environment.apiBaseUrl}/api/auth/session/bootstrap`, {
        preferredTenantId
      })
    );
    await this.activateSession(response);
  }

  private async activateSession(response: TenantSessionResponse): Promise<void> {
    const credential = await signInWithCustomToken(this.auth, response.firebaseCustomToken);
    const token = await credential.user.getIdToken(true);
    this.currentUser.set(credential.user);
    this.authToken.set(token);
    this.tenantId.set(response.activeTenantId);
    this.persistTenantInStorage(response.activeTenantId);
    this.companies.set(response.companies ?? []);
    this.ownedCompanyLimit.set(response.ownedCompanyLimit);
    this.ownedCompanyCount.set(response.ownedCompanyCount);
    await this.loadAuthorizationContext(credential.user.uid);
  }

  private toReadableAuthError(error: unknown): string {
    if (!error || typeof error !== 'object' || !('code' in error)) {
      return 'Ocurrio un error inesperado. Intenta nuevamente.';
    }

    const code = String(error.code);
    const dictionary: Record<string, string> = {
      'auth/email-already-in-use': 'El correo ya esta registrado.',
      'auth/invalid-credential': 'Credenciales invalidas.',
      'auth/invalid-email': 'El correo no es valido.',
      'auth/weak-password': 'La contrasena debe tener al menos 6 caracteres.',
      'auth/network-request-failed': 'No hay conexion de red.'
      ,
      'auth/account-exists-with-different-credential': 'Este correo ya usa contrasena. Inicia sesion y vincula Google desde tu perfil.',
      'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.'
    };

    return dictionary[code] ?? 'No se pudo completar la operacion.';
  }
}
