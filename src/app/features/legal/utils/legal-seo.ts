import { DOCUMENT, DestroyRef, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { construirOrganizationJsonLd } from '../data/datos-empresa';

export interface SeoLegal {
  /** Se antepone a " | WinSuit" en el titulo de la pestana. */
  readonly titulo: string;
  readonly descripcion: string;
  /** Ruta absoluta de la pagina, para la URL canonica. Ej: '/legal/privacidad'. */
  readonly ruta: string;
  /** Solo la pagina de representante legal publica el JSON-LD de la organizacion. */
  readonly conJsonLd?: boolean;
}

const SITIO = 'https://winsuit.app';
const ID_JSON_LD = 'legal-organization-jsonld';

/**
 * Fija titulo, descripcion, canonica y (opcionalmente) el JSON-LD de la pagina legal,
 * y lo revierte al salir. index.html trae un <title>WinSuit</title> global y ninguna
 * meta descripcion, asi que cada pagina legal tiene que ponerlos por su cuenta.
 *
 * Debe llamarse dentro de un contexto de inyeccion (el constructor del componente).
 */
export function aplicarSeoLegal(seo: SeoLegal): void {
  const documento = inject(DOCUMENT);
  const destroyRef = inject(DestroyRef);
  const title = inject(Title);
  const meta = inject(Meta);

  const tituloPrevio = title.getTitle();
  title.setTitle(`${seo.titulo} | WinSuit`);

  const url = `${SITIO}${seo.ruta}`;
  meta.updateTag({ name: 'description', content: seo.descripcion });
  meta.updateTag({ name: 'robots', content: 'index, follow' });
  meta.updateTag({ property: 'og:type', content: 'website' });
  meta.updateTag({ property: 'og:title', content: `${seo.titulo} | WinSuit` });
  meta.updateTag({ property: 'og:description', content: seo.descripcion });
  meta.updateTag({ property: 'og:url', content: url });

  let canonica = documento.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const canonicaPropia = !canonica;
  if (!canonica) {
    canonica = documento.createElement('link');
    canonica.rel = 'canonical';
    documento.head.appendChild(canonica);
  }
  const canonicaPrevia = canonica.href;
  canonica.href = url;

  let jsonLd: HTMLScriptElement | null = null;
  if (seo.conJsonLd) {
    jsonLd = documento.createElement('script');
    jsonLd.type = 'application/ld+json';
    jsonLd.id = ID_JSON_LD;
    jsonLd.textContent = construirOrganizationJsonLd();
    documento.head.appendChild(jsonLd);
  }

  destroyRef.onDestroy(() => {
    title.setTitle(tituloPrevio);
    meta.removeTag('name="description"');
    meta.removeTag('name="robots"');
    meta.removeTag('property="og:type"');
    meta.removeTag('property="og:title"');
    meta.removeTag('property="og:description"');
    meta.removeTag('property="og:url"');

    if (canonicaPropia) {
      canonica?.remove();
    } else if (canonica) {
      canonica.href = canonicaPrevia;
    }

    jsonLd?.remove();
  });
}
