# Design System Documentation: Tactile Clarity

## 1. Overview & Creative North Star
The "Tactile Clarity" system is designed to transform the often-dense landscape of CRM and ERP interfaces into a high-end, editorial experience. We are moving away from the "data-heavy spreadsheet" aesthetic toward a "Digital Atelier"—a space that feels bespoke, organized, and light. 

**Creative North Star: The Precision Atelier**
This system treats digital space like a physical, premium workspace. It prioritizes breathing room, intentional asymmetry, and a sophisticated layering of materials. We break the rigid, boxed-in feel of traditional dashboards by using high-contrast typography scales and overlapping surface elements that suggest depth without the clutter of structural lines.

---

## 2. Colors
Our palette is anchored in professional teals and clinical mints, balanced by a sophisticated range of architectural grays.

### The Palette (Material 3 Tokens)
*   **Primary (Teal/Mint):** `primary: #066b5e` | `primary_container: #a0f2e1` | `on_primary_container: #005d51`
*   **Neutral (Surfaces):** `surface: #f8f9fa` | `surface_container_low: #f1f4f5` | `surface_container_highest: #dee3e6` | `surface_container_lowest: #ffffff`
*   **Accents:** `tertiary: #3a647d` (used for secondary data streams)

### Color Strategy
*   **The "No-Line" Rule:** We do not use 1px solid borders to section off the UI. Boundaries must be defined through tonal shifts. A side navigation should sit on `surface_container_low` while the main canvas sits on `surface`. This creates a cleaner, more modern look that mimics natural light falling on different planes.
*   **Surface Hierarchy & Nesting:** Think of the UI as layers of fine paper. A main dashboard card (`surface_container_lowest`) should sit atop a `surface_container` background. This "nesting" creates an intuitive sense of importance without needing shadows for every element.
*   **The Glass & Gradient Rule:** To ensure the system feels "premium" rather than "default," use Glassmorphism for floating elements (e.g., dropdowns, modals) using semi-transparent `surface_container_lowest` with a `backdrop-blur` of 12px-20px. 
*   **Signature Textures:** For high-impact CTAs or data visualizations, utilize subtle linear gradients transitioning from `primary` to `primary_dim`. This adds a "soul" and depth to the interface that flat fills cannot achieve.

---

## 3. Typography
We utilize a dual-typeface system to achieve an editorial feel: **Manrope** for structure and **Inter** for utility.

*   **Display & Headline (Manrope):** Use `display-lg` (3.5rem) and `headline-md` (1.75rem) to create clear entry points. Manrope’s geometric qualities provide an architectural authority.
*   **Title & Body (Inter):** Use `title-md` (1.125rem) for section headers and `body-md` (0.875rem) for data. Inter is selected for its relentless legibility in dense CRM environments.
*   **Editorial Contrast:** Create visual interest by pairing a `label-sm` in all caps (letter-spacing: 0.05em) directly above a `headline-sm`. This hierarchy mimics high-end magazine layouts and guides the user’s eye through complex data sets.

---

## 4. Elevation & Depth
Depth in this design system is achieved through **Tonal Layering** rather than structural shadows.

*   **The Layering Principle:** 
    *   **Level 0 (Base):** `surface`
    *   **Level 1 (Sections):** `surface_container_low`
    *   **Level 2 (Cards/Content):** `surface_container_lowest` (Pure White)
*   **Ambient Shadows:** If a floating element (like a FAB or a Modal) requires a shadow, it must be "Ambient." Use a blur of 30px-60px with 4%-8% opacity. The shadow color should be a tinted version of `on_surface` (a deep slate) rather than pure black, ensuring the shadow feels like a natural part of the teal-toned environment.
*   **The "Ghost Border" Fallback:** If a container requires more definition (e.g., in high-density data tables), use a "Ghost Border." This is the `outline_variant` token at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components

### Buttons
*   **Primary:** `primary` fill with `on_primary` text. Use `full` (pill-shaped) or `xl` (1.5rem) roundedness to contrast with the more structured grid.
*   **Secondary:** `surface_container_high` fill. This feels more integrated than a standard outlined button.

### Inputs & Fields
*   **Styling:** Use `surface_container_highest` for the input background with a 0px border. Upon focus, transition to a "Ghost Border" of `primary` and a 2px bottom-accent.
*   **Checkboxes/Radios:** Use `primary` for the selected state. Ensure the `roundedness.sm` (0.25rem) is applied to checkboxes to maintain the system's softness.

### Cards & Lists
*   **No Dividers:** Forbid the use of 1px horizontal lines between list items. Instead, use vertical white space (8px-12px) or a subtle background hover state using `surface_container_low`.
*   **Card Styling:** Use `roundedness.lg` (1rem) for all dashboard cards. This high level of roundedness communicates a modern, approachable ERP experience.

