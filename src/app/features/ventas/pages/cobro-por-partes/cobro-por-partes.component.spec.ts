import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { CarritoItem } from '../../models/ventas.models';
import { CobroPorPartesComponent, CobroPorPartesRequest } from './cobro-por-partes.component';

describe('CobroPorPartesComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CobroPorPartesComponent],
      providers: [{ provide: MatDialog, useValue: { open: vi.fn() } }]
    }).compileComponents();
  });

  it('emite únicamente la cantidad seleccionada para consumidor final', () => {
    const fixture = TestBed.createComponent(CobroPorPartesComponent);
    const producto: CarritoItem = {
      itemTipo: 'PRODUCTO',
      productoId: 'producto-1',
      sku: 'SKU-1',
      nombre: 'Producto de prueba',
      cantidad: 3,
      precioUnitario: 10,
      costoUnitario: 4,
      descuentoItem: 0,
      ivaPorcentaje: 12,
      stockDisponible: 10
    };
    fixture.componentRef.setInput('items', [producto]);
    fixture.componentRef.setInput('metodosPago', ['EFECTIVO']);
    fixture.componentRef.setInput('impuestoPorDefecto', 12);
    fixture.detectChanges();

    let emitido: CobroPorPartesRequest | undefined;
    fixture.componentInstance.cobrar.subscribe((request) => {
      emitido = request;
    });

    const element = fixture.nativeElement as HTMLElement;
    const sumar = element.querySelectorAll<HTMLButtonElement>('.quantity-btn')[1];
    sumar.click();
    fixture.detectChanges();

    const cobrar = [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Cobrar esta selección'));
    cobrar?.click();

    expect(emitido).toEqual(expect.objectContaining({
      clienteId: null,
      clienteNombre: 'CLIENTE FINAL',
      metodoPago: 'EFECTIVO'
    }));
    expect(emitido?.items).toEqual([
      expect.objectContaining({ productoId: 'producto-1', cantidad: 1 })
    ]);
  });

  it('muestra la tarifa del artículo y el desglose del IVA seleccionado', () => {
    const fixture = TestBed.createComponent(CobroPorPartesComponent);
    fixture.componentRef.setInput('items', [
      {
        itemTipo: 'PRODUCTO',
        productoId: 'producto-15',
        sku: 'IVA-15',
        nombre: 'Producto IVA 15',
        cantidad: 1,
        precioUnitario: 10,
        costoUnitario: 4,
        descuentoItem: 0,
        ivaPorcentaje: 15,
        stockDisponible: 10
      },
      {
        itemTipo: 'PRODUCTO',
        productoId: 'producto-5',
        sku: 'IVA-5',
        nombre: 'Producto IVA 5',
        cantidad: 1,
        precioUnitario: 20,
        costoUnitario: 8,
        descuentoItem: 0,
        ivaPorcentaje: 5,
        stockDisponible: 10
      }
    ] satisfies CarritoItem[]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const sumar = element.querySelectorAll<HTMLButtonElement>('.quantity-btn');
    sumar[1].click();
    sumar[3].click();
    fixture.detectChanges();

    const texto = element.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(texto).toContain('IVA 15%');
    expect(texto).toContain('IVA 5%');
    expect(texto).toContain('Tarifa 5%');
    expect(texto).toContain('Tarifa 15%');
    expect(texto).toContain('IVA total');
  });
});
