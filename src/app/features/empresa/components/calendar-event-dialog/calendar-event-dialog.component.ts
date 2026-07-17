import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';

import { CalendarRecipient, CompanyCalendarEvent } from '../../models/company-calendar.models';

export interface CalendarEventDialogData {
  event?: CompanyCalendarEvent;
  start?: Date;
  recipients: CalendarRecipient[];
  canDelete: boolean;
}

export type CalendarEventDialogResult = { action: 'save'; event: CompanyCalendarEvent } | { action: 'delete' };

@Component({
  selector: 'app-calendar-event-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTimepickerModule
  ],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'es-EC' }],
  template: `
    <div class="heading">
      <span class="event-icon"><mat-icon>event</mat-icon></span>
      <div><p class="eyebrow">Calendario de la empresa</p><h2 mat-dialog-title>{{ data.event ? 'Editar evento' : 'Nuevo evento' }}</h2></div>
    </div>
    <mat-dialog-content>
      <form id="event-form" [formGroup]="form" (ngSubmit)="save()">
        <mat-form-field appearance="outline"><mat-label>Título</mat-label><input matInput formControlName="title" maxlength="140" /></mat-form-field>

        <div class="schedule-grid">
          <fieldset class="date-time-group">
            <legend><mat-icon>play_circle</mat-icon>Inicio</legend>
            <mat-form-field appearance="outline">
              <mat-label>Fecha de inicio</mat-label>
              <input matInput formControlName="startDate" [matDatepicker]="startDatePicker" (click)="startDatePicker.open()" readonly />
              <mat-datepicker-toggle matIconSuffix [for]="startDatePicker" />
              <mat-datepicker #startDatePicker [touchUi]="touchUi" />
              @if (form.controls.startDate.hasError('required')) {<mat-error>Selecciona una fecha.</mat-error>}
            </mat-form-field>
            @if (!form.controls.allDay.value) {
              <mat-form-field appearance="outline">
                <mat-label>Hora de inicio</mat-label>
                <input matInput formControlName="startTime" [matTimepicker]="startTimePicker" />
                <mat-timepicker-toggle matIconSuffix [for]="startTimePicker" />
                <mat-timepicker #startTimePicker interval="15m" aria-label="Seleccionar hora de inicio" />
                @if (form.controls.startTime.hasError('required')) {<mat-error>Selecciona una hora.</mat-error>}
              </mat-form-field>
            }
          </fieldset>

          <fieldset class="date-time-group" [class.range-error]="form.hasError('dateRange')">
            <legend><mat-icon>stop_circle</mat-icon>Finalización</legend>
            <mat-form-field appearance="outline">
              <mat-label>Fecha de finalización</mat-label>
              <input matInput formControlName="endDate" [matDatepicker]="endDatePicker" [min]="form.controls.startDate.value" (click)="endDatePicker.open()" readonly />
              <mat-datepicker-toggle matIconSuffix [for]="endDatePicker" />
              <mat-datepicker #endDatePicker [touchUi]="touchUi" />
              @if (form.controls.endDate.hasError('required')) {<mat-error>Selecciona una fecha.</mat-error>}
            </mat-form-field>
            @if (!form.controls.allDay.value) {
              <mat-form-field appearance="outline">
                <mat-label>Hora de finalización</mat-label>
                <input matInput formControlName="endTime" [matTimepicker]="endTimePicker" />
                <mat-timepicker-toggle matIconSuffix [for]="endTimePicker" />
                <mat-timepicker #endTimePicker interval="15m" aria-label="Seleccionar hora de finalización" />
                @if (form.controls.endTime.hasError('required')) {<mat-error>Selecciona una hora.</mat-error>}
              </mat-form-field>
            }
            @if (form.hasError('dateRange')) {
              <p class="range-message"><mat-icon>error</mat-icon>La finalización debe ser posterior al inicio.</p>
            }
          </fieldset>
        </div>

        <mat-checkbox formControlName="allDay">Evento de todo el día</mat-checkbox>
        <mat-form-field appearance="outline"><mat-label>Lugar o enlace</mat-label><input matInput formControlName="location" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Descripción</mat-label><textarea matInput formControlName="description" rows="3"></textarea></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Alertar a</mat-label><mat-select formControlName="recipientMode"><mat-option value="ALL">Todos los colaboradores</mat-option><mat-option value="SELECTED">Colaboradores específicos</mat-option></mat-select></mat-form-field>
        @if (form.controls.recipientMode.value === 'SELECTED') {
          <mat-form-field appearance="outline"><mat-label>Colaboradores</mat-label><mat-select formControlName="recipientUserIds" multiple>@for (person of data.recipients; track person.userId) {<mat-option [value]="person.userId">{{ person.fullName }} · {{ person.email }}</mat-option>}</mat-select></mat-form-field>
        }
        <mat-form-field appearance="outline"><mat-label>Recordatorios</mat-label><mat-select formControlName="reminderOffsetsMinutes" multiple>@for (option of reminderOptions; track option.value) {<mat-option [value]="option.value">{{ option.label }}</mat-option>}</mat-select></mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end" [class.with-delete]="data.event && data.canDelete">
      @if (data.event && data.canDelete) {<button mat-button class="delete" type="button" (click)="remove()"><mat-icon>delete</mat-icon>Eliminar</button>}
      <div><button mat-button type="button" mat-dialog-close>Cancelar</button><button mat-flat-button color="primary" type="submit" form="event-form">Guardar evento</button></div>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; min-width: min(620px, 88vw); }
    .heading { display: flex; align-items: center; gap: .8rem; padding: 1.2rem 1.5rem 0; }
    .event-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; color: var(--primary); background: color-mix(in srgb, var(--primary) 14%, transparent); }
    .eyebrow { margin: 0 0 .15rem; color: var(--primary); text-transform: uppercase; letter-spacing: .1em; font-size: .7rem; }
    h2 { margin: 0; padding: 0; } form { display: grid; gap: .55rem; padding-top: .5rem; } mat-form-field { width: 100%; }
    .schedule-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
    .date-time-group { min-width: 0; margin: 0; padding: .8rem .8rem .15rem; border: 1px solid var(--tc-ghost-border); border-radius: 14px; }
    .date-time-group legend { display: inline-flex; align-items: center; gap: .35rem; padding: 0 .35rem; font-size: .8rem; font-weight: 700; }
    .date-time-group legend mat-icon { width: 18px; height: 18px; color: var(--primary); font-size: 18px; }
    .date-time-group.range-error { border-color: var(--destructive); }
    .range-message { display: flex; align-items: center; gap: .3rem; margin: -.15rem 0 .65rem; color: var(--destructive); font-size: .75rem; }
    .range-message mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .delete { color: var(--destructive); }
    mat-dialog-actions.with-delete { justify-content: space-between; }
    mat-dialog-actions > div { display: flex; gap: .5rem; }
    @media (width <= 640px) { :host { min-width: 84vw; } .schedule-grid { grid-template-columns: 1fr; } }
  `]
})
export class CalendarEventDialogComponent {
  protected readonly data = inject<CalendarEventDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CalendarEventDialogComponent, CalendarEventDialogResult>);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly reminderOptions = [
    { value: 0, label: 'Al iniciar' }, { value: 10, label: '10 minutos antes' }, { value: 15, label: '15 minutos antes' },
    { value: 30, label: '30 minutos antes' }, { value: 60, label: '1 hora antes' }, { value: 1440, label: '1 día antes' }
  ];
  private readonly initialStart = this.data.event ? new Date(this.data.event.start) : (this.data.start ?? new Date());
  private readonly initialEnd = this.data.event ? new Date(this.data.event.end) : new Date(this.initialStart.getTime() + 60 * 60 * 1000);
  private readonly displayedEnd = this.data.event?.allDay ? new Date(this.initialEnd.getTime() - 24 * 60 * 60 * 1000) : this.initialEnd;
  protected readonly touchUi = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse), (max-width: 640px)').matches;
  protected readonly form = this.formBuilder.nonNullable.group({
    title: [this.data.event?.title ?? '', Validators.required],
    startDate: [this.dateOnly(this.initialStart), Validators.required],
    startTime: [this.timeOnly(this.initialStart), Validators.required],
    endDate: [this.dateOnly(this.displayedEnd), Validators.required],
    endTime: [this.timeOnly(this.initialEnd), Validators.required],
    allDay: [this.data.event?.allDay ?? false],
    location: [this.data.event?.location ?? ''],
    description: [this.data.event?.description ?? ''],
    recipientMode: [this.data.event?.recipientMode ?? 'SELECTED' as 'ALL' | 'SELECTED'],
    recipientUserIds: [this.data.event?.recipientUserIds ?? [] as string[]],
    reminderOffsetsMinutes: [this.data.event?.reminderOffsetsMinutes ?? [15] as number[]]
  }, { validators: control => this.validateRange(control) });

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const { startDate, startTime, endDate, endTime, ...eventFields } = value;
    const event: CompanyCalendarEvent = {
      ...this.data.event,
      ...eventFields,
      start: this.combine(startDate, startTime, value.allDay, false),
      end: this.combine(endDate, endTime, value.allDay, true)
    };
    this.dialogRef.close({ action: 'save', event });
  }

  protected remove(): void { this.dialogRef.close({ action: 'delete' }); }

  private validateRange(control: AbstractControl): ValidationErrors | null {
    const startDate = control.get('startDate')?.value as Date | null;
    const startTime = control.get('startTime')?.value as Date | null;
    const endDate = control.get('endDate')?.value as Date | null;
    const endTime = control.get('endTime')?.value as Date | null;
    const allDay = control.get('allDay')?.value === true;
    if (!startDate || !startTime || !endDate || !endTime) return null;
    return this.combine(endDate, endTime, allDay, true) > this.combine(startDate, startTime, allDay, false)
      ? null
      : { dateRange: true };
  }

  private dateOnly(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  private timeOnly(date: Date): Date { return new Date(1970, 0, 1, date.getHours(), date.getMinutes()); }
  private combine(date: Date, time: Date, allDay: boolean, endOfAllDay: boolean): number {
    if (allDay) {
      const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (endOfAllDay) value.setDate(value.getDate() + 1);
      return value.getTime();
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes()).getTime();
  }
}
