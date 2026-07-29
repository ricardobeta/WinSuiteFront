import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-dashboard-edit-toolbar',
  standalone: true,
  host: {
    '[class.is-editing]': 'editing()'
  },
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  template: `
    <div class="edit-toolbar">
      @if (!editing()) {
        <button mat-raised-button color="primary" type="button" aria-label="Personalizar dashboard" (click)="edit.emit()">
          <mat-icon>edit</mat-icon>
          Personalizar dashboard
        </button>
      } @else {
        <button mat-stroked-button type="button" (click)="add.emit()">
          <mat-icon>add</mat-icon>
          <span class="desktop-label">Agregar widget</span>
          <span class="mobile-label">Agregar</span>
        </button>
        <button mat-button type="button" (click)="cancel.emit()">
          <mat-icon>close</mat-icon>
          <span>Cancelar</span>
        </button>
        <button mat-raised-button color="primary" type="button" (click)="save.emit()">
          <mat-icon>save</mat-icon>
          <span>Guardar</span>
        </button>
        <button
          mat-button
          type="button"
          aria-label="Más opciones de personalización"
          matTooltip="Más opciones"
          [matMenuTriggerFor]="moreMenu"
        >
          <mat-icon>more_vert</mat-icon>
          <span class="mobile-label">Más</span>
        </button>

        <mat-menu #moreMenu="matMenu">
          <button mat-menu-item type="button" (click)="reset.emit()">
            <mat-icon>restart_alt</mat-icon>
            <span>Restablecer</span>
          </button>
          @if (canPublish()) {
            <button mat-menu-item type="button" (click)="publish.emit()">
              <mat-icon>business</mat-icon>
              <span>Publicar como base</span>
            </button>
          }
        </mat-menu>
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
      min-height: 44px;
      white-space: nowrap;
    }

    .mobile-label {
      display: none;
    }

    @media (max-width: 759px) {
      :host:not(.is-editing) .edit-toolbar button {
        width: 44px;
        min-width: 44px;
        padding: 0;
        font-size: 0;
      }

      :host:not(.is-editing) .edit-toolbar mat-icon {
        margin: 0;
      }

      :host(.is-editing) {
        position: fixed;
        z-index: 80;
        right: 0;
        bottom: 0;
        left: 0;
        padding: .55rem max(.75rem, env(safe-area-inset-right)) max(.55rem, env(safe-area-inset-bottom)) max(.75rem, env(safe-area-inset-left));
        border-top: 1px solid var(--border);
        background: color-mix(in srgb, var(--tc-surface-container-lowest) 94%, transparent);
        box-shadow: 0 -10px 28px rgb(0 0 0 / 14%);
        backdrop-filter: blur(12px);
      }

      :host(.is-editing) .edit-toolbar {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: .35rem;
      }

      :host(.is-editing) button {
        min-width: 0;
        padding-inline: .4rem;
      }

      :host(.is-editing) button span {
        font-size: .75rem;
      }

      :host(.is-editing) .desktop-label {
        display: none;
      }

      :host(.is-editing) .mobile-label {
        display: inline;
      }
    }
  `]
})
export class DashboardEditToolbarComponent {
  readonly editing = input(false);
  readonly canPublish = input(false);

  readonly edit = output<void>();
  readonly add = output<void>();
  readonly reset = output<void>();
  readonly publish = output<void>();
  readonly cancel = output<void>();
  readonly save = output<void>();
}
