import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { EstadoOrdenCompra, OrdenCompra } from '../../models/inventario.models';
import { OrdenesCompraService } from '../../services/ordenes-compra.service';

@Component({
  selector: 'app-ordenes-compra-kanban',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DragDropModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule
  ],
  template: `
    <section class="page-grid">
      <header class="surface-card header-card">
        <div>
          <p class="eyebrow">Inventario</p>
          <h2>Kanban drag and drow</h2>
          <p>Mueve ordenes entre estados operativos con filtro rapido.</p>
        </div>

        <div class="header-actions">
          <a mat-stroked-button routerLink="/workspace/inventario/ordenes-compra">Volver a lista</a>
          <a mat-raised-button color="primary" routerLink="/workspace/inventario/ordenes-compra/new">Nueva OC</a>
        </div>
      </header>

      <section class="surface-card filter-card">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Filtrar OC (numero o proveedorId)</mat-label>
          <input matInput [value]="filtro()" (input)="filtro.set($any($event.target).value)" />
        </mat-form-field>
      </section>

      <section class="kanban-grid">
        @for (estado of estados; track estado) {
          <article class="surface-card lane-card">
            <header class="lane-head">
              <h3>{{ estado }}</h3>
              <span>{{ porEstado(estado).length }}</span>
            </header>

            <div
              class="lane-body"
              cdkDropList
              [cdkDropListData]="porEstado(estado)"
              [cdkDropListConnectedTo]="dropListIds"
              [id]="dropId(estado)"
              (cdkDropListDropped)="soltar($event, estado)">
              @for (oc of porEstado(estado); track oc.id) {
                <div class="oc-card" cdkDrag [cdkDragData]="oc">
                  <p class="numero">{{ oc.numero }}</p>
                  <p>Total: {{ oc.total | number:'1.2-2' }}</p>
                  <p>Proveedor: {{ oc.proveedorId }}</p>
                  <p>Emision: {{ oc.fechaEmision | date:'dd/MM/yyyy' }}</p>
                  <a mat-button [routerLink]="['/workspace/inventario/ordenes-compra', oc.id, 'ver']">Ver</a>
                </div>
              }
            </div>
          </article>
        }
      </section>
    </section>
  `,
  styles: [`
    .page-grid { display: grid; gap: 1rem; }
    .header-card, .filter-card { padding: 1rem 1.25rem; background: var(--tc-surface-container-lowest); }
    .header-card { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; }
    .header-card h2 { margin: 0; }
    .header-card p { margin: .35rem 0 0; color: var(--muted-foreground); }
    .header-actions { display: flex; gap: .5rem; }
    .eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; color: var(--primary); }
    .filter-field { width: 100%; }
    .kanban-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .9rem; }
    .lane-card { padding: .75rem; background: var(--tc-surface-container-lowest); display: grid; gap: .75rem; }
    .lane-head { display: flex; justify-content: space-between; align-items: center; }
    .lane-head h3 { margin: 0; font-size: 1rem; }
    .lane-head span { color: var(--muted-foreground); }
    .lane-body { min-height: 220px; display: grid; gap: .6rem; }
    .oc-card { background: color-mix(in srgb, var(--tc-surface-container-low) 92%, white); border-radius: .8rem; padding: .75rem; display: grid; gap: .25rem; cursor: grab; }
    .oc-card p { margin: 0; color: var(--muted-foreground); }
    .oc-card .numero { color: var(--foreground); font-weight: 700; }
    @media (max-width: 1200px) { .kanban-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 900px) {
      .header-card { align-items: flex-start; flex-direction: column; }
      .kanban-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class OrdenesCompraKanbanComponent {
  private readonly service = inject(OrdenesCompraService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly filtro = signal('');
  protected readonly ordenes = signal<OrdenCompra[]>([]);
  protected readonly estados: EstadoOrdenCompra[] = ['BORRADOR', 'ENVIADA', 'RECIBIDA_PARCIAL', 'RECIBIDA', 'ANULADA'];
  protected readonly dropListIds = this.estados.map((e) => this.dropId(e));

  protected readonly ordenesFiltradas = computed(() => {
    const term = this.filtro().trim().toLowerCase();
    if (!term) {
      return this.ordenes();
    }

    return this.ordenes().filter((oc) =>
      oc.numero.toLowerCase().includes(term) ||
      oc.proveedorId.toLowerCase().includes(term)
    );
  });

  constructor() {
    this.service
      .getOrdenesCompra()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ordenes) => {
        this.ordenes.set(ordenes);
      });
  }

  protected porEstado(estado: EstadoOrdenCompra): OrdenCompra[] {
    return this.ordenesFiltradas().filter((oc) => oc.estado === estado);
  }

  protected async soltar(event: CdkDragDrop<OrdenCompra[]>, estadoDestino: EstadoOrdenCompra): Promise<void> {
    const oc = event.item.data as OrdenCompra;
    if (!oc?.id || oc.estado === estadoDestino) {
      return;
    }

    if (estadoDestino === 'RECIBIDA' || estadoDestino === 'RECIBIDA_PARCIAL') {
      await this.router.navigate(['/workspace/inventario/ordenes-compra', oc.id, 'recibir']);
      return;
    }

    try {
      await this.service.cambiarEstadoOrdenCompra(oc.id, estadoDestino);
      this.toast('Estado actualizado.', 'check_circle');
    } catch (error) {
      this.toast(error instanceof Error ? error.message : 'No fue posible mover la OC.', 'error');
    }
  }

  protected dropId(estado: EstadoOrdenCompra): string {
    return `kanban-${estado}`;
  }

  private toast(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2200,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}
