import { Component, input } from '@angular/core';

@Component({
  selector: 'app-company-loading-overlay',
  standalone: true,
  templateUrl: './company-loading-overlay.component.html',
  styleUrl: './company-loading-overlay.component.scss',
})
export class CompanyLoadingOverlayComponent {
  readonly companyName = input<string | null>(null);
}
