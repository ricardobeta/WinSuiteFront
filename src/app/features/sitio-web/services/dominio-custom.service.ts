import { Injectable, inject } from '@angular/core';
import { Database, get, ref, remove, runTransaction, update } from '@angular/fire/database';
import { DominioCustom, EntradaDominioCustom, escaparDominio } from '@winsuite/bloques';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Alta de dominio propio por sitio. En esta fase solo registra el dominio y genera el token;
 * la verificacion DNS (TXT _winsuite-verify + CNAME) y la emision de certificado se activan
 * en la fase de dominios custom del renderer.
 */
@Injectable({ providedIn: 'root' })
export class DominioCustomService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  async registrar(sitioId: string, dominio: string): Promise<DominioCustom> {
    const tenantId = this.authService.getTenantId();
    const dominioLimpio = dominio.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dominioLimpio)) {
      throw new Error('Dominio no valido. Ejemplo: mitienda.com');
    }
    const clave = escaparDominio(dominioLimpio);
    const token = `wsv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    const entrada: EntradaDominioCustom = {
      tenantId,
      sitioId,
      dominio: dominioLimpio,
      verificado: false,
      tokenVerificacion: token,
      creadoEn: Date.now(),
    };

    const resultado = await runTransaction(
      ref(this.database, `dominios_custom/${clave}`),
      (actual) => (actual === null ? entrada : undefined),
    );
    if (!resultado.committed) {
      throw new Error('Ese dominio ya esta registrado en otra cuenta.');
    }

    const dominioCustom: DominioCustom = {
      dominio: dominioLimpio,
      verificado: false,
      tokenVerificacion: token,
    };
    await update(ref(this.database), {
      [`sitios/${tenantId}/${sitioId}/config/dominioCustom`]: dominioCustom,
      [`sitios/${tenantId}/${sitioId}/config/actualizadoEn`]: Date.now(),
    });
    return dominioCustom;
  }

  async quitar(sitioId: string, dominio: string): Promise<void> {
    const tenantId = this.authService.getTenantId();
    const clave = escaparDominio(dominio);
    const entrada = await get(ref(this.database, `dominios_custom/${clave}`));
    if (entrada.exists() && (entrada.val() as EntradaDominioCustom).tenantId === tenantId) {
      await remove(ref(this.database, `dominios_custom/${clave}`));
    }
    await update(ref(this.database), {
      [`sitios/${tenantId}/${sitioId}/config/dominioCustom`]: null,
      [`sitios/${tenantId}/${sitioId}/config/actualizadoEn`]: Date.now(),
    });
  }
}
