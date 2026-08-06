import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FuenteCatalogo, ProductoPublicado } from '@winsuite/bloques';
import { ProductosService } from '../../../inventario/services/productos.service';
import { Producto } from '../../../inventario/models/inventario.models';
import { CatalogoPublicacionService } from '../../services/catalogo-publicacion.service';
import { SelectorImagenComponent } from '../../components/selector-imagen/selector-imagen.component';

interface ProductoVista {
  id: string;
  nombre: string;
  precioVenta: number;
  fuente: 'inventario' | 'manual';
  inventario?: Producto;
}

interface FormProductoManual {
  nombre: string; descripcion: string; descripcionLarga: string; precioVenta: number;
  ivaPorcentaje: number; categoriaNombre: string; badge: string; imagenes: string[]; visible: boolean;
}

const FORM_VACIO: FormProductoManual = {
  nombre: '', descripcion: '', descripcionLarga: '', precioVenta: 0, ivaPorcentaje: 0,
  categoriaNombre: '', badge: '', imagenes: [], visible: true,
};

/** Productos empresariales con fuentes combinables: Inventario y creación propia de Sitios Web. */
@Component({
  selector: 'app-catalogo-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [A11yModule, CurrencyPipe, FormsModule, MatButtonModule, MatIconModule, MatSlideToggleModule, SelectorImagenComponent],
  template: `
    <div class="pagina">
      <header class="cabecera">
        <div><span class="kicker">Comercio digital</span><h2>Productos</h2>
          <p class="ayuda">Combina tu inventario con productos creados exclusivamente para tus sitios.</p></div>
        <div class="acciones">
          <button mat-stroked-button type="button" (click)="abrirFuentes()"><mat-icon>hub</mat-icon> Configurar fuentes</button>
          @if (fuenteActiva('manual')) {
            <button mat-flat-button type="button" (click)="nuevoManual()"><mat-icon>add</mat-icon> Nuevo producto</button>
          }
        </div>
      </header>

      <section class="resumen-fuentes" aria-label="Fuentes activas">
        <button type="button" [class.activo]="filtroFuente() === 'todos'" (click)="filtroFuente.set('todos')">Todos</button>
        @if (fuenteActiva('inventario')) { <button type="button" [class.activo]="filtroFuente() === 'inventario'" (click)="filtroFuente.set('inventario')">Inventario</button> }
        @if (fuenteActiva('manual')) { <button type="button" [class.activo]="filtroFuente() === 'manual'" (click)="filtroFuente.set('manual')">Sitios Web</button> }
      </section>

      <div class="herramientas">
        <label class="busqueda"><mat-icon>search</mat-icon><input type="search" placeholder="Buscar por nombre..." (input)="filtro.set($any($event.target).value)" /></label>
        @if (fuenteActiva('inventario')) {
          <button mat-stroked-button (click)="refrescar()" [disabled]="refrescando()"><mat-icon>sync</mat-icon>{{ refrescando() ? 'Actualizando...' : 'Actualizar inventario' }}</button>
        }
      </div>

      <div class="lista">
        @for (producto of productosFiltrados(); track producto.id) {
          <article class="producto" [class.publicado]="esVisible(producto.id)">
            <mat-slide-toggle [checked]="esVisible(producto.id)" [attr.aria-label]="(esVisible(producto.id) ? 'Ocultar ' : 'Mostrar ') + producto.nombre" (change)="alternarVisible(producto, $event.checked)" />
            <div class="miniatura">
              @if (imagenDe(producto.id)) { <img [src]="imagenDe(producto.id)" [alt]="producto.nombre" loading="lazy" /> }
              @else { <mat-icon>inventory_2</mat-icon> }
            </div>
            <div class="datos"><span class="fuente fuente-{{ producto.fuente }}">{{ producto.fuente === 'manual' ? 'Sitios Web' : 'Inventario' }}</span>
              <strong>{{ producto.nombre }}</strong><span>{{ producto.precioVenta | currency:'USD' }}</span></div>
            <div class="acciones-fila">
              @if (producto.fuente === 'manual') {
                <button mat-icon-button [attr.aria-label]="'Editar ' + producto.nombre" (click)="editarManual(producto.id)"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button class="peligro" [attr.aria-label]="'Eliminar ' + producto.nombre" (click)="eliminarManual(producto.id)"><mat-icon>delete</mat-icon></button>
              } @else if (esVisible(producto.id)) {
                <button mat-icon-button title="Editar ficha publica" (click)="fichaAbierta.set(fichaAbierta() === producto.id ? null : producto.id)"><mat-icon>{{ fichaAbierta() === producto.id ? 'expand_less' : 'edit_note' }}</mat-icon></button>
              }
            </div>
          </article>
          @if (producto.fuente === 'inventario' && esVisible(producto.id) && fichaAbierta() === producto.id) {
            <section class="ficha">
              <div class="campo"><span>Imagen principal</span><app-selector-imagen [url]="imagenDe(producto.id)" (urlChange)="cambiarImagen(producto.id, $event)" /></div>
              <label>Badge<input maxlength="20" [value]="catalogoDe(producto.id)?.badge ?? ''" (change)="guardarFicha(producto.id, 'badge', $any($event.target).value)" /></label>
              <label>Descripcion larga<textarea rows="5" maxlength="20000" [value]="catalogoDe(producto.id)?.descripcionLarga ?? ''" (change)="guardarFicha(producto.id, 'descripcionLarga', $any($event.target).value)"></textarea></label>
            </section>
          }
        } @empty {
          <div class="vacio"><mat-icon>inventory_2</mat-icon><h3>No hay productos en esta vista</h3><p>Activa una fuente o crea tu primer producto para Sitios Web.</p></div>
        }
      </div>
    </div>

    @if (configurandoFuentes()) {
      <div class="overlay" (click)="cerrarFuentes()">
        <section class="dialogo fuentes-dialogo" role="dialog" aria-modal="true" aria-labelledby="titulo-fuentes" cdkTrapFocus [cdkTrapFocusAutoCapture]="true" (click)="$event.stopPropagation()">
          <div class="dialogo-cabecera"><div><span class="paso">Configuración de productos</span><h2 id="titulo-fuentes">¿De dónde vienen tus productos?</h2></div>
            @if (config()?.wizardCompletado) { <button mat-icon-button type="button" aria-label="Cerrar configuración de fuentes" (click)="cerrarFuentes()"><mat-icon>close</mat-icon></button> }
          </div>
          <p>Activa una o ambas fuentes. Puedes cambiar esta decisión sin borrar productos.</p>
          <div class="fuentes-grid">
            <button type="button" class="fuente-card" [class.seleccionada]="seleccionada('inventario')" [attr.aria-pressed]="seleccionada('inventario')" (click)="toggleFuente('inventario')">
              <mat-icon>warehouse</mat-icon><strong>Inventario WinSuit</strong><span>Sincroniza nombre, precio y categoría.</span><b>{{ seleccionada('inventario') ? 'Activa' : 'Activar' }}</b>
            </button>
            <button type="button" class="fuente-card" [class.seleccionada]="seleccionada('manual')" [attr.aria-pressed]="seleccionada('manual')" (click)="toggleFuente('manual')">
              <mat-icon>add_box</mat-icon><strong>Crear en Sitios Web</strong><span>Productos independientes del inventario.</span><b>{{ seleccionada('manual') ? 'Activa' : 'Activar' }}</b>
            </button>
            <div class="fuente-card deshabilitada" aria-disabled="true"><mat-icon>local_shipping</mat-icon><strong>Dropi</strong><span>Dropshipping y sincronización externa.</span><b>Próximamente</b></div>
          </div>
          @if (errorFuentes()) { <p class="error" role="alert">{{ errorFuentes() }}</p> }
          <div class="acciones-dialogo"><button mat-flat-button type="button" [disabled]="guardandoFuentes()" (click)="guardarFuentes()">{{ guardandoFuentes() ? 'Guardando...' : 'Guardar y continuar' }}</button></div>
        </section>
      </div>
    }

    @if (productoEditando() !== undefined) {
      <div class="overlay" (click)="cerrarManual()">
        <section class="dialogo producto-dialogo" role="dialog" aria-modal="true" aria-labelledby="titulo-producto" cdkTrapFocus [cdkTrapFocusAutoCapture]="true" (click)="$event.stopPropagation()">
          <div class="dialogo-cabecera"><div><span class="paso">Sitios Web</span><h2 id="titulo-producto">{{ productoEditando() ? 'Editar producto' : 'Nuevo producto' }}</h2></div>
            <button mat-icon-button type="button" aria-label="Cerrar" (click)="cerrarManual()"><mat-icon>close</mat-icon></button></div>
          <div class="form-grid">
            <label class="ancho">Nombre<input maxlength="200" [ngModel]="formManual().nombre" (ngModelChange)="patchForm({ nombre:$event })" /></label>
            <label>Precio USD<input type="number" min="0" step="0.01" [ngModel]="formManual().precioVenta" (ngModelChange)="patchForm({ precioVenta:+$event })" /></label>
            <label>IVA %<input type="number" min="0" max="100" step="1" [ngModel]="formManual().ivaPorcentaje" (ngModelChange)="patchForm({ ivaPorcentaje:+$event })" /></label>
            <label>Categoría<input maxlength="80" [ngModel]="formManual().categoriaNombre" (ngModelChange)="patchForm({ categoriaNombre:$event })" /></label>
            <label>Badge<input maxlength="20" placeholder="Nuevo, Oferta..." [ngModel]="formManual().badge" (ngModelChange)="patchForm({ badge:$event })" /></label>
            <label class="ancho">Descripción corta<textarea rows="2" maxlength="8000" [ngModel]="formManual().descripcion" (ngModelChange)="patchForm({ descripcion:$event })"></textarea></label>
            <label class="ancho">Descripción larga<textarea rows="5" maxlength="20000" [ngModel]="formManual().descripcionLarga" (ngModelChange)="patchForm({ descripcionLarga:$event })"></textarea></label>
            <div class="campo ancho"><span>Imagen principal</span><app-selector-imagen [url]="formManual().imagenes[0]" (urlChange)="patchForm({ imagenes:$event ? [$event] : [] })" /></div>
            <label class="check ancho"><input type="checkbox" [ngModel]="formManual().visible" (ngModelChange)="patchForm({ visible:$event })" /> Visible en el catálogo</label>
          </div>
          @if (errorManual()) { <p class="error" role="alert">{{ errorManual() }}</p> }
          <div class="acciones-dialogo"><button mat-stroked-button type="button" (click)="cerrarManual()">Cancelar</button><button mat-flat-button type="button" [disabled]="guardandoManual()" (click)="guardarManual()">{{ guardandoManual() ? 'Guardando...' : 'Guardar producto' }}</button></div>
        </section>
      </div>
    }
  `,
  styles: `
    :host { display:block; }
    .pagina { padding:clamp(18px,3vw,32px);max-width:1040px;margin-inline:auto; }
    .cabecera { display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:20px; }
    .kicker,.paso { color:var(--primary);font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase; }
    h2 { margin:4px 0 5px;font-family:var(--tc-font-headline); }
    .ayuda { margin:0;max-width:62ch;color:var(--tc-on-surface-variant); }
    .acciones,.herramientas,.acciones-dialogo { display:flex;gap:8px;align-items:center;flex-wrap:wrap; }
    .resumen-fuentes { display:flex;gap:6px;margin-bottom:14px; }
    .resumen-fuentes button { border:0;border-radius:9px;padding:8px 12px;background:var(--tc-surface-container);color:var(--tc-on-surface);cursor:pointer;font:inherit;font-size:.82rem;font-weight:700; }
    .resumen-fuentes button.activo { background:var(--tc-primary-container);color:var(--tc-on-primary-container); }
    .herramientas { justify-content:space-between;margin-bottom:14px; }
    .busqueda { display:flex;align-items:center;gap:8px;flex:1;min-width:220px;padding:0 12px;border-radius:10px;background:var(--tc-surface-container-highest); }
    .busqueda input { flex:1;border:0;background:transparent;padding:11px 0;color:inherit;font:inherit;outline:0; }
    .lista { display:grid;gap:8px; }
    .producto { display:grid;grid-template-columns:auto 64px minmax(0,1fr) auto;align-items:center;gap:14px;padding:10px 14px;border-radius:14px;background:var(--tc-surface-container-lowest);box-shadow:var(--tc-elevation-1); }
    .producto.publicado { background:color-mix(in srgb,var(--tc-primary-container) 26%,var(--tc-surface-container-lowest)); }
    .miniatura { width:58px;height:58px;border-radius:11px;background:var(--tc-surface-container);display:grid;place-items:center;overflow:hidden;color:var(--tc-on-surface-variant); }
    .miniatura img { width:100%;height:100%;object-fit:cover; }
    .datos { display:grid;gap:2px;min-width:0; }
    .datos strong { overflow-wrap:anywhere; }
    .datos>span:last-child { color:var(--tc-on-surface-variant);font-size:.85rem; }
    .fuente { width:max-content;border-radius:6px;padding:2px 6px;font-size:.66rem;font-weight:800; }
    .fuente-inventario { background:var(--tc-info-container);color:var(--tc-on-info-container); }
    .fuente-manual { background:var(--tc-success-container);color:var(--tc-on-success-container); }
    .acciones-fila { display:flex; }
    .peligro { color:var(--tc-error); }
    .ficha { margin-top:-10px;padding:22px 16px 16px;border-radius:0 0 14px 14px;background:var(--tc-surface-container-low);display:grid;gap:12px; }
    label,.campo { display:flex;flex-direction:column;gap:5px;font-size:.84rem;font-weight:700; }
    input,textarea { box-sizing:border-box;width:100%;border:0;border-radius:9px;padding:10px 11px;background:var(--tc-surface-container-highest);color:var(--tc-on-surface);font:inherit;font-weight:400; }
    input:focus-visible,textarea:focus-visible { outline:2px solid var(--primary);outline-offset:2px; }
    .vacio { padding:48px 20px;text-align:center;color:var(--tc-on-surface-variant); }
    .vacio mat-icon { width:42px;height:42px;font-size:42px; }
    .vacio h3 { margin:10px 0 4px;color:var(--tc-on-surface); }
    .vacio p { margin:0; }
    .overlay { position:fixed;z-index:1200;inset:0;display:grid;place-items:center;padding:20px;background:rgba(8,24,22,.56); }
    .dialogo { width:min(760px,100%);max-height:calc(100vh - 40px);overflow:auto;border-radius:16px;padding:clamp(20px,4vw,32px);background:var(--tc-surface-container-lowest);color:var(--tc-on-surface);box-shadow:0 24px 70px rgba(0,0,0,.24); }
    .dialogo>p { color:var(--tc-on-surface-variant); }
    .dialogo-cabecera { display:flex;justify-content:space-between;gap:16px;align-items:flex-start; }
    .fuentes-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:22px 0; }
    .fuente-card { display:flex;min-height:190px;flex-direction:column;align-items:flex-start;gap:8px;padding:18px;border:0;border-radius:14px;background:var(--tc-surface-container-low);color:inherit;text-align:left;cursor:pointer;font:inherit; }
    .fuente-card mat-icon { color:var(--primary);font-size:28px;width:28px;height:28px; }
    .fuente-card span { color:var(--tc-on-surface-variant);font-size:.83rem;line-height:1.45; }
    .fuente-card b { margin-top:auto;color:var(--primary);font-size:.78rem; }
    .fuente-card.seleccionada { background:var(--tc-primary-container);outline:2px solid var(--primary);outline-offset:-2px; }
    .fuente-card.deshabilitada { opacity:.55;cursor:not-allowed; }
    .acciones-dialogo { justify-content:flex-end;margin-top:20px; }
    .form-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px; }
    .form-grid .ancho { grid-column:1/-1; }
    .check { flex-direction:row;align-items:center; }
    .check input { width:auto; }
    .error { padding:9px 11px;border-radius:9px;background:var(--tc-error-container);color:var(--tc-on-error-container)!important; }
    @media (max-width:720px) { .cabecera { flex-direction:column; }.acciones { width:100%; }.fuentes-grid { grid-template-columns:1fr; }.fuente-card { min-height:140px; }.form-grid { grid-template-columns:1fr; }.form-grid .ancho { grid-column:auto; } }
    @media (max-width:560px) { .producto { grid-template-columns:auto 50px minmax(0,1fr); }.acciones-fila { grid-column:2/-1;justify-content:flex-end; }.miniatura { width:48px;height:48px; } }
  `,
})
export class CatalogoPageComponent {
  private readonly productosService = inject(ProductosService);
  private readonly catalogoService = inject(CatalogoPublicacionService);
  private readonly snackBar = inject(MatSnackBar);

  readonly filtro = signal('');
  readonly filtroFuente = signal<'todos' | 'inventario' | 'manual'>('todos');
  readonly refrescando = signal(false);
  readonly fichaAbierta = signal<string | null>(null);
  readonly configurandoFuentes = signal(false);
  readonly seleccionFuentes = signal<FuenteCatalogo[]>(['inventario', 'manual']);
  readonly guardandoFuentes = signal(false);
  readonly errorFuentes = signal('');
  readonly productoEditando = signal<ProductoPublicado | null | undefined>(undefined);
  readonly formManual = signal<FormProductoManual>({ ...FORM_VACIO });
  readonly guardandoManual = signal(false);
  readonly errorManual = signal('');
  private wizardInicializado = false;

  private readonly inventario = toSignal(this.productosService.getProductos(), { initialValue: [] });
  private readonly catalogo = toSignal(this.catalogoService.getCatalogo(), { initialValue: {} as Record<string, ProductoPublicado> });
  protected readonly config = toSignal(this.catalogoService.getFuentesConfig());

  readonly productosFiltrados = computed<ProductoVista[]>(() => {
    const activas = new Set(this.config()?.fuentesActivas ?? this.seleccionFuentes());
    const inventario: ProductoVista[] = activas.has('inventario') ? this.inventario().filter((p) => p.activo && p.id).map((p) => ({ id:p.id!,nombre:p.nombre,precioVenta:p.precioVenta,fuente:'inventario',inventario:p })) : [];
    const manuales: ProductoVista[] = activas.has('manual') ? Object.values(this.catalogo()).filter((p) => p.fuente?.tipo === 'manual').map((p) => ({ id:p.productoId,nombre:p.nombre,precioVenta:p.precioVenta,fuente:'manual' })) : [];
    const texto = this.filtro().trim().toLocaleLowerCase();
    return [...inventario,...manuales]
      .filter((p) => this.filtroFuente() === 'todos' || p.fuente === this.filtroFuente())
      .filter((p) => !texto || p.nombre.toLocaleLowerCase().includes(texto))
      .sort((a,b) => a.nombre.localeCompare(b.nombre));
  });

  constructor() {
    effect(() => {
      const config = this.config();
      if (config === undefined || this.wizardInicializado) return;
      this.wizardInicializado = true;
      this.seleccionFuentes.set(config?.fuentesActivas ?? ['inventario','manual']);
      this.configurandoFuentes.set(!config?.wizardCompletado);
    });
  }

  fuenteActiva(fuente: FuenteCatalogo): boolean { return (this.config()?.fuentesActivas ?? this.seleccionFuentes()).includes(fuente); }
  seleccionada(fuente: FuenteCatalogo): boolean { return this.seleccionFuentes().includes(fuente); }
  toggleFuente(fuente: FuenteCatalogo): void { this.seleccionFuentes.update((lista) => lista.includes(fuente) ? lista.filter((x) => x !== fuente) : [...lista,fuente]); }
  abrirFuentes(): void { this.seleccionFuentes.set(this.config()?.fuentesActivas ?? ['inventario','manual']);this.configurandoFuentes.set(true); }
  cerrarFuentes(): void { if (this.config()?.wizardCompletado && !this.guardandoFuentes()) this.configurandoFuentes.set(false); }
  async guardarFuentes(): Promise<void> { if (!this.seleccionFuentes().length) { this.errorFuentes.set('Activa al menos una fuente.');return; } this.guardandoFuentes.set(true);this.errorFuentes.set('');try { await this.catalogoService.guardarFuentesConfig(this.seleccionFuentes());this.configurandoFuentes.set(false); } catch { this.errorFuentes.set('No se pudo guardar la configuracion. Intenta nuevamente.'); } finally { this.guardandoFuentes.set(false); } }

  esVisible(id:string):boolean { return this.catalogo()[id]?.visible ?? false; }
  imagenDe(id:string):string|undefined { return this.catalogo()[id]?.imagenes?.[0]; }
  catalogoDe(id:string):ProductoPublicado|undefined { return this.catalogo()[id]; }
  async alternarVisible(producto:ProductoVista,visible:boolean):Promise<void> { try { if (producto.fuente === 'manual') await this.catalogoService.setVisiblePorId(producto.id,visible); else if (producto.inventario) await this.catalogoService.setVisible(producto.inventario,visible); } catch(error) { this.snackBar.open((error as Error).message || 'No se pudo actualizar','OK',{duration:4000}); } }
  async cambiarImagen(id:string,url:string):Promise<void> { const actuales=this.catalogo()[id]?.imagenes ?? [];await this.catalogoService.setImagenes(id,url?[url,...actuales.slice(1)]:actuales.slice(1)); }
  async guardarFicha(id:string,campo:'badge'|'descripcionLarga',valor:string):Promise<void> { const actual=this.catalogo()[id];await this.catalogoService.setFichaTienda(id,{badge:campo==='badge'?valor:actual?.badge,descripcionLarga:campo==='descripcionLarga'?valor:actual?.descripcionLarga}); }
  async refrescar():Promise<void> { this.refrescando.set(true);try { await this.catalogoService.refrescarCatalogo();this.snackBar.open('Productos actualizados desde el inventario','OK',{duration:3000}); } finally { this.refrescando.set(false); } }

