import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

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
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <div class="heading"><span class="event-icon"><mat-icon>event</mat-icon></span><div><p class="eyebrow">Calendario de la empresa</p><h2 mat-dialog-title>{{ data.event ? 'Editar evento' : 'Nuevo evento' }}</h2></div></div>
    <mat-dialog-content>
      <form id="event-form" [formGroup]="form" (ngSubmit)="save()">
        <mat-form-field appearance="outline" class="wide"><mat-label>Titulo</mat-label><input matInput formControlName="title" maxlength="140" /></mat-form-field>
        <div class="dates">
          <mat-form-field appearance="outline"><mat-label>Inicio</mat-label><input matInput type="datetime-local" formControlName="start" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Finalizacion</mat-label><input matInput type="datetime-local" formControlName="end" /></mat-form-field>
        </div>
        <mat-checkbox formControlName="allDay">Evento de todo el dia</mat-checkbox>
        <mat-form-field appearance="outline"><mat-label>Lugar o enlace</mat-label><input matInput formControlName="location" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Descripcion</mat-label><textarea matInput formControlName="description" rows="3"></textarea></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Alertar a</mat-label><mat-select formControlName="recipientMode"><mat-option value="ALL">Todos los colaboradores</mat-option><mat-option value="SELECTED">Colaboradores especificos</mat-option></mat-select></mat-form-field>
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
    .heading { display: flex; align-items: center; gap: 0.8rem; padding: 1.2rem 1.5rem 0; }
    .event-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; color: var(--primary); background: color-mix(in srgb, var(--primary) 14%, transparent); }
    .eyebrow { margin: 0 0 0.15rem; color: var(--primary); text-transform: uppercase; letter-spacing: .1em; font-size: .7rem; }
    h2 { margin: 0; padding: 0; } form { display: grid; gap: .25rem; padding-top: .5rem; } mat-form-field { width: 100%; }
    .dates { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; } .delete { color: var(--destructive); }
    mat-dialog-actions.with-delete { justify-content: space-between; }
    mat-dialog-actions > div { display: flex; gap: .5rem; }
    @media (width <= 640px) { :host { min-width: 84vw; } .dates { grid-template-columns: 1fr; } }
  `]
})
export class CalendarEventDialogComponent {
  protected readonly data = inject<CalendarEventDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CalendarEventDialogComponent, CalendarEventDialogResult>);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly reminderOptions = [
    { value: 0, label: 'Al iniciar' }, { value: 10, label: '10 minutos antes' }, { value: 15, label: '15 minutos antes' },
    { value: 30, label: '30 minutos antes' }, { value: 60, label: '1 hora antes' }, { value: 1440, label: '1 dia antes' }
  ];
  private readonly initialStart = this.data.event ? new Date(this.data.event.start) : (this.data.start ?? new Date());
  private readonly initialEnd = this.data.event ? new Date(this.data.event.end) : new Date(this.initialStart.getTime() + 60 * 60 * 1000);
  protected readonly form = this.formBuilder.nonNullable.group({
    title: [this.data.event?.title ?? '', Validators.required],
    start: [this.localDateTime(this.initialStart), Validators.required],
    end: [this.localDateTime(this.initialEnd), Validators.required],
    allDay: [this.data.event?.allDay ?? false],
    location: [this.data.event?.location ?? ''], description: [this.data.event?.description ?? ''],
    recipientMode: [this.data.event?.recipientMode ?? 'SELECTED' as 'ALL' | 'SELECTED'],
    recipientUserIds: [this.data.event?.recipientUserIds ?? [] as string[]],
    reminderOffsetsMinutes: [this.data.event?.reminderOffsetsMinutes ?? [15] as number[]]
  });

  protected save(): void {
    this.form.markAllAsTouched(); if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const event: CompanyCalendarEvent = { ...this.data.event, ...value, start: new Date(value.start).getTime(), end: new Date(value.end).getTime() };
    if (event.end <= event.start) { this.form.controls.end.setErrors({ range: true }); return; }
    this.dialogRef.close({ action: 'save', event });
  }
  protected remove(): void { this.dialogRef.close({ action: 'delete' }); }
  private localDateTime(date: Date): string { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
}
