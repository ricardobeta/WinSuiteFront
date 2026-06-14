import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { AsientoContable, EstadoAsiento } from '../../models/contabilidad.models';
import { AsientosContablesService } from '../../services/asientos-contables.service';

@Component({
  selector: 'app-asientos-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  template: `
    <section class="asientos-page">
      <header class="surface-card page-header">
        <div>
          <p class="eyebrow">Contabilidad</p>
          <h2>
            Asientos manuales
            <button mat-icon-button type="button" matTooltipPosition="above" [matTooltip]="ayuda.submodulo" aria-label="Ayuda asientos manuales">
              <mat-icon>help_outline</mat-icon>
            </button>
          </h2>
          <p>Registra ajustes, aperturas y movimientos contables manuales.</p>
        </div>
        <a mat-raised-button color="primary" routerLink="/workspace/contabilidad/asientos/nuevo" [class.disabled-link]="!canCreate()" matTooltipPosition="above" [matTooltip]="ayuda.nuevo">
          <mat-icon>add</mat-icon>
          Nuevo asiento
        </a>
      </header>

      <section class="surface-card filters-card">
        <mat-form-field appearance="outline">
          <mat-label>Buscar</mat-label>
          <input matInput type="search" [value]="busqueda()" (input)="actualizarBusqueda($event)" placeholder="Numero, detalle o referencia" />
          <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.buscar" aria-label="Ayuda buscar asiento">
            <mat-icon>help_outline</mat-icon>
          </button>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select [value]="estadoFiltro()" (valueChange)="estadoFiltro.set($event)">
            <mat-option value="TODOS">Todos</mat-option>
            <mat-option value="BORRADOR">Borrador</mat-option>
            <mat-option value="APROBADO">Aprobado</mat-option>
            <mat-option value="REVERSADO">Reversado</mat-option>
          </mat-select>
          <button mat-icon-button matIconSuffix type="button" matTooltipPosition="above" [matTooltip]="ayuda.estado" aria-label="Ayuda estado asiento">
            <mat-icon>help_outline</mat-icon>
          </button>
        </mat-form-field>
      </section>

      <section class="surface-card table-card">
        @if (cargando()) {
          <div class="empty-state">
            <mat-icon>hourglass_empty</mat-icon>
            <h3>Cargando asientos</h3>
          </div>
        } @else if (asientosFiltrados().length === 0) {
          <div class="empty-state">
            <mat-icon>receipt_long</mat-icon>
            <h3>Sin asientos</h3>
            <p>Crea el primer asiento manual para este tenant.</p>
          </div>
        } @else {
          <div class="table-wrap">
            <table mat-table [dataSource]="asientosFiltrados()">
              <ng-container matColumnDef="numero">
                <th mat-header-cell *matHeaderCellDef>Numero</th>
                <td mat-cell *matCellDef="let row">{{ row.numero ?? 'Borrador' }}</td>
              </ng-container>

              <ng-container matColumnDef="fecha">
                <th mat-header-cell *matHeaderCellDef>Fecha</th>
                <td mat-cell *matCellDef="let row">{{ row.fecha }}</td>
              </ng-container>

              <ng-container matColumnDef="periodo">
                <th mat-header-cell *matHeaderCellDef>Periodo</th>
                <td mat-cell *matCellDef="let row">{{ row.periodo }}</td>
              </ng-container>

              <ng-container matColumnDef="glosa">
                <th mat-header-cell *matHeaderCellDef>Detalle</th>
                <td mat-cell *matCellDef="let row">{{ row.glosa }}</td>
              </ng-container>

              <ng-container matColumnDef="totalDebe">
                <th mat-header-cell *matHeaderCellDef>Debe</th>
                <td mat-cell *matCellDef="let row">{{ row.totalDebe | number:'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="totalHaber">
                <th mat-header-cell *matHeaderCellDef>Haber</th>
                <td mat-cell *matCellDef="let row">{{ row.totalHaber | number:'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="estado">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let row">
                  <mat-chip [class.estado-borrador]="row.estado === 'BORRADOR'" [class.estado-aprobado]="row.estado === 'APROBADO'">
                    {{ row.estado }}
                  </mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="acciones">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let row">
                  <button mat-button type="button" (click)="editar(row)" matTooltipPosition="above" [matTooltip]="ayuda.editar">Editar</button>
                  <button mat-button type="button" (click)="duplicar(row)" [disabled]="!canCreate()" matTooltipPosition="above" [matTooltip]="ayuda.duplicar">Duplicar</button>
                  <button mat-button type="button" (click)="reversar(row)" [disabled]="row.estado !== 'APROBADO' || !canCreate()" matTooltipPosition="above" [matTooltip]="ayuda.reversar">Reversar</button>
                  <button mat-button color="warn" type="button" (click)="eliminar(row)" [disabled]="row.estado !== 'BORRADOR' || !canDelete()" matTooltipPosition="above" [matTooltip]="ayuda.eliminar">Eliminar</button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columnas"></tr>
              <tr mat-row *matRowDef="let row; columns: columnas"></tr>
            </table>
          </div>
        }
      </section>
    </section>
  `,
  styles: [`
    .asientos-page { display: grid; gap: 1rem; }
    .page-header { padding: 1.25rem; display: flex; justify-content: space-between; align-items: end; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .page-header h2 { margin: 0; font-size: 1.45rem; }
    .page-header h2 { display: inline-flex; align-items: center; gap: .35rem; }
    .page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .filters-card { padding: 1rem; display: grid; grid-template-columns: minmax(260px, 1fr) 220px; gap: .75rem; background: var(--tc-surface-container-lowest); }
    .table-card { padding: 1rem; background: var(--tc-surface-container-lowest); }
    .table-wrap { overflow: auto; }
    table { width: 100%; min-width: 1080px; }
    .estado-borrador { background: color-mix(in srgb, #f59e0b 18%, transparent); }
    .estado-aprobado { background: color-mix(in srgb, var(--primary) 18%, transparent); }
    .empty-state { min-height: 240px; display: grid; place-items: center; align-content: center; gap: .5rem; text-align: center; color: var(--muted-foreground); }
    .empty-state h3 { margin: 0; color: var(--foreground); }
    .empty-state p { margin: 0; }
    .disabled-link { pointer-events: none; opacity: .55; }
    button[mat-icon-button] { color: var(--muted-foreground); }
    @media (max-width: 860px) {
      .page-header { flex-direction: column; align-items: flex-start; }
      .filters-card { grid-template-columns: 1fr; }
    }
  `]
})
export class AsientosListComponent implements OnInit {
  private readonly service = inject(AsientosContablesService);
  private readonly authorization = inject(AuthorizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected readonly columnas = ['numero', 'fecha', 'periodo', 'glosa', 'totalDebe', 'totalHaber', 'estado', 'acciones'];
  protected readonly asientos = signal<AsientoContable[]>([]);
  protected readonly cargando = signal(true);
  protected readonly busqueda = signal('');
  protected readonly estadoFiltro = signal<EstadoAsiento | 'TODOS'>('TODOS');
  protected readonly canCreate = computed(() => this.authorization.canAccess('contabilidad', 'create'));
  protected readonly canDelete = computed(() => this.authorization.canAccess('contabilidad', 'delete'));
  protected readonly ayuda = {
    submodulo: 'Registro de comprobantes contables manuales. Solo los asientos aprobados afectan mayores, balances y estados financieros.',
    nuevo: 'Crea un asiento en borrador para registrar aperturas, ajustes o movimientos que no vienen de POS/compras.',
    buscar: 'Busca por numero de asiento, detalle general o referencia del documento soporte.',
    estado: 'Borrador no afecta reportes; aprobado impacta saldos; reversado conserva trazabilidad del asiento anulado.',
    editar: 'Permite revisar el detalle. Solo los borradores se pueden modificar.',
    duplicar: 'Copia lineas y datos para acelerar registros similares sin afectar el asiento original.',
    reversar: 'Genera un asiento inverso para anular contablemente un asiento aprobado sin borrar historico.',
    eliminar: 'Solo elimina borradores. Los asientos aprobados deben reversarse para mantener auditoria.'
  };

  protected readonly asientosFiltrados = computed(() => {
    const term = this.busqueda().trim().toLowerCase();
    return this.asientos().filter((asiento) => {
      const matchText = !term
        || (asiento.numero ?? '').toLowerCase().includes(term)
        || asiento.glosa.toLowerCase().includes(term)
        || (asiento.referencia ?? '').toLowerCase().includes(term);
      const matchEstado = this.estadoFiltro() === 'TODOS' || asiento.estado === this.estadoFiltro();
      return matchText && matchEstado;
    });
  });

  ngOnInit(): void {
    this.service
      .getAsientos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (asientos) => {
          this.asientos.set(asientos);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.mostrarMensaje('No se pudieron cargar los asientos.', 'error');
        }
      });
  }

  protected actualizarBusqueda(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value);
  }

  protected editar(asiento: AsientoContable): void {
    void this.router.navigate(['/workspace/contabilidad/asientos', asiento.id, 'editar']);
  }

  protected duplicar(asiento: AsientoContable): void {
    void this.router.navigate(['/workspace/contabilidad/asientos/nuevo'], {
      state: { asientoInicial: this.service.duplicarAsiento(asiento) }
    });
  }

  protected reversar(asiento: AsientoContable): void {
    void this.router.navigate(['/workspace/contabilidad/asientos/nuevo'], {
      state: { asientoInicial: this.service.crearReverso(asiento) }
    });
  }

  protected eliminar(asiento: AsientoContable): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Eliminar borrador',
        message: `Deseas eliminar el asiento ${asiento.numero ?? 'en borrador'}?`,
        confirmText: 'Eliminar'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }

      void this.service.eliminarBorrador(asiento).then(() => {
        this.mostrarMensaje('Borrador eliminado.', 'delete');
      });
    });
  }

  private mostrarMensaje(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}
