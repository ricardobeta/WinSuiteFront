import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompanyLoadingOverlayComponent } from './company-loading-overlay.component';

describe('CompanyLoadingOverlayComponent', () => {
  let fixture: ComponentFixture<CompanyLoadingOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyLoadingOverlayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanyLoadingOverlayComponent);
  });

  it('announces the company loading state accessibly', () => {
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(status).toBeTruthy();
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toContain('Cargando empresa');
    expect(status.textContent).toContain('tu espacio de trabajo');
  });

  it('shows the destination company when it is known', () => {
    fixture.componentRef.setInput('companyName', 'Empresa Beta');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Empresa Beta');
  });
});
