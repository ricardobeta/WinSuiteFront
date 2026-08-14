import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EtiquetaClienteConfig } from '../../models/clientes.models';
import { resolverEtiquetaCliente } from '../../utils/etiquetas-clientes.utils';

@Component({
  selector: 'app-etiqueta-cliente-chip',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="cliente-tag"
      [attr.data-color]="vista().color"
      [class.is-muted]="!vista().activa"
      [matTooltip]="ayuda()"
    >
      <span class="tag-dot" aria-hidden="true"></span>
      <span>{{ vista().nombre }}</span>
      @if (mostrarEstado() && (vista().historica || !vista().activa)) {
        <mat-icon aria-hidden="true">history</mat-icon>
      }
    </span>
  `,
  styles: [`
    :host { display: inline-flex; max-width: 100%; }
    .cliente-tag { --tag-bg: #d8f3ed; --tag-fg: #075b50; display: inline-flex; min-height: 28px; max-width: 100%; align-items: center; gap: .38rem; padding: .18rem .62rem; border-radius: 999px; background: var(--tag-bg); color: var(--tag-fg); font-size: .76rem; font-weight: 700; line-height: 1.25; }
    .cliente-tag > span:nth-child(2) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tag-dot { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; background: currentColor; opacity: .72; }
    mat-icon { width: 14px; height: 14px; font-size: 14px; opacity: .7; }
    [data-color='blue'] { --tag-bg: #dceeff; --tag-fg: #174f78; }
    [data-color='violet'] { --tag-bg: #ece5ff; --tag-fg: #593b87; }
    [data-color='amber'] { --tag-bg: #ffedc7; --tag-fg: #714500; }
    [data-color='rose'] { --tag-bg: #ffe1e7; --tag-fg: #8b2943; }
    [data-color='slate'] { --tag-bg: #e7ecef; --tag-fg: #45545b; }
    .is-muted { filter: saturate(.5); opacity: .82; }
    :host-context(html.theme-dark) .cliente-tag { --tag-bg: #163f38; --tag-fg: #a9eee0; }
    :host-context(html.theme-dark) [data-color='blue'] { --tag-bg: #17364a; --tag-fg: #b9e0fb; }
    :host-context(html.theme-dark) [data-color='violet'] { --tag-bg: #35274b; --tag-fg: #ddc9ff; }
    :host-context(html.theme-dark) [data-color='amber'] { --tag-bg: #493716; --tag-fg: #ffdda0; }
    :host-context(html.theme-dark) [data-color='rose'] { --tag-bg: #4b2631; --tag-fg: #ffc6d2; }
    :host-context(html.theme-dark) [data-color='slate'] { --tag-bg: #30383c; --tag-fg: #d7e0e4; }
  `]
})
export class EtiquetaClienteChipComponent {
  readonly valor = input.required<string>();
  readonly catalogo = input.required<EtiquetaClienteConfig[]>();
  readonly mostrarEstado = input(true);

  protected readonly vista = computed(() => resolverEtiquetaCliente(this.valor(), this.catalogo()));
  protected readonly ayuda = computed(() => {
    if (this.vista().historica) return 'Etiqueta histórica';
    if (!this.vista().activa) return 'Etiqueta desactivada';
    return '';
  });
}
