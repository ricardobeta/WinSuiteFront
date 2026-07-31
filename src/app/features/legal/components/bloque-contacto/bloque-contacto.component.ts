import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { DATOS_EMPRESA } from '../../data/datos-empresa';

/**
 * Franja de contacto que cierra las tres paginas legales. El telefono publicado aqui
 * es el que Meta cruza contra el registrado en Business Manager.
 */
@Component({
  selector: 'app-bloque-contacto',
  imports: [MatIconModule],
  templateUrl: './bloque-contacto.component.html',
  styleUrl: './bloque-contacto.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BloqueContactoComponent {
  protected readonly empresa = DATOS_EMPRESA;
}
