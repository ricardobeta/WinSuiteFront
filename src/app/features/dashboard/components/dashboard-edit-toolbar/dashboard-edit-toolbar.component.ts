import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-dashboard-edit-toolbar',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="edit-toolbar">
      @if (!editing()) {
        <button mat-raised-button color="primary" type="button" (click)="edit.emit()">
          <mat-icon>edit</mat-icon>
          Editar dashboard
        </button>
      } @else {
        <button mat-stroked-button type="button" (click)="add.emit()">
          <mat-icon>add</mat-icon>
          Agregar metrica
        </button>
        <button mat-stroked-button type="button" (click)="reset.emit()">
          <mat-icon>restart_alt</mat-icon>
          Restablecer
        </button>
        <button mat-stroked-button type="button" (click)="publish.emit()" matTooltip="Guarda este diseno como base del negocio">
          <mat-icon>business</mat-icon>
          Publicar negocio
        </button>
        <button mat-button type="button" (click)="cancel.emit()">Cancelar</button>
        <button mat-raised-button color="primary" type="button" (click)="save.emit()">
          <mat-icon>save</mat-icon>
          Guardar
        </button>
      }
    </div>
  `,
  styles: [`
    .edit-toolbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: .55rem;
      flex-wrap: wrap;
    }

    button {
      white-space: nowrap;
    }
  `]
})
export class DashboardEditToolbarComponent {
  readonly editing = input(false);

  readonly edit = output<void>();
  readonly add = output<void>();
  readonly reset = output<void>();
  readonly publish = output<void>();
  readonly cancel = output<void>();
  readonly save = output<void>();
}
