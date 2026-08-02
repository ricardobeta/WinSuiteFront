import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';

import { EmpresaFila } from '../../../../core/models/platform.models';
import { PlatformApiService } from '../../../../core/services/platform-api.service';
import { DataTableFrameComponent } from '../../../../shared/components/data-table-frame/data-table-frame.component';

/** Listado de todas las empresas registradas con su plan actual. */
@Component({
  selector: 'app-empresas-list',
  standalone: true,
  imports: [
    DatePipe,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    DataTableFrameComponent,
  ],
  template: `
    <section class="surface-card pagina">
      <div class="cabecera">
        <div>
          <p class="eyebrow">Plataforma</p>
          <h2>Empresas registradas</h2>
          <p class="sub">{{ empresas().length }} empresa(s) en total. Entra en una para editar su plan y sus limites.</p>
        </div>
        <button mat-stroked-button type="button" (click)="cargar()" [disabled]="cargando()">
          <mat-icon>refresh</mat-icon>
          Actualizar
        </button>
      </div>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <app-data-table-frame
        searchPlaceholder="Buscar por nombre, razon social o correo"
        [searchValue]="busqueda()"
        [total]="filtradas().length"
        [pageIndex]="pageIndex()"
        [pageSize]="pageSize()"
        (searchChange)="buscar($event)"
        (pageChange)="cambiarPagina($event)"
      >
        <table mat-table [dataSource]="pagina()">
          <ng-container matColumnDef="empresa">
            <th mat-header-cell *matHeaderCellDef>Empresa</th>
            <td mat-cell *matCellDef="let row">
              <strong>{{ row.name }}</strong>
              @if (row.businessName && row.businessName !== row.name) {
                <small>{{ row.businessName }}</small>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="contacto">
            <th mat-header-cell *matHeaderCellDef>Contacto</th>
            <td mat-cell *matCellDef="let row">{{ row.email || '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="plan">
            <th mat-header-cell *matHeaderCellDef>Plan</th>
            <td mat-cell *matCellDef="let row">{{ row.planNombre }}</td>
          </ng-container>

          <ng-container matColumnDef="estado">
            <th mat-header-cell *matHeaderCellDef>Estado</th>
            <td mat-cell *matCellDef="let row">
              <span class="pastilla" [class.suspendida]="row.estadoSuscripcion === 'SUSPENDED'">
                {{ etiquetaEstado(row.estadoSuscripcion) }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="creada">
            <th mat-header-cell *matHeaderCellDef>Creada</th>
            <td mat-cell *matCellDef="let row">{{ row.createdAt ? (row.createdAt | date: 'dd/MM/yyyy') : '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="acciones">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button color="primary" type="button" matTooltip="Administrar" (click)="abrir(row)">
                <mat-icon>tune</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columnas"></tr>
          <tr mat-row *matRowDef="let row; columns: columnas"></tr>
        </table>

        @if (!cargando() && filtradas().length === 0) {
          <p class="vacio">No hay empresas que coincidan con la busqueda.</p>
        }
      </app-data-table-frame>
    </section>
  `,
  styles: [`
    .pagina { padding: 1.25rem; display: grid; gap: 1rem; background: var(--tc-surface-container-lowest); }
    .cabecera { display: flex; align-items: end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .cabecera h2 { margin: 0; font-size: 1.35rem; }
    .sub { margin: .25rem 0 0; color: var(--muted-foreground); }
    .eyebrow { margin: 0 0 .3rem; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: var(--primary); }
    table { width: 100%; min-width: 860px; }
    thead tr { background: var(--tc-surface-container-low); }
    td strong { display: block; }
    td small { color: var(--muted-foreground); }
    .pastilla {
      display: inline-block; padding: .18rem .6rem; border-radius: 999px; font-size: .78rem;
      background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary);
    }
    .pastilla.suspendida { background: color-mix(in srgb, red 12%, transparent); color: #b3261e; }
    .vacio, .error { margin: 1rem 0 0; color: var(--muted-foreground); text-align: center; }
    .error { color: #b3261e; text-align: left; }
  `],
})
export class EmpresasListComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly router = inject(Router);

  protected readonly columnas = ['empresa', 'contacto', 'plan', 'estado', 'creada', 'acciones'];
  protected readonly empresas = signal<EmpresaFila[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busqueda = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(25);

  protected readonly filtradas = computed(() => {
    const needle = this.busqueda().trim().toLowerCase();
    if (!needle) return this.empresas();
    return this.empresas().filter((empresa) =>
      [empresa.name, empresa.businessName, empresa.email, empresa.planNombre]
        .some((valor) => (valor ?? '').toLowerCase().includes(needle)),
    );
  });

  protected readonly pagina = computed(() => {
    const inicio = this.pageIndex() * this.pageSize();
    return this.filtradas().slice(inicio, inicio + this.pageSize());
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.listarEmpresas().subscribe({
      next: (empresas) => {
        this.empresas.set(empresas);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el listado de empresas.');
        this.cargando.set(false);
      },
    });
  }

  protected buscar(valor: string): void {
    this.busqueda.set(valor);
    this.pageIndex.set(0);
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.pageIndex.set(evento.pageIndex);
    this.pageSize.set(evento.pageSize);
  }

  protected abrir(empresa: EmpresaFila): void {
    void this.router.navigate(['/super-admin/empresas', empresa.tenantId]);
  }

  protected etiquetaEstado(estado: string): string {
    if (estado === 'SUSPENDED') return 'Suspendida';
    if (estado === 'TRIAL') return 'Prueba';
    return 'Activa';
  }
}
