import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

/** Cuerpo del HTTP 402 que devuelve el backend cuando una operacion no cabe en el plan. */
export interface LimiteAlcanzadoData {
  error: string;
  recurso: string;
  recursoNombre: string;
  limite: number;
  usado: number;
  bolsa: number;
}

/**
 * Se abre cuando el backend rechaza una operacion por limite de plan. Ofrece las dos salidas
 * posibles: comprar mas capacidad o, para los tokens de IA, usar la clave propia de la empresa.
 */
@Component({
  selector: 'app-limite-alcanzado-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>lock</mat-icon>
      Alcanzaste el limite de tu plan
    </h2>

    <mat-dialog-content>
      <p class="mensaje">{{ data.error }}</p>

      @if (data.limite > 0) {
        <dl>
          <div>
            <dt>Recurso</dt>
            <dd>{{ data.recursoNombre }}</dd>
          </div>
          <div>
            <dt>Incluido en tu plan</dt>
            <dd>{{ data.limite.toLocaleString('es-EC') }}</dd>
          </div>
          <div>
            <dt>Consumido</dt>
            <dd>{{ data.usado.toLocaleString('es-EC') }}</dd>
          </div>
          @if (data.bolsa > 0) {
            <div>
              <dt>Saldo comprado</dt>
              <dd>{{ data.bolsa.toLocaleString('es-EC') }}</dd>
            </div>
          }
        </dl>
      }

      @if (esRecursoDeIa) {
        <p class="alternativa">
          Tambien puedes seguir trabajando con tu propia clave de IA configurandola en los datos
          de tu empresa. En ese caso el consumo lo facturas directamente al proveedor.
        </p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cerrar</button>
      @if (esRecursoDeIa) {
        <button mat-stroked-button type="button" (click)="irAConector()">Usar mi propia clave</button>
      }
      <button mat-raised-button color="primary" type="button" (click)="irAPlanes()">
        <mat-icon>upgrade</mat-icon>
        Ver planes
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: .5rem; }
    .mensaje { margin: 0 0 1rem; }
    dl { display: grid; gap: .4rem; margin: 0 0 1rem; }
    dl div { display: flex; justify-content: space-between; gap: 1rem; }
    dt { color: var(--muted-foreground); }
    dd { margin: 0; font-weight: 600; }
    .alternativa { margin: 0; color: var(--muted-foreground); font-size: .9rem; }
  `],
})
export class LimiteAlcanzadoDialogComponent {
  protected readonly data = inject<LimiteAlcanzadoData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<LimiteAlcanzadoDialogComponent>);
  private readonly router = inject(Router);

  protected readonly esRecursoDeIa = this.data.recurso === 'aiTokens';

  protected irAPlanes(): void {
    this.dialogRef.close(true);
    void this.router.navigate(['/workspace/planes'], { queryParams: { recurso: this.data.recurso } });
  }

  protected irAConector(): void {
    this.dialogRef.close(true);
    void this.router.navigate(['/workspace/empresa/ia']);
  }
}
