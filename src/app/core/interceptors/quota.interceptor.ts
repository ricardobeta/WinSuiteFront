import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, catchError, throwError } from 'rxjs';

import {
  LimiteAlcanzadoData,
  LimiteAlcanzadoDialogComponent,
} from '../../shared/components/limite-alcanzado-dialog/limite-alcanzado-dialog.component';

/**
 * Convierte el HTTP 402 del backend en un aviso con salida de compra.
 *
 * El error se sigue propagando para que cada pantalla pueda deshacer lo que estuviera haciendo;
 * el interceptor solo se encarga de explicarle al usuario que paso y adonde ir.
 */
@Injectable()
export class QuotaInterceptor implements HttpInterceptor {
  private readonly dialog = inject(MatDialog);
  /** Evita apilar dialogos cuando una pantalla lanza varias peticiones a la vez. */
  private dialogoAbierto = false;

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 402) {
          this.avisar(error.error as Partial<LimiteAlcanzadoData> | null);
        }
        return throwError(() => error);
      }),
    );
  }

  private avisar(cuerpo: Partial<LimiteAlcanzadoData> | null): void {
    if (this.dialogoAbierto) {
      return;
    }
    this.dialogoAbierto = true;
    this.dialog
      .open(LimiteAlcanzadoDialogComponent, {
        width: '460px',
        data: {
          error: cuerpo?.error ?? 'Alcanzaste el limite de tu plan.',
          recurso: cuerpo?.recurso ?? '',
          recursoNombre: cuerpo?.recursoNombre ?? 'Recurso',
          limite: cuerpo?.limite ?? 0,
          usado: cuerpo?.usado ?? 0,
          bolsa: cuerpo?.bolsa ?? 0,
        } satisfies LimiteAlcanzadoData,
      })
      .afterClosed()
      .subscribe(() => {
        this.dialogoAbierto = false;
      });
  }
}
