import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  QueryList,
  ViewChild,
  ViewChildren,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

import { loadTourSteps } from '../../../core/config/tour-steps/tour-steps.registry';
import { GuidedTourService } from '../../../core/services/guided-tour.service';
import { TourTriggerButtonComponent } from '../tour-trigger-button/tour-trigger-button.component';

export interface ModuleNavItem {
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
  /** Parametros para enlazar a una seccion concreta de otro modulo (ej. un tab o panel). */
  queryParams?: Record<string, string>;
}

export function calculateVisibleNavIndices(
  widths: readonly number[],
  available: number,
  moreWidth: number,
  activeIndex = -1,
  gap = 6,
): number[] {
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  if (total <= available) return widths.map((_, index) => index);

  const usable = Math.max(0, available - moreWidth - gap);
  const visible: number[] = [];
  let used = 0;
  for (let index = 0; index < widths.length; index += 1) {
    const next = widths[index] + (visible.length > 0 ? gap : 0);
    if (used + next > usable) break;
    visible.push(index);
    used += next;
  }

  if (activeIndex >= 0 && activeIndex < widths.length && !visible.includes(activeIndex)) {
    if (visible.length > 0) visible.pop();
    visible.push(activeIndex);
    visible.sort((a, b) => a - b);
  }
  return visible;
}

