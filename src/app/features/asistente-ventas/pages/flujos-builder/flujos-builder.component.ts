import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ClassicPreset, GetSchemes, NodeEditor } from 'rete';
import { firstValueFrom } from 'rxjs';

import { FlowDefinition, FlowGraph, FlowNode, FlowNodeType, WhatsAppInstance } from '../../models/asistente-ventas.models';
import { AsistenteVentasApiService } from '../../services/asistente-ventas-api.service';

const NODE_LABELS: Record<FlowNodeType, string> = {
  trigger: 'Inicio',
  text: 'Mensaje',
  buttons: 'Botones',
  list: 'Lista',
  question: 'Pregunta',
  end: 'Fin'
};

type ReteNode = ClassicPreset.Node;
type ReteConnection = ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node>;
type ReteSchemes = GetSchemes<ReteNode, ReteConnection>;

@Component({
  selector: 'app-flujos-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <section class="builder">
      <aside class="panel surface-card sidebar">
        <div>
          <p class="eyebrow">Flujo</p>
          <mat-form-field appearance="outline">
            <mat-label>Nombre del flujo</mat-label>
            <input matInput class="title-input" [(ngModel)]="flowName" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Numero WhatsApp</mat-label>
          <mat-select [(ngModel)]="instanceId">
            <mat-option value="">Selecciona una instancia</mat-option>
            <mat-option *ngFor="let instance of connectedInstances()" [value]="instance.id">
              {{ instance.displayName }} - {{ instance.displayPhoneNumber || instance.status }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <div class="palette">
          <button mat-stroked-button type="button" *ngFor="let type of nodeTypes" (click)="addNode(type)">
            <mat-icon>{{ nodeIcon(type) }}</mat-icon>
            {{ NODE_LABELS[type] }}
          </button>
        </div>

        <div class="actions">
          <button mat-stroked-button type="button" (click)="newFlow()">
            <mat-icon>note_add</mat-icon>
            Nuevo
          </button>
          <button mat-stroked-button type="button" (click)="saveDraft()" [disabled]="saving()">
            <mat-icon>save</mat-icon>
            Guardar
          </button>
          <button mat-raised-button color="primary" type="button" (click)="publish()" [disabled]="saving() || !selectedFlowId()">
            <mat-icon>publish</mat-icon>
            Publicar
          </button>
        </div>

        <p class="message error" *ngIf="errorMessage()">{{ errorMessage() }}</p>
        <p class="message success" *ngIf="successMessage()">{{ successMessage() }}</p>

        <div class="flows-list">
          <button mat-button type="button" class="flow-row" *ngFor="let flow of flows()" (click)="loadFlow(flow)">
            <strong>{{ flow.name }}</strong>
            <span>{{ flow.status }} - {{ flow.version }}</span>
          </button>
        </div>
      </aside>

      <main class="canvas surface-card" (pointerdown)="startCanvasPan($event)">
        <div class="canvas-toolbar">
          <button mat-stroked-button type="button" (click)="resetView($event)">
            <mat-icon>center_focus_strong</mat-icon>
            Centrar
          </button>
        </div>

        <div class="canvas-content" [style.transform]="canvasTransform()">
          <svg class="edges" viewBox="0 0 1200 820" preserveAspectRatio="xMinYMin meet" aria-hidden="true">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                <path d="M 0 0 L 10 4 L 0 8 z"></path>
              </marker>
            </defs>
            <line
              *ngFor="let edge of graph().edges"
              [attr.x1]="nodeCenter(edge.source).x"
              [attr.y1]="nodeCenter(edge.source).y"
              [attr.x2]="nodeCenter(edge.target).x"
              [attr.y2]="nodeCenter(edge.target).y"
            />
          </svg>

          <button
            type="button"
          class="node"
          *ngFor="let node of graph().nodes"
          [class.selected]="selectedNodeId() === node.id"
          [class.dragging]="isDraggingNode(node.id)"
            [style.left.px]="node.x"
            [style.top.px]="node.y"
            (click)="selectNode(node.id)"
            (pointerdown)="startNodeDrag($event, node)"
          >
            <mat-icon>{{ nodeIcon(node.type) }}</mat-icon>
            <span>{{ NODE_LABELS[node.type] }}</span>
            <strong>{{ node.label }}</strong>
          </button>
        </div>
      </main>

      <aside class="panel surface-card inspector" *ngIf="selectedNode() as node">
        <div class="header-row">
          <div>
            <p class="eyebrow">Configurar nodo</p>
            <h2>{{ NODE_LABELS[node.type] }}</h2>
          </div>
          <button mat-stroked-button color="warn" type="button" (click)="removeNode(node.id)" [disabled]="node.type === 'trigger'">
            <mat-icon>delete</mat-icon>
            Eliminar
          </button>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Etiqueta</mat-label>
          <input matInput [(ngModel)]="node.label" (ngModelChange)="touchGraph()" />
        </mat-form-field>

        <mat-form-field appearance="outline" *ngIf="node.type === 'trigger'">
          <mat-label>Palabras de inicio</mat-label>
          <input matInput [ngModel]="keywordsText(node)" (ngModelChange)="setKeywords(node, $event)" placeholder="hola, inicio, comprar" />
        </mat-form-field>

        <mat-form-field appearance="outline" *ngIf="node.type !== 'trigger' && node.type !== 'end'">
          <mat-label>Mensaje</mat-label>
          <textarea matInput [(ngModel)]="node.data.text" (ngModelChange)="touchGraph()" rows="4"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" *ngIf="node.type === 'list'">
          <mat-label>Texto del boton</mat-label>
          <input matInput [(ngModel)]="node.data.buttonText" (ngModelChange)="touchGraph()" />
        </mat-form-field>

        <div class="options" *ngIf="node.type === 'buttons' || node.type === 'list'">
          <div class="option-row" *ngFor="let option of node.data.options ?? []; let index = index">
            <mat-form-field appearance="outline">
              <mat-label>Opcion</mat-label>
              <input matInput [(ngModel)]="option.label" (ngModelChange)="touchGraph()" />
            </mat-form-field>
            <button mat-icon-button type="button" (click)="removeOption(node, index)" aria-label="Eliminar opcion">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <button mat-stroked-button type="button" (click)="addOption(node)">
            <mat-icon>add</mat-icon>
            Agregar opcion
          </button>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Siguiente nodo</mat-label>
          <mat-select [ngModel]="firstTarget(node.id)" (ngModelChange)="connect(node.id, $event)">
            <mat-option value="">Sin conexion</mat-option>
            <mat-option *ngFor="let target of graph().nodes" [value]="target.id" [disabled]="target.id === node.id">{{ target.label }}</mat-option>
          </mat-select>
        </mat-form-field>

        <div class="option-links" *ngIf="node.type === 'buttons' || node.type === 'list'">
          <mat-form-field appearance="outline" *ngFor="let option of node.data.options ?? []">
            <mat-label>Siguiente para {{ option.label }}</mat-label>
            <mat-select [ngModel]="targetForHandle(node.id, option.id)" (ngModelChange)="connect(node.id, $event, option.id)">
              <mat-option value="">Usar conexion general</mat-option>
              <mat-option *ngFor="let target of graph().nodes" [value]="target.id" [disabled]="target.id === node.id">{{ target.label }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </aside>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .builder { min-height: 680px; display: grid; grid-template-columns: 300px minmax(420px, 1fr) 340px; gap: var(--space-4); }
    .panel { padding: var(--space-4); display: grid; gap: var(--space-3); align-content: start; border-radius: var(--radius-md); }
    .canvas { position: relative; overflow: hidden; min-height: 680px; border-radius: var(--radius-md); background-color: var(--card); background-image: radial-gradient(color-mix(in srgb, var(--border) 75%, transparent) 1px, transparent 1px); background-size: 24px 24px; cursor: grab; }
    .canvas:active { cursor: grabbing; }
    .canvas-toolbar { position: absolute; top: var(--space-3); right: var(--space-3); z-index: 5; display: flex; gap: var(--space-2); }
    .canvas-content { position: absolute; inset: 0; width: 1200px; height: 820px; transform-origin: 0 0; }
    .edges { position: absolute; inset: 0; width: 1200px; height: 820px; pointer-events: none; z-index: 1; overflow: visible; }
    .edges line { stroke: var(--primary); stroke-width: 3; stroke-linecap: round; marker-end: url(#arrowhead); opacity: .82; }
    .edges marker path { fill: var(--primary); }
    .node { position: absolute; z-index: 2; width: 180px; min-height: 82px; display: grid; grid-template-columns: auto 1fr; gap: .25rem .55rem; text-align: left; border: 1px solid var(--border); border-radius: var(--radius-md); padding: .75rem; background: var(--mat-sys-surface-container-lowest); color: inherit; box-shadow: var(--tc-elevation-1); cursor: move; touch-action: none; user-select: none; }
    .node.dragging { box-shadow: var(--tc-elevation-2); opacity: .96; }
    .node.selected { outline: 3px solid color-mix(in srgb, var(--primary) 28%, transparent); border-color: var(--primary); }
    .node mat-icon { grid-row: span 2; color: var(--primary); align-self: center; }
    .node span, .eyebrow { text-transform: uppercase; letter-spacing: .08em; color: var(--primary); font-size: .72rem; }
    .node strong { overflow-wrap: anywhere; grid-column: 2; }
    h2, p { margin: 0; }
    mat-form-field { width: 100%; }
    button mat-icon { margin-right: var(--space-2); }
    .title-input { font-size: 1.15rem; font-weight: 700; }
    .palette, .actions, .flows-list, .options, .option-links { display: grid; gap: .55rem; }
    .flow-row { height: auto; min-height: 56px; text-align: left; display: grid; justify-items: start; gap: .25rem; border: 1px solid var(--border); border-radius: var(--radius-md); padding: .65rem; }
    .flow-row span, .message { color: var(--muted-foreground); }
    .option-row { display: grid; grid-template-columns: 1fr 42px; gap: .45rem; align-items: start; }
    .header-row { display: flex; justify-content: space-between; gap: .8rem; align-items: start; }
    .error { color: var(--destructive); }
    .success { color: var(--success); }
    @media (max-width: 1180px) { .builder { grid-template-columns: 1fr; } .canvas { min-height: 560px; } }
  `]
})
export class FlujosBuilderComponent {
  protected readonly NODE_LABELS = NODE_LABELS;
  protected readonly nodeTypes: FlowNodeType[] = ['trigger', 'text', 'buttons', 'list', 'question', 'end'];
  private readonly api = inject(AsistenteVentasApiService);
  private readonly socket = new ClassicPreset.Socket('flow');
  private reteEditor = new NodeEditor<ReteSchemes>();

  protected readonly saving = signal(false);
  protected readonly flows = signal<FlowDefinition[]>([]);
  protected readonly instances = signal<WhatsAppInstance[]>([]);
  protected readonly selectedFlowId = signal<string | null>(null);
  protected readonly selectedNodeId = signal<string>('trigger-1');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly graph = signal<FlowGraph>(this.initialGraph());
  protected readonly panX = signal(0);
  protected readonly panY = signal(0);
  protected readonly dragState = signal<DragState | null>(null);
  protected flowName = 'Flujo de bienvenida';
  protected instanceId = '';

  protected readonly connectedInstances = computed(() => this.instances().filter((instance) => instance.status === 'CONNECTED'));
  protected readonly selectedNode = computed(() => this.graph().nodes.find((node) => node.id === this.selectedNodeId()) ?? null);

  constructor() {
    void this.loadInitialData();
  }

  protected nodeIcon(type: FlowNodeType): string {
    return {
      trigger: 'bolt',
      text: 'chat',
      buttons: 'smart_button',
      list: 'format_list_bulleted',
      question: 'help',
      end: 'flag'
    }[type];
  }

  protected canvasTransform(): string {
    return `translate(${this.panX()}px, ${this.panY()}px)`;
  }

  protected startCanvasPan(event: PointerEvent): void {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.node, .canvas-toolbar')) return;
    event.preventDefault();
    this.dragState.set({
      type: 'canvas',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: this.panX(),
      startPanY: this.panY()
    });
  }

  protected startNodeDrag(event: PointerEvent, node: FlowNode): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    this.selectedNodeId.set(node.id);
    this.dragState.set({
      type: 'node',
      nodeId: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startNodeX: node.x,
      startNodeY: node.y
    });
  }

  protected resetView(event?: Event): void {
    event?.stopPropagation();
    this.panX.set(0);
    this.panY.set(0);
  }

  protected isDraggingNode(nodeId: string): boolean {
    const drag = this.dragState();
    return drag?.type === 'node' && drag.nodeId === nodeId;
  }

  @HostListener('window:pointermove', ['$event'])
  protected onPointerMove(event: PointerEvent): void {
    const drag = this.dragState();
    if (!drag) return;
    event.preventDefault();
    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;
    if (drag.type === 'canvas') {
      this.panX.set(drag.startPanX + deltaX);
      this.panY.set(drag.startPanY + deltaY);
      return;
    }
    this.moveNode(drag.nodeId, drag.startNodeX + deltaX, drag.startNodeY + deltaY);
  }

  @HostListener('window:pointerup')
  protected onPointerUp(): void {
    this.dragState.set(null);
  }

  protected addNode(type: FlowNodeType): void {
    const nodes = this.graph().nodes;
    const id = `${type}-${Date.now()}`;
    const node: FlowNode = {
      id,
      type,
      label: NODE_LABELS[type],
      x: 280 + (nodes.length % 3) * 220,
      y: 90 + Math.floor(nodes.length / 3) * 150,
      data: type === 'buttons' || type === 'list'
        ? { text: '', buttonText: 'Opciones', options: [{ id: `${id}-op1`, label: 'Opcion 1' }] }
        : { text: '' }
    };
    this.graph.set({ ...this.graph(), nodes: [...nodes, node] });
    this.selectedNodeId.set(id);
  }

  protected removeNode(nodeId: string): void {
    this.graph.set({
      nodes: this.graph().nodes.filter((node) => node.id !== nodeId),
      edges: this.graph().edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    });
    this.selectedNodeId.set('trigger-1');
  }

  protected selectNode(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
  }

  protected connect(source: string, target: string, sourceHandle?: string): void {
    const edges = this.graph().edges.filter((edge) => !(edge.source === source && (edge.sourceHandle ?? '') === (sourceHandle ?? '')));
    if (target) {
      edges.push({ id: `edge-${Date.now()}`, source, target, sourceHandle, order: edges.length });
    }
    this.graph.set({ ...this.graph(), edges });
  }

  protected firstTarget(source: string): string {
    return this.graph().edges.find((edge) => edge.source === source && !edge.sourceHandle)?.target ?? '';
  }

  protected targetForHandle(source: string, handle: string): string {
    return this.graph().edges.find((edge) => edge.source === source && edge.sourceHandle === handle)?.target ?? '';
  }

  protected nodeCenter(nodeId: string): { x: number; y: number } {
    const node = this.graph().nodes.find((item) => item.id === nodeId);
    return node ? { x: node.x + 90, y: node.y + 41 } : { x: 0, y: 0 };
  }

  protected addOption(node: FlowNode): void {
    const index = (node.data.options?.length ?? 0) + 1;
    node.data.options = [...(node.data.options ?? []), { id: `${node.id}-op${index}`, label: `Opcion ${index}` }];
    this.touchGraph();
  }

  protected removeOption(node: FlowNode, index: number): void {
    const option = node.data.options?.[index];
    node.data.options = (node.data.options ?? []).filter((_, itemIndex) => itemIndex !== index);
    this.graph.set({ ...this.graph(), edges: this.graph().edges.filter((edge) => edge.sourceHandle !== option?.id) });
  }

  protected keywordsText(node: FlowNode): string {
    return (node.data.keywords ?? []).join(', ');
  }

  protected setKeywords(node: FlowNode, value: string): void {
    node.data.keywords = value.split(',').map((keyword) => keyword.trim()).filter(Boolean);
    this.touchGraph();
  }

  protected touchGraph(): void {
    this.graph.set({ nodes: [...this.graph().nodes], edges: [...this.graph().edges] });
  }

  private moveNode(nodeId: string, x: number, y: number): void {
    const nodes = this.graph().nodes.map((node) => node.id === nodeId
      ? { ...node, x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) }
      : node
    );
    this.graph.set({ ...this.graph(), nodes });
  }

  protected newFlow(): void {
    this.selectedFlowId.set(null);
    this.flowName = 'Flujo de bienvenida';
    this.graph.set(this.initialGraph());
    this.selectedNodeId.set('trigger-1');
    this.clearMessages();
  }

  protected async saveDraft(): Promise<void> {
    if (!this.instanceId) {
      this.errorMessage.set('Selecciona una instancia conectada.');
      return;
    }
    this.saving.set(true);
    this.clearMessages();
    try {
      await this.syncReteGraph();
      const flow = await firstValueFrom(this.api.saveFlow({
        id: this.selectedFlowId() ?? undefined,
        instanceId: this.instanceId,
        name: this.flowName,
        graphJson: JSON.stringify(this.graph())
      }));
      this.selectedFlowId.set(flow.id);
      await this.reloadFlows();
      this.successMessage.set('Flujo guardado como borrador.');
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No se pudo guardar el flujo.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async publish(): Promise<void> {
    if (!this.selectedFlowId()) return;
    this.saving.set(true);
    this.clearMessages();
    try {
      await firstValueFrom(this.api.publishFlow(this.selectedFlowId()!));
      await this.reloadFlows();
      this.successMessage.set('Flujo publicado.');
    } catch (error) {
      console.error(error);
      this.errorMessage.set('No se pudo publicar. Revisa que exista un nodo de inicio.');
    } finally {
      this.saving.set(false);
    }
  }

  protected loadFlow(flow: FlowDefinition): void {
    this.selectedFlowId.set(flow.id);
    this.flowName = flow.name;
    this.instanceId = flow.instanceId;
    this.graph.set(JSON.parse(flow.graphJson || '{}') as FlowGraph);
    this.selectedNodeId.set(this.graph().nodes[0]?.id ?? 'trigger-1');
    this.clearMessages();
  }

  private async loadInitialData(): Promise<void> {
    const [instances, flows] = await Promise.all([
      firstValueFrom(this.api.listInstances()),
      firstValueFrom(this.api.listFlows())
    ]);
    this.instances.set(instances ?? []);
    this.flows.set(flows ?? []);
    this.instanceId = this.connectedInstances()[0]?.id ?? '';
    await this.syncReteGraph();
  }

  private async syncReteGraph(): Promise<void> {
    const editor = new NodeEditor<ReteSchemes>();
    const nodeMap = new Map<string, ReteNode>();
    for (const flowNode of this.graph().nodes) {
      const node = new ClassicPreset.Node(flowNode.label);
      node.id = flowNode.id;
      if (flowNode.type !== 'trigger') {
        node.addInput('in', new ClassicPreset.Input(this.socket, 'Entrada'));
      }
      if (flowNode.type !== 'end') {
        node.addOutput('out', new ClassicPreset.Output(this.socket, 'Salida'));
      }
      nodeMap.set(flowNode.id, node);
      await editor.addNode(node);
    }
    for (const edge of this.graph().edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (source && target && source.hasOutput('out') && target.hasInput('in')) {
        const connection = new ClassicPreset.Connection(source, 'out', target, 'in');
        connection.id = edge.id;
        await editor.addConnection(connection);
      }
    }
    this.reteEditor = editor;
  }

  private async reloadFlows(): Promise<void> {
    this.flows.set((await firstValueFrom(this.api.listFlows())) ?? []);
  }

  private initialGraph(): FlowGraph {
    return {
      nodes: [
        { id: 'trigger-1', type: 'trigger', label: 'Mensaje esperado', x: 80, y: 80, data: { keywords: ['hola', 'inicio'] } },
        { id: 'text-1', type: 'text', label: 'Bienvenida', x: 330, y: 80, data: { text: 'Hola, gracias por escribirnos. ¿En que podemos ayudarte?' } },
        { id: 'buttons-1', type: 'buttons', label: 'Opciones', x: 580, y: 80, data: { text: 'Elige una opcion', options: [{ id: 'ventas', label: 'Ventas' }, { id: 'soporte', label: 'Soporte' }] } }
      ],
      edges: [
        { id: 'edge-1', source: 'trigger-1', target: 'text-1', order: 0 },
        { id: 'edge-2', source: 'text-1', target: 'buttons-1', order: 1 }
      ]
    };
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }
}

type DragState = {
  type: 'canvas';
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
} | {
  type: 'node';
  nodeId: string;
  startClientX: number;
  startClientY: number;
  startNodeX: number;
  startNodeY: number;
};
