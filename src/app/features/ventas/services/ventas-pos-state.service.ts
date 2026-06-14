import { Injectable, computed, signal } from '@angular/core';

import { Cliente as ClienteModel } from '../../../shared/models/clientes.models';
import { CarritoItem, CarritoState, MetodoPagoState, MetodoPagoVenta, PosTabState } from '../models/ventas.models';

function getItemKey(productoId: string, itemTipo: CarritoItem['itemTipo'] = 'PRODUCTO'): string {
  return `${itemTipo}:${productoId}`;
}

const ESTADO_INICIAL: CarritoState = {
  items: [],
  clienteId: null,
  clienteNombre: null,
  descuentoGlobal: 0,
  notas: '',
  pagos: [{ metodo: 'EFECTIVO', monto: 0, referencia: '' }]
};

function crearCarritoInicial(): CarritoState {
  return {
    items: [],
    clienteId: null,
    clienteNombre: null,
    descuentoGlobal: 0,
    notas: '',
    pagos: [{ metodo: 'EFECTIVO', monto: 0, referencia: '' }]
  };
}

function crearPosTab(index: number): PosTabState {
  const random = Math.random().toString(36).slice(2, 9);
  return {
    id: `pos-tab-${Date.now()}-${random}`,
    nombre: `POS ${index}`,
    carrito: crearCarritoInicial()
  };
}

@Injectable({
  providedIn: 'root'
})
export class VentasPosStateService {
  private readonly tabsState = signal<PosTabState[]>([crearPosTab(1)]);
  readonly tabs = computed(() => this.tabsState());
  readonly activeTabId = signal<string>(this.tabsState()[0].id);
  private readonly storageKeyTabs = 'winsuite.pos.tabs';
  private readonly storageKeyActive = 'winsuite.pos.activeTabId';

  constructor() {
    this.loadFromLocalStorage();
  }

  readonly activeTab = computed(() => {
    const tab = this.tabsState().find((item) => item.id === this.activeTabId());
    return tab ?? this.tabsState()[0];
  });

  readonly carrito = computed<CarritoState>(() => this.activeTab()?.carrito ?? ESTADO_INICIAL);

  readonly subtotal = computed(() =>
    this.carrito().items.reduce((acum, item) => {
      const subtotalItem = item.precioUnitario * item.cantidad;
      const descuentoItem = this.montoDescuentoItem(item);
      return acum + (subtotalItem - descuentoItem);
    }, 0)
  );

  readonly totalDescuento = computed(() => {
    const descuentoItems = this.carrito().items.reduce((acum, item) => acum + this.montoDescuentoItem(item), 0);
    const descuentoGlobal = Math.max(0, this.subtotal() * (this.carrito().descuentoGlobal / 100));
    return descuentoItems + descuentoGlobal;
  });

  agregarTab(): string {
    const nextIndex = this.tabsState().length + 1;
    const tab = crearPosTab(nextIndex);

    this.tabsState.update((tabs) => [...tabs, tab]);
    this.activeTabId.set(tab.id);
    this.saveToLocalStorage();
    return tab.id;
  }

  seleccionarTab(tabId: string): void {
    if (!this.tabsState().some((tab) => tab.id === tabId)) {
      return;
    }

    this.activeTabId.set(tabId);
    this.saveToLocalStorage();
  }

  renombrarTab(tabId: string, nombre: string): void {
    const nuevoNombre = nombre.trim();
    if (!nuevoNombre) {
      return;
    }

    this.tabsState.update((tabs) =>
      tabs.map((tab) => (tab.id === tabId ? { ...tab, nombre: nuevoNombre.slice(0, 30) } : tab))
    );
    this.saveToLocalStorage();
  }

  cerrarTab(tabId: string): void {
    const tabs = this.tabsState();
    if (tabs.length <= 1) {
      return;
    }

    const nextTabs = tabs.filter((tab) => tab.id !== tabId);
    this.tabsState.set(nextTabs);

    if (this.activeTabId() === tabId) {
      this.activeTabId.set(nextTabs[0].id);
    }
    this.saveToLocalStorage();
  }

  setCliente(cliente: ClienteModel): void {
    this.updateActiveCarrito((state) => ({
      ...state,
      clienteId: cliente.id ?? null,
      clienteNombre: cliente.nombreCompleto
    }));
  }

  clearCliente(): void {
    this.updateActiveCarrito((state) => ({
      ...state,
      clienteId: null,
      clienteNombre: null
    }));
  }

  setDescuentoGlobal(descuentoGlobal: number): void {
    this.updateActiveCarrito((state) => ({
      ...state,
      descuentoGlobal: Number.isFinite(descuentoGlobal) ? Math.max(0, descuentoGlobal) : 0
    }));
  }

  setNotas(notas: string): void {
    this.updateActiveCarrito((state) => ({ ...state, notas }));
  }

