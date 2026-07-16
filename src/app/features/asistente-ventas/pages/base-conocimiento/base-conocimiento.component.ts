import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { AiAnswer, AiConfigView, KnowledgeItem } from '../../models/asistente-ventas.models';
import { AsistenteVentasApiService } from '../../services/asistente-ventas-api.service';

type NoticeType = 'success' | 'error';
type SourceType = {
  value: string;
  label: string;
  icon: string;
  hint: string;
};

/** Tipos de fuente por defecto: siempre disponibles y no eliminables (los personalizados se guardan por tenant en Firebase). */
const DEFAULT_SOURCE_TYPES: SourceType[] = [
  { value: 'manual', label: 'Manual operativo', icon: 'menu_book', hint: 'Procesos internos para responder mejor.' },
  { value: 'catalogo', label: 'Catalogo', icon: 'inventory_2', hint: 'Productos, servicios, precios y disponibilidad.' },
  { value: 'faq', label: 'Preguntas frecuentes', icon: 'quiz', hint: 'Dudas repetidas de clientes.' }
];

const OTHER_TYPE: SourceType = { value: 'otros', label: 'Otros', icon: 'folder', hint: '' };

@Component({
  selector: 'app-base-conocimiento',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule
  ],
  templateUrl: './base-conocimiento.component.html',
  styleUrl: './base-conocimiento.component.scss'
})
export class BaseConocimientoComponent {
  private readonly api = inject(AsistenteVentasApiService);

  protected readonly config = signal<AiConfigView | null>(null);
  protected readonly knowledge = signal<KnowledgeItem[]>([]);
  protected readonly saving = signal(false);
  protected readonly notice = signal<{ type: NoticeType; text: string } | null>(null);

  /** Tipos personalizados del tenant (persistidos en Firebase); los por defecto son fijos. */
  protected readonly customTypes = signal<SourceType[]>([]);
  /** Todos los tipos disponibles = por defecto (fijos) + personalizados del tenant. */
  protected readonly sourceTypes = computed<SourceType[]>(() => [...DEFAULT_SOURCE_TYPES, ...this.customTypes()]);

  /** Iconos disponibles para nuevos tipos de fuente. */
  protected readonly iconOptions: string[] = [
    'menu_book', 'inventory_2', 'quiz', 'policy', 'sell', 'local_shipping',
    'description', 'support_agent', 'storefront', 'campaign', 'receipt_long', 'fact_check', 'folder'
  ];

  protected readonly sourceGroups = computed(() => {
    const groups = new Map<string, { type: SourceType; sources: Set<string>; items: KnowledgeItem[] }>();

    for (const item of this.knowledge()) {
      const type = this.classifySource(item.source);
      const group = groups.get(type.value) ?? { type, sources: new Set<string>(), items: [] };
      group.sources.add(this.cleanSourceName(item.source));
      group.items.push(item);
      groups.set(type.value, group);
    }

    return Array.from(groups.values()).map((group) => ({
      ...group,
      sourceNames: Array.from(group.sources)
    }));
  });

  // form config
  protected provider = 'gemini';
  protected model = '';
  protected systemPrompt = '';
  protected apiKey = '';
  protected enabled = false;

