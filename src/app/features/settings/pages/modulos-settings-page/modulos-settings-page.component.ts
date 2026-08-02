import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { MANDATORY_MODULES, MODULE_CATALOG } from '../../../../core/config/module-catalog';
import { PlanService } from '../../../../core/services/plan.service';
import { Router } from '@angular/router';
import { TenantApiService } from '../../../../core/services/tenant-api.service';
import { ModuleCardComponent } from '../../../../shared/components/module-card/module-card.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';

@Component({
  selector: 'app-modulos-settings-page',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule, ModuleCardComponent],
  templateUrl: './modulos-settings-page.component.html',
  styleUrl: './modulos-settings-page.component.scss'
})
export class ModulosSettingsPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly tenantApi = inject(TenantApiService);
  private readonly planService = inject(PlanService);
  private readonly router = inject(Router);

  protected readonly moduleCatalog = MODULE_CATALOG;
  protected readonly mandatoryModules = MANDATORY_MODULES;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly selectedModules = signal<Set<string>>(new Set());

  constructor() {
    this.tenantApi
      .getCurrentTenant()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tenant) => {
          this.selectedModules.set(new Set(tenant.activeModules ?? MODULE_CATALOG.map((module) => module.id)));
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.showMessage('No se pudo cargar la configuracion de modulos.', 'error');
        }
      });
  }

  protected isModuleSelected(moduleId: string): boolean {
    return this.selectedModules().has(moduleId);
  }

  protected isModuleLocked(moduleId: string): boolean {
    return this.mandatoryModules.includes(moduleId);
  }

  /** El modulo existe en el catalogo pero el plan contratado no lo incluye. */
  protected isModuleFueraDelPlan(moduleId: string): boolean {
    return !this.planService.incluyeModulo(moduleId);
  }

  protected verPlanes(): void {
    void this.router.navigate(['/workspace/planes']);
  }

  protected toggleModule(moduleId: string): void {
    if (this.isModuleLocked(moduleId)) {
      return;
    }
    // El backend rechaza los modulos fuera del plan; aqui se evita el viaje en balde.
    if (this.isModuleFueraDelPlan(moduleId) && !this.isModuleSelected(moduleId)) {
      this.verPlanes();
      return;
    }

    this.selectedModules.update((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }

  protected guardarCambios(): void {
    this.saving.set(true);
    this.tenantApi.updateActiveModules(Array.from(this.selectedModules())).subscribe({
      next: (tenant) => {
        this.selectedModules.set(new Set(tenant.activeModules ?? []));
        this.saving.set(false);
        this.showMessage('Modulos actualizados.', 'save');
      },
      error: () => {
        this.saving.set(false);
        this.showMessage('No se pudieron guardar los modulos.', 'error');
      }
    });
  }

  private showMessage(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}
