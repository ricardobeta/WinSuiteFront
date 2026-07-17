import { AppUserProfile } from './auth.models';

export type CompanyInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface CompanyInvitation {
  id: string;
  tenantId: string;
  tenantName: string;
  invitedUserId: string;
  email: string;
  fullName: string;
  role: string;
  status: CompanyInvitationStatus;
  createdAt: number;
  respondedAt?: number;
}

export interface CollaboratorEmailStatus {
  exists: boolean;
  alreadyMember: boolean;
}

export interface CollaboratorProvisioningResult {
  status: 'CREATED' | 'INVITED';
  collaborator?: AppUserProfile;
  invitation?: CompanyInvitation;
}
