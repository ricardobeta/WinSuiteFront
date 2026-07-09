import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { ModuleCatalogEntry } from '../../../core/config/module-catalog';

@Component({
  selector: 'app-module-card',
  standalone: true,
  imports: [MatCheckboxModule, MatIconModule, MatSlideToggleModule],
  templateUrl: './module-card.component.html',
  styleUrl: './module-card.component.scss'
})
export class ModuleCardComponent {
  @Input({ required: true }) module!: ModuleCatalogEntry;
  @Input() selected = false;
  /** Use a slide toggle (settings screen) instead of a checkbox (signup step). */
  @Input() variant: 'checkbox' | 'toggle' = 'checkbox';
  @Output() readonly toggle = new EventEmitter<void>();

  protected onClick(): void {
    if (!this.module.locked) {
      this.toggle.emit();
    }
  }
}
