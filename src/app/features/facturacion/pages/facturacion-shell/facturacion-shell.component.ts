import { Component, Injector, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { loadTourSteps } from '../../../../core/config/tour-steps/tour-steps.registry';
import { GuidedTourService } from '../../../../core/services/guided-tour.service';
import { TourTriggerButtonComponent } from '../../../../shared/components/tour-trigger-button/tour-trigger-button.component';

@Component({
	selector: 'app-facturacion-shell',
	standalone: true,
	imports: [RouterOutlet, TourTriggerButtonComponent],
	template: `
		<section class="facturacion-shell">
			<header class="facturacion-hero surface-card" id="tour-facturacion-header">
				<div>
					<p class="eyebrow">
						Módulo Facturación Electrónica
						<app-tour-trigger-button (open)="startTourManually()" />
					</p>
					<h1>Facturación</h1>
					<p>
						Centraliza firmas, configuracion tributaria y emision de facturas electronicas para tu empresa.
					</p>
				</div>
			</header>

			<main class="facturacion-content" id="tour-facturacion-content">
				<router-outlet />
			</main>
		</section>
	`,
		styles: [ `
			.facturacion-shell { display: grid; gap: 1rem; }
			.facturacion-hero { padding: 1.5rem; display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); align-items: end; background: var(--tc-surface-container-lowest); }
			.facturacion-hero h1 { margin: 0; font-size: clamp(2rem, 4vw, 3rem); }
			.facturacion-hero p { margin: .35rem 0 0; max-width: 70ch; color: var(--muted-foreground); }
			.eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; margin: 0 0 .35rem; color: var(--primary); }
			.facturacion-content { min-width: 0; }
		` ]
})
export class FacturacionShellComponent {
	private static readonly MODULE_ID = 'facturacion';

	private readonly guidedTour = inject(GuidedTourService);
	private readonly injector = inject(Injector);

	constructor() {
		if (!this.guidedTour.hasSeenTour(FacturacionShellComponent.MODULE_ID)) {
			afterNextRender(
				() => {
					void loadTourSteps(FacturacionShellComponent.MODULE_ID).then((steps) =>
						this.guidedTour.startTour(FacturacionShellComponent.MODULE_ID, steps)
					);
				},
				{ injector: this.injector }
			);
		}
	}

	protected startTourManually(): void {
		void loadTourSteps(FacturacionShellComponent.MODULE_ID).then((steps) =>
			this.guidedTour.startTour(FacturacionShellComponent.MODULE_ID, steps)
		);
	}
}
