import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import {
  RevisarAsientoData,
  RevisarAsientoDialogComponent
} from '../components/revisar-asiento-dialog/revisar-asiento-dialog.component';
import { AsientoContableLinea } from '../models/contabilidad.models';
import { PlanCuentasService } from './plan-cuentas.service';

export interface SolicitudRevisionAsiento {
  titulo: string;
  subtitulo: string;
  lineas: AsientoContableLinea[];
}

/** Orquestador reutilizable para que cualquier submodulo revise el mismo popup contable. */
@Injectable({ providedIn: 'root' })
export class RevisionAsientoService {
  private readonly dialog = inject(MatDialog);
  private readonly planCuentasService = inject(PlanCuentasService);

  async revisar(solicitud: SolicitudRevisionAsiento): Promise<AsientoContableLinea[] | null> {
    const cuentas = await this.planCuentasService.getCuentasOnce();
    const data: RevisarAsientoData = { ...solicitud, cuentas };
    const resultado = await firstValueFrom(
      this.dialog.open<RevisarAsientoDialogComponent, RevisarAsientoData, AsientoContableLinea[] | undefined>(
        RevisarAsientoDialogComponent,
        { maxWidth: '96vw', width: 'min(1120px, 96vw)', data }
      ).afterClosed()
    );
    return resultado ?? null;
  }
}