### Contextual Components
*   **Metric Hero:** A large card using a subtle `primary` to `primary_container` gradient background with `on_primary_container` text for key CRM metrics (e.g., Total Revenue).
*   **Status Pills:** Use `tertiary_container` for neutral status and `error_container` for alerts, always with `on_container` text for accessibility.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical margins. A wider left margin on a header can create a sophisticated, editorial "entry point" for the eye.
*   **Do** leverage the `surface_tint` for subtle overlays on images or decorative backgrounds.
*   **Do** ensure all interactive elements have a minimum touch target of 44px, even on desktop, to maintain the "Tactile" feel.

### Don't
*   **Don't** use pure black (#000000) for text. Always use `on_surface` (#2d3335) to maintain tonal harmony with the teal palette.
*   **Don't** use standard Material 3 "elevated" shadows. Stick to the Tonal Layering and Ambient Shadow rules defined in Section 4.
*   **Don't** cram data. If a table feels tight, increase the `surface` padding rather than shrinking the font size. Respect the `body-md` minimum.
*   **Don't** use high-contrast dividers. Let the "negative space" do the work of organization.

---

## 7. Implementation File Map (What to Analyze First)

Use this list before implementing new UI work to keep consistency with Tactile Clarity.

### A. Global Design Source of Truth
*   `src/styles.scss`
    *   Base app variables (`--background`, `--primary`, radii, spacing).
    *   Global structural classes like `.surface-card`.
    *   Light/Dark runtime variables (`html.theme-dark`).
*   `src/styles/_tokens.scss`
    *   Tactile Clarity token layer (`--tc-*`) mapping to the design system palette.
    *   Core semantic tokens for surface hierarchy and accents.
*   `src/styles/_material-mapping.scss`
    *   Angular Material component mapping to Tactile tokens.
    *   Inputs, dialogs, buttons, tables, hover/focus states.

### B. Theme Runtime Control
*   `src/app/core/services/theme.service.ts`
    *   Handles light/dark mode and `data-theme` / `theme-dark` toggling.
    *   Must be updated whenever token switching behavior changes.

### C. Font & Typography Entry Points
*   `src/index.html`
    *   Font loading (Manrope + Inter).
*   `src/styles.scss` and feature-level `*.scss`
    *   Typographic scale usage (`display`, `headline`, `title`, `body`).

### D. Layout Shells (Highest UI Impact)
*   `src/app/features/workspace/layout/workspace-shell/workspace-shell.component.scss`
    *   Sidebar/main canvas tonal separation (`surface_container_low` vs `surface`).
    *   Navigation touch targets and interactive states.
*   `src/app/features/workspace/pages/workspace-page/workspace-page.component.scss`
    *   Default workspace canvas and placeholder composition.

### E. Feature Shells and Module Heroes
*   `src/app/features/clientes/pages/clientes-shell/clientes-shell.component.ts`
*   `src/app/features/facturacion/pages/facturacion-shell/facturacion-shell.component.ts`
*   `src/app/features/auth/pages/login-page/login-page.component.scss`
*   `src/app/features/auth/pages/register-page/register-page.component.scss`
    *   Validate card/hero layering, CTA hierarchy, and editorial spacing.

### F. Data-Dense Screens (No-Line Rule Validation)
*   `src/app/features/clientes/pages/lista-clientes/lista-clientes.component.ts`
*   `src/app/features/clientes/pages/configuracion-clientes/configuracion-clientes.component.ts`
*   `src/app/features/facturacion/pages/configuracion-facturacion-page/configuracion-facturacion-page.component.ts`
    *   Ensure list/table boundaries use spacing and tonal rows, not hard dividers.

### G. Dialogs and Forms (Glass + Input Rules)
*   `src/app/shared/components/cliente-form-dialog/cliente-form-dialog.component.ts`
*   `src/app/shared/components/agregar-campo-dialog/agregar-campo-dialog.component.ts`
*   `src/app/shared/components/confirm-dialog/confirm-dialog.component.ts`
*   `src/app/shared/components/campos-custom-form/campos-custom-form.component.ts`
    *   Confirm 0px border fields, ghost-focus behavior, and modal glass treatment.

### H. Recommended Analysis Order (Before Any New UI PR)
1. Verify palette and token values in `src/styles/_tokens.scss` against Section 2.
2. Verify Material mapping in `src/styles/_material-mapping.scss`.
3. Verify shell-level visual hierarchy in workspace + module shells.
4. Verify one data-heavy page and one form/dialog page for rule compliance.
5. Verify interactive elements keep minimum 44px touch targets.

---
*Document end.*