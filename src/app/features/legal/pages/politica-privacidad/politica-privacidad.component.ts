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
  selector: 'app-politica-privacidad',
  imports: [LegalLayoutComponent, IndiceLegalComponent, RouterLink],
  templateUrl: './politica-privacidad.component.html',
  styleUrl: './politica-privacidad.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoliticaPrivacidadComponent {
  protected readonly empresa = DATOS_EMPRESA;

  protected readonly secciones: readonly SeccionLegal[] = [
    { id: 'responsable', titulo: 'Responsable del tratamiento' },
    { id: 'datos', titulo: 'Datos que tratamos' },
    { id: 'finalidades', titulo: 'Para qué usamos los datos' },
    { id: 'base-legal', titulo: 'Base legal' },
    { id: 'whatsapp', titulo: 'WhatsApp Business y Meta' },
    { id: 'proveedores', titulo: 'Proveedores y transferencias' },
    { id: 'conservacion', titulo: 'Plazo de conservación' },
    { id: 'derechos', titulo: 'Tus derechos' },
    { id: 'seguridad', titulo: 'Seguridad de la información' },
    { id: 'menores', titulo: 'Menores de edad' },
    { id: 'cambios', titulo: 'Cambios en esta política' },
  ];

  constructor() {
    aplicarSeoLegal({
      titulo: 'Política de Privacidad',
      descripcion:
        'Cómo WinSuit recopila, usa, comparte y protege los datos personales de sus usuarios, conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador.',
      ruta: '/legal/privacidad',
    });
  }
}