@Component({
  selector: 'app-module-shell',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatMenuModule, TourTriggerButtonComponent],
  template: `
    <section class="module-shell">
      @if (!immersive()) {
      <header class="module-hero surface-card" [id]="tourId('header')">
        <div class="module-hero__copy">
          <p class="module-hero__eyebrow">
            {{ eyebrow() }}
            @if (tourEnabled()) {
              <app-tour-trigger-button (open)="startTourManually()" />
            }
          </p>
          <h1>{{ title() }}</h1>
          <p class="module-hero__description">{{ description() }}</p>
        </div>

        <div class="module-hero__aside">
          <div class="module-hero__actions"><ng-content select="[module-hero-actions]" /></div>
          <div class="module-hero__icon" aria-hidden="true">
            <mat-icon>{{ icon() }}</mat-icon>
          </div>
        </div>
      </header>

      }

      @if (!immersive() && items().length > 0) {
        <nav
          #navHost
          class="module-nav surface-card"
          [id]="tourId('subnav')"
          [attr.aria-label]="navigationLabel()"
        >
          <div class="module-nav__visible">
            @for (entry of visibleEntries(); track entry.item.route) {
              <a
                class="module-nav__link"
                [class.active]="isActive(entry.item)"
                [routerLink]="entry.item.route"
                [queryParams]="entry.item.queryParams ?? null"
                [attr.aria-current]="isActive(entry.item) ? 'page' : null"
              >
                <mat-icon>{{ entry.item.icon }}</mat-icon>
                <span>{{ entry.item.label }}</span>
              </a>
            }
          </div>

          @if (overflowEntries().length > 0) {
            <button
              mat-button
              type="button"
              class="module-nav__more"
              [matMenuTriggerFor]="overflowMenu"
              aria-label="Ver más secciones"
            >
              <mat-icon>more_horiz</mat-icon>
              <span>Más</span>
            </button>
            <mat-menu #overflowMenu="matMenu" xPosition="before" class="module-nav-menu">
              @for (entry of overflowEntries(); track entry.item.route) {
                <a
                  mat-menu-item
                  [routerLink]="entry.item.route"
                  [queryParams]="entry.item.queryParams ?? null"
                  [class.module-nav-menu__active]="isActive(entry.item)"
                  [attr.aria-current]="isActive(entry.item) ? 'page' : null"
                >
                  <mat-icon>{{ entry.item.icon }}</mat-icon>
                  <span>{{ entry.item.label }}</span>
                </a>
              }
            </mat-menu>
          }

          <div class="module-nav__measure" aria-hidden="true">
            @for (item of items(); track item.route) {
              <span #measureItem class="module-nav__measure-item">
                <mat-icon>{{ item.icon }}</mat-icon><span>{{ item.label }}</span>
              </span>
            }
            <span #measureMore class="module-nav__measure-item module-nav__measure-more">
              <mat-icon>more_horiz</mat-icon><span>Más</span>
            </span>
          </div>
        </nav>
      }

      <main class="module-content" [id]="tourId('content')">
        <ng-content />
      </main>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; max-width: 100%; }
    .module-shell { display: grid; gap: 1rem; min-width: 0; max-width: 100%; }
    .module-hero {
      min-height: 132px;
      padding: clamp(1rem, 2vw, 1.5rem);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.25rem;
      overflow: hidden;
      background: var(--tc-hero-background);
    }
    .module-hero__copy { min-width: 0; display: grid; align-content: center; }
    .module-hero__eyebrow {
      display: inline-flex;
      align-items: center;
      margin: 0 0 .3rem;
      color: var(--primary);
      font-size: .74rem;
      font-weight: 800;
      letter-spacing: .11em;
      text-transform: uppercase;
    }
    .module-hero h1 {
      margin: 0;
      font-family: var(--tc-font-family-heading);
      font-size: clamp(1.65rem, 3vw, 2.35rem);
      line-height: 1.08;
      letter-spacing: -.025em;
    }
    .module-hero__description {
      margin: .45rem 0 0;
      max-width: 72ch;
      color: var(--muted-foreground);
      line-height: 1.5;
    }
    .module-hero__aside { display: flex; align-items: center; gap: 1rem; flex: 0 0 auto; }
    .module-hero__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .65rem; }
    .module-hero__actions:empty { display: none; }
    .module-hero__icon {
      width: 68px;
      height: 68px;
      border-radius: 22px;
      display: grid;
      place-items: center;
      color: var(--tc-on-primary-container);
      background: color-mix(in srgb, var(--tc-primary-container) 78%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 18%, transparent);
      transform: rotate(3deg);
    }
    .module-hero__icon mat-icon { width: 34px; height: 34px; font-size: 34px; transform: rotate(-3deg); }
    .module-nav {
      position: relative;
      min-width: 0;
      max-width: 100%;
      padding: .55rem;
      display: flex;
      align-items: center;
      gap: .35rem;
      overflow: hidden;
      background: var(--tc-surface-container);
      box-shadow: none;
    }
    .module-nav__visible { min-width: 0; display: flex; align-items: center; gap: .35rem; overflow: hidden; }
    .module-nav__link,
    .module-nav__more,
    .module-nav__measure-item {
      min-height: 44px;
      padding: .58rem .82rem;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .45rem;
      flex: 0 0 auto;
      white-space: nowrap;
      color: var(--tc-on-surface);
      text-decoration: none;
      font-size: .875rem;
      font-weight: 700;
    }
    .module-nav__link mat-icon,
    .module-nav__more mat-icon,
    .module-nav__measure-item mat-icon { width: 20px; height: 20px; font-size: 20px; }
    .module-nav__link { transition: color .16s ease, background-color .16s ease, transform .16s ease; }
    .module-nav__link:hover { color: var(--primary); background: var(--tc-surface-container-highest); transform: translateY(-1px); }
    .module-nav__link.active {
      color: #fff;
      background: var(--mat-sys-primary);
      box-shadow: 0 7px 18px color-mix(in srgb, var(--mat-sys-primary) 22%, transparent);
    }
    .module-nav__link.active mat-icon { color: #fff; }

    :host-context(html.theme-dark) .module-nav__link.active,
    :host-context(html.theme-dark) .module-nav__link.active mat-icon {
      color: var(--tc-on-primary);
    }
    .module-nav__link:focus-visible,
    .module-nav__more:focus-visible { outline: 3px solid color-mix(in srgb, var(--primary) 35%, transparent); outline-offset: 2px; }
    .module-nav__more { margin-left: auto; color: var(--primary); background: var(--tc-surface-container-highest); }
    .module-nav__measure { position: absolute; inset: auto auto 0 -100000px; display: flex; gap: .35rem; visibility: hidden; pointer-events: none; }
    .module-content { display: block; min-width: 0; max-width: 100%; }
    @media (max-width: 720px) {
      .module-hero { min-height: 104px; align-items: flex-start; gap: .75rem; }
      .module-hero__description { font-size: .9rem; }
      .module-hero__aside { align-items: flex-start; }
      .module-hero__icon { width: 50px; height: 50px; border-radius: 16px; }
      .module-hero__icon mat-icon { width: 26px; height: 26px; font-size: 26px; }
      .module-hero__actions { grid-column: 1 / -1; justify-content: flex-start; }
      .module-nav { padding: .4rem; }
      .module-nav__link, .module-nav__more, .module-nav__measure-item { padding-inline: .68rem; }
    }
    @media (max-width: 480px) {
      .module-hero__icon { display: none; }
      .module-hero__aside { display: contents; }
      .module-hero { display: grid; grid-template-columns: minmax(0, 1fr); }
    }
  `],
})
export class ModuleShellComponent implements AfterViewInit {
  readonly moduleId = input.required<string>();
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly icon = input.required<string>();
  readonly items = input<readonly ModuleNavItem[]>([]);
  readonly navigationLabel = input('Navegación del módulo');
  readonly tourEnabled = input(true);
  /** Oculta el hero y la navegación del módulo (modo inmersivo/pantalla completa). */
  readonly immersive = input(false);

  @ViewChild('navHost') private navHost?: ElementRef<HTMLElement>;
  @ViewChildren('measureItem') private measureItems?: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('measureMore') private measureMore?: ElementRef<HTMLElement>;

  private readonly router = inject(Router);
  private readonly guidedTour = inject(GuidedTourService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly visibleIndices = signal<number[]>([]);
  private resizeObserver?: ResizeObserver;

  protected readonly entries = computed(() => this.items().map((item, index) => ({ item, index })));
  protected readonly visibleEntries = computed(() => {
    const visible = new Set(this.visibleIndices());
    return this.entries().filter((entry) => visible.has(entry.index));
  });
  protected readonly overflowEntries = computed(() => {
    const visible = new Set(this.visibleIndices());
    return this.entries().filter((entry) => !visible.has(entry.index));
  });

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => queueMicrotask(() => this.recalculateNavigation()));

    afterNextRender(() => {
      this.maybeStartTour();
    }, { injector: this.injector });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.setupResponsiveNavigation());
  }

  protected tourId(section: 'header' | 'subnav' | 'content'): string {
    return `tour-${this.moduleId()}-${section}`;
  }

  protected isActive(item: ModuleNavItem): boolean {
    return this.router.isActive(item.route, {
      paths: item.exact ? 'exact' : 'subset',
      queryParams: 'ignored',
      matrixParams: 'ignored',
      fragment: 'ignored',
    });
  }

  protected startTourManually(): void {
    void loadTourSteps(this.moduleId()).then((steps) => this.guidedTour.startTour(this.moduleId(), steps));
  }

  private maybeStartTour(): void {
    if (this.tourEnabled() && !this.guidedTour.hasSeenTour(this.moduleId())) {
      this.startTourManually();
    }
  }

  private setupResponsiveNavigation(): void {
    const host = this.navHost?.nativeElement;
    if (!host) {
      this.visibleIndices.set(this.entries().map((entry) => entry.index));
      return;
    }

    this.resizeObserver?.disconnect();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.recalculateNavigation());
      this.resizeObserver.observe(host);
      this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
    }
    this.recalculateNavigation();
  }

  private recalculateNavigation(): void {
    const host = this.navHost?.nativeElement;
    const measurements = this.measureItems?.toArray() ?? [];
    const allEntries = this.entries();
    if (!host || measurements.length !== allEntries.length) {
      this.visibleIndices.set(allEntries.map((entry) => entry.index));
      return;
    }

    const horizontalPadding = 18;
    const available = Math.max(0, host.clientWidth - horizontalPadding);
    const widths = measurements.map((entry) => Math.ceil(entry.nativeElement.getBoundingClientRect().width));
    const moreWidth = Math.ceil(this.measureMore?.nativeElement.getBoundingClientRect().width ?? 84);
    const activeIndex = allEntries.findIndex((entry) => this.isActive(entry.item));
    this.visibleIndices.set(calculateVisibleNavIndices(widths, available, moreWidth, activeIndex));
  }
}
