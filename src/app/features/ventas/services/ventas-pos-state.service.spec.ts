import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/services/auth.service';
import { CarritoItem } from '../models/ventas.models';
import { VentasPosStateService } from './ventas-pos-state.service';

function item(
  productoId: string,
  cantidad: number,
  itemTipo: CarritoItem['itemTipo'] = 'PRODUCTO'
): CarritoItem {
  return {
    itemTipo,
    productoId,
    sku: productoId,
    nombre: productoId,
    cantidad,
    precioUnitario: 10,
    costoUnitario: 4,
    descuentoItem: 0,
    ivaPorcentaje: 12,
    stockDisponible: 20
  };
}

describe('VentasPosStateService', () => {
  const tenantId = signal<string | null>('tenant-1');
  const currentUser = signal<{ uid: string } | null>({ uid: 'usuario-1' });
  let service: VentasPosStateService;

  beforeEach(() => {
    localStorage.clear();
    tenantId.set('tenant-1');
    currentUser.set({ uid: 'usuario-1' });
    TestBed.configureTestingModule({
      providers: [
        VentasPosStateService,
        {
          provide: AuthService,
          useValue: { tenantId, currentUser }
        }
      ]
    });
    service = TestBed.inject(VentasPosStateService);
    TestBed.tick();
  });

  it('resta en una sola operación lo cobrado y elimina las líneas agotadas', () => {
    service.agregarItem(item('producto-1', 5));
    service.agregarItem(item('producto-1', 2, 'RECETA'));

    service.descontarItemsCobrados([
      item('producto-1', 2),
      item('producto-1', 2, 'RECETA')
    ]);

    expect(service.carrito().items).toEqual([
      expect.objectContaining({
        productoId: 'producto-1',
        itemTipo: 'PRODUCTO',
        cantidad: 3
      })
    ]);

    const guardadas = JSON.parse(
      localStorage.getItem('winsuite.pos.v2.tenant-1.usuario-1.tabs') ?? '[]'
    );
    expect(guardadas[0].carrito.items[0].cantidad).toBe(3);
  });

  it('nunca deja cantidades negativas aunque reciba una resta mayor', () => {
    service.agregarItem(item('producto-2', 1));

    service.descontarItemsCobrados([item('producto-2', 4)]);

    expect(service.carrito().items).toEqual([]);
  });

  it('aísla las pestañas y el carrito por empresa', () => {
    service.agregarItem(item('producto-empresa-1', 2));

    tenantId.set('tenant-2');
    expect(service.contextoListo()).toBe(false);
    expect(service.carrito().items).toEqual([]);
    TestBed.tick();

    expect(service.contextoListo()).toBe(true);
    expect(service.carrito().items).toEqual([]);
    service.agregarItem(item('producto-empresa-2', 1));

    tenantId.set('tenant-1');
    expect(service.carrito().items).toEqual([]);
    TestBed.tick();

    expect(service.carrito().items).toEqual([
      expect.objectContaining({ productoId: 'producto-empresa-1', cantidad: 2 })
    ]);
  });

  it('descarta el almacenamiento legado sin empresa identificable', () => {
    localStorage.setItem('winsuite.pos.tabs', JSON.stringify([{ nombre: 'Otra empresa' }]));
    localStorage.setItem('winsuite.pos.activeTabId', JSON.stringify('tab-ajena'));

    tenantId.set('tenant-2');
    TestBed.tick();

    expect(service.carrito().items).toEqual([]);
    expect(localStorage.getItem('winsuite.pos.tabs')).toBeNull();
    expect(localStorage.getItem('winsuite.pos.activeTabId')).toBeNull();
  });

  it('limita las notas a 300 caracteres al escribir y al retomar una cuenta', () => {
    service.setNotas('a'.repeat(301));

    expect(service.carrito().notas).toHaveLength(300);

    service.cargarCarrito({
      ...service.carrito(),
      notas: 'b'.repeat(350)
    });

    expect(service.carrito().notas).toBe('b'.repeat(300));
  });
});
