import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CalendarOptions, DateSelectInfo, DatesSetInfo, EventClickInfo, EventInput } from 'fullcalendar';
import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import interactionPlugin from '@fullcalendar/angular/interaction';
import listPlugin from '@fullcalendar/angular/list';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import themePlugin from '@fullcalendar/angular/themes/monarch';
import esLocale from 'fullcalendar/locales/es';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { CalendarEventDialogComponent, CalendarEventDialogResult } from '../../components/calendar-event-dialog/calendar-event-dialog.component';
import { CalendarRecipient, CompanyCalendarEvent } from '../../models/company-calendar.models';
import { CompanyCalendarService } from '../../services/company-calendar.service';

@Component({
  selector: 'app-empresa-calendar',
  imports: [FullCalendarModule, MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule],
  template: `
    <section class="calendar-card surface-card">
      <div class="calendar-heading">
        <div><p class="eyebrow">Calendario compartido</p><h2>Eventos de la empresa</h2><p>Agenda actividades y alerta a las personas responsables.</p></div>
        @if (canCreate) {<button mat-flat-button color="primary" type="button" (click)="openCreate()"><mat-icon>add</mat-icon>Nuevo evento</button>}
      </div>
      <div class="calendar-wrap" [class.loading]="loading()">
        <full-calendar [options]="calendarOptions" />
        @if (loading()) {<div class="loading-layer"><mat-spinner diameter="36" /></div>}
      </div>
    </section>
  `,
  styles: [`
    .calendar-card { padding: 1.25rem; display: grid; gap: 1rem; }
    .calendar-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
    .eyebrow { margin: 0 0 .25rem; color: var(--primary); text-transform: uppercase; letter-spacing: .11em; font-size: .72rem; }
    h2 { margin: 0; } .calendar-heading p:last-child { margin: .35rem 0 0; color: var(--muted-foreground); }
    .calendar-wrap { position: relative; min-height: 620px; } .loading-layer { position: absolute; inset: 0; display: grid; place-items: center; background: color-mix(in srgb, var(--background) 72%, transparent); z-index: 3; }
    :host ::ng-deep .fc { --fc-page-bg-color: transparent; --fc-neutral-bg-color: var(--tc-surface-container-low); --fc-border-color: var(--tc-ghost-border); --fc-button-bg-color: var(--primary); --fc-button-border-color: var(--primary); --fc-event-bg-color: var(--primary); --fc-event-border-color: var(--primary); }
    :host ::ng-deep .fc .fc-toolbar-title { font-size: 1.15rem; text-transform: capitalize; }
    :host ::ng-deep .fc-event { cursor: pointer; border-radius: 6px; padding: 2px 4px; }
    @media (width <= 720px) { .calendar-heading { flex-direction: column; } .calendar-wrap { min-height: 540px; } :host ::ng-deep .fc .fc-toolbar { align-items: stretch; flex-direction: column; gap: .65rem; } }
  `]
})
export class EmpresaCalendarComponent {
  private readonly calendar = inject(CompanyCalendarService);
  private readonly authorization = inject(AuthorizationService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly loading = signal(false);
  protected readonly canCreate = this.authorization.canAccess('empresa_calendario', 'create');
  private recipients: CalendarRecipient[] = [];
  private eventMap = new Map<string, CompanyCalendarEvent>();
  private visibleRange?: DatesSetInfo;
  protected calendarOptions: CalendarOptions = {
    plugins: [themePlugin, dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    locale: esLocale,
    initialView: typeof window !== 'undefined' && window.innerWidth < 640 ? 'listWeek' : 'dayGridMonth',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' },
    height: 'auto', nowIndicator: true, selectable: this.canCreate, selectMirror: true,
    datesSet: info => this.loadRange(info), select: info => this.openFromSelection(info), eventClick: info => this.openExisting(info),
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false }
  };

  constructor() {
    this.calendar.recipients().subscribe({ next: people => this.recipients = people, error: () => this.recipients = [] });
  }

  protected openCreate(): void { this.openDialog(undefined, new Date()); }
  private openFromSelection(info: DateSelectInfo): void { if (this.canCreate) this.openDialog(undefined, info.start); }
  private openExisting(info: EventClickInfo): void { const event = this.eventMap.get(info.event.id); if (event) this.openDialog(event); }
  private openDialog(event?: CompanyCalendarEvent, start?: Date): void {
    const ref = this.dialog.open(CalendarEventDialogComponent, { width: '680px', maxWidth: '96vw', data: { event, start, recipients: this.recipients, canDelete: this.authorization.canAccess('empresa_calendario', 'delete') } });
    ref.afterClosed().subscribe((result?: CalendarEventDialogResult) => {
      if (!result) return;
      if (result.action === 'delete' && event?.id) {
        this.calendar.delete(event.id).subscribe({ next: () => this.refresh(), error: () => this.showError() });
      } else if (result.action === 'save') {
        const request = event?.id ? this.calendar.update(event.id, result.event) : this.calendar.create(result.event);
        request.subscribe({ next: () => this.refresh(), error: () => this.showError() });
      }
    });
  }

  private loadRange(info: DatesSetInfo): void {
    this.visibleRange = info;
    this.loading.set(true);
    this.calendar.list(info.start.getTime(), info.end.getTime()).subscribe({
      next: events => { this.eventMap = new Map(events.filter(e => !!e.id).map(e => [e.id!, e])); this.calendarOptions = { ...this.calendarOptions, events: events.map(e => this.toCalendarEvent(e)) }; this.loading.set(false); },
      error: () => { this.loading.set(false); this.showError(); }
    });
  }
  private refresh(): void {
    this.snackBar.open('Calendario actualizado.', undefined, { duration: 1800 });
    if (this.visibleRange) this.loadRange(this.visibleRange);
  }
  private toCalendarEvent(event: CompanyCalendarEvent): EventInput { return { id: event.id, title: event.title, start: event.start, end: event.end, allDay: event.allDay }; }
  private showError(): void { this.snackBar.open('No se pudo completar la operacion del calendario.', 'Cerrar', { duration: 3200 }); }
}
