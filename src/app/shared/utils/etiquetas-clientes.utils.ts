import { ColorEtiquetaCliente, EtiquetaClienteConfig } from '../models/clientes.models';

export function textoComparableEtiqueta(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es');
}

export interface EtiquetaClienteVista {
  valor: string;
  nombre: string;
  color: ColorEtiquetaCliente;
  historica: boolean;
  activa: boolean;
}

export function resolverEtiquetaCliente(
  valor: string,
  catalogo: EtiquetaClienteConfig[]
): EtiquetaClienteVista {
  const configurada = catalogo.find((item) =>
    item.idEtiqueta === valor || textoComparableEtiqueta(item.nombre) === textoComparableEtiqueta(valor));
  if (configurada) {
    return {
      valor,
      nombre: configurada.nombre,
      color: configurada.color,
      historica: false,
      activa: configurada.activa
    };
  }

  return { valor, nombre: valor, color: 'slate', historica: true, activa: false };
}

/**
 * Migra de forma oportunista etiquetas antiguas por nombre al identificador estable del catalogo.
 * Las que no tienen equivalencia se conservan intactas para no perder informacion historica.
 */
export function normalizarValoresEtiquetasCliente(
  valores: string[] | null | undefined,
  catalogo: EtiquetaClienteConfig[]
): string[] {
  const porNombre = new Map(
    catalogo.map((item) => [textoComparableEtiqueta(item.nombre), item.idEtiqueta])
  );
  const resultado: string[] = [];

  for (const rawValor of valores ?? []) {
    const valor = String(rawValor).trim();
    if (!valor) continue;
    const configurada = catalogo.some((item) => item.idEtiqueta === valor)
      ? valor
      : porNombre.get(textoComparableEtiqueta(valor)) ?? valor;
    if (!resultado.includes(configurada)) resultado.push(configurada);
  }
  return resultado;
}
