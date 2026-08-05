import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { CompanyLoadingOverlayComponent } from './shared/components/company-loading-overlay/company-loading-overlay.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CompanyLoadingOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly loadingInitialCompany = computed(
    () => this.auth.initialBootstrapPending() && this.isCompanySessionRoute()
  );

  constructor() {
    this.theme.initializeTheme();
  }

  private isCompanySessionRoute(): boolean {
    if (typeof window === 'undefined') return false;

    return !/(^|\/)(legal|super-admin)(\/|$)/.test(window.location.pathname);
  }
}
