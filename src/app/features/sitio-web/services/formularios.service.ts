import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, ref, remove, set } from '@angular/fire/database';
import { Observable } from 'rxjs';
import { CampoFormulario, FormSubmission, FormularioDef, formularioDefSchema } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Formularios prehechos de la EMPRESA (sitios_formularios/{tenantId}), compartidos entre
 * todos sus sitios. El bloque 'formulario' solo referencia el formularioId; al publicar,
 * las definiciones usadas se embeben en el snapshot publicado.
 */
@Injectable({ providedIn: 'root' })
export class FormulariosService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

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
    await set(ref(this.database, `${this.getTenantPath()}/${formulario.formularioId}`), validado);
  }

  async eliminar(formularioId: string): Promise<void> {
    await remove(ref(this.database, `${this.getTenantPath()}/${formularioId}`));
  }

  getRespuestas(formularioId: string): Observable<FormSubmission[]> {
    const tenantId = this.authService.getTenantId();
    return new Observable<FormSubmission[]>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, `form_submissions/${tenantId}/${formularioId}`),
        (snapshot) => {
          const valor = (snapshot.val() ?? {}) as Record<string, FormSubmission>;
          const respuestas = Object.entries(valor)
            .map(([id, respuesta]) => ({ ...respuesta, id }))
            .sort((a, b) => b.creadoEn - a.creadoEn);
          subscriber.next(respuestas);
        },
        (error) => subscriber.error(error),
      );
      return () => unsubscribe();
    });
  }

  /** RTDB elimina arrays vacios: restaura campos/opciones. */
  private normalizar(formulario: FormularioDef): FormularioDef {
    const campos = Array.isArray(formulario.campos)
      ? formulario.campos
      : (Object.values(formulario.campos ?? {}) as CampoFormulario[]);
    return {
      ...formulario,
      campos: campos.map((campo) =>
        campo.tipo === 'seleccion'
          ? { ...campo, opciones: Array.isArray(campo.opciones) ? campo.opciones : [] }
          : campo,
      ),
    };
  }
}
