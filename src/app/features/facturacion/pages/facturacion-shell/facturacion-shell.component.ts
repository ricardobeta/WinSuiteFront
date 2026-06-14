import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
	selector: 'app-facturacion-shell',
	standalone: true,
	imports: [RouterOutlet],
	template: `
		<section class="facturacion-shell">
			<header class="facturacion-hero surface-card">
				<div>
					<p class="eyebrow">Módulo Facturación Electrónica</p>
					<h1>Facturación</h1>
					<p>
						Centraliza el ciclo operativo de firmas, configuración tributaria y emisión de facturas electrónicas por tenant.
					</p>
				</div>
			</header>

			<main class="facturacion-content">
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
export class FacturacionShellComponent {}