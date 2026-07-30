import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ConfigScreenContext } from '../../../../core/services/ai-config-copilot.service';
import { ConfiguracionClientesService } from '../../../../core/services/configuracion-clientes.service';
import { AgregarCampoDialogComponent } from '../../../../shared/components/agregar-campo-dialog/agregar-campo-dialog.component';
import { ConfigCopilotPanelComponent } from '../../../../shared/components/config-copilot-panel/config-copilot-panel.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { CampoPersonalizado, ConfiguracionClientes } from '../../../../shared/models/clientes.models';

@Component({
  selector: 'app-configuracion-clientes',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatPaginatorModule, MatButtonModule, MatIconModule, MatDialogModule, MatTooltipModule, MatSnackBarModule, ConfigCopilotPanelComponent],
  template: `
    <section class="config-page" aria-labelledby="clientes-config-title">
      <header class="page-header">
        <div><p class="eyebrow">Clientes</p><h2 id="clientes-config-title">Configuración</h2><p>Define la información adicional que el equipo puede registrar para cada cliente.</p></div>
        <div class="header-actions">
          <span class="header-count"><mat-icon>tune</mat-icon>{{ configuracion().camposPersonalizados.length }} campos</span>
          <app-config-copilot-panel [context]="copilotContext" [ejemplos]="copilotEjemplos" />
        </div>
      </header>
      <div class="config-surface surface-card">
        <div class="section-heading"><div class="section-icon"><mat-icon>tune</mat-icon></div><div><h3>Campos personalizados</h3><p>Crea campos reutilizables para clientes y futuros módulos.</p></div></div>
        <div class="toolbar"><div><strong>Información adicional del cliente</strong><p>Los campos se mostrarán al crear o editar clientes.</p></div><button mat-flat-button color="primary" type="button" (click)="agregarCampo()"><mat-icon>add</mat-icon>Agregar campo</button></div>
        @if (configuracion().camposPersonalizados.length > 0) {
          <div class="table-wrap"><table mat-table [dataSource]="dataSource" class="fields-table">
            <ng-container matColumnDef="nombreMostrar"><th mat-header-cell *matHeaderCellDef>Nombre</th><td mat-cell *matCellDef="let row"><strong>{{ row.nombreMostrar }}</strong></td></ng-container>
            <ng-container matColumnDef="tipo"><th mat-header-cell *matHeaderCellDef>Tipo</th><td mat-cell *matCellDef="let row">{{ row.tipo }}</td></ng-container>
            <ng-container matColumnDef="opciones"><th mat-header-cell *matHeaderCellDef>Opciones</th><td mat-cell *matCellDef="let row" class="options-cell" [matTooltip]="formatearOpciones(row)">{{ formatearOpciones(row) }}</td></ng-container>
            <ng-container matColumnDef="estado"><th mat-header-cell *matHeaderCellDef>Estado</th><td mat-cell *matCellDef="let row"><span class="chips">@if (row.requerido) { <span class="chip">Obligatorio</span> }@if (row.visibleEnLista) { <span class="chip">En la lista</span> }@if (row.activo === false) { <span class="chip chip-off">Desactivado</span> }</span></td></ng-container>
            <ng-container matColumnDef="acciones"><th mat-header-cell *matHeaderCellDef><span class="visually-hidden">Acciones</span></th><td mat-cell *matCellDef="let row"><button mat-icon-button type="button" [attr.aria-label]="'Editar ' + row.nombreMostrar" matTooltip="Editar campo" (click)="editarCampo(row)"><mat-icon>edit</mat-icon></button><button mat-icon-button color="warn" type="button" [attr.aria-label]="'Eliminar ' + row.nombreMostrar" matTooltip="Eliminar campo" (click)="eliminarCampo(row)"><mat-icon>delete_outline</mat-icon></button></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="columnasVisibles"></tr><tr mat-row *matRowDef="let row; columns: columnasVisibles"></tr>
          </table></div>
          <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
        } @else {
          <div class="empty-state"><mat-icon>playlist_add</mat-icon><h4>Aún no hay campos personalizados</h4><p>Agrega campos como sector, fecha de aniversario o preferencias para conocer mejor a tus clientes.</p><button mat-stroked-button type="button" (click)="agregarCampo()">Agregar primer campo</button></div>
        }
      </div>
    </section>
  `,
  styles: [`
    .config-page { display: grid; gap: 1rem; max-width: 1440px; margin: 0 auto; }.page-header { display: flex; align-items: end; justify-content: space-between; gap: 2rem; padding: .25rem; }.page-header h2 { margin: 0; font-size: clamp(1.55rem, 2vw, 2rem); letter-spacing: -.025em; }.page-header p { margin: .35rem 0 0; color: var(--muted-foreground); }.eyebrow { margin: 0 0 .35rem; color: var(--primary); font-size: .72rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .header-actions { display: flex; align-items: end; gap: .75rem; flex-shrink: 0; flex-wrap: wrap; }
    .header-count { display: inline-flex; align-items: center; gap: .35rem; min-height: 34px; padding: .2rem .7rem; border: 1px solid var(--border); border-radius: 999px; color: var(--muted-foreground); font-size: .78rem; font-weight: 650; white-space: nowrap; }.header-count mat-icon { width: 18px; height: 18px; color: var(--primary); font-size: 18px; }
    .chips { display: inline-flex; gap: .3rem; flex-wrap: wrap; }.chip { padding: .1rem .5rem; border-radius: 999px; background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); font-size: .72rem; font-weight: 650; white-space: nowrap; }.chip-off { background: color-mix(in srgb, var(--muted-foreground) 14%, transparent); color: var(--muted-foreground); }
    .config-surface { display: grid; gap: 1.25rem; padding: 1.5rem; border: 1px solid var(--border); border-radius: 16px; background: var(--tc-surface-container-lowest); box-shadow: 0 8px 28px rgb(15 23 42 / 5%); }.section-heading { display: flex; align-items: flex-start; gap: .9rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border); }.section-icon { display: grid; width: 44px; height: 44px; flex: 0 0 44px; place-items: center; border-radius: 12px; background: color-mix(in srgb, var(--primary) 11%, transparent); color: var(--primary); }.section-heading h3 { margin: 0; font-size: 1.2rem; }.section-heading p, .toolbar p { margin: .3rem 0 0; color: var(--muted-foreground); font-size: .86rem; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }.table-wrap { overflow: auto; }.fields-table { width: 100%; min-width: 720px; }.fields-table th { color: var(--muted-foreground); font-size: .72rem; font-weight: 700; letter-spacing: .035em; text-transform: uppercase; }.options-cell { max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.empty-state { display: grid; justify-items: center; gap: .65rem; padding: 2.75rem 1rem; border: 1px dashed var(--border); border-radius: 12px; text-align: center; }.empty-state mat-icon { width: 42px; height: 42px; color: var(--muted-foreground); font-size: 42px; }.empty-state h4, .empty-state p { margin: 0; }.empty-state p { max-width: 56ch; color: var(--muted-foreground); }.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
    @media (max-width: 900px) { .page-header, .toolbar { align-items: start; flex-direction: column; }.header-count { display: none; }.config-surface { padding: 1.1rem; } }
  `]
})
export class ConfiguracionClientesComponent implements OnInit, AfterViewInit {
  private readonly configuracionService = inject(ConfiguracionClientesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild(MatPaginator) protected paginator!: MatPaginator;
  protected readonly dataSource = new MatTableDataSource<CampoPersonalizado>([]);
  protected readonly configuracion = signal<ConfiguracionClientes>({ camposPersonalizados: [] });
  protected readonly columnasVisibles = ['nombreMostrar', 'tipo', 'opciones', 'estado', 'acciones'];

  /** screenKey debe coincidir con el ConfigToolSet del backend. */
  protected readonly copilotContext: ConfigScreenContext = {
    route: '/workspace/customers/configuracion',
    module: 'Clientes',
    page: 'Configuracion',
    screenKey: 'clientes.configuracion'
  };
  protected readonly copilotEjemplos = [
    'Quiero saber por qué canal llegó cada cliente',
    'Agrega la fecha de aniversario del cliente',
    'Necesito guardar notas internas de cada cliente'
  ];

  ngOnInit(): void { this.configuracionService.getConfiguracion().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((configuracion) => { this.configuracion.set(configuracion); this.dataSource.data = configuracion.camposPersonalizados ?? []; }); }
  ngAfterViewInit(): void { this.dataSource.paginator = this.paginator; }
  protected agregarCampo(): void { this.dialog.open(AgregarCampoDialogComponent, { width: '760px', maxWidth: '95vw' }).afterClosed().subscribe((campo: CampoPersonalizado | undefined) => { if (campo) void this.configuracionService.agregarCampo(campo).then(() => this.mostrarExito('Campo personalizado agregado.', 'playlist_add')); }); }

  /**
   * El dialogo ya sabia editar (acepta el campo como data) pero se abria siempre sin el. Sin
   * esto, lo que el copiloto cambia no se puede revertir a mano.
   */
  protected editarCampo(campo: CampoPersonalizado): void { this.dialog.open(AgregarCampoDialogComponent, { width: '760px', maxWidth: '95vw', data: campo }).afterClosed().subscribe((editado: CampoPersonalizado | undefined) => { if (editado) void this.configuracionService.actualizarCampo(editado).then(() => this.mostrarExito('Campo personalizado actualizado.', 'edit')); }); }
  protected eliminarCampo(campo: CampoPersonalizado): void { this.dialog.open(ConfirmDialogComponent, { width: '420px', data: { title: 'Eliminar campo', message: `¿Deseas eliminar el campo ${campo.nombreMostrar}?`, confirmText: 'Eliminar' } }).afterClosed().subscribe((confirmado) => { if (confirmado) void this.configuracionService.eliminarCampo(campo.idCampo).then(() => this.mostrarExito('Campo eliminado correctamente.', 'delete')); }); }
  protected formatearOpciones(campo: CampoPersonalizado): string { return campo.opciones?.map((opcion) => `${opcion.clave}: ${opcion.valor}`).join(' · ') ?? '-'; }
  private mostrarExito(message: string, icon: string): void { this.snackBar.openFromComponent(SuccessSnackbarComponent, { data: { message, icon }, duration: 2600, horizontalPosition: 'end', verticalPosition: 'top' }); }
}
