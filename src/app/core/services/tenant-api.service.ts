import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AppUserProfile,
  CollaboratorPayload,
  CreateTenantPayload,
  TenantApiResponse,
  TenantAuthorizationContext,
  TenantRoleDefinition,
  TenantUserUpdatePayload
} from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class TenantApiService {
  private readonly http = inject(HttpClient);

  createTenant(payload: CreateTenantPayload): Observable<TenantApiResponse> {
    return this.http.post<TenantApiResponse>(
      `${environment.apiBaseUrl}/api/tenants`,
      payload
    );
  }

  getCurrentTenant(): Observable<TenantApiResponse> {
    return this.http.get<TenantApiResponse>(`${environment.apiBaseUrl}/api/tenants/current`);
  }

  getAuthorizationContext(): Observable<TenantAuthorizationContext> {
    return this.http.get<TenantAuthorizationContext>(`${environment.apiBaseUrl}/api/tenants/current/context`);
  }

  updateTenantProfile(payload: { name: string; mobilePhone: string; email: string }): Observable<TenantApiResponse> {
    return this.http.patch<TenantApiResponse>(`${environment.apiBaseUrl}/api/tenants/current/profile`, payload);
  }

  updateActiveModules(activeModules: string[]): Observable<TenantApiResponse> {
    return this.http.patch<TenantApiResponse>(
      `${environment.apiBaseUrl}/api/tenants/current/modules`,
      { activeModules }
    );
  }

  createTenantUser(userProfile: AppUserProfile): Observable<AppUserProfile> {
    return this.http.post<AppUserProfile>(
      `${environment.apiBaseUrl}/api/tenants/current/users`,
      userProfile
    );
  }

  getTenantUsers(): Observable<AppUserProfile[]> {
    return this.http.get<AppUserProfile[]>(`${environment.apiBaseUrl}/api/tenants/current/users`);
  }

  createCollaborator(payload: CollaboratorPayload): Observable<AppUserProfile> {
    return this.http.post<AppUserProfile>(`${environment.apiBaseUrl}/api/tenants/current/collaborators`, payload);
  }

  updateTenantUser(userId: string, payload: TenantUserUpdatePayload): Observable<AppUserProfile> {
    return this.http.put<AppUserProfile>(`${environment.apiBaseUrl}/api/tenants/current/users/${userId}`, payload);
  }

  deactivateTenantUser(userId: string): Observable<void> {
    return this.http.patch<void>(`${environment.apiBaseUrl}/api/tenants/current/users/${userId}/deactivate`, {});
  }

  getRoles(): Observable<TenantRoleDefinition[]> {
    return this.http.get<TenantRoleDefinition[]>(`${environment.apiBaseUrl}/api/tenants/current/roles`);
  }

  saveRole(role: TenantRoleDefinition): Observable<TenantRoleDefinition> {
    return this.http.post<TenantRoleDefinition>(`${environment.apiBaseUrl}/api/tenants/current/roles`, role);
  }

  deleteRole(roleId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/api/tenants/current/roles/${roleId}`);
  }

}
