import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { CalendarRecipient, CompanyCalendarEvent } from '../models/company-calendar.models';

@Injectable({ providedIn: 'root' })
export class CompanyCalendarService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiBaseUrl}/api/tenants/current/calendar`;

  list(from: number, to: number): Observable<CompanyCalendarEvent[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<CompanyCalendarEvent[]>(`${this.endpoint}/events`, { params });
  }

  recipients(): Observable<CalendarRecipient[]> {
    return this.http.get<CalendarRecipient[]>(`${this.endpoint}/recipients`);
  }

  create(event: CompanyCalendarEvent): Observable<CompanyCalendarEvent> {
    return this.http.post<CompanyCalendarEvent>(`${this.endpoint}/events`, event);
  }

  update(eventId: string, event: CompanyCalendarEvent): Observable<CompanyCalendarEvent> {
    return this.http.put<CompanyCalendarEvent>(`${this.endpoint}/events/${eventId}`, event);
  }

  delete(eventId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/events/${eventId}`);
  }
}