  agregarItem(item: CarritoItem): void {
    this.updateActiveCarrito((state) => {
      const key = getItemKey(item.productoId, item.itemTipo);
      const index = state.items.findIndex((current) => getItemKey(current.productoId, current.itemTipo) === key);

      if (index === -1) {
        return {
          ...state,
          items: [...state.items, item]
        };
      }

      const nextItems = [...state.items];
      nextItems[index] = {
        ...nextItems[index],
        cantidad: nextItems[index].cantidad + item.cantidad,
        stockDisponible: item.stockDisponible
      };

      return {
        ...state,
        items: nextItems
      };
    });
  }

  actualizarCantidad(productoId: string, cantidad: number, itemTipo: CarritoItem['itemTipo'] = 'PRODUCTO'): void {
    this.updateActiveCarrito((state) => ({
      ...state,
      items: state.items.map((item) => {
        if (getItemKey(item.productoId, item.itemTipo) !== getItemKey(productoId, itemTipo)) {
          return item;
        }

        return {
          ...item,
          cantidad: Math.max(1, cantidad)
        };
      })
    }));
  }

  actualizarDescuentoItem(productoId: string, descuentoItem: number, itemTipo: CarritoItem['itemTipo'] = 'PRODUCTO'): void {
    this.updateActiveCarrito((state) => ({
      ...state,
      items: state.items.map((item) => {
        if (getItemKey(item.productoId, item.itemTipo) !== getItemKey(productoId, itemTipo)) {
          return item;
        }

        return {
          ...item,
          descuentoItem: Number.isFinite(descuentoItem) ? Math.max(0, descuentoItem) : 0
        };
      })
    }));
  }

  actualizarStockDisponible(productoId: string, stockDisponible: number, itemTipo: CarritoItem['itemTipo'] = 'PRODUCTO'): void {
    this.updateActiveCarrito((state) => ({
      ...state,
      items: state.items.map((item) =>
        getItemKey(item.productoId, item.itemTipo) === getItemKey(productoId, itemTipo)
          ? { ...item, stockDisponible: Math.max(0, stockDisponible) }
          : item
      )
    }));
  }

  removerItem(productoId: string, itemTipo: CarritoItem['itemTipo'] = 'PRODUCTO'): void {
    this.updateActiveCarrito((state) => ({
      ...state,
      items: state.items.filter((item) => getItemKey(item.productoId, item.itemTipo) !== getItemKey(productoId, itemTipo))
    }));
  }

  setPagos(pagos: MetodoPagoState[]): void {
    this.updateActiveCarrito((state) => ({
      ...state,
      pagos: pagos.map((pago) => ({
        ...pago,
        monto: this.roundToTwo(Number(pago.monto ?? 0))
      }))
    }));
  }

  agregarPago(metodo: MetodoPagoVenta = 'EFECTIVO'): void {
    this.updateActiveCarrito((state) => ({
      ...state,
      pagos: [...state.pagos, { metodo, monto: 0, referencia: '' }]
    }));
  }

  removerPago(index: number): void {
    this.updateActiveCarrito((state) => {
      if (state.pagos.length === 1) {
        return state;
      }

      return {
        ...state,
        pagos: state.pagos.filter((_, currentIndex) => currentIndex !== index)
      };
    });
  }

  limpiar(): void {
    this.updateActiveCarrito(() => crearCarritoInicial());
  }

  private updateActiveCarrito(updater: (state: CarritoState) => CarritoState): void {
    const activeId = this.activeTabId();

    this.tabsState.update((tabs) =>
      tabs.map((tab) => {
        if (tab.id !== activeId) {
          return tab;
        }

        return {
          ...tab,
          carrito: updater(tab.carrito)
        };
      })
    );
    this.saveToLocalStorage();
  }

  private loadFromLocalStorage(): void {
    try {
      const rawTabs = localStorage.getItem(this.storageKeyTabs);
      const rawActive = localStorage.getItem(this.storageKeyActive);

      if (rawTabs) {
        const parsed = JSON.parse(rawTabs) as PosTabState[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed.map((tab) => ({
            ...tab,
            carrito: {
              ...tab.carrito,
              items: (tab.carrito?.items ?? []).map((item) => ({
                ...item,
                itemTipo: item.itemTipo ?? 'PRODUCTO'
              })),
              pagos: (tab.carrito?.pagos ?? []).map((pago) => ({
                ...pago,
                monto: this.roundToTwo(Number(pago.monto ?? 0))
              }))
            }
          }));

          this.tabsState.set(normalized);
        }
      }

      if (rawActive) {
        try {
          const aid = String(JSON.parse(rawActive));
          if (this.tabsState().some((t) => t.id === aid)) {
            this.activeTabId.set(aid);
          }
        } catch {
          // ignore malformed
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(this.storageKeyTabs, JSON.stringify(this.tabsState()));
      localStorage.setItem(this.storageKeyActive, JSON.stringify(this.activeTabId()));
    } catch {
      // ignore quota/errors
    }
  }

  private montoDescuentoItem(item: CarritoItem): number {
    const base = item.precioUnitario * item.cantidad;
    return Math.min(base, base * (item.descuentoItem / 100));
  }

  private roundToTwo(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