  /** Modelos seleccionables por integracion (los mas economicos de cada proveedor). */
  protected readonly modelsByProvider: Record<string, { value: string; label: string; hint: string }[]> = {
    anthropic: [
      { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', hint: 'El mas economico - $1 / $5 por 1M tokens' },
      { value: 'claude-sonnet-5', label: 'Claude Sonnet 5', hint: 'Mayor calidad - $3 / $15 por 1M tokens' }
    ],
    gemini: [
      { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', hint: 'Rapido y de bajo coste' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: 'Modelo estable de uso general' },
      { value: 'gemma-4-31b-it', label: 'Gemma 4 31B IT', hint: 'Modelo abierto de Google para la clave propia de la empresa' }
    ]
  };

  protected get availableModels(): { value: string; label: string; hint: string }[] {
    return this.modelsByProvider[this.provider] ?? [];
  }

  protected get selectedModelHint(): string {
    return this.availableModels.find((m) => m.value === this.model)?.hint ?? '';
  }

  /** Al cambiar de proveedor, selecciona por defecto su primer modelo. */
  protected onProviderChange(): void {
    const models = this.availableModels;
    if (!models.some((m) => m.value === this.model)) {
      this.model = models[0]?.value ?? '';
    }
  }

  // form conocimiento
  protected kbSourceType = this.sourceTypes()[0]?.value ?? '';
  protected kbSource = '';
  protected kbContent = '';

  // form nuevo tipo de fuente
  protected newTypeLabel = '';
  protected newTypeIcon = 'folder';
  protected newTypeHint = '';

  // prueba
  protected testQuery = '';
  protected testUseRag = true;
  protected readonly answer = signal<AiAnswer | null>(null);
  protected readonly testing = signal(false);

  protected get selectedTypeHint(): string {
    return this.sourceTypes().find((t) => t.value === this.kbSourceType)?.hint ?? '';
  }

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [config, knowledge, sourceTypes] = await Promise.all([
        firstValueFrom(this.api.getAiConfig()),
        firstValueFrom(this.api.listKnowledge()),
        firstValueFrom(this.api.getSourceTypes())
      ]);
      this.config.set(config);
      this.knowledge.set(knowledge ?? []);
      this.customTypes.set(sourceTypes ?? []);
      this.provider = config.provider || 'gemini';
      this.model = config.model || '';
      this.systemPrompt = config.systemPrompt || '';
      this.enabled = config.enabled;
      // Corrige configuraciones antiguas que ya no aparecen en el catalogo actual.
      if (!this.availableModels.some((candidate) => candidate.value === this.model)) {
        this.onProviderChange();
      }
    } catch (error) {
      console.error(error);
      this.showError('No se pudo cargar la base de conocimiento.');
    }
  }

  // ---------------- Tipos de fuente ----------------

  /** Los tipos por defecto son fijos y no se pueden eliminar. */
  protected isDefault(value: string): boolean {
    return DEFAULT_SOURCE_TYPES.some((t) => t.value === value);
  }

  protected async addSourceType(): Promise<void> {
    const label = this.newTypeLabel.trim();
    if (!label) return;

    if (this.sourceTypes().some((t) => t.label.toLowerCase() === label.toLowerCase())) {
      this.showError('Ya existe un tipo de fuente con ese nombre.');
      return;
    }

    const type: SourceType = {
      value: this.uniqueValue(this.slugify(label), this.sourceTypes()),
      label,
      icon: this.newTypeIcon || 'folder',
      hint: this.newTypeHint.trim()
    };

    const next = [...this.customTypes(), type];
    this.newTypeLabel = '';
    this.newTypeHint = '';
    this.newTypeIcon = 'folder';
    this.kbSourceType = type.value;
    await this.persistCustom(next, `Tipo de fuente "${type.label}" agregado.`);
  }

  protected async removeSourceType(value: string): Promise<void> {
    if (this.isDefault(value)) return; // los por defecto no se eliminan
    const next = this.customTypes().filter((t) => t.value !== value);
    if (this.kbSourceType === value) {
      this.kbSourceType = this.sourceTypes()[0]?.value ?? '';
    }
    await this.persistCustom(next, 'Tipo de fuente eliminado.');
  }

  /** Persiste los tipos personalizados en Firebase (por tenant) y sincroniza la vista. */
  private async persistCustom(next: SourceType[], successText: string): Promise<void> {
    this.customTypes.set(next); // optimista
    try {
      const saved = await firstValueFrom(this.api.saveSourceTypes(next));
      this.customTypes.set(saved ?? next);
      this.showSuccess(successText);
    } catch (error) {
      console.error(error);
      this.showError('No se pudieron guardar los tipos de fuente.');
      try {
        this.customTypes.set((await firstValueFrom(this.api.getSourceTypes())) ?? []);
      } catch {
        // si falla la recarga, dejamos el estado optimista
      }
    }
  }

  private slugify(label: string): string {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'fuente';
  }

