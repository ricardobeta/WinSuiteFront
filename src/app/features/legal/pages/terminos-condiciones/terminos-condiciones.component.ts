import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  IndiceLegalComponent,
  SeccionLegal,
} from '../../components/indice-legal/indice-legal.component';
import { LegalLayoutComponent } from '../../components/legal-layout/legal-layout.component';
import { DATOS_EMPRESA } from '../../data/datos-empresa';
import { aplicarSeoLegal } from '../../utils/legal-seo';

@Component({
  selector: 'app-terminos-condiciones',
  imports: [LegalLayoutComponent, IndiceLegalComponent, RouterLink],
  templateUrl: './terminos-condiciones.component.html',
  styleUrl: './terminos-condiciones.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminosCondicionesComponent {
  protected readonly empresa = DATOS_EMPRESA;

  protected readonly secciones: readonly SeccionLegal[] = [
    { id: 'objeto', titulo: 'Objeto y aceptación' },
    { id: 'servicio', titulo: 'Descripción del servicio' },
    { id: 'cuenta', titulo: 'Cuenta y credenciales' },
    { id: 'uso', titulo: 'Uso aceptable' },
    { id: 'datos-cliente', titulo: 'Titularidad de tus datos' },
    { id: 'proteccion-datos', titulo: 'Protección de datos personales' },
    { id: 'facturacion', titulo: 'Facturación electrónica' },
    { id: 'planes', titulo: 'Planes y pagos' },
    { id: 'disponibilidad', titulo: 'Disponibilidad y soporte' },
    { id: 'responsabilidad', titulo: 'Límite de responsabilidad' },
    { id: 'terminacion', titulo: 'Terminación' },
    { id: 'ley', titulo: 'Ley aplicable' },
  ];

  constructor() {
    aplicarSeoLegal({
      titulo: 'Términos y Condiciones',
      descripcion:
        'Condiciones de uso de WinSuit: alcance del servicio, obligaciones del usuario, titularidad de los datos, facturación electrónica, pagos y responsabilidad.',
      ruta: '/legal/terminos',
    });
  }
}
