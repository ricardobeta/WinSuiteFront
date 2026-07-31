import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { DATOS_EMPRESA } from '../../data/datos-empresa';
import { BloqueContactoComponent } from '../bloque-contacto/bloque-contacto.component';

/**
 * Cascara comun de las paginas de /legal: cabecera con marca, cuerpo proyectado,
 * franja de contacto y pie con la fecha de vigencia.
 *
 * Proyecta dos slots: el atributo [indice] para la columna lateral (opcional) y el
 * contenido por defecto para el documento.
 */
@Component({
  selector: 'app-legal-layout',
  imports: [RouterLink, BloqueContactoComponent],
  templateUrl: './legal-layout.component.html',
  styleUrl: './legal-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // El partial cubre tambien el contenido proyectado por las paginas y sus propios
  // selectores de host, que quedan fuera del alcance de la encapsulacion emulada.
  encapsulation: ViewEncapsulation.None,
})
export class LegalLayoutComponent {
  readonly titulo = input.required<string>();
  readonly subtitulo = input.required<string>();

  protected readonly empresa = DATOS_EMPRESA;
  protected readonly anio = new Date().getFullYear();

  protected readonly vigenciaLegible = computed(() => {
    const fecha = new Date(`${this.empresa.ultimaActualizacion}T00:00:00`);
    return new Intl.DateTimeFormat('es-EC', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(fecha);
  });

  protected readonly titularLegal = computed(
    () => this.empresa.razonSocial || this.empresa.nombreComercial,
  );
}
