import { CommonModule } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ExportacionRecienteSri } from '../../models/cumplimiento-sri.models';
import { CumplimientoSriApiService } from '../../services/cumplimiento-sri-api.service';

@Component({
  selector: 'app-cumplimiento-sri-hub',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatSnackBarModule, MatTooltipModule],
  template: `
    <section class="sri-hub">
      <header class="hub-hero">
        <div>
          <p class="eyebrow">Contabilidad · Cumplimiento SRI</p>
          <h2>Obligaciones listas para revisar y presentar</h2>
          <p>Prepara anexos y papeles de trabajo desde la información ya registrada en WinSuite. La presentación en el portal del SRI sigue siendo responsabilidad del contribuyente.</p>
        </div>
        <span class="hero-mark" aria-hidden="true"><mat-icon>verified</mat-icon></span>
      </header>

      <div class="document-grid" aria-label="Documentos disponibles">
        <article class="document-card primary-card">
          <div class="card-icon"><mat-icon>apartment</mat-icon></div>
          <p class="card-kicker">Devolución de IVA</p>
          <h3>Proyectos inmobiliarios</h3>
          <p>Selecciona compras locales del período, revisa las bases por tarifa y descarga el listado oficial en formato Excel.</p>
          <div class="card-meta"><span>4 pasos</span><span>Plantilla SRI · XLS</span></div>
          <a mat-flat-button color="primary" routerLink="/workspace/contabilidad/cumplimiento-sri/devolucion-iva-proyectos-inmobiliarios">
            Preparar listado <mat-icon>arrow_forward</mat-icon>
          </a>
        </article>

        <article class="document-card">
          <div class="card-icon secondary"><mat-icon>data_object</mat-icon></div>
          <p class="card-kicker">Anexo transaccional</p>
          <h3>ATS</h3>
          <p>Genera y valida el anexo mensual de compras, ventas, retenciones y documentos anulados.</p>
          <div class="card-meta"><span>XML</span><span>Validación previa</span></div>
          <a mat-stroked-button color="primary" routerLink="/workspace/contabilidad/cumplimiento-sri/ats">
            Abrir ATS <mat-icon>arrow_forward</mat-icon>
          </a>
        </article>
      </div>

      <section class="history-card">
        <div class="section-heading">
          <div><p class="eyebrow">Trazabilidad</p><h3>Exportaciones recientes</h3></div>
          <span class="status-note"><mat-icon>lock</mat-icon> Versiones inmutables</span>
        </div>
        @if (loading()) {
          <div class="state-row"><mat-spinner diameter="28" /> Cargando historial…</div>
        } @else if (error()) {
          <div class="state-row error"><mat-icon>error_outline</mat-icon> {{ error() }}</div>
        } @else if (!recent().length) {
          <div class="empty-history"><mat-icon>history</mat-icon><div><strong>Aún no hay exportaciones</strong><p>Las versiones generadas aparecerán aquí con su período y total de IVA.</p></div></div>
        } @else {
          <div class="history-list">
            @for (item of recent(); track item.expedienteId + '-' + item.version) {
              <div class="history-row">
                <div class="file-mark"><mat-icon>table_view</mat-icon></div>
                <div class="history-main"><strong>{{ item.proyectoNombre }}</strong><span>{{ item.periodo }} · Versión {{ item.version }}</span></div>
                <div class="history-amount"><strong>{{ item.totalIva | currency:'USD':'symbol-narrow':'1.2-2' }}</strong><span>{{ item.numeroLineas }} líneas</span></div>
                <time>{{ item.generadoEn | date:'dd MMM y, HH:mm' }}</time>
                <span class="file-state" [class.missing]="item.archivo?.estado !== 'DISPONIBLE'">
                  <mat-icon>{{ item.archivo?.estado === 'DISPONIBLE' ? 'cloud_done' : 'history' }}</mat-icon>
                  {{ item.archivo?.estado === 'DISPONIBLE' ? 'Respaldado' : 'Recuperable' }}
                </span>
                <button mat-icon-button type="button" color="primary"
                  [disabled]="processing() === itemKey(item) || (item.archivo?.estado !== 'DISPONIBLE' && !canRestore())"
                  [matTooltip]="item.archivo?.estado === 'DISPONIBLE' ? 'Descargar esta versión' : 'Restaurar y descargar esta versión'"
                  [attr.aria-label]="item.archivo?.estado === 'DISPONIBLE' ? 'Descargar versión ' + item.version : 'Restaurar y descargar versión ' + item.version"
                  (click)="download(item)">
                  @if (processing() === itemKey(item)) { <mat-spinner diameter="20" /> }
                  @else { <mat-icon>{{ item.archivo?.estado === 'DISPONIBLE' ? 'download' : 'restore' }}</mat-icon> }
                </button>
              </div>
            }
          </div>
        }
      </section>
    </section>
  `,
  styles: [`
    .sri-hub { display: grid; gap: 24px; padding-bottom: 32px; }
    .hub-hero { position: relative; overflow: hidden; display: flex; justify-content: space-between; align-items: center; min-height: 190px; padding: 34px 38px; border-radius: 24px; background: linear-gradient(125deg, #102f2a, #174b43); color: #fff; box-shadow: 0 20px 44px rgba(16, 47, 42, .16); }
    .hub-hero::after { content: ''; position: absolute; right: -90px; bottom: -130px; width: 310px; height: 310px; border: 1px solid rgba(255,255,255,.12); border-radius: 50%; }
    .hub-hero h2 { max-width: 720px; margin: 6px 0 10px; font-size: clamp(1.75rem, 3vw, 2.55rem); line-height: 1.08; letter-spacing: -.035em; }
    .hub-hero p:not(.eyebrow) { max-width: 760px; margin: 0; color: rgba(255,255,255,.76); line-height: 1.6; }
    .eyebrow { margin: 0; color: #65d5bf; font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .hero-mark { z-index: 1; display: grid; place-items: center; width: 82px; height: 82px; flex: 0 0 auto; border: 1px solid rgba(255,255,255,.16); border-radius: 22px; background: rgba(255,255,255,.08); }
    .hero-mark mat-icon { width: 42px; height: 42px; font-size: 42px; color: #65d5bf; }
    .document-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 20px; }
    .document-card, .history-card { border: 1px solid var(--app-border, #dbe4e1); border-radius: 20px; background: var(--app-surface, #fff); box-shadow: 0 10px 26px rgba(26, 49, 44, .06); }
    .document-card { display: flex; flex-direction: column; align-items: flex-start; min-height: 300px; padding: 28px; }
    .primary-card { border-top: 4px solid #1d7567; }
    .card-icon { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; background: #dff4ef; color: #17685b; }
    .card-icon.secondary { background: #eaf0f7; color: #3d5873; }
    .card-kicker { margin: 22px 0 5px; color: #1d7567; font-size: .75rem; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
    .document-card h3, .history-card h3 { margin: 0; color: var(--app-text-primary); font-size: 1.35rem; }
    .document-card > p:not(.card-kicker) { flex: 1; margin: 11px 0 18px; color: var(--app-text-secondary); line-height: 1.55; }
    .card-meta { display: flex; gap: 8px; margin-bottom: 20px; }
    .card-meta span { padding: 5px 9px; border-radius: 999px; background: #f1f5f4; color: #4d625e; font-size: .76rem; font-weight: 700; }
    .document-card a { min-height: 44px; }
    .history-card { padding: 26px 28px; }
    .section-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 18px; }
    .section-heading .eyebrow { margin-bottom: 5px; color: #1d7567; }
    .status-note { display: flex; align-items: center; gap: 6px; color: #526862; font-size: .8rem; }
    .status-note mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .state-row, .empty-history { display: flex; align-items: center; gap: 14px; min-height: 82px; color: var(--app-text-secondary); }
    .state-row.error { color: #a33a31; }
    .empty-history p { margin: 3px 0 0; }
    .empty-history > mat-icon { width: 36px; height: 36px; font-size: 36px; color: #77918b; }
    .history-row { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto auto auto 44px; align-items: center; gap: 14px; padding: 14px 0; border-top: 1px solid var(--app-border, #e3e9e7); }
    .file-mark { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; background: #e7f3ef; color: #1d7567; }
    .history-main, .history-amount { display: grid; min-width: 0; gap: 3px; }
    .history-main strong { overflow-wrap: anywhere; }
    .history-main span, .history-amount span, .history-row time { color: var(--app-text-secondary); font-size: .78rem; }
    .history-amount { min-width: 100px; text-align: right; }
    .file-state { display: inline-flex; align-items: center; gap: 5px; min-height: 30px; padding: 5px 9px; border-radius: 999px; background: #e2f3ee; color: #17685b; font-size: .75rem; font-weight: 750; white-space: nowrap; }
    .file-state.missing { background: #f3eee3; color: #7a5b21; }
    .file-state mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .history-row button { width: 44px; height: 44px; }
    @media (max-width: 980px) { .document-grid { grid-template-columns: 1fr; } .hero-mark { display: none; } .history-row { grid-template-columns: 42px minmax(0, 1fr) auto 44px; } .history-amount { display: none; } .history-row time { grid-column: 2; } .file-state { grid-column: 3; grid-row: 1 / span 2; } .history-row button { grid-column: 4; grid-row: 1 / span 2; } }
    @media (max-width: 560px) { .hub-hero { padding: 26px 22px; border-radius: 18px; } .document-card, .history-card { padding: 22px; } .section-heading { align-items: flex-start; flex-direction: column; } .history-row { grid-template-columns: 42px minmax(0, 1fr) 44px; } .history-amount { display: none; } .file-state { grid-column: 2; grid-row: 3; justify-self: start; } .history-row button { grid-column: 3; grid-row: 1 / span 3; } }
  `]
})
export class CumplimientoSriHubComponent implements OnInit {
  private readonly api = inject(CumplimientoSriApiService);
  private readonly authorization = inject(AuthorizationService);
  private readonly snack = inject(MatSnackBar);
  readonly recent = signal<ExportacionRecienteSri[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly processing = signal('');
  readonly canRestore = computed(() => this.authorization.canAccess('contabilidad_sri', 'create'));

  async ngOnInit(): Promise<void> {
    await this.loadRecent();
  }

  itemKey(item: ExportacionRecienteSri): string { return `${item.expedienteId}-${item.version}`; }

  async download(item: ExportacionRecienteSri): Promise<void> {
    const key = this.itemKey(item);
    if (this.processing()) return;
    this.processing.set(key); this.error.set('');
    try {
      const restored = item.archivo?.estado !== 'DISPONIBLE';
      const response = restored
        ? await this.api.restaurarArchivo(item.expedienteId, item.version)
        : await this.api.descargarArchivo(item.expedienteId, item.version);
      this.saveBlob(response, item.nombreArchivo);
      if (restored) {
        await this.loadRecent(false);
        this.snack.open(`Versión ${item.version} restaurada, respaldada y descargada.`, 'Cerrar', { duration: 4500 });
      }
    } catch (error) {
      this.error.set(await this.downloadErrorMessage(error));
    } finally {
      this.processing.set('');
    }
  }

  private async loadRecent(showLoading = true): Promise<void> {
    if (showLoading) this.loading.set(true);
    try {
      this.recent.set(await this.api.exportacionesRecientes());
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  private saveBlob(response: HttpResponse<Blob>, fallback: string): void {
    const disposition = response.headers.get('content-disposition') ?? '';
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const simple = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const filename = encoded ? decodeURIComponent(encoded) : (simple ?? fallback);
    const url = URL.createObjectURL(response.body ?? new Blob());
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private async downloadErrorMessage(error: unknown): Promise<string> {
    const body = (error as { error?: unknown })?.error;
    if (body instanceof Blob) {
      try {
        const payload = JSON.parse(await body.text()) as { error?: string; message?: string };
        return payload.error ?? payload.message ?? this.message(error);
      } catch { /* Se conserva el mensaje HTTP original. */ }
    }
    return this.message(error);
  }

  private message(error: unknown): string {
    const candidate = error as { error?: { error?: string }; message?: string };
    return candidate.error?.error ?? candidate.message ?? 'No se pudo cargar el historial reciente.';
  }
}
