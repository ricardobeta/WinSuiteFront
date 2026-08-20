import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/services/auth.service';
import { TablePreferencesService } from '../../../core/services/table-preferences.service';
import { DataTableFrameComponent } from './data-table-frame.component';

describe('DataTableFrameComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTableFrameComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AuthService, useValue: { currentProfile: () => null } },
        { provide: TablePreferencesService, useValue: {} }
      ]
    }).compileComponents();
  });

  it('muestra la guia y la sombra final cuando la tabla desborda', async () => {
    const fixture = TestBed.createComponent(DataTableFrameComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const viewport = fixture.nativeElement.querySelector('.data-table-viewport') as HTMLElement;
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 320 },
      scrollWidth: { configurable: true, value: 900 },
      scrollLeft: { configurable: true, writable: true, value: 0 }
    });

    (fixture.componentInstance as any).updateOverflowState();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.data-table-scroll-hint')?.textContent)
      .toContain('Desliza horizontalmente');
    expect(fixture.nativeElement.querySelector('.data-table-surface')?.classList)
      .toContain('can-scroll-forward');
  });

  it('actualiza ambas sombras al desplazarse y las retira sin overflow', async () => {
    const fixture = TestBed.createComponent(DataTableFrameComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const viewport = fixture.nativeElement.querySelector('.data-table-viewport') as HTMLElement;
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 320 },
      scrollWidth: { configurable: true, value: 900 },
      scrollLeft: { configurable: true, writable: true, value: 120 }
    });
    viewport.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    const surface = fixture.nativeElement.querySelector('.data-table-surface') as HTMLElement;
    expect(surface.classList).toContain('can-scroll-backward');
    expect(surface.classList).toContain('can-scroll-forward');

    Object.defineProperty(viewport, 'scrollWidth', { configurable: true, value: 320 });
    (fixture.componentInstance as any).updateOverflowState();
    fixture.detectChanges();

    expect(surface.classList).not.toContain('can-scroll-backward');
    expect(surface.classList).not.toContain('can-scroll-forward');
    expect(fixture.nativeElement.querySelector('.data-table-scroll-hint')).toBeNull();
  });
});
