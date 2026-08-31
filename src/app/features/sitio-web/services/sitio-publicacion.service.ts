import { Injectable, inject } from '@angular/core';
import { Database, get, ref, update } from 'firebase/database';
import { FormularioDef, PaginaDoc, migrarPagina, temaSitioSchema, SitioConfig } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';
import { SitioBorradorService } from './sitio-borrador.service';
import { CatalogoPublicacionService } from './catalogo-publicacion.service';
import { FormulariosService } from './formularios.service';
import { SITES_DATABASE } from '../../../core/firebase/sites-firebase.tokens';
import { SitesFirebaseSessionService } from '../../../core/services/sites-firebase-session.service';

@Injectable({ providedIn: 'root' })
export class SitioPublicacionService {
  private readonly database = inject(SITES_DATABASE);
  private readonly authService = inject(AuthService);
  private readonly borradorService = inject(SitioBorradorService);
  private readonly catalogoService = inject(CatalogoPublicacionService);
  private readonly formulariosService = inject(FormulariosService);
  private readonly sitesSession = inject(SitesFirebaseSessionService);

  /**
   * Publica el borrador: valida con Zod (bloquea si falla), copia borrador -> publicado,
   * refresca el snapshot del catalogo (si es ecommerce) e incrementa publicaciones/{t}/{sitioId}.
   * Todo en un update() multipath atomico.
   */
  async publicar(config: SitioConfig): Promise<number> {
    await this.sitesSession.ensureReady();
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

    const release = {
      meta: { version: nuevaVersion, publicadoEn: ahora, publicadoPor: uid },
      tema: borrador.tema,
      paginas: paginasValidadas,
      // Snapshot derivado: las definiciones canonicas permanecen en el proyecto principal.
      formularios: await this.formulariosUsados(Object.values(paginasValidadas)),
    };

    // La version se escribe primero. Solo cuando termina se cambia el puntero visible.
    await update(ref(this.database), {
      [`sitios/${tenantId}/${sitioId}/releases/${nuevaVersion}`]: this.sinUndefined(release),
    });

    const cambios: Record<string, unknown> = {
      [`sitios/${tenantId}/${sitioId}/activeVersion`]: nuevaVersion,
      [`sitios_resumen/${tenantId}/${sitioId}/versionPublicada`]: nuevaVersion,
      [`publicaciones/${tenantId}/${sitioId}`]: { version: nuevaVersion, publicadoEn: ahora },
    };

    if (config.tipo === 'ecommerce') {
      Object.assign(cambios, await this.catalogoService.cambiosRefrescoCatalogo());
    }

    await update(ref(this.database), cambios);
    return nuevaVersion;
  }

  /**
   * RTDB rechaza el update() completo si encuentra un undefined en cualquier nivel.
   * Un opcional ausente y un opcional en undefined significan lo mismo: se omite la clave.
   */
  private sinUndefined<T>(valor: T): T {
    if (Array.isArray(valor)) {
      return valor.filter((item) => item !== undefined).map((item) => this.sinUndefined(item)) as T;
    }
    if (valor !== null && typeof valor === 'object') {
      return Object.fromEntries(
        Object.entries(valor as Record<string, unknown>)
          .filter(([, item]) => item !== undefined)
          .map(([clave, item]) => [clave, this.sinUndefined(item)]),
      ) as T;
    }
    return valor;
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
      Object.entries(todos)
        .filter(([id]) => ids.has(id))
        // La integracion apagada no viaja al snapshot publicado: el renderer no la usa
        // y sus mapeos solo le interesan al editor.
        .map(([id, formulario]): [string, FormularioDef] => {
          if (formulario.integracionClientes?.habilitada) return [id, formulario];
          const { integracionClientes: _apagada, ...resto } = formulario;
          return [id, resto];
        }),
    );
    return Object.keys(usados).length > 0 ? usados : null;
  }
}
