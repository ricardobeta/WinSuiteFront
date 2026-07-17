import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CompanyInvitation } from '../models/company-invitation.models';

@Injectable({ providedIn: 'root' })
export class CompanyInvitationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/invitations`;

  readonly pending = signal<CompanyInvitation[]>([]);

  load() {
    return this.http.get<CompanyInvitation[]>(this.baseUrl).pipe(tap(items => this.pending.set(items)));
  }

  accept(invitationId: string) {
    return this.http.post<CompanyInvitation>(`${this.baseUrl}/${encodeURIComponent(invitationId)}/accept`, {}).pipe(
      tap(() => this.remove(invitationId))
    );
  }

  reject(invitationId: string) {
    return this.http.post<CompanyInvitation>(`${this.baseUrl}/${encodeURIComponent(invitationId)}/reject`, {}).pipe(
      tap(() => this.remove(invitationId))
    );
  }

  private remove(invitationId: string): void {
    this.pending.update(items => items.filter(item => item.id !== invitationId));
  }
}
