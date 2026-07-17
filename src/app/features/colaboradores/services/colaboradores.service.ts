import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AppUserProfile,
  CollaboratorPayload,
  TenantRoleDefinition,
  TenantUserUpdatePayload
} from '../../../core/models/auth.models';
import { CollaboratorEmailStatus, CollaboratorProvisioningResult } from '../../../core/models/company-invitation.models';
import { TenantApiService } from '../../../core/services/tenant-api.service';

@Injectable({
  providedIn: 'root'
})
export class ColaboradoresService {
  private readonly tenantApi = inject(TenantApiService);

  getColaboradores(): Observable<AppUserProfile[]> {
    return this.tenantApi.getTenantUsers();
  }

  checkEmail(email: string): Observable<CollaboratorEmailStatus> {
    return this.tenantApi.checkCollaboratorEmail(email);
  }

  createColaborador(payload: CollaboratorPayload): Observable<CollaboratorProvisioningResult> {
    return this.tenantApi.createCollaborator(payload);
  }

  updateColaborador(userId: string, payload: TenantUserUpdatePayload): Observable<AppUserProfile> {
    return this.tenantApi.updateTenantUser(userId, payload);
  }

  deactivateColaborador(userId: string): Observable<void> {
    return this.tenantApi.deactivateTenantUser(userId);
  }

  getRoles(): Observable<TenantRoleDefinition[]> {
    return this.tenantApi.getRoles();
  }

  saveRole(role: TenantRoleDefinition): Observable<TenantRoleDefinition> {
    return this.tenantApi.saveRole(role);
  }

  deleteRole(roleId: string): Observable<void> {
    return this.tenantApi.deleteRole(roleId);
  }
}
