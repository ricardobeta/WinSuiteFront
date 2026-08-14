import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, ref, set } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';
import {
  CAMPOS_BASE_CLIENTE,
  COLORES_ETIQUETA_CLIENTE,
  CampoFormularioClienteKey,
  CampoPersonalizado,
  ColorEtiquetaCliente,
  ConfiguracionClientes,
  EtiquetaClienteConfig
} from '../../shared/models/clientes.models';
import { textoComparableEtiqueta } from '../../shared/utils/etiquetas-clientes.utils';

export { textoComparableEtiqueta } from '../../shared/utils/etiquetas-clientes.utils';

export const ORDEN_FORMULARIO_CLIENTE_PREDETERMINADO: readonly CampoFormularioClienteKey[] = [
  ...CAMPOS_BASE_CLIENTE
];

export function ordenFormularioPredeterminado(campos: CampoPersonalizado[]): CampoFormularioClienteKey[] {
  return [
    ...ORDEN_FORMULARIO_CLIENTE_PREDETERMINADO,
    ...ordenarCampos(campos).map((campo) => `custom:${campo.idCampo}` as const)
  ];
}

export function normalizarConfiguracionClientes(value: unknown): ConfiguracionClientes {
  const raw = esRegistro(value) ? value : {};
  const campos = normalizarCampos(raw['camposPersonalizados']);
  const catalogoEtiquetas = normalizarCatalogoEtiquetas(raw['catalogoEtiquetas']);

  return {
    camposPersonalizados: campos,
    catalogoEtiquetas,
    ordenFormulario: normalizarOrdenFormulario(raw['ordenFormulario'], campos)
  };
}

function normalizarCampos(value: unknown): CampoPersonalizado[] {
  if (!Array.isArray(value)) return [];

  return ordenarCampos(value.flatMap((rawCampo, index) => {
    if (!esRegistro(rawCampo)) return [];
    const idCampo = texto(rawCampo['idCampo']);
    const nombreMostrar = texto(rawCampo['nombreMostrar']);
    const tipo = texto(rawCampo['tipo']) as CampoPersonalizado['tipo'];
    if (!idCampo || !nombreMostrar || !tipo) return [];

    const campo: CampoPersonalizado = { idCampo, nombreMostrar, tipo };
    if (typeof rawCampo['requerido'] === 'boolean') campo.requerido = rawCampo['requerido'];
    campo.orden = typeof rawCampo['orden'] === 'number' ? rawCampo['orden'] : index;
    if (typeof rawCampo['visibleEnLista'] === 'boolean') campo.visibleEnLista = rawCampo['visibleEnLista'];
    if (typeof rawCampo['activo'] === 'boolean') campo.activo = rawCampo['activo'];

    if (Array.isArray(rawCampo['opciones'])) {
      campo.opciones = rawCampo['opciones'].flatMap((rawOpcion) => {
        if (!esRegistro(rawOpcion)) return [];
        const clave = texto(rawOpcion['clave']);
        const valor = texto(rawOpcion['valor']);
        return clave && valor ? [{ clave, valor }] : [];
      });
    }

    return [campo];
  }));
}

function normalizarCatalogoEtiquetas(value: unknown): EtiquetaClienteConfig[] {
  if (!Array.isArray(value)) return [];

  const ids = new Set<string>();
  const nombres = new Set<string>();
  return value.flatMap((rawEtiqueta) => {
    if (!esRegistro(rawEtiqueta)) return [];
    const idEtiqueta = texto(rawEtiqueta['idEtiqueta']);
    const nombre = texto(rawEtiqueta['nombre']);
    if (!idEtiqueta || !nombre) return [];

    const nombreComparable = textoComparableEtiqueta(nombre);
    if (ids.has(idEtiqueta) || nombres.has(nombreComparable)) return [];
    ids.add(idEtiqueta);
    nombres.add(nombreComparable);

    const rawColor = texto(rawEtiqueta['color']);
    const color = COLORES_ETIQUETA_CLIENTE.includes(rawColor as ColorEtiquetaCliente)
      ? rawColor as ColorEtiquetaCliente
      : 'teal';

    return [{
      idEtiqueta,
      nombre,
      color,
      activa: rawEtiqueta['activa'] !== false
    } satisfies EtiquetaClienteConfig];
  });
}

function normalizarOrdenFormulario(value: unknown, campos: CampoPersonalizado[]): CampoFormularioClienteKey[] {
  const conocidas = new Set<CampoFormularioClienteKey>(ordenFormularioPredeterminado(campos));
  const resultado: CampoFormularioClienteKey[] = [];
  const vistas = new Set<CampoFormularioClienteKey>();

  if (Array.isArray(value)) {
    for (const rawKey of value) {
      if (typeof rawKey !== 'string') continue;
      const key = rawKey as CampoFormularioClienteKey;
      if (!conocidas.has(key) || vistas.has(key)) continue;
      vistas.add(key);
      resultado.push(key);
    }
  }

  for (const key of ordenFormularioPredeterminado(campos)) {
    if (!vistas.has(key)) resultado.push(key);
  }
  return resultado;
}

