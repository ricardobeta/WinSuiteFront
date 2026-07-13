import { DatePipe, NgClass } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { PageEvent } from '@angular/material/paginator';

import { AuditEvent } from '../../../../core/models/audit.models';
import { AuditService } from '../../../../core/services/audit.service';
import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';

@Component({
  selector: 'app-auditoria-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    NgClass,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    DataTableFrameComponent
  ],
  template: `
    <section class="audit-page">
      <header class="surface-card header">
        <div>
          <p class="eyebrow">Trazabilidad</p>
          <h1>Auditoria de cambios</h1>
          <p>Consulta las acciones recientes hechas por usuarios y procesos del sistema.</p>
        </div>
        <button mat-stroked-button type="button" (click)="reload()">
          <mat-icon>refresh</mat-icon>
          Actualizar
        </button>
        <div class="header-icon" aria-hidden="true"><mat-icon>manage_search</mat-icon></div>
      </header>

      <section class="surface-card filters">
        <mat-form-field appearance="outline">
          <mat-label>Modulo</mat-label>
          <mat-select [(ngModel)]="moduleFilter" (selectionChange)="reload()">
            <mat-option value="">Todos</mat-option>
            @for (module of modules(); track module) {
              <mat-option [value]="module">{{ module }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Buscar</mat-label>
          <input matInput [(ngModel)]="textFilter" placeholder="Usuario, registro o resumen" />
        </mat-form-field>
      </section>

      <section class="surface-card table-card">
        @if (loading()) {
          <div class="state">
            <mat-spinner diameter="34" />
          </div>
        } @else if (filteredEvents().length === 0) {
          <div class="state empty">
            <mat-icon>manage_search</mat-icon>
            <span>No hay eventos para los filtros actuales.</span>
          </div>
        } @else {
          <app-data-table-frame
            [showSearch]="false"
            [total]="filteredEvents().length"
            [pageIndex]="pageIndexActual()"
            [pageSize]="pageSize()"
            (pageChange)="actualizarPagina($event)"
          >
            <table mat-table [dataSource]="paginatedEvents()">
              <ng-container matColumnDef="timestamp">
                <th mat-header-cell *matHeaderCellDef>Fecha</th>
                <td mat-cell *matCellDef="let row">{{ row.timestamp | date:'dd/MM/yyyy HH:mm' }}</td>
              </ng-container>

              <ng-container matColumnDef="action">
                <th mat-header-cell *matHeaderCellDef>Accion</th>
                <td mat-cell *matCellDef="let row">
                  <span class="action-pill" [ngClass]="row.action">{{ labelAction(row.action) }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="module">
                <th mat-header-cell *matHeaderCellDef>Modulo</th>
                <td mat-cell *matCellDef="let row">{{ row.module }}</td>
              </ng-container>

              <ng-container matColumnDef="target">
                <th mat-header-cell *matHeaderCellDef>Registro</th>
                <td mat-cell *matCellDef="let row">
                  <strong>{{ row.target?.label || row.entityId }}</strong>
                  <span>{{ row.entityType }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="actor">
                <th mat-header-cell *matHeaderCellDef>Usuario</th>
                <td mat-cell *matCellDef="let row">
                  <strong>{{ row.actor?.fullName || row.actor?.email || row.userId }}</strong>
                  <span>{{ row.actor?.role || 'Sin rol' }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="summary">
                <th mat-header-cell *matHeaderCellDef>Resumen</th>
                <td mat-cell *matCellDef="let row">{{ row.summary }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>
            </table>
          </app-data-table-frame>
          @if (hasMore()) {
            <div class="load-more">
              <button mat-stroked-button type="button" [disabled]="loadingMore()" (click)="loadMore()">
                {{ loadingMore() ? 'Cargando...' : 'Cargar más' }}
              </button>
            </div>
          }
        }
      </section>
    </section>
  `,
  styles: [
    `
      .audit-page {
        display: grid;
        gap: 1rem;
      }

      .header,
      .filters,
      .table-card {
        padding: 1.25rem;
      }

      .header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: end;
        min-height: 132px;
        background: var(--tc-hero-background);
        overflow: hidden;
      }

      .header > div:first-child { min-width: 0; flex: 1; }
      .header-icon { width: 58px; height: 58px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 18px; color: var(--primary); background: color-mix(in srgb, var(--primary) 14%, transparent); }
      .header-icon mat-icon { width: 30px; height: 30px; font-size: 30px; }

      .eyebrow {
        margin: 0 0 0.35rem;
        color: var(--primary);
        font-size: 0.75rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        font-size: 1.6rem;
      }

      p {
        color: var(--muted-foreground);
        margin: 0.35rem 0 0;
      }

      .filters {
        display: grid;
        gap: 1rem;
        grid-template-columns: minmax(180px, 260px) minmax(240px, 1fr);
      }

      .table-wrap {
        overflow: auto;
      }

      table {
        width: 100%;
        min-width: 980px;
      }

      td span {
        display: block;
        color: var(--muted-foreground);
        font-size: 0.82rem;
      }

      .action-pill {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 18%, transparent);
        color: var(--foreground);
        font-size: 0.8rem;
      }

      .action-pill.eliminar,
      .action-pill.reversar {
        background: var(--tc-error-container);
        color: var(--tc-on-error-container);
      }

      .action-pill.aprobar,
      .action-pill.publicar {
        background: var(--tc-success-container);
        color: var(--tc-on-success-container);
      }

      .state {
        min-height: 220px;
        display: grid;
        place-items: center;
        color: var(--muted-foreground);
      }

      .empty {
        gap: 0.5rem;
      }

      .empty mat-icon {
        font-size: 2rem;
        width: 2rem;
        height: 2rem;
      }

      .load-more {
        display: flex;
        justify-content: center;
        padding-top: 1rem;
      }

      @media (max-width: 760px) {
        .header {
          align-items: start;
          flex-direction: column;
        }

        .filters {
          grid-template-columns: 1fr;
        }
        .header-icon { display: none; }
      }
    `
  ]
})
export class AuditoriaPageComponent implements OnInit {
  private readonly audit = inject(AuditService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = ['timestamp', 'action', 'module', 'target', 'actor', 'summary'];
  protected readonly events = signal<AuditEvent[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);
  private readonly nextCursor = signal<string | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected moduleFilter = '';
  protected textFilter = '';

  protected modules(): string[] {
    return [...new Set(this.events().map((event) => event.module).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  protected filteredEvents(): AuditEvent[] {
    const moduleFilter = this.moduleFilter.trim().toLowerCase();
    const textFilter = this.textFilter.trim().toLowerCase();

    return this.events().filter((event) => {
      const matchesModule = !moduleFilter || event.module.toLowerCase() === moduleFilter;
      const haystack = [
        event.summary,
        event.entityId,
        event.entityType,
        event.target?.label,
        event.actor?.fullName,
        event.actor?.email,
        event.actor?.role
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesText = !textFilter || haystack.includes(textFilter);
      return matchesModule && matchesText;
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.pageIndex.set(0);
    this.loading.set(true);
    this.nextCursor.set(null);
    this.audit
      .getEventsPage(50, null, this.moduleFilter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.events.set(page.items);
          this.nextCursor.set(page.nextCursor);
          this.hasMore.set(page.hasMore);
          this.loading.set(false);
        },
        error: () => {
          this.events.set([]);
          this.nextCursor.set(null);
          this.hasMore.set(false);
          this.loading.set(false);
        }
      });
  }

  protected pageIndexActual(): number {
    return Math.min(this.pageIndex(), Math.max(0, Math.ceil(this.filteredEvents().length / this.pageSize()) - 1));
  }

  protected paginatedEvents(): AuditEvent[] {
    const start = this.pageIndexActual() * this.pageSize();
    return this.filteredEvents().slice(start, start + this.pageSize());
  }

  protected actualizarPagina(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  protected loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) {
      return;
    }

    this.loadingMore.set(true);
    this.audit
      .getEventsPage(50, cursor, this.moduleFilter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.events.update((events) => [...events, ...page.items]);
          this.nextCursor.set(page.nextCursor);
          this.hasMore.set(page.hasMore);
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false)
      });
  }

  protected labelAction(action: string): string {
    const labels: Record<string, string> = {
      crear: 'Crear',
      actualizar: 'Actualizar',
      eliminar: 'Eliminar',
      aprobar: 'Aprobar',
      reversar: 'Reversar',
      importar: 'Importar',
      generar: 'Generar',
      publicar: 'Publicar',
      configurar: 'Configurar'
    };

    return labels[action] ?? action;
  }
}
