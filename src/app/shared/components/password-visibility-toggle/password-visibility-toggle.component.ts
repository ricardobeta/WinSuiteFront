import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-password-visibility-toggle',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button
      mat-icon-button
      type="button"
      tabindex="-1"
      [attr.aria-label]="visible() ? 'Ocultar contrasena' : 'Mostrar contrasena'"
      [attr.aria-pressed]="visible()"
      (click)="visible.set(!visible())"
    >
      <mat-icon>{{ visible() ? 'visibility_off' : 'visibility' }}</mat-icon>
    </button>
  `
})
export class PasswordVisibilityToggleComponent {
  readonly visible = signal(false);
}
