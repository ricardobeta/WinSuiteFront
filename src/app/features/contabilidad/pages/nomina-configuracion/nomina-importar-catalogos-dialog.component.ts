import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { VistaPreviaImportacionCatalogosNomina } from '../../models/nomina.models';

@Component({
  selector: 'app-nomina-importar-catalogos-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Importar datos existentes</h2>
    <mat-dialog-content>
      <div class="summary" role="status">
        <mat-icon>sync_alt</mat-icon>
        <p><strong>{{ data.empleadosPorVincular }} empleados</strong> se vincularán con los catálogos sin cambiar sus nombres actuales.</p>
      </div>
      <div class="preview-grid">
        <section>
          <h3>{{ data.cargos.length }} cargos nuevos</h3>
          @if (data.cargos.length) {
            <ul>@for (nombre of data.cargos; track nombre) { <li>{{ nombre }}</li> }</ul>
          } @else { <p>Todos los cargos ya existen.</p> }
        </section>
        <section>
          <h3>{{ data.departamentos.length }} departamentos nuevos</h3>
          @if (data.departamentos.length) {
            <ul>@for (nombre of data.departamentos; track nombre) { <li>{{ nombre }}</li> }</ul>
          } @else { <p>Todos los departamentos ya existen.</p> }
        </section>
      </div>
      <p class="note">Después de importar, revisa y asigna una cuenta contable a cada cargo antes de aprobar el próximo rol.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false" type="button">Cancelar</button>
      <button mat-flat-button color="primary" [mat-dialog-close]="true" type="button" [disabled]="data.empleadosPorVincular === 0">Importar y vincular</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .summary { display: flex; align-items: flex-start; gap: .75rem; padding: .9rem 1rem; border-radius: 14px; background: var(--tc-surface-container-low); }
    .summary mat-icon { color: var(--primary); }
    .summary p, .note { margin: 0; line-height: 1.5; }
    .preview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-top: 1rem; }
    .preview-grid section { padding: 1rem; border-radius: 14px; background: var(--tc-surface-container-low); }
    h3 { margin: 0 0 .6rem; font-size: 1rem; }
    ul { max-height: 180px; overflow: auto; margin: 0; padding-left: 1.2rem; }
    li + li { margin-top: .35rem; }
    .preview-grid p { margin: 0; color: var(--muted-foreground); }
    .note { margin-top: 1rem; color: var(--muted-foreground); font-size: .86rem; }
    @media (max-width: 640px) { .preview-grid { grid-template-columns: 1fr; } }
  `]
})
export class NominaImportarCatalogosDialogComponent {
  protected readonly data = inject<VistaPreviaImportacionCatalogosNomina>(MAT_DIALOG_DATA);
}
