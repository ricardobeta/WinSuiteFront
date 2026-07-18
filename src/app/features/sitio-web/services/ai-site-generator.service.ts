import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Bloque, ContenidoSitio, TemaSitio, TipoSitio } from '@winsuite/bloques';
import { environment } from '../../../../environments/environment';
import { LienzoPlantillaId } from '../config/lienzo-plantillas';

export interface AiSiteBrief {
  type: TipoSitio;
  businessName: string;
  description: string;
  objective: string;
  audience: string;
  visualStyle: string;
  tone: string;
  features: string[];
  pages: string[];
  imageUrls: string[];
  notes: string;
}

export interface AiSiteBlueprintItem {
  title?: string;
  text?: string;
  value?: string;
  icon?: string;
  imageIndex?: number;
  price?: number;
  period?: string;
  features?: string[];
}

export interface AiSiteBlueprintColumn {
  title?: string;
  text?: string;
  imageIndex?: number;
  ctaText?: string;
  ctaLink?: string;
}

export interface AiSiteBlueprintCanvas {
  template: LienzoPlantillaId;
  slots?: {
    titulo?: string;
    subtitulo?: string;
    ctaText?: string;
    ctaLink?: string;
    imageIndex?: number;
    imageIndexes?: number[];
  };
}

export interface AiSiteBlueprintFormField {
  label: string;
  type: 'texto' | 'email' | 'telefono' | 'textarea' | 'seleccion';
  required: boolean;
  options?: string[];
}

/** Especificacion del formulario que la plataforma crea de verdad al aplicar el diseno. */
export interface AiSiteBlueprintForm {
  name: string;
  fields: AiSiteBlueprintFormField[];
  successMessage?: string;
}

export interface AiSiteBlueprintTextStyle {
  color?: string;
  font?: 'system' | 'inter' | 'poppins' | 'montserrat' | 'playfair' | 'roboto';
  sizePx?: number;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface AiSiteBlueprintSectionStyle {
  /** Color exacto por seccion; no modifica el tema global. */
  background?: string;
  title?: AiSiteBlueprintTextStyle;
  text?: AiSiteBlueprintTextStyle;
  button?: AiSiteBlueprintTextStyle & { background?: string };
}

export interface AiSiteBlueprintSection {
  type: 'hero' | 'features' | 'products' | 'testimonials' | 'gallery' | 'text' | 'cta' |
    'faq' | 'statistics' | 'team' | 'plans' | 'payment' | 'contact' | 'map' | 'logos' |
    'carousel' | 'image' | 'video' | 'button' | 'columns' | 'canvas' | 'html' |
    'paycta' | 'countdown' | 'spacer';
  title?: string;
  text?: string;
  ctaText?: string;
  ctaLink?: string;
  variant?: string;
  anchor?: string;
  style?: AiSiteBlueprintSectionStyle;
  divider?: 'none' | 'wave' | 'diagonal' | 'curve';
  /** Fondo de la seccion: tintes/degradados claros que alternan el ritmo visual. */
  background?: 'none' | 'suave' | 'suave-acento' | 'degradado' | 'degradado-acento';
  imageIndex?: number;
  imageIndexes?: number[];
  /** 1-3 palabras que describen la foto ideal; guia las imagenes de muestra. */
  imageHint?: string;
  videoId?: string;
  html?: string;
  heightPx?: number;
  countdownDate?: string;
  address?: string;
  phone?: string;
  hours?: string;
  email?: string;
  canvas?: AiSiteBlueprintCanvas;
  columns?: AiSiteBlueprintColumn[];
  form?: AiSiteBlueprintForm;
  items?: AiSiteBlueprintItem[];
}

export interface AiSiteBlueprint {
  concept: string;
  theme: {
    primary: string;
    accent: string;
    background: string;
    text: string;
    headingFont: string;
    bodyFont: string;
    cornerStyle: string;
  };
  pages: { title: string; slug: string; sections: AiSiteBlueprintSection[] }[];
}

export interface AiSiteChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiSiteChatRequest {
  /** null = la IA descubre el tipo conversando; obligatorio en refinamiento. */
  type: TipoSitio | null;
  messages: AiSiteChatMessage[];
  imageUrls: string[];
  /** null = fase conversacion; con blueprint el ultimo mensaje user es la instruccion de refinamiento. */
  blueprint: AiSiteBlueprint | null;
  /** Documento real del editor. Si existe, el backend devuelve operaciones acotadas. */
  currentContent: ContenidoSitio | null;
}

export type AiSiteEditOperation =
  | { op: 'patch-theme'; patch: Partial<TemaSitio> & Record<string, unknown> }
  | { op: 'patch-block'; pageId: string; blockId: string; patch: Record<string, unknown> }
  | { op: 'insert-block'; pageId: string; afterBlockId?: string | null; block: Bloque }
  | { op: 'move-block'; pageId: string; blockId: string; afterBlockId?: string | null }
  | { op: 'delete-block'; pageId: string; blockId: string };

export interface AiSiteChatResponse {
  mode: 'ask' | 'generate' | 'edit';
  message: string;
  suggestions: string[];
  requestImages: boolean;
  blueprint: AiSiteBlueprint | null;
  operations: AiSiteEditOperation[];
  /** Tipo resuelto por la IA: nunca null cuando mode='generate'. */
  siteType: TipoSitio | null;
  inputTokens: number;
  outputTokens: number;
}

@Injectable({ providedIn: 'root' })
export class AiSiteGeneratorService {
  private readonly http = inject(HttpClient);
  private readonly baseEndpoint = `${environment.apiBaseUrl}/api/tenants/current/ai/sites`;

