import { Component, EventEmitter, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-tour-trigger-button',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <button
      mat-icon-button
      type="button"
      class="tour-trigger-button"
      matTooltip="Ver recorrido guiado"
      aria-label="Ver recorrido guiado"
      (click)="open.emit()"
    >
      <mat-icon>help</mat-icon>
    </button>
  `,
  styles: [`
    .tour-trigger-button {
      width: 26px;
      height: 26px;
      line-height: 26px;
      vertical-align: middle;
      color: var(--primary);
      text-transform: none;
    }

    .tour-trigger-button mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class TourTriggerButtonComponent {
  @Output() readonly open = new EventEmitter<void>();
}
