import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AppUserProfile } from '../../../../core/models/auth.models';
import { AuthorizationService } from '../../../../core/services/authorization.service';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import { ColaboradoresService } from '../../services/colaboradores.service';

@Component({
  selector: 'app-lista-colaboradores',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    MatSnackBarModule
  ],
  template: `
    <section class="surface-card page-card">
      <div class="toolbar">
        <div>
          <p class="eyebrow">Colaboradores</p>
          <h2>Lista de colaboradores</h2>
          <p>Consulta colaboradores y ajusta su acceso por rol.</p>
        </div>
        @if (authorization.canAccess('colaboradores', 'create')) {
          <a mat-raised-button color="primary" routerLink="/workspace/colaboradores/nuevo">
            <mat-icon>person_add</mat-icon>
            Crear colaborador
          </a>
        }
      </div>

      <div class="table-wrap">
        <table mat-table [dataSource]="dataSource" matSort>
          <ng-container matColumnDef="fullName">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Nombre</th>
            <td mat-cell *matCellDef="let row">{{ row.fullName }}</td>
          </ng-container>

          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Email</th>
            <td mat-cell *matCellDef="let row">{{ row.email }}</td>
          </ng-container>

          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Rol</th>
            <td mat-cell *matCellDef="let row">{{ row.role }}</td>
          </ng-container>

          <ng-container matColumnDef="active">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Estado</th>
            <td mat-cell *matCellDef="let row">
              <mat-chip [class.activo]="row.active" [class.inactivo]="!row.active">
                {{ row.active ? 'Activo' : 'Inactivo' }}
              </mat-chip>
            </td>
          </ng-container>

          <ng-container matColumnDef="acciones">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let row">
              @if (authorization.canAccess('colaboradores', 'update')) {
                <button mat-icon-button color="primary" type="button" matTooltip="Editar" (click)="editar(row)">
                  <mat-icon>edit</mat-icon>
                </button>
              }

              @if (authorization.canAccess('colaboradores', 'delete') && row.active) {
                <button mat-icon-button color="warn" type="button" matTooltip="Desactivar" (click)="desactivar(row)">
                  <mat-icon>person_off</mat-icon>
                </button>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>

      <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
    </section>
  `,
  styles: [
    `
      .page-card {
        padding: 1.25rem;
        display: grid;
        gap: 1rem;
      }
      .toolbar {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
      }
      .eyebrow {
        margin: 0 0 0.35rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.75rem;
        color: var(--primary);
      }
      h2 {
        margin: 0;
        font-size: 1.35rem;
      }
      .toolbar p {
        margin: 0.25rem 0 0;
        color: var(--muted-foreground);
      }
      .table-wrap {
        overflow: auto;
      }
      table {
        width: 100%;
        min-width: 860px;
      }
      mat-chip.activo {
        background: rgb(16 185 129 / 18%);
      }
      mat-chip.inactivo {
        background: rgb(148 163 184 / 22%);
      }
      @media (max-width: 900px) {
        .toolbar {
          align-items: start;
          flex-direction: column;
        }
      }
    `
  ]
})
export class ListaColaboradoresComponent implements OnInit {
  private readonly colaboradoresService = inject(ColaboradoresService);
  protected readonly authorization = inject(AuthorizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly dataSource = new MatTableDataSource<AppUserProfile>([]);
  protected readonly columns = ['fullName', 'email', 'role', 'active', 'acciones'];

  @ViewChild(MatPaginator) private paginator!: MatPaginator;
  @ViewChild(MatSort) private sort!: MatSort;

  ngOnInit(): void {
    this.colaboradoresService
      .getColaboradores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((users) => {
        this.dataSource.data = users;
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      });
  }

  protected editar(user: AppUserProfile): void {
    void this.router.navigate(['/workspace/colaboradores', user.userId, 'editar']);
  }

  protected desactivar(user: AppUserProfile): void {
    if (!user.userId) {
      return;
    }

    this.colaboradoresService.deactivateColaborador(user.userId).subscribe(() => {
      this.snackBar.openFromComponent(SuccessSnackbarComponent, {
        data: { message: 'Colaborador desactivado.', icon: 'person_off' },
        duration: 2600,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
    });
  }
}
