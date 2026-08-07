import { Injectable } from '@angular/core';

import { SpanishPaginatorIntl } from '../../services/spanish-paginator-intl';

/**
 * Intl del paginador propio de cada `app-data-table-frame`.
 *
 * Se provee a nivel de componente, no en el bootstrap: las tablas con paginacion por
 * cursor no conocen el total real de registros y necesitan una etiqueta distinta, pero
 * el resto de tablas de la aplicacion debe seguir viendo la etiqueta estandar.
 * Hereda de `SpanishPaginatorIntl` para conservar los textos traducidos.
 */
@Injectable()
export class DataTableFramePaginatorIntl extends SpanishPaginatorIntl {
  /** Si esta definida, sustituye la etiqueta de rango de este paginador. */
  rangeLabelFn: ((pageIndex: number, pageSize: number, length: number) => string) | null = null;

  constructor() {
    super();
    // `getRangeLabel` es un campo de instancia, no un metodo: para poder delegar en la
    // implementacion heredada hay que capturarla antes de reemplazarla.
    const porDefecto = this.getRangeLabel;
    this.getRangeLabel = (pageIndex: number, pageSize: number, length: number): string =>
      this.rangeLabelFn?.(pageIndex, pageSize, length) ?? porDefecto(pageIndex, pageSize, length);
  }
}
