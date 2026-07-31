import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LegalLayoutComponent } from '../../components/legal-layout/legal-layout.component';
import { DATOS_EMPRESA } from '../../data/datos-empresa';
import { aplicarSeoLegal } from '../../utils/legal-seo';

interface FilaFicha {
  readonly etiqueta: string;
  readonly valor: string;
  /** Marca los datos numericos para que se rendericen con cifras tabulares. */
  readonly numerico?: boolean;
}

/**
 * Pagina publica de identificacion de la empresa y su representante legal.
 * Es la URL que se entrega a Meta durante la verificacion de negocio, por lo que los
 * datos deben coincidir de forma exacta con el RUC y con Business Manager.
 */
@Component({
  selector: 'app-representante-legal',
  imports: [LegalLayoutComponent, RouterLink],
  templateUrl: './representante-legal.component.html',
  styleUrl: './representante-legal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepresentanteLegalComponent {
  protected readonly empresa = DATOS_EMPRESA;

  protected readonly identidad = computed<readonly FilaFicha[]>(() => [
    { etiqueta: 'Razón social', valor: this.empresa.razonSocial },
    { etiqueta: 'Nombre comercial', valor: this.empresa.nombreComercial },
    { etiqueta: 'RUC', valor: this.empresa.ruc, numerico: true },
    { etiqueta: 'Domicilio fiscal', valor: this.empresa.direccion },
    { etiqueta: 'País', valor: this.empresa.pais },
  ]);

  protected readonly representacion = computed<readonly FilaFicha[]>(() => [
    { etiqueta: 'Nombre completo', valor: this.empresa.representanteLegal.nombre },
    { etiqueta: 'Cargo', valor: this.empresa.representanteLegal.cargo },
    { etiqueta: 'Teléfono de contacto', valor: this.empresa.telefono.display, numerico: true },
  ]);

  constructor() {
    aplicarSeoLegal({
      titulo: 'Representante Legal',
      descripcion:
        'Identificación de la empresa titular de WinSuit: razón social, RUC, domicilio fiscal, representante legal y teléfono de contacto.',
      ruta: '/legal/representante-legal',
      conJsonLd: true,
    });
  }
}
