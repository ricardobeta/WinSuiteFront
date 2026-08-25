import { A11yModule } from '@angular/cdk/a11y';
import { Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import {
  EFConnectableSide,
  EFConnectionType,
  FCanvasComponent,
  FCreateConnectionEvent,
  FCreateNodeEvent,
  FFlowModule,
  FReassignConnectionEvent,
  FZoomDirective
} from '@foblex/flow';
import { firstValueFrom } from 'rxjs';

import { FlowDefinition, FlowGraph, FlowIssue, FlowNode, FlowNodeType, FlowOption, WhatsAppInstance } from '../../models/asistente-ventas.models';
import { AsistenteVentasApiService } from '../../services/asistente-ventas-api.service';
import { defaultNodeData, FLOW_NODE_CATALOG, FlowNodeMeta, PALETTE_NODE_TYPES } from './flow-node-catalog';
import { inputConnectorId, outputConnectorId, outputHandles, parseConnectorId, validateGraph } from './flow-graph.util';
import { FLOW_TEMPLATES, FlowTemplate } from './flow-templates';
import { FlowSimulator, SimMessage } from './flow-simulator';

@Component({
  selector: 'app-flujos-builder',
  standalone: true,
  imports: [
    FormsModule,
    A11yModule,
    FFlowModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatTooltipModule,
    RouterLink
  ],
  templateUrl: './flujos-builder.component.html'
})
export class FlujosBuilderComponent {
  private readonly api = inject(AsistenteVentasApiService);

  protected readonly catalog = FLOW_NODE_CATALOG;
  protected readonly paletteTypes = PALETTE_NODE_TYPES;
  protected readonly templates = FLOW_TEMPLATES;
  protected readonly connectorSide = EFConnectableSide;
  protected readonly connectionType = EFConnectionType.SEGMENT;

  private readonly canvas = viewChild(FCanvasComponent);
  private readonly zoom = viewChild(FZoomDirective);
  private readonly builderRoot = viewChild<ElementRef<HTMLElement>>('builderRoot');

  // ---- estado principal ----
  protected readonly graph = signal<FlowGraph>({ nodes: [], edges: [] });
  protected readonly selectedNodeId = signal<string | null>(null);
  protected readonly flows = signal<FlowDefinition[]>([]);
  protected readonly instances = signal<WhatsAppInstance[]>([]);
  protected readonly selectedFlowId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveStatus = signal<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected flowName = 'Flujo de bienvenida';
  protected instanceId = '';
  protected readonly paletteOpen = signal(false);
  protected readonly flowMenuOpen = signal(false);
  protected readonly showArchived = signal(false);
  protected readonly fullscreen = signal(false);
  protected readonly newFlowOpen = signal(false);
  protected paletteSearch = '';
  protected flowSearch = '';
  protected newFlowName = 'Nuevo flujo';
  protected newFlowInstanceId = '';
  protected newFlowTemplateId = 'blank';
  private autosaveTimer?: ReturnType<typeof setTimeout>;
  private saveChain: Promise<void> = Promise.resolve();
  private dirtyRevision = 0;
  private savedRevision = 0;
  private newFlowReturnFocus: HTMLElement | null = null;

  // ---- historial (undo/redo) ----
  private readonly past = signal<string[]>([]);
  private readonly future = signal<string[]>([]);
  protected readonly canUndo = computed(() => this.past().length > 0);
  protected readonly canRedo = computed(() => this.future().length > 0);

  // ---- posiciones estables para Foblex ----
  private readonly positions = new Map<string, { x: number; y: number }>();

  // ---- derivados ----
  protected readonly connectedInstances = computed(() => this.instances().filter((i) => i.status === 'CONNECTED'));
  protected readonly selectedNode = computed(() => this.graph().nodes.find((n) => n.id === this.selectedNodeId()) ?? null);
  protected readonly selectedFlow = computed(() => this.flows().find((flow) => flow.id === this.selectedFlowId()) ?? null);
  protected visibleFlows(): FlowDefinition[] {
    const query = this.flowSearch.trim().toLowerCase();
    return this.flows().filter((flow) => {
      const archived = flow.archivedAt != null;
      return archived === this.showArchived()
        && (!query || `${flow.name} ${flow.status}`.toLowerCase().includes(query));
    });
  }
  protected filteredPaletteTypes(): FlowNodeType[] {
    const query = this.paletteSearch.trim().toLowerCase();
    return this.paletteTypes.filter((type) => {
      const item = this.catalog[type];
      return !query || `${item.label} ${item.description}`.toLowerCase().includes(query);
    });
  }
  protected readonly issues = computed(() => validateGraph(this.graph()));
  protected readonly errorCount = computed(() => this.issues().filter((i) => i.severity === 'error').length);
  protected readonly warningCount = computed(() => this.issues().filter((i) => i.severity === 'warning').length);
  protected readonly showProblems = signal(false);

  // ---- simulador ----
  protected readonly simOpen = signal(false);
  protected readonly simMessages = signal<SimMessage[]>([]);
  protected simInput = '';
  private simulator: FlowSimulator | null = null;

  constructor() {
    void this.loadInitialData();
  }

  // =========================================================================
  // Metadata / helpers de plantilla
  // =========================================================================
  protected meta(node: FlowNode): FlowNodeMeta {
    return this.catalog[node.type];
  }

  protected nodePos(node: FlowNode): { x: number; y: number } {
    let pos = this.positions.get(node.id);
    if (!pos) {
      pos = { x: node.x, y: node.y };
      this.positions.set(node.id, pos);
    }
    return pos;
  }

  protected outputHandlesOf(node: FlowNode) {
    return outputHandles(node);
  }

  protected outConnId(nodeId: string, handle?: string) {
    return outputConnectorId(nodeId, handle);
  }

  protected inConnId(nodeId: string) {
    return inputConnectorId(nodeId);
  }

  protected nodeIssues(nodeId: string): FlowIssue[] {
    return this.issues().filter((i) => i.nodeId === nodeId);
  }

  protected nodeHasError(nodeId: string): boolean {
    return this.nodeIssues(nodeId).some((i) => i.severity === 'error');
  }

  protected nodeHasWarning(nodeId: string): boolean {
    return this.nodeIssues(nodeId).some((i) => i.severity === 'warning');
  }

  // =========================================================================
  // Mutaciones de grafo (con historial)
  // =========================================================================
  private snapshot(): string {
    return JSON.stringify(this.graph());
  }

  private pushHistory(): void {
    this.past.update((h) => [...h.slice(-49), this.snapshot()]);
    this.future.set([]);
  }

  private setGraph(graph: FlowGraph): void {
    this.graph.set(graph);
  }

  protected undo(): void {
    const past = this.past();
    if (!past.length) return;
    const previous = past[past.length - 1];
    this.future.update((f) => [this.snapshot(), ...f]);
    this.past.set(past.slice(0, -1));
    this.applyGraph(JSON.parse(previous));
    this.markDirty();
  }

  protected redo(): void {
    const future = this.future();
    if (!future.length) return;
    this.past.update((p) => [...p, this.snapshot()]);
    this.future.set(future.slice(1));
    this.applyGraph(JSON.parse(future[0]));
    this.markDirty();
  }

  private applyGraph(graph: FlowGraph): void {
    this.positions.clear();
    this.graph.set(graph);
  }

  private clearCanvas(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.selectedFlowId.set(null);
    this.applyGraph({ nodes: [], edges: [] });
    this.selectedNodeId.set(null);
    this.paletteOpen.set(false);
    this.showProblems.set(false);
    this.past.set([]);
    this.future.set([]);
    this.dirtyRevision = 0;
    this.savedRevision = 0;
    this.saveStatus.set('idle');
  }

  protected touchGraph(): void {
    this.graph.set({ nodes: [...this.graph().nodes], edges: [...this.graph().edges] });
    this.markDirty();
  }

  protected select(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
  }

  protected onNodeKeydown(event: KeyboardEvent, nodeId: string): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.select(nodeId);
  }

  protected connectedTarget(sourceId: string, sourceHandle?: string): string {
    return this.graph().edges.find((edge) => edge.source === sourceId
      && (edge.sourceHandle ?? '') === (sourceHandle ?? ''))?.target ?? '';
  }

  protected setConnectionTarget(sourceId: string, sourceHandle: string | undefined, targetId: string): void {
    this.pushHistory();
    const edges = this.graph().edges.filter((edge) => !(edge.source === sourceId
      && (edge.sourceHandle ?? '') === (sourceHandle ?? '')));
    if (targetId) {
      edges.push({
        id: `edge-${sourceId}-${sourceHandle ?? 'default'}-${targetId}-${Date.now()}`,
        source: sourceId,
        target: targetId,
        sourceHandle
      });
    }
    this.setGraph({ ...this.graph(), edges });
    this.markDirty();
  }

  protected onFlowMetaChanged(): void {
    this.markDirty();
  }

  // =========================================================================
  // Nodos
  // =========================================================================
  private addNodeAt(type: FlowNodeType, x: number, y: number): void {
    this.pushHistory();
    const id = `${type}-${Date.now()}`;
    const node: FlowNode = { id, type, label: this.catalog[type].label, x, y, data: defaultNodeData(type, id) };
    this.positions.set(id, { x, y });
    this.setGraph({ ...this.graph(), nodes: [...this.graph().nodes, node] });
    this.selectedNodeId.set(id);
    this.markDirty();
  }

  protected addNode(type: FlowNodeType): void {
    const canvas = this.canvas();
    const host = canvas?.hostElement?.nativeElement as HTMLElement | undefined;
    if (canvas && host) {
      const rect = host.getBoundingClientRect();
      const position = canvas.getPosition();
      const scale = canvas.getScale() || 1;
      this.addNodeAt(type, Math.round((rect.width / 2 - position.x) / scale), Math.round((rect.height / 2 - position.y) / scale));
    } else {
      const count = this.graph().nodes.length;
      this.addNodeAt(type, 320 + (count % 3) * 60, 160 + (count % 5) * 40);
    }
  }

  protected onCreateNode(event: FCreateNodeEvent): void {
    const type = event.data as FlowNodeType;
    const pos = event.dropPosition ?? event.externalItemRect;
    this.addNodeAt(type, Math.round(pos.x), Math.round(pos.y));
  }

  protected duplicateNode(node: FlowNode): void {
    this.pushHistory();
    const id = `${node.type}-${Date.now()}`;
    const clone: FlowNode = { ...structuredClone(node), id, label: `${node.label} (copia)`, x: node.x + 40, y: node.y + 40 };
    this.setGraph({ ...this.graph(), nodes: [...this.graph().nodes, clone] });
    this.selectedNodeId.set(id);
    this.markDirty();
  }

  protected removeNode(nodeId: string): void {
    const node = this.graph().nodes.find((n) => n.id === nodeId);
    if (!node || node.type === 'trigger') return;
    this.pushHistory();
    this.positions.delete(nodeId);
    this.setGraph({
      nodes: this.graph().nodes.filter((n) => n.id !== nodeId),
      edges: this.graph().edges.filter((e) => e.source !== nodeId && e.target !== nodeId)
    });
    this.selectedNodeId.set(null);
    this.markDirty();
  }

  protected onNodeMoved(node: FlowNode, position: { x: number; y: number }): void {
    const pos = this.positions.get(node.id);
    if (pos) {
      pos.x = position.x;
      pos.y = position.y;
    }
    node.x = Math.round(position.x);
    node.y = Math.round(position.y);
    this.markDirty();
  }

  // =========================================================================
  // Conexiones
  // =========================================================================
  protected onCreateConnection(event: FCreateConnectionEvent): void {
    if (!event.targetId) return;
    const source = parseConnectorId(event.sourceId);
    const target = parseConnectorId(event.targetId);
    if (source.nodeId === target.nodeId) return;
    this.pushHistory();
    const edges = this.graph().edges.filter(
      (e) => !(e.source === source.nodeId && (e.sourceHandle ?? '') === (source.handle ?? ''))
    );
    edges.push({
      id: `edge-${Date.now()}`,
      source: source.nodeId,
      target: target.nodeId,
      sourceHandle: source.handle,
      order: edges.length
    });
    this.setGraph({ ...this.graph(), edges });
    this.markDirty();
  }

  protected onReassignConnection(event: FReassignConnectionEvent): void {
    const edges = [...this.graph().edges];
    const edge = edges.find((e) => e.id === event.connectionId);
    if (!edge) return;
    this.pushHistory();
    if (event.endpoint === 'source') {
      if (!event.nextSourceId) {
        this.setGraph({ ...this.graph(), edges: edges.filter((e) => e.id !== edge.id) });
        this.markDirty();
        return;
      }
      const parsed = parseConnectorId(event.nextSourceId);
      edge.source = parsed.nodeId;
      edge.sourceHandle = parsed.handle;
    } else {
      if (!event.nextTargetId) {
        this.setGraph({ ...this.graph(), edges: edges.filter((e) => e.id !== edge.id) });
        this.markDirty();
        return;
      }
      edge.target = parseConnectorId(event.nextTargetId).nodeId;
    }
    this.setGraph({ ...this.graph(), edges: [...edges] });
    this.markDirty();
  }

  // =========================================================================
  // Inspector: opciones, keywords, condiciones
  // =========================================================================
  protected keywordsText(node: FlowNode): string {
    return (node.data.keywords ?? []).join(', ');
  }

  protected setKeywords(node: FlowNode, value: string): void {
    node.data.keywords = value.split(',').map((k) => k.trim()).filter(Boolean);
    this.touchGraph();
  }

  protected addOption(node: FlowNode): void {
    const index = (node.data.options?.length ?? 0) + 1;
    const option: FlowOption = { id: `${node.id}-op${index}-${Date.now()}`, label: `Opción ${index}` };
    node.data.options = [...(node.data.options ?? []), option];
    this.touchGraph();
  }

  protected removeOption(node: FlowNode, index: number): void {
    const option = node.data.options?.[index];
    node.data.options = (node.data.options ?? []).filter((_, i) => i !== index);
    this.setGraph({ ...this.graph(), edges: this.graph().edges.filter((e) => e.sourceHandle !== option?.id) });
    this.markDirty();
  }

  // =========================================================================
  // Toolbar del canvas
  // =========================================================================
  protected zoomIn(): void {
    this.zoom()?.zoomIn();
  }

  protected zoomOut(): void {
    this.zoom()?.zoomOut();
  }

  protected fit(): void {
    this.canvas()?.fitToScreen({ x: 60, y: 60 }, true);
  }

  protected resetView(): void {
    this.canvas()?.resetScaleAndCenter(true);
  }

  /** Auto-organiza los nodos en columnas siguiendo el orden de conexión (BFS desde el trigger). */
  protected autoLayout(): void {
    this.pushHistory();
    const nodes = this.graph().nodes;
    const edges = this.graph().edges;
    const trigger = nodes.find((n) => n.type === 'trigger');
    if (!trigger) return;

    const level = new Map<string, number>();
    const queue: string[] = [trigger.id];
    level.set(trigger.id, 0);
    while (queue.length) {
      const id = queue.shift()!;
      const depth = level.get(id) ?? 0;
      for (const edge of edges.filter((e) => e.source === id)) {
        if (!level.has(edge.target)) {
          level.set(edge.target, depth + 1);
          queue.push(edge.target);
        }
      }
    }
    let maxLevel = 0;
    level.forEach((v) => (maxLevel = Math.max(maxLevel, v)));
    const perColumn = new Map<number, number>();
    for (const node of nodes) {
      const col = level.get(node.id) ?? maxLevel + 1;
      const row = perColumn.get(col) ?? 0;
      perColumn.set(col, row + 1);
      const x = 80 + col * 300;
      const y = 80 + row * 180;
      node.x = x;
      node.y = y;
      const pos = this.positions.get(node.id);
      if (pos) {
        pos.x = x;
        pos.y = y;
      } else {
        this.positions.set(node.id, { x, y });
      }
    }
    this.touchGraph();
    setTimeout(() => this.fit(), 50);
  }

  // =========================================================================
  // Simulador
  // =========================================================================
  protected openSimulator(): void {
    this.simulator = new FlowSimulator(this.graph());
    this.simMessages.set([]);
    this.simInput = '';
    this.simOpen.set(true);
  }

  protected closeSimulator(): void {
    this.simOpen.set(false);
    this.simulator = null;
  }

  protected restartSimulator(): void {
    this.simulator = new FlowSimulator(this.graph());
    this.simMessages.set([]);
  }

  protected sendSim(): void {
    const text = this.simInput.trim();
    if (!text || !this.simulator) return;
    const outbound: SimMessage[] = [{ from: 'user', text }];
    const started = this.simMessages().length > 0;
    const replies = started ? this.simulator.reply(text) : this.simulator.start(text);
    this.simMessages.update((m) => [...m, ...outbound, ...replies]);
    this.simInput = '';
  }

  protected quickReply(option: string): void {
    this.simInput = option;
    this.sendSim();
  }

  // =========================================================================
  // Persistencia
  // =========================================================================
  protected applyTemplate(template: FlowTemplate): void {
    this.pushHistory();
    if (!this.selectedFlowId()) {
      this.flowName = template.name === 'En blanco' ? 'Nuevo flujo' : `Flujo · ${template.name}`;
    }
    this.applyGraph(template.build());
    this.selectedNodeId.set(null);
    this.clearMessages();
    this.markDirty();
  }

  protected async loadFlow(flow: FlowDefinition, force = false): Promise<void> {
    if (!force && flow.id === this.selectedFlowId()) {
      this.flowMenuOpen.set(false);
      return;
    }
    if (this.selectedFlowId() && this.dirtyRevision > this.savedRevision) {
      await this.flushAutosave(true);
      if (this.saveStatus() === 'error') return;
    } else {
      await this.saveChain.catch(() => undefined);
    }
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.selectedFlowId.set(flow.id);
    this.flowName = flow.name;
    this.instanceId = flow.instanceId;
    try {
      this.applyGraph(JSON.parse(flow.graphJson || '{"nodes":[],"edges":[]}') as FlowGraph);
    } catch {
      this.applyGraph({ nodes: [], edges: [] });
      this.errorMessage.set('El flujo tiene un formato inválido.');
    }
    this.selectedNodeId.set(null);
    this.paletteOpen.set(false);
    this.dirtyRevision = 0;
    this.savedRevision = 0;
    this.saveStatus.set(flow.archivedAt ? 'idle' : 'saved');
    this.clearMessages();
    setTimeout(() => this.fit(), 100);
  }

  protected async openNewFlow(): Promise<void> {
    this.newFlowReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (this.selectedFlowId() && this.dirtyRevision > this.savedRevision) {
      await this.flushAutosave(true);
      if (this.saveStatus() === 'error') return;
    }
    this.newFlowName = 'Nuevo flujo';
    this.newFlowInstanceId = this.connectedInstances()[0]?.id ?? '';
    this.newFlowTemplateId = 'blank';
    this.newFlowOpen.set(true);
  }

  protected closeNewFlow(): void {
    this.newFlowOpen.set(false);
    const returnFocus = this.newFlowReturnFocus;
    this.newFlowReturnFocus = null;
    setTimeout(() => returnFocus?.focus(), 0);
  }

  protected async createFlow(): Promise<void> {
    if (!this.newFlowName.trim() || !this.newFlowInstanceId) return;
    const template = this.templates.find((item) => item.id === this.newFlowTemplateId) ?? this.templates[0];
    this.saving.set(true);
    this.clearMessages();
    try {
      const flow = await firstValueFrom(this.api.saveFlow({
        instanceId: this.newFlowInstanceId,
        name: this.newFlowName.trim(),
        graphJson: JSON.stringify(template.build())
      }));
      await this.reloadFlows();
      await this.loadFlow(flow);
      this.closeNewFlow();
      this.successMessage.set('Flujo creado. Los siguientes cambios se guardarán automáticamente.');
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No se pudo crear el flujo. Revisa la conexión e intenta de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async duplicateCurrentFlow(): Promise<void> {
    const current = this.selectedFlow();
    if (!current) return;
    await this.flushAutosave(true);
    if (this.saveStatus() === 'error') return;
    this.saving.set(true);
    try {
      const copy = await firstValueFrom(this.api.saveFlow({
        instanceId: this.instanceId,
        name: `${this.flowName} copia`,
        graphJson: JSON.stringify(this.graph())
      }));
      await this.reloadFlows();
      await this.loadFlow(copy);
      this.successMessage.set('Copia creada como borrador.');
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No se pudo duplicar el flujo.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async setCurrentFlowArchived(archived: boolean): Promise<void> {
    const current = this.selectedFlow();
    if (!current) return;
    if (archived && !window.confirm(
      current.status === 'PUBLISHED'
        ? 'Archivar este flujo pausará la automatización inmediatamente. ¿Continuar?'
        : '¿Archivar este flujo? Podrás restaurarlo después.'
    )) return;
    if (archived) {
      await this.flushAutosave(true);
      if (this.saveStatus() === 'error') return;
    }
    this.saving.set(true);
    try {
      const updated = await firstValueFrom(this.api.setFlowArchived(current.id, archived));
      await this.reloadFlows();
      if (archived) {
        const next = this.flows().find((flow) => flow.archivedAt == null);
        if (next) await this.loadFlow(next);
        else {
          this.clearCanvas();
        }
      } else {
        await this.loadFlow(updated, true);
      }
      this.successMessage.set(archived ? 'Flujo archivado.' : 'Flujo restaurado.');
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No se pudo cambiar el estado del flujo.');
    } finally {
      this.saving.set(false);
    }
  }

  private markDirty(): void {
    if (this.selectedFlow()?.archivedAt) return;
    this.dirtyRevision += 1;
    this.saveStatus.set('pending');
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    if (this.selectedFlowId()) this.autosaveTimer = setTimeout(() => void this.flushAutosave(), 1200);
  }

  private async flushAutosave(force = false): Promise<void> {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    const flowId = this.selectedFlowId();
    if (!flowId || !this.instanceId || this.selectedFlow()?.archivedAt) return;
    const revision = this.dirtyRevision;
    if (!force && revision <= this.savedRevision) return;
    const payload = {
      id: flowId,
      instanceId: this.instanceId,
      name: this.flowName.trim() || 'Flujo sin nombre',
      graphJson: JSON.stringify(this.graph())
    };
    this.saveChain = this.saveChain.catch(() => undefined).then(async () => {
      const isCurrentFlow = () => this.selectedFlowId() === flowId;
      if (isCurrentFlow()) {
        this.saveStatus.set('saving');
        this.saving.set(true);
      }
      try {
        const saved = await firstValueFrom(this.api.saveFlow(payload));
        this.flows.update((items) => items.map((item) => item.id === saved.id ? saved : item));
        if (isCurrentFlow()) {
          this.savedRevision = Math.max(this.savedRevision, revision);
          this.saveStatus.set(this.dirtyRevision > this.savedRevision ? 'pending' : 'saved');
        }
        if (isCurrentFlow() && this.dirtyRevision > this.savedRevision) {
          this.autosaveTimer = setTimeout(() => void this.flushAutosave(), 250);
        }
      } catch (error) {
        console.error(error);
        if (isCurrentFlow()) {
          this.saveStatus.set('error');
          this.errorMessage.set('No se guardaron los últimos cambios. Usa Reintentar.');
        }
        throw error;
      } finally {
        if (isCurrentFlow()) this.saving.set(false);
      }
    });
    await this.saveChain.catch(() => undefined);
  }

  protected async saveDraft(): Promise<void> {
    if (!this.instanceId) {
      this.errorMessage.set('Selecciona una instancia conectada.');
      return;
    }
    this.clearMessages();
    if (!this.selectedFlowId()) {
      await this.openNewFlow();
      return;
    }
    this.dirtyRevision += 1;
    await this.flushAutosave(true);
    if (this.saveStatus() === 'saved') this.successMessage.set('Borrador actualizado.');
  }

  protected async publish(): Promise<void> {
    if (this.errorCount() > 0) {
      this.showProblems.set(true);
      this.errorMessage.set('Corrige los errores antes de publicar.');
      return;
    }
    if (!this.selectedFlowId()) {
      await this.saveDraft();
    }
    if (!this.selectedFlowId()) return;
    await this.flushAutosave(true);
    if (this.saveStatus() === 'error') return;
    this.saving.set(true);
    this.clearMessages();
    try {
      await firstValueFrom(this.api.publishFlow(this.selectedFlowId()!));
      await this.reloadFlows();
      this.successMessage.set('Flujo publicado. Ya responde en WhatsApp.');
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No se pudo publicar el flujo.');
    } finally {
      this.saving.set(false);
    }
  }

  private async loadInitialData(): Promise<void> {
    const [instances, flows] = await Promise.all([
      firstValueFrom(this.api.listInstances()),
      firstValueFrom(this.api.listFlows(true))
    ]);
    this.instances.set(instances ?? []);
    this.flows.set(flows ?? []);
    this.instanceId = this.connectedInstances()[0]?.id ?? '';
    const firstActive = this.flows().find((flow) => flow.archivedAt == null);
    if (firstActive) await this.loadFlow(firstActive);
    else this.clearCanvas();
  }

  private async reloadFlows(): Promise<void> {
    this.flows.set((await firstValueFrom(this.api.listFlows(true))) ?? []);
  }

  protected async toggleFullscreen(): Promise<void> {
    const root = this.builderRoot()?.nativeElement;
    if (!root) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {
      this.errorMessage.set('El navegador no permitió activar pantalla completa.');
    }
  }

  @HostListener('document:fullscreenchange')
  protected onFullscreenChange(): void {
    this.fullscreen.set(document.fullscreenElement === this.builderRoot()?.nativeElement);
    setTimeout(() => this.fit(), 80);
  }

  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirtyRevision > this.savedRevision) event.preventDefault();
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  // =========================================================================
  // Atajos de teclado
  // =========================================================================
  @HostListener('window:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.newFlowOpen()) this.closeNewFlow();
      else if (this.simOpen()) this.closeSimulator();
      else if (this.paletteOpen()) this.paletteOpen.set(false);
      else if (this.showProblems()) this.showProblems.set(false);
      else this.selectedNodeId.set(null);
      return;
    }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.undo();
    } else if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
      event.preventDefault();
      this.redo();
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedNodeId()) {
      event.preventDefault();
      this.removeNode(this.selectedNodeId()!);
    } else if (event.key.toLowerCase() === 'n') {
      if (!this.selectedFlow() || this.selectedFlow()?.archivedAt) return;
      event.preventDefault();
      this.paletteOpen.set(true);
    }
  }
}