  private uniqueValue(base: string, existing: SourceType[]): string {
    let value = base;
    let i = 2;
    while (existing.some((t) => t.value === value)) {
      value = `${base}-${i++}`;
    }
    return value;
  }

  // ---------------- Conocimiento ----------------

  protected async indexKnowledge(): Promise<void> {
    if (!this.kbContent.trim()) return;
    this.saving.set(true);
    this.notice.set(null);
    try {
      const result = await firstValueFrom(this.api.indexKnowledge({ source: this.buildSourceName(), content: this.kbContent }));
      this.showSuccess(`Contenido indexado en ${result.chunks} fragmento(s).`);
      this.kbContent = '';
      this.kbSource = '';
      await this.reloadKnowledge();
    } catch (error) {
      console.error(error);
      this.showError(this.extractError(error, 'No se pudo indexar el contenido.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(item: KnowledgeItem): Promise<void> {
    await firstValueFrom(this.api.deleteKnowledge(item.id));
    await this.reloadKnowledge();
    this.showSuccess('Fragmento eliminado.');
  }

  protected async clearAll(): Promise<void> {
    await firstValueFrom(this.api.clearKnowledge());
    await this.reloadKnowledge();
    this.showSuccess('Base de conocimiento vaciada.');
  }

  // ---------------- Configuracion ----------------

  protected async saveConfig(): Promise<void> {
    this.saving.set(true);
    this.notice.set(null);
    try {
      const saved = await firstValueFrom(
        this.api.saveAiConfig({
          provider: this.provider,
          model: this.model,
          apiKey: this.apiKey || undefined,
          systemPrompt: this.systemPrompt,
          enabled: this.enabled
        })
      );
      this.config.set(saved);
      this.apiKey = '';
      this.showSuccess('Configuracion guardada.');
    } catch (error) {
      console.error(error);
      this.showError(this.extractError(error, 'No se pudo guardar la configuracion.'));
    } finally {
      this.saving.set(false);
    }
  }

  // ---------------- Prueba ----------------

  protected async runTest(): Promise<void> {
    if (!this.testQuery.trim()) return;
    this.testing.set(true);
    this.answer.set(null);
    this.notice.set(null);
    try {
      const result = await firstValueFrom(this.api.aiAnswer({ query: this.testQuery, useRag: this.testUseRag }));
      this.answer.set(result);
    } catch (error) {
      console.error(error);
      this.showError(this.extractError(error, 'Error al consultar la IA. Revisa la API key.'));
    } finally {
      this.testing.set(false);
    }
  }

  // ---------------- Helpers ----------------

  protected classifySource(source: string): SourceType {
    const types = this.sourceTypes();
    if (!types.length) return OTHER_TYPE;

    // buildSourceName guarda "Label: nombre" -> el prefijo identifica el tipo de forma fiable.
    const prefix = (source.split(':')[0] ?? '').trim().toLowerCase();
    const byLabel = types.find((t) => t.label.toLowerCase() === prefix);
    if (byLabel) return byLabel;

    const normalized = source.toLowerCase();
    const byKeyword = types.find((t) => normalized.includes(t.value) || normalized.includes(t.label.toLowerCase()));
    return byKeyword ?? types[0];
  }

  protected cleanSourceName(source: string): string {
    return source.replace(/^[^:]+:\s*/, '').trim() || 'Sin nombre';
  }

  private async reloadKnowledge(): Promise<void> {
    this.knowledge.set((await firstValueFrom(this.api.listKnowledge())) ?? []);
    this.config.update((c) => (c ? { ...c, chunkCount: this.knowledge().length } : c));
  }

  private buildSourceName(): string {
    const type = this.sourceTypes().find((item) => item.value === this.kbSourceType) ?? this.sourceTypes()[0] ?? OTHER_TYPE;
    const name = this.kbSource.trim() || type.label;
    return `${type.label}: ${name}`;
  }

  private showSuccess(text: string): void {
    this.notice.set({ type: 'success', text });
  }

  private showError(text: string): void {
    this.notice.set({ type: 'error', text });
  }

  /** El backend devuelve {"error": "motivo real"} en fallos de IA. */
  private extractError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return fallback;
  }
}
