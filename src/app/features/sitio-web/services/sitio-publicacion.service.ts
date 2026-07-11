import { Injectable, inject } from '@angular/core';
import { Database, get, ref, update } from '@angular/fire/database';
import { FormularioDef, PaginaDoc, migrarPagina, temaSitioSchema, SitioConfig } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';
import { SitioBorradorService } from './sitio-borrador.service';
import { CatalogoPublicacionService } from './catalogo-publicacion.service';
import { FormulariosService } from './formularios.service';

@Injectable({ providedIn: 'root' })
export class SitioPublicacionService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly borradorService = inject(SitioBorradorService);
  private readonly catalogoService = inject(CatalogoPublicacionService);
  private readonly formulariosService = inject(FormulariosService);

  /**
   * Publica el borrador: valida con Zod (bloquea si falla), copia borrador -> publicado,
   * refresca el snapshot del catalogo (si es ecommerce) e incrementa publicaciones/{t}/{sitioId}.
   * Todo en un update() multipath atomico.
   */
  async publicar(config: SitioConfig): Promise<number> {
    const tenantId = this.authService.getTenantId();
    const sitioId = config.sitioId;

    const borrador = await this.borradorService.cargar(sitioId);
    if (!borrador) {
      throw new Error('No hay borrador para publicar.');
    }

    // Validacion estricta: cualquier pagina o tema invalido bloquea la publicacion.
    temaSitioSchema.parse(borrador.tema);
    const paginasValidadas = Object.fromEntries(
      Object.entries(borrador.paginas).map(([id, pagina]) => [id, migrarPagina(pagina)]),
    );

    const versionActual = await get(
      ref(this.database, `publicaciones/${tenantId}/${sitioId}/version`),
    );
    const nuevaVersion = (Number(versionActual.val()) || 0) + 1;
    const ahora = Date.now();
    const uid = this.authService.currentUser()?.uid ?? '';

    const cambios: Record<string, unknown> = {
      [`sitios/${tenantId}/${sitioId}/publicado`]: {
        meta: { version: nuevaVersion, publicadoEn: ahora, publicadoPor: uid },
        tema: borrador.tema,
        paginas: paginasValidadas,
        // Definiciones de formularios prehechos usados: el renderer no lee sitios_formularios.
        formularios: await this.formulariosUsados(Object.values(paginasValidadas)),
      },
      [`publicaciones/${tenantId}/${sitioId}`]: { version: nuevaVersion, publicadoEn: ahora },
    };

    if (config.tipo === 'ecommerce') {
      Object.assign(cambios, await this.catalogoService.cambiosRefrescoCatalogo());
    }

    await update(ref(this.database), cambios);
    return nuevaVersion;
  }

  /** Definiciones de los formularios prehechos referenciados por los bloques de las paginas. */
  private async formulariosUsados(
    paginas: PaginaDoc[],
  ): Promise<Record<string, FormularioDef> | null> {
    const ids = new Set<string>();
    for (const pagina of paginas) {
      for (const bloque of pagina.bloques) {
        if (bloque.tipo === 'formulario') ids.add(bloque.formularioId);
        if (bloque.tipo === 'lienzo') {
          for (const elemento of bloque.elementos) {
            if (elemento.tipo === 'formulario') ids.add(elemento.formularioId);
          }
        }
      }
    }
    if (ids.size === 0) return null;
    const todos = await this.formulariosService.getFormulariosUnaVez();
    const usados = Object.fromEntries(
      Object.entries(todos).filter(([id]) => ids.has(id)),
    );
    return Object.keys(usados).length > 0 ? usados : null;
  }
}
