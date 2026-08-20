import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../../../core/services/auth.service';
import { AuditService } from '../../../core/services/audit.service';
import { Producto } from '../models/inventario.models';
import { CostosService } from './costos.service';
import { KardexService } from './kardex.service';
import { ProductosService } from './productos.service';
import { RecetasService } from './recetas.service';

vi.mock('@angular/fire/database', () => ({
  Database: class Database {},
  ref: () => ({}),
  get: async () => ({ exists: () => false, val: () => null }),
  onValue: () => () => undefined,
  push: () => ({ key: 'mock-key' }),
  remove: async () => undefined,
  set: async () => undefined,
  update: async () => undefined,
  runTransaction: async (_reference: unknown, updater: (current: unknown) => unknown) => {
    const value = updater(null) as { token?: string } | null;
    return {
      committed: true,
      snapshot: {
        child: () => ({
          val: () => value?.token
        })
      }
    };
  }
}));

function producto(overrides: Partial<Producto>): Producto {
  return {
    sku: '',
    nombre: '',
    categoriaId: '',
    unidadId: '',
    metodoCosteo: 'PROMEDIO',
    precioCosto: 0,
    precioVenta: 0,
    ivaPorcentaje: 0,
    stockMinimo: 0,
    activo: true,
    ...overrides
  };
}

describe('RecetasService', () => {
  const productos = new Map<string, Producto>([
    ['americano', producto({
      id: 'americano',
      sku: 'REC-AMERICANO',
      nombre: 'Americano',
      tipo: 'RECETA',
      recetaItems: [
        { productoId: 'agua', cantidad: 10, unidadId: 'ml' },
        { productoId: 'cafe', cantidad: 8, unidadId: 'g' }
      ]
    })],
    ['agua', producto({ id: 'agua', sku: 'AGUA', nombre: 'Agua', unidadId: 'ml' })],
    ['cafe', producto({ id: 'cafe', sku: 'CAFE', nombre: 'Cafe', unidadId: 'g' })]
  ]);

  let service: RecetasService;
  let actualizarStock: ReturnType<typeof vi.fn>;
  let registrarMovimiento: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    actualizarStock = vi.fn().mockResolvedValue({ exito: true, saldo: 100 });
    registrarMovimiento = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        RecetasService,
        { provide: Database, useValue: {} },
        { provide: AuthService, useValue: { getTenantId: () => 'tenant-1' } },
        {
          provide: ProductosService,
          useValue: {
            getProductoById: vi.fn((id: string) => Promise.resolve(productos.get(id) ?? null))
          }
        },
        {
          provide: CostosService,
          useValue: { calcularCostoSalidaUnitario: vi.fn().mockResolvedValue(1) }
        },
        {
          provide: KardexService,
          useValue: { actualizarStock, registrarMovimiento }
        },
        { provide: AuditService, useValue: {} }
      ]
    });

    service = TestBed.inject(RecetasService);
  });

  it('descuenta una sola vez la cantidad vendida de cada ingrediente', async () => {
    await service.descontarInventarioReceta({
      recetaId: 'americano',
      almacenId: 'principal',
      cantidadRecetas: 2,
      motivo: 'VENTA',
      referenciaId: 'venta-1',
      creadoPor: 'vendedor-1',
      permitirInventarioNegativo: false
    });

    expect(actualizarStock).toHaveBeenCalledTimes(2);
    expect(actualizarStock).toHaveBeenCalledWith('agua', 'principal', -20, false);
    expect(actualizarStock).toHaveBeenCalledWith('cafe', 'principal', -16, false);

    expect(registrarMovimiento).toHaveBeenCalledTimes(2);
    expect(registrarMovimiento).toHaveBeenCalledWith(
      'agua',
      expect.objectContaining({ tipo: 'SALIDA', motivo: 'RECETA_VENTA', cantidad: 20 })
    );
    expect(registrarMovimiento).toHaveBeenCalledWith(
      'cafe',
      expect.objectContaining({ tipo: 'SALIDA', motivo: 'RECETA_VENTA', cantidad: 16 })
    );
  });
});