  generate(brief: AiSiteBrief): Observable<AiSiteBlueprint> {
    return this.http.post<unknown>(`${this.baseEndpoint}/draft`, brief).pipe(
      map(response => this.readBlueprint(response)),
    );
  }

  chat(request: AiSiteChatRequest): Observable<AiSiteChatResponse> {
    return this.http.post<AiSiteChatResponse>(`${this.baseEndpoint}/chat`, request).pipe(
      map(response => ({
        mode: response.mode === 'generate' ? 'generate' as const
          : response.mode === 'edit' ? 'edit' as const : 'ask' as const,
        message: typeof response.message === 'string' ? response.message : '',
        suggestions: Array.isArray(response.suggestions) ? response.suggestions : [],
        requestImages: response.requestImages === true,
        blueprint: response.mode === 'generate' && response.blueprint
          ? this.readBlueprint(response.blueprint)
          : null,
        operations: response.mode === 'edit' && Array.isArray(response.operations)
          ? response.operations
          : [],
        siteType: response.siteType === 'ecommerce' ? 'ecommerce' as const
          : response.siteType === 'landing' ? 'landing' as const : null,
        inputTokens: response.inputTokens ?? 0,
        outputTokens: response.outputTokens ?? 0,
      })),
    );
  }

  private readBlueprint(response: unknown): AiSiteBlueprint {
    const parsed = this.parseIfJsonString(response);
    const root = this.asRecord(parsed);
    const candidates = [
      parsed,
      root?.['blueprint'],
      root?.['data'],
      root?.['result'],
      root?.['response'],
      root?.['body'],
    ].map(value => this.parseIfJsonString(value));
    const blueprint = candidates.find(value => Array.isArray(this.asRecord(value)?.['pages']));
    const receivedKeys = root ? Object.keys(root) : [];

    console.info('[AI][sites-generador][HTTP_RESPONSE]', {
      receivedType: Array.isArray(parsed) ? 'array' : typeof parsed,
      receivedKeys,
      pages: blueprint ? (this.asRecord(blueprint)?.['pages'] as unknown[]).length : 0,
    });

    if (!blueprint) {
      console.error('[AI][sites-generador][INVALID_BLUEPRINT]', parsed);
      throw new Error('WinSuite recibio una respuesta de IA con un formato incompatible. Intenta nuevamente.');
    }
    return blueprint as unknown as AiSiteBlueprint;
  }

  private parseIfJsonString(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }
}