function ordenarCampos(campos: CampoPersonalizado[]): CampoPersonalizado[] {
  return [...campos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

function esRegistro(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function texto(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const resultado = String(value).trim();
  return resultado || null;
}

@Injectable({ providedIn: 'root' })
export class ConfiguracionClientesService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getConfigPath(): string {
    return `clientes/${this.authService.getTenantId()}/configuracion`;
  }

  getConfiguracion(): Observable<ConfiguracionClientes> {
    return new Observable<ConfiguracionClientes>((subscriber) => {
      const unsubscribe = onValue(
        ref(this.database, this.getConfigPath()),
        (snapshot) => subscriber.next(normalizarConfiguracionClientes(snapshot.exists() ? snapshot.val() : null)),
        (error) => subscriber.error(error)
      );
      return () => unsubscribe();
    });
  }

  async guardarConfiguracion(config: ConfiguracionClientes): Promise<void> {
    await set(ref(this.database, this.getConfigPath()), normalizarConfiguracionClientes(config));
  }

  async agregarCampo(campo: CampoPersonalizado): Promise<void> {
    const config = await this.getConfiguracionOnce();
    const nuevoCampo = { ...campo, orden: config.camposPersonalizados.length };
    const camposPersonalizados = ordenarCampos([...config.camposPersonalizados, nuevoCampo]);
    await this.guardarConfiguracion({
      ...config,
      camposPersonalizados,
      ordenFormulario: [...config.ordenFormulario, `custom:${campo.idCampo}`]
    });
  }

  async actualizarCampo(campo: CampoPersonalizado): Promise<void> {
    const config = await this.getConfiguracionOnce();
    const camposPersonalizados = ordenarCampos(config.camposPersonalizados
      .map((existente) => existente.idCampo === campo.idCampo
        ? { ...campo, orden: existente.orden ?? campo.orden }
        : existente));
    await this.guardarConfiguracion({ ...config, camposPersonalizados });
  }

  async eliminarCampo(idCampo: string): Promise<void> {
    const config = await this.getConfiguracionOnce();
    const camposPersonalizados = config.camposPersonalizados.filter((campo) => campo.idCampo !== idCampo);
    await this.guardarConfiguracion({
      ...config,
      camposPersonalizados,
      ordenFormulario: config.ordenFormulario.filter((key) => key !== `custom:${idCampo}`)
    });
  }

  async agregarEtiqueta(etiqueta: EtiquetaClienteConfig): Promise<void> {
    const config = await this.getConfiguracionOnce();
    this.validarNombreEtiqueta(etiqueta.nombre, config.catalogoEtiquetas);
    await this.guardarConfiguracion({
      ...config,
      catalogoEtiquetas: [...config.catalogoEtiquetas, { ...etiqueta, nombre: etiqueta.nombre.trim(), activa: true }]
    });
  }

  async actualizarEtiqueta(etiqueta: EtiquetaClienteConfig): Promise<void> {
    const config = await this.getConfiguracionOnce();
    this.validarNombreEtiqueta(etiqueta.nombre, config.catalogoEtiquetas, etiqueta.idEtiqueta);
    await this.guardarConfiguracion({
      ...config,
      catalogoEtiquetas: config.catalogoEtiquetas.map((existente) =>
        existente.idEtiqueta === etiqueta.idEtiqueta
          ? { ...etiqueta, nombre: etiqueta.nombre.trim() }
          : existente)
    });
  }

  async cambiarEstadoEtiqueta(idEtiqueta: string, activa: boolean): Promise<void> {
    const config = await this.getConfiguracionOnce();
    await this.guardarConfiguracion({
      ...config,
      catalogoEtiquetas: config.catalogoEtiquetas.map((etiqueta) =>
        etiqueta.idEtiqueta === idEtiqueta ? { ...etiqueta, activa } : etiqueta)
    });
  }

  async guardarOrdenFormulario(ordenFormulario: CampoFormularioClienteKey[]): Promise<void> {
    const config = await this.getConfiguracionOnce();
    await this.guardarConfiguracion({ ...config, ordenFormulario });
  }

  async restablecerOrdenFormulario(): Promise<void> {
    const config = await this.getConfiguracionOnce();
    await this.guardarConfiguracion({
      ...config,
      ordenFormulario: ordenFormularioPredeterminado(config.camposPersonalizados)
    });
  }

  private validarNombreEtiqueta(
    nombre: string,
    existentes: EtiquetaClienteConfig[],
    excluirId?: string
  ): void {
    const comparable = textoComparableEtiqueta(nombre);
    if (!comparable) throw new Error('Escribe un nombre para la etiqueta.');
    if (existentes.some((item) => item.idEtiqueta !== excluirId && textoComparableEtiqueta(item.nombre) === comparable)) {
      throw new Error('Ya existe una etiqueta con ese nombre.');
    }
  }

  private async getConfiguracionOnce(): Promise<ConfiguracionClientes> {
    const snapshot = await get(ref(this.database, this.getConfigPath()));
    return normalizarConfiguracionClientes(snapshot.exists() ? snapshot.val() : null);
  }
}
