import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { EChartsOption } from 'echarts';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { firstValueFrom } from 'rxjs';

import { FlowDefinition, FunnelDefinition, FunnelStage, StageMetric } from '../../models/asistente-ventas.models';
import { AsistenteVentasApiService } from '../../services/asistente-ventas-api.service';

interface FlowNodeRef {
  id: string;
  label: string;
}

@Component({
  selector: 'app-funnels',
  standalone: true,
  imports: [FormsModule, NgxEchartsDirective, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  providers: [provideEchartsCore({ echarts: () => import('echarts') })],
  templateUrl: './funnels.component.html',
  styleUrl: './funnels.component.scss'
})
export class FunnelsComponent {
  private readonly api = inject(AsistenteVentasApiService);

  protected readonly flows = signal<FlowDefinition[]>([]);
  protected readonly funnels = signal<FunnelDefinition[]>([]);
  protected readonly saving = signal(false);
  protected readonly message = signal<string | null>(null);

  protected flowId = '';
  protected funnelName = '';
  private funnelId: string | null = null;
  protected readonly stages = signal<FunnelStage[]>([]);
  protected readonly flowNodes = signal<FlowNodeRef[]>([]);
  protected readonly metrics = signal<StageMetric[]>([]);

  protected readonly chartOptions = computed<EChartsOption>(() => {
    const data = this.metrics().map((s) => ({ name: s.name, value: s.reached }));
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      series: [
        {
          type: 'funnel',
          left: '5%',
          right: '5%',
          top: 10,
          bottom: 10,
          minSize: '18%',
          sort: 'descending',
          gap: 3,
          label: { show: true, position: 'inside', formatter: '{b}\n{c}' },
          data: data.length ? data : [{ name: 'Sin datos', value: 1 }]
        }
      ]
    };
  });

  constructor() {
    void this.load();
  }

  protected onFlowChange(): void {
    const flow = this.flows().find((f) => f.id === this.flowId);
    this.flowNodes.set(this.parseNodes(flow?.graphJson));
    const funnel = this.funnels().find((f) => f.flowId === this.flowId);
    if (funnel) {
      this.funnelId = funnel.id;
      this.funnelName = funnel.name;
      this.stages.set(this.parseStages(funnel.stagesJson));
    } else {
      this.funnelId = null;
      this.funnelName = flow ? `Embudo · ${flow.name}` : '';
      this.stages.set([]);
    }
    void this.loadMetrics();
  }

  protected addStage(): void {
    this.stages.update((s) => [...s, { id: `stage-${Date.now()}`, name: `Etapa ${s.length + 1}`, nodeIds: [] }]);
  }

  protected removeStage(index: number): void {
    this.stages.update((s) => s.filter((_, i) => i !== index));
  }

  protected async saveFunnel(): Promise<void> {
    if (!this.flowId) {
      this.message.set('Selecciona un flujo.');
      return;
    }
    this.saving.set(true);
    this.message.set(null);
    try {
      const saved = await firstValueFrom(
        this.api.saveFunnel({
          id: this.funnelId ?? undefined,
          flowId: this.flowId,
          name: this.funnelName,
          stagesJson: JSON.stringify(this.stages())
        })
      );
      this.funnelId = saved.id;
      this.funnels.set((await firstValueFrom(this.api.listFunnels())) ?? []);
      this.message.set('Embudo guardado.');
    } catch (error) {
      console.error(error);
      this.message.set('No se pudo guardar el embudo.');
    } finally {
      this.saving.set(false);
    }
  }

  private async loadMetrics(): Promise<void> {
    if (!this.flowId) {
      this.metrics.set([]);
      return;
    }
    try {
      const result = await firstValueFrom(this.api.getFunnelMetrics(this.flowId));
      this.metrics.set(result?.stages ?? []);
    } catch {
      this.metrics.set([]);
    }
  }

  private async load(): Promise<void> {
    const [flows, funnels] = await Promise.all([
      firstValueFrom(this.api.listFlows()),
      firstValueFrom(this.api.listFunnels())
    ]);
    this.flows.set(flows ?? []);
    this.funnels.set(funnels ?? []);
    if (this.flows().length) {
      this.flowId = this.flows()[0].id;
      this.onFlowChange();
    }
  }

  private parseNodes(graphJson?: string): FlowNodeRef[] {
    try {
      const graph = JSON.parse(graphJson || '{"nodes":[]}');
      return (graph.nodes ?? []).map((n: { id: string; label?: string; type: string }) => ({ id: n.id, label: n.label || n.type }));
    } catch {
      return [];
    }
  }

  private parseStages(stagesJson?: string): FunnelStage[] {
    try {
      return JSON.parse(stagesJson || '[]') as FunnelStage[];
    } catch {
      return [];
    }
  }
}
