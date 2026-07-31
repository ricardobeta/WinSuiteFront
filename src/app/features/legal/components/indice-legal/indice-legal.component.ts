import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

export interface SeccionLegal {
  /** Debe coincidir con el id del <h2> correspondiente en la pagina. */
  readonly id: string;
  readonly titulo: string;
}

/**
 * Indice pegajoso de las paginas legales largas. Marca la seccion visible con un
 * IntersectionObserver y colapsa en un <details> por debajo de 1024 px.
 */
@Component({
  selector: 'app-indice-legal',
  imports: [MatIconModule, RouterLink],
  templateUrl: './indice-legal.component.html',
  styleUrl: './indice-legal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndiceLegalComponent {
  private readonly documento = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly secciones = input.required<readonly SeccionLegal[]>();

  protected readonly seccionActiva = signal('');
  protected readonly esEscritorio = signal(false);

  constructor() {
    // El ancho se resuelve antes del primer render para que en escritorio el indice
    // no aparezca colapsado y se abra de golpe.
    this.observarAnchoDeVentana();
    afterNextRender(() => this.observarSecciones());
  }

  private observarAnchoDeVentana(): void {
    const consulta = this.documento.defaultView?.matchMedia('(min-width: 64rem)');
    if (!consulta) {
      return;
    }

    this.esEscritorio.set(consulta.matches);
    const alCambiar = (evento: MediaQueryListEvent) => this.esEscritorio.set(evento.matches);
    consulta.addEventListener('change', alCambiar);
    this.destroyRef.onDestroy(() => consulta.removeEventListener('change', alCambiar));
  }

  private observarSecciones(): void {
    const ventana = this.documento.defaultView;
    if (!ventana || !('IntersectionObserver' in ventana)) {
      return;
    }

    const encabezados = this.secciones()
      .map((seccion) => this.documento.getElementById(seccion.id))
      .filter((elemento): elemento is HTMLElement => elemento !== null);

    if (encabezados.length === 0) {
      return;
    }

    // La banda estrecha en el tercio superior evita que dos secciones compitan por
    // el estado activo mientras el lector se desplaza.
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.find((entrada) => entrada.isIntersecting);
        if (visible) {
          this.seccionActiva.set(visible.target.id);
        }
      },
      { rootMargin: '-12% 0px -74% 0px', threshold: 0 },
    );

    encabezados.forEach((encabezado) => observador.observe(encabezado));
    this.destroyRef.onDestroy(() => observador.disconnect());
  }
}
