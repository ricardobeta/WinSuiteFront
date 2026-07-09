import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { TemplateButton, WhatsAppInstance, WhatsAppTemplate } from '../../models/asistente-ventas.models';
import { AsistenteVentasApiService } from '../../services/asistente-ventas-api.service';

interface TemplateDraft {
  id?: string;
  instanceId: string;
  name: string;
  category: string;
  language: string;
  headerType: 'NONE' | 'TEXT' | 'IMAGE';
  headerText: string;
  body: string;
  footerText: string;
  buttons: TemplateButton[];
  examples: string[];
  status?: string;
}

@Component({
  selector: 'app-plantillas',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTooltipModule],
  templateUrl: './plantillas.component.html',
  styleUrl: './plantillas.component.scss'
})
export class PlantillasComponent {
  private readonly api = inject(AsistenteVentasApiService);

  protected readonly templates = signal<WhatsAppTemplate[]>([]);
  protected readonly instances = signal<WhatsAppInstance[]>([]);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly connectedInstances = computed(() => this.instances().filter((i) => i.status === 'CONNECTED'));

  protected draft = signal<TemplateDraft>(this.emptyDraft());

  /** Número de variables {{n}} detectadas en el cuerpo. */
  protected readonly variableCount = computed(() => {
    const matches = this.draft().body.match(/\{\{\s*(\d+)\s*\}\}/g) ?? [];
    const numbers = matches.map((m) => parseInt(m.replace(/[^\d]/g, ''), 10));
    return numbers.length ? Math.max(...numbers) : 0;
  });

  /** Vista previa del cuerpo con los ejemplos sustituidos. */
  protected readonly previewBody = computed(() => {
    let text = this.draft().body;
    this.draft().examples.forEach((example, index) => {
      text = text.replace(new RegExp(`\\{\\{\\s*${index + 1}\\s*\\}\\}`, 'g'), example || `{{${index + 1}}}`);
    });
    return text;
  });

  // envío como mensaje
  protected readonly sendOpen = signal(false);
  protected sendPhone = '';
  protected sendVariables: string[] = [];

  constructor() {
    void this.load();
  }

  private emptyDraft(): TemplateDraft {
    return {
      instanceId: '',
      name: '',
      category: 'MARKETING',
      language: 'es',
      headerType: 'NONE',
      headerText: '',
      body: 'Hola {{1}}, gracias por tu interés. ¿Deseas más información?',
      footerText: '',
      buttons: [],
      examples: ['Juan']
    };
  }

  protected newTemplate(): void {
    const draft = this.emptyDraft();
    draft.instanceId = this.connectedInstances()[0]?.id ?? '';
    this.draft.set(draft);
    this.clearMessages();
  }

  protected edit(template: WhatsAppTemplate): void {
    let buttons: TemplateButton[] = [];
    try {
      buttons = template.buttonsJson ? (JSON.parse(template.buttonsJson) as TemplateButton[]) : [];
    } catch {
      buttons = [];
    }
    this.draft.set({
      id: template.id,
      instanceId: template.instanceId,
      name: template.name,
      category: template.category || 'MARKETING',
      language: template.language || 'es',
      headerType: (template.headerType as TemplateDraft['headerType']) || 'NONE',
      headerText: template.headerText || '',
      body: template.body || '',
      footerText: template.footerText || '',
      buttons,
      examples: (template.example || '').split('|').filter((_, i, arr) => arr.length > 0),
      status: template.status
    });
    this.clearMessages();
  }

  protected syncExamples(): void {
    const count = this.variableCount();
    const examples = [...this.draft().examples];
    while (examples.length < count) examples.push('');
    examples.length = count;
    this.draft.update((d) => ({ ...d, examples }));
  }

  protected addButton(): void {
    this.draft.update((d) => ({ ...d, buttons: [...d.buttons, { type: 'QUICK_REPLY', text: 'Ver más' }] }));
  }

  protected removeButton(index: number): void {
    this.draft.update((d) => ({ ...d, buttons: d.buttons.filter((_, i) => i !== index) }));
  }

  protected normalizeName(value: string): void {
    this.draft.update((d) => ({ ...d, name: value.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 60) }));
  }

  protected async save(): Promise<TemplateDraft | null> {
    const d = this.draft();
    if (!d.instanceId) {
      this.errorMessage.set('Selecciona una instancia conectada.');
      return null;
    }
    if (!d.name.trim() || !d.body.trim()) {
      this.errorMessage.set('El nombre y el cuerpo son obligatorios.');
      return null;
    }
    this.saving.set(true);
    this.clearMessages();
    try {
      const saved = await firstValueFrom(
        this.api.saveTemplate({
          id: d.id,
          instanceId: d.instanceId,
          name: d.name,
          category: d.category,
          language: d.language,
          body: d.body,
          headerType: d.headerType,
          headerText: d.headerText,
          footerText: d.footerText,
          buttonsJson: JSON.stringify(d.buttons),
          example: d.examples.join('|')
        })
      );
      this.draft.update((cur) => ({ ...cur, id: saved.id, status: saved.status }));
      await this.reload();
      this.successMessage.set('Plantilla guardada.');
      return this.draft();
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No se pudo guardar la plantilla.');
      return null;
    } finally {
      this.saving.set(false);
    }
  }

  protected async submit(): Promise<void> {
    const saved = this.draft().id ? this.draft() : await this.save();
    if (!saved?.id) return;
    this.saving.set(true);
    this.clearMessages();
    try {
      const result = await firstValueFrom(this.api.submitTemplate(saved.id));
      this.draft.update((d) => ({ ...d, status: result.status }));
      await this.reload();
      this.successMessage.set('Enviada a Meta para aprobación.');
    } catch (error) {
      console.error(error);
      this.errorMessage.set('Meta rechazó la plantilla. Revisa el formato.');
    } finally {
      this.saving.set(false);
    }
  }

  protected openSend(): void {
    this.sendPhone = '';
    this.sendVariables = new Array(this.variableCount()).fill('');
    this.sendOpen.set(true);
  }

  protected async sendAsMessage(): Promise<void> {
    const d = this.draft();
    if (!this.sendPhone.trim() || !d.id) return;
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.api.sendMessage({
          instanceId: d.instanceId,
          conversationId: `${d.instanceId}_${this.sendPhone.trim()}`,
          toPhone: this.sendPhone.trim(),
          type: 'TEMPLATE',
          body: JSON.stringify({ name: d.name, language: d.language, variables: this.sendVariables })
        })
      );
      this.sendOpen.set(false);
      this.successMessage.set('Plantilla enviada.');
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No se pudo enviar la plantilla (¿está aprobada?).');
    } finally {
      this.saving.set(false);
    }
  }

  protected statusClass(status?: string): string {
    if (status === 'APPROVED') return 'ok';
    if (status === 'REJECTED') return 'err';
    if (status === 'PENDING_META_APPROVAL' || status === 'SUBMITTED') return 'pending';
    return 'draft';
  }

  private async load(): Promise<void> {
    const [templates, instances] = await Promise.all([
      firstValueFrom(this.api.listTemplates()),
      firstValueFrom(this.api.listInstances())
    ]);
    this.templates.set(templates ?? []);
    this.instances.set(instances ?? []);
    const draft = this.emptyDraft();
    draft.instanceId = this.connectedInstances()[0]?.id ?? '';
    this.draft.set(draft);
  }

  private async reload(): Promise<void> {
    this.templates.set((await firstValueFrom(this.api.listTemplates())) ?? []);
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }
}
