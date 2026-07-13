import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FUENTES, FuenteId, TemaSitio } from '@winsuite/bloques';
import { SelectorImagenComponent } from '../selector-imagen/selector-imagen.component';

@Component({
  selector: 'app-panel-tema',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectorImagenComponent],
  template: `
    <div class="panel">
      <h3>Tema del sitio</h3>

      <div class="campo">
        <span class="etiqueta">Temas listos</span>
        <div class="presets">
          @for (preset of presets; track preset.nombre) {
            <button
              type="button"
              class="preset"
              [title]="preset.nombre"
              (click)="aplicarPreset(preset)"
            >
              <span class="muestra" [style.background]="preset.tema.colorPrimario"></span>
              <span class="muestra" [style.background]="preset.tema.colorAcento"></span>
              <span class="muestra" [style.background]="preset.tema.colorFondo"></span>
              <span class="preset-nombre">{{ preset.nombre }}</span>
            </button>
          }
        </div>
      </div>

      <div class="colores">
        <label>
          <input
            type="color"
            [ngModel]="tema().colorPrimario"
            (ngModelChange)="patch({ colorPrimario: $event })"
          />
          <span>Primario</span>
        </label>
        <label>
          <input
            type="color"
            [ngModel]="tema().colorAcento"
            (ngModelChange)="patch({ colorAcento: $event })"
          />
          <span>Acento</span>
        </label>
        <label>
          <input
            type="color"
            [ngModel]="tema().colorFondo"
            (ngModelChange)="patch({ colorFondo: $event })"
          />
          <span>Fondo</span>
        </label>
        <label>
          <input
            type="color"
            [ngModel]="tema().colorTexto"
            (ngModelChange)="patch({ colorTexto: $event })"
          />
          <span>Texto</span>
        </label>
      </div>

      <label class="campo">
        <span>Fuente de titulos</span>
        <select [ngModel]="tema().fuenteTitulos" (ngModelChange)="patch({ fuenteTitulos: $event })">
          @for (fuente of fuentes; track fuente.id) {
            <option [value]="fuente.id">{{ fuente.label }}</option>
          }
        </select>
      </label>

      <label class="campo">
        <span>Fuente de texto</span>
        <select [ngModel]="tema().fuenteCuerpo" (ngModelChange)="patch({ fuenteCuerpo: $event })">
          @for (fuente of fuentes; track fuente.id) {
            <option [value]="fuente.id">{{ fuente.label }}</option>
          }
        </select>
      </label>

      <label class="campo">
        <span>Esquinas</span>
        <select [ngModel]="tema().radioEsquinas" (ngModelChange)="patch({ radioEsquinas: $event })">
          <option value="recto">Rectas</option>
          <option value="suave">Suaves</option>
          <option value="redondo">Redondeadas</option>
        </select>
      </label>

      <div class="campo">
        <span class="etiqueta">Logo</span>
        <app-selector-imagen [url]="tema().logoUrl" (urlChange)="patch({ logoUrl: $event })" />
      </div>
    </div>
  `,
  styles: `
    .panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 14px;
      color: var(--tc-on-surface);
    }
    h3 {
      margin: 0;
      font-size: 0.95rem;
    }
    .colores {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .colores label {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-size: 0.72rem;
    }
    .colores input[type='color'] {
      width: 100%;
      height: 34px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 6px;
      padding: 2px;
      background: var(--tc-surface-container-lowest);
      cursor: pointer;
    }
    .presets {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .preset {
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 6px 8px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 8px;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
      cursor: pointer;
      font: inherit;
      font-size: 0.75rem;
    }
    .preset:hover {
      border-color: var(--primary);
    }
    .muestra {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      border: 1px solid var(--tc-ghost-border);
      flex-shrink: 0;
    }
    .preset-nombre {
      margin-left: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .campo {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .campo .etiqueta {
      font-weight: 600;
    }
    select {
      font: inherit;
      font-weight: 400;
      padding: 7px 8px;
      border: 1px solid var(--tc-ghost-border);
      border-radius: 6px;
      background: var(--tc-surface-container-lowest);
      color: var(--tc-on-surface);
    }
  `,
})
export class PanelTemaComponent {
  readonly tema = input.required<TemaSitio>();
  readonly temaChange = output<TemaSitio>();

  readonly fuentes = (Object.keys(FUENTES) as FuenteId[]).map((id) => ({
    id,
    label: FUENTES[id].label,
  }));

  /** Temas listos para aplicar con un click (mantienen el logo actual). */
  readonly presets: { nombre: string; tema: Omit<TemaSitio, 'logoUrl'> }[] = [
    {
      nombre: 'Clasico',
      tema: {
        colorPrimario: '#2563eb',
        colorAcento: '#f59e0b',
        colorFondo: '#ffffff',
        colorTexto: '#1f2937',
        fuenteTitulos: 'poppins',
        fuenteCuerpo: 'inter',
        radioEsquinas: 'suave',
      },
    },
    {
      nombre: 'Natural',
      tema: {
        colorPrimario: '#059669',
        colorAcento: '#d97706',
        colorFondo: '#f8faf7',
        colorTexto: '#1c2b24',
        fuenteTitulos: 'montserrat',
        fuenteCuerpo: 'system',
        radioEsquinas: 'redondo',
      },
    },
    {
      nombre: 'Elegante',
      tema: {
        colorPrimario: '#111827',
        colorAcento: '#b45309',
        colorFondo: '#faf7f2',
        colorTexto: '#27272a',
        fuenteTitulos: 'playfair',
        fuenteCuerpo: 'inter',
        radioEsquinas: 'recto',
      },
    },
    {
      nombre: 'Vibrante',
      tema: {
        colorPrimario: '#db2777',
        colorAcento: '#7c3aed',
        colorFondo: '#ffffff',
        colorTexto: '#18181b',
        fuenteTitulos: 'poppins',
        fuenteCuerpo: 'roboto',
        radioEsquinas: 'redondo',
      },
    },
    {
      nombre: 'Oscuro',
      tema: {
        colorPrimario: '#38bdf8',
        colorAcento: '#facc15',
        colorFondo: '#0f172a',
        colorTexto: '#e2e8f0',
        fuenteTitulos: 'montserrat',
        fuenteCuerpo: 'inter',
        radioEsquinas: 'suave',
      },
    },
  ];

  aplicarPreset(preset: { nombre: string; tema: Omit<TemaSitio, 'logoUrl'> }): void {
    this.temaChange.emit({ ...preset.tema, logoUrl: this.tema().logoUrl });
  }

  patch(cambios: Partial<TemaSitio>): void {
    this.temaChange.emit({ ...this.tema(), ...cambios });
  }
}
