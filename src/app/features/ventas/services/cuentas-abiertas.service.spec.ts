import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import { CuentaAbierta } from '../models/ventas.models';
import { CuentasAbiertasService } from './cuentas-abiertas.service';

function cuenta(overrides: Partial<CuentaAbierta> = {}): CuentaAbierta {
  return {
    id: 'cuenta-1',
    almacenId: 'almacen-1',
    etiqueta: 'Mesa 1',
    carrito: {
      items: [],
      clienteId: null,
      clienteNombre: null,
      descuentoGlobal: 0,
      notas: '',
      pagos: []
    },
    abiertaPor: 'user-1',
    abiertaPorNombre: 'Usuario',
    abiertaEn: Date.now(),
    actualizadoEn: Date.now(),
    ...overrides
  };
}

describe('CuentasAbiertasService', () => {
  let service: CuentasAbiertasService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        CuentasAbiertasService,
        { provide: Database, useValue: {} },
        { provide: AuthService, useValue: { getTenantId: () => 'tenant-1' } }
      ]
    });
    service = TestBed.inject(CuentasAbiertasService);
  });

  it('genera un identificador nuevo para cada retención', () => {
    const primera = service.crearCuentaId();
    const segunda = service.crearCuentaId();

    expect(primera).toMatch(/^cuenta-/);
    expect(segunda).toMatch(/^cuenta-/);
    expect(primera).not.toBe(segunda);
  });

  it('distingue una cuenta tomada aquí de una tomada por otro dispositivo', () => {
    const tomadaEn = Date.now();
    const propia = cuenta({
      tomadaPorDispositivo: service.getDispositivoId(),
      tomadaEn
    });
    const ajena = cuenta({
      tomadaPorDispositivo: 'otro-dispositivo',
      tomadaEn
    });

    expect(service.estaTomadaPorEsteDispositivo(propia)).toBe(true);
    expect(service.estaTomadaPorOtroDispositivo(propia)).toBe(false);
    expect(service.estaTomadaPorOtroDispositivo(ajena)).toBe(true);
  });
});
