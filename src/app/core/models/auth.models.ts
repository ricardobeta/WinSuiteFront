import { RoleDefinition } from './rbac.models';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterUserPayload {
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterBusinessPayload {
  businessName: string;
  country: string;
  mobilePhone: string;
}

export interface CreateTenantPayload {
  name: string;
  ownerId: string;
  plan: string;
  businessName?: string;
  country?: string;
  mobilePhone?: string;
  activeModules?: string[];
}

export interface TenantApiResponse {
  id: string;
  name: string;
  ownerId: string;
  plan: string;
  status?: string;
  createdAt?: number;
  activeModules?: string[];
  email?: string;
  mobilePhone?: string;
}

export interface CompanySummary {
  tenantId: string;
  name: string;
  role: string;
  plan: string;
  status: string;
  owned: boolean;
}

export interface TenantSessionResponse {
  userId: string;
  email: string;
  activeTenantId: string;
  firebaseCustomToken: string;
  sessionId: string;
  sessionVersion: number;
  companies: CompanySummary[];
  ownedCompanyLimit: number;
  ownedCompanyCount: number;
}

export interface TenantAuthorizationContext {
  tenant: TenantApiResponse;
  profile: AppUserProfile;
  roles: TenantRoleDefinition[];
}

export interface UpdateActiveModulesPayload {
  activeModules: string[];
}

export interface AppUserProfile {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  tenantId?: string;
  active?: boolean;
  joinedAt?: number;
}

export interface CollaboratorPayload {
  fullName: string;
  email: string;
  password?: string;
  role: string;
}

export interface TenantUserUpdatePayload {
  fullName: string;
  email: string;
  role: string;
  active: boolean;
}

export type TenantRoleDefinition = RoleDefinition;
