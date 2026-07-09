import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { AgregarCampoDialogComponent } from '../../../../shared/components/agregar-campo-dialog/agregar-campo-dialog.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CampoPersonalizado } from '../../../../shared/models/clientes.models';
import { NominaService } from '../../services/nomina.service';

@Component({
  selector: 'app-nomina-campos-empleado-configuracion',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  template: `
    <section class="nomina-config">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Contabilidad - Nomina</p>
          <h2>Configuracion de empleados</h2>
          <p>Define los campos adicionales que apareceran al crear o editar empleados de nomina.</p>
        </div>
        <button mat-raised-button color="primary" type="button" (click)="agregarCampo()" [disabled]="!canUpdate()">
          <mat-icon>add</mat-icon>
          Agregar campo
        </button>
      </header>

      <section class="surface-card config-card">
        <div class="section-head">
          <div>
            <h3>Campos adicionales del empleado</h3>
            <p>Usalos para registrar informacion propia de tu operacion, como talla de uniforme, banco o centro de costo.</p>
          </div>
        </div>

        @if (camposPersonalizados().length === 0) {
          <div class="empty-state">
            <mat-icon>dynamic_form</mat-icon>
            <h3>Sin campos adicionales</h3>
            <p>Agrega campos para adaptar la ficha del empleado a tu empresa.</p>
          </div>
        } @else {
          <div class="table-wrap">
            <table mat-table [dataSource]="camposPersonalizados()">
              <ng-container matColumnDef="nombreMostrar">
                <th mat-header-cell *matHeaderCellDef>Nombre</th>
                <td mat-cell *matCellDef="let row">{{ row.nombreMostrar }}</td>
              </ng-container>

              <ng-container matColumnDef="tipo">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let row">{{ row.tipo }}</td>
              </ng-container>

              <ng-container matColumnDef="opciones">
                <th mat-header-cell *matHeaderCellDef>Opciones</th>
                <td mat-cell *matCellDef="let row" class="options-cell" [matTooltip]="formatearOpciones(row)">
                  {{ formatearOpciones(row) }}
                </td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef class="num">Acciones</th>
                <td mat-cell *matCellDef="let row" class="num">
                  <button mat-icon-button color="warn" type="button" matTooltip="Eliminar campo" (click)="eliminarCampo(row)" [disabled]="!canUpdate()">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnasCampos"></tr>
              <tr mat-row *matRowDef="let row; columns: columnasCampos"></tr>
            </table>
          </div>
        }
      </section>
    </section>
  `,
  styles: [`
    .nomina-config { display: grid; gap: 1rem; }
    .page-header, .config-card { padding: 1.25rem; background: var(--tc-surface-container-lowest); }
    .page-header { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    h2, h3, p { margin: 0; }
    .page-header p, .section-head p, .empty-state p { margin-top: .35rem; color: var(--muted-foreground); }
    .config-card { display: grid; gap: 1rem; }
    .section-head { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 640px; }
    .num { text-align: right; }
    .options-cell { max-width: 340px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .empty-state { min-height: 190px; display: grid; place-items: center; align-content: center; gap: .35rem; color: var(--muted-foreground); text-align: center; }
    .empty-state mat-icon { color: var(--primary); font-size: 2rem; width: 2rem; height: 2rem; }
  `]
})
export class NominaCamposEmpleadoConfiguracionComponent {
  private readonly nominaService = inject(NominaService);
  private readonly authorization = inject(AuthorizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly camposPersonalizados = signal<CampoPersonalizado[]>([]);
  protected readonly canUpdate = computed(() => this.authorization.canAccess('contabilidad', 'update'));
  protected readonly columnasCampos = ['nombreMostrar', 'tipo', 'opciones', 'acciones'];

  constructor() {
    this.nominaService
      .getConfiguracion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => this.camposPersonalizados.set(config.camposPersonalizados ?? []));
  }

  protected agregarCampo(): void {
    if (!this.canUpdate()) {
      return;
    }

    const dialogRef = this.dialog.open(AgregarCampoDialogComponent, {
      width: '760px',
      maxWidth: '95vw'
    });

    dialogRef.afterClosed().subscribe((campo: CampoPersonalizado | undefined) => {
      if (!campo) {
        return;
      }
      void this.nominaService.agregarCampo(campo).then(() => this.toast('Campo adicional agregado.', 'playlist_add'));
    });
  }

  protected eliminarCampo(campo: CampoPersonalizado): void {
    if (!this.canUpdate()) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Eliminar campo',
        message: `Deseas eliminar el campo ${campo.nombreMostrar}?`,
        confirmText: 'Eliminar'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }
      void this.nominaService.eliminarCampo(campo.idCampo).then(() => this.toast('Campo eliminado.', 'delete'));
    });
  }

  protected formatearOpciones(campo: CampoPersonalizado): string {
    return campo.opciones?.map((opcion) => `${opcion.clave}: ${opcion.valor}`).join(' - ') ?? '-';
  }

  private toast(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}