  nuevoManual():void { this.productoEditando.set(null);this.formManual.set({...FORM_VACIO,imagenes:[]});this.errorManual.set(''); }
  editarManual(id:string):void { const p=this.catalogo()[id];if(!p)return;this.productoEditando.set(p);this.formManual.set({nombre:p.nombre,descripcion:p.descripcion??'',descripcionLarga:p.descripcionLarga??'',precioVenta:p.precioVenta,ivaPorcentaje:p.ivaPorcentaje,categoriaNombre:p.categoriaNombre||p.categoriaId,badge:p.badge??'',imagenes:[...(p.imagenes??[])],visible:p.visible});this.errorManual.set(''); }
  cerrarManual():void { if(!this.guardandoManual())this.productoEditando.set(undefined); }
  @HostListener('document:keydown.escape')
  alPresionarEscape(): void { if (this.productoEditando() !== undefined) this.cerrarManual(); else this.cerrarFuentes(); }
  patchForm(cambios:Partial<FormProductoManual>):void { this.formManual.update((actual)=>({...actual,...cambios})); }
  async guardarManual():Promise<void> { const f=this.formManual();if(f.nombre.trim().length<2||f.precioVenta<0||!f.categoriaNombre.trim()){this.errorManual.set('Completa nombre, precio y categoria.');return;}this.guardandoManual.set(true);this.errorManual.set('');try{await this.catalogoService.guardarProductoManual({...f,productoId:this.productoEditando()?.productoId});this.productoEditando.set(undefined);this.snackBar.open('Producto guardado','OK',{duration:2500});}catch{this.errorManual.set('No se pudo guardar el producto. Intenta nuevamente.');}finally{this.guardandoManual.set(false);} }
  async eliminarManual(id:string):Promise<void> { if(!globalThis.confirm?.('¿Eliminar este producto de Sitios Web?'))return;try{await this.catalogoService.eliminarProductoManual(id);this.snackBar.open('Producto eliminado','OK',{duration:2500});}catch(error){this.snackBar.open((error as Error).message||'No se pudo eliminar','OK',{duration:4000});} }
}
