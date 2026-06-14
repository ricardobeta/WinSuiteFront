import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';

export interface SuccessSnackbarData {
  message: string;
  icon?: string;
}

@Component({
  selector: 'app-success-snackbar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="snackbar-success">
      <mat-icon>{{ data.icon ?? 'check_circle' }}</mat-icon>
      <span>{{ data.message }}</span>
    </div>
  `,
  styles: [`
    .snackbar-success {
      display: inline-flex;
      align-items: center;
      gap: .55rem;
      font-weight: 500;
    }

    .snackbar-success mat-icon {
      font-size: 1.15rem;
      width: 1.15rem;
      height: 1.15rem;
      color: var(--primary);
    }
  `]
})
export class SuccessSnackbarComponent {
  protected readonly data = inject<SuccessSnackbarData>(MAT_SNACK_BAR_DATA);
}