import { Injectable, inject } from '@angular/core';
import { Database, endAt, get, limitToLast, onValue, orderByKey, query, ref, remove, set } from '@angular/fire/database';
import { Observable } from 'rxjs';
import { CampoFormulario, FormSubmission, FormularioDef, MapeoClienteFormulario, formularioDefSchema } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';
import { ConfiguracionClientesService } from '../../../core/services/configuracion-clientes.service';

/**
 * Formularios prehechos de la EMPRESA (sitios_formularios/{tenantId}), compartidos entre
 * todos sus sitios. El bloque 'formulario' solo referencia el formularioId; al publicar,
 * las definiciones usadas se embeben en el snapshot publicado.
 */
@Injectable({ providedIn: 'root' })
export class FormulariosService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);
  private readonly configuracionClientes = inject(ConfiguracionClientesService);

  private getTenantPath(): string {
    return `sitios_formularios/${this.authService.getTenantId()}`;
  }

  getFormularios(): Observable<FormularioDef[]> {
    return new Observable<FormularioDef[]>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, this.getTenantPath()),
        (snapshot) => {
          const valor = (snapshot.val() ?? {}) as Record<string, FormularioDef>;
          const formularios = Object.values(valor)
            .filter((f) => !!f?.formularioId)
            .map((f) => this.normalizar(f))
            .sort((a, b) => a.creadoEn - b.creadoEn);
          subscriber.next(formularios);
        },
        (error) => subscriber.error(error),
      );
      return () => unsubscribe();
    });
  }

  async getFormulariosUnaVez(): Promise<Record<string, FormularioDef>> {
    const snapshot = await get(ref(this.database, this.getTenantPath()));
    const valor = (snapshot.val() ?? {}) as Record<string, FormularioDef>;
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([, f]) => !!f?.formularioId)
        .map(([id, f]) => [id, this.normalizar(f)]),
    );
  }

  crearFormulario(nombre: string): FormularioDef {
    const ahora = Date.now();
    return {
      formularioId: `f-${ahora.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      nombre,
      campos: [
        { id: 'nombre', tipo: 'texto', etiqueta: 'Nombre', requerido: true },
        { id: 'telefono', tipo: 'telefono', etiqueta: 'Telefono', requerido: true },
        { id: 'mensaje', tipo: 'textarea', etiqueta: 'Mensaje', requerido: false },
      ],
      mensajeExito: 'Gracias, te contactaremos pronto.',
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
  }

  async guardar(formulario: FormularioDef): Promise<void> {
    const validado = { ...formulario, actualizadoEn: Date.now() };
    formularioDefSchema.parse(validado);
    if (validado.integracionClientes?.habilitada) {
      await this.configuracionClientes.asegurarEtiquetaFormulario(
        validado.formularioId,
        validado.integracionClientes.etiquetaId,
        validado.nombre,
      );
    } else if (validado.integracionClientes) {
      await this.configuracionClientes.liberarEtiquetaFormulario(
        validado.formularioId,
        validado.integracionClientes.etiquetaId,
      );
    }
    await set(ref(this.database, `${this.getTenantPath()}/${formulario.formularioId}`), validado);
  }

  async eliminar(formularioId: string): Promise<void> {
    const snapshot = await get(ref(this.database, `${this.getTenantPath()}/${formularioId}`));
    const formulario = snapshot.exists() ? this.normalizar(snapshot.val() as FormularioDef) : null;
    if (formulario?.integracionClientes?.etiquetaId) {
      await this.configuracionClientes.liberarEtiquetaFormulario(
        formularioId,
        formulario.integracionClientes.etiquetaId,
      );
    }
    await remove(ref(this.database, `${this.getTenantPath()}/${formularioId}`));
  }

  getRespuestas(formularioId: string): Observable<FormSubmission[]> {
    return new Observable<FormSubmission[]>((subscriber) => {
      void this.getRespuestasPage(formularioId).then(
        (page) => {
          subscriber.next(page.items);
          subscriber.complete();
        },
        (error) => subscriber.error(error),
      );
    });
  }

  async getRespuestasPage(
    formularioId: string,
    limit = 25,
    cursor: string | null = null,
  ): Promise<{ items: FormSubmission[]; nextCursor: string | null; hasMore: boolean }> {
    const tenantId = this.authService.getTenantId();
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const constraints = [orderByKey()];
    if (cursor) constraints.push(endAt(cursor));
    constraints.push(limitToLast(boundedLimit + (cursor ? 2 : 1)));

    const snapshot = await get(
      query(ref(this.database, `form_submissions/${tenantId}/${formularioId}`), ...constraints),
    );
    const items: FormSubmission[] = [];
    snapshot.forEach((child) => {
      if (child.key !== cursor) {
        items.push({ ...(child.val() as FormSubmission), id: child.key ?? undefined });
      }
      return false;
    });
    const hasMore = items.length > boundedLimit;
    if (hasMore) items.shift();
    items.reverse();
    return {
      items,
      nextCursor: hasMore && items.length ? items.at(-1)?.id ?? null : null,
      hasMore,
    };
  }

  /** RTDB elimina arrays vacios: restaura campos/opciones. */
  private normalizar(formulario: FormularioDef): FormularioDef {
    const campos = Array.isArray(formulario.campos)
      ? formulario.campos
      : (Object.values(formulario.campos ?? {}) as CampoFormulario[]);
    const integracion = formulario.integracionClientes;
    return {
      ...formulario,
      // La clave nunca puede quedar en undefined: el update() multipath de la publicacion
      // rechaza el snapshot completo si encuentra un undefined.
      ...(integracion
        ? {
            integracionClientes: {
              ...integracion,
              mapeos: Array.isArray(integracion.mapeos)
                ? integracion.mapeos
                : (Object.values(integracion.mapeos ?? {}) as MapeoClienteFormulario[]),
            },
          }
        : {}),
      campos: campos.map((campo) =>
        campo.tipo === 'seleccion'
          ? { ...campo, opciones: Array.isArray(campo.opciones) ? campo.opciones : [] }
          : campo,
      ),
    };
  }
}
