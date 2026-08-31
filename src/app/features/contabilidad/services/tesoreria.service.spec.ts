import { TestBed } from '@angular/core/testing';
import { Database, get, update } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import { AuditService } from '../../../core/services/audit.service';
import { AsientoContable } from '../models/contabilidad.models';
import { AsientosContablesService } from './asientos-contables.service';
import { MovimientoTesoreria, TesoreriaService } from './tesoreria.service';

vi.mock('@angular/fire/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@angular/fire/database')>();
  return {
    ...actual,
    get: vi.fn(),
    ref: vi.fn((_database: unknown, path: string) => ({ path })),
    update: vi.fn(),
  };
});

describe('TesoreriaService · anulación contable', () => {
  let service: TesoreriaService;
  let asientos: {
    getAsientoById: ReturnType<typeof vi.fn>;
    crearReverso: ReturnType<typeof vi.fn>;
    guardarBorrador: ReturnType<typeof vi.fn>;
    aprobarAsiento: ReturnType<typeof vi.fn>;
    marcarReversado: ReturnType<typeof vi.fn>;
  };

  const movimiento: MovimientoTesoreria = {
    id: 'mov-1',
    tipo: 'CHEQUE',
    cuentaBancariaId: 'banco-1',
    fecha: '2026-08-28',
    fechaTs: 1,
    periodo: '2026-08',
    monto: -125,
    referencia: 'CH-15',
    glosa: 'Pago de servicio',
    estado: 'REGISTRADO',
    asientoId: 'asi-1',
  };

  const asientoOriginal: AsientoContable = {
    id: 'asi-1',
    fecha: '2026-08-28',
    periodo: '2026-08',
    tipo: 'AJUSTE',
    glosa: 'Tesorería: Pago de servicio',
    estado: 'APROBADO',
    origen: 'MANUAL',
    origenModulo: 'BANCOS',
    lineas: [
      {
        id: '1',
        cuentaId: 'gasto',
        codigoCuenta: '5.1',
        nombreCuenta: 'Gasto',
        descripcion: '',
        debe: 125,
        haber: 0,
      },
      {
        id: '2',
        cuentaId: 'banco',
        codigoCuenta: '1.1',
        nombreCuenta: 'Banco',
        descripcion: '',
        debe: 0,
        haber: 125,
      },
    ],
    totalDebe: 125,
    totalHaber: 125,
    diferencia: 0,
  };

  const reverso: AsientoContable = {
    ...asientoOriginal,
    id: undefined,
    fecha: '2026-09-01',
    periodo: '2026-09',
    estado: 'BORRADOR',
    asientoReversadoId: 'asi-1',
    lineas: asientoOriginal.lineas.map((linea) => ({
      ...linea,
      debe: linea.haber,
      haber: linea.debe,
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    asientos = {
      getAsientoById: vi.fn().mockResolvedValue(asientoOriginal),
      crearReverso: vi.fn().mockReturnValue(reverso),
      guardarBorrador: vi.fn().mockResolvedValue('rev-1'),
      aprobarAsiento: vi.fn().mockResolvedValue('rev-1'),
      marcarReversado: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        TesoreriaService,
        { provide: Database, useValue: {} },
        {
          provide: AuthService,
          useValue: { getTenantId: () => 'tenant-1', currentUser: () => ({ uid: 'uid-1' }) },
        },
        { provide: AuditService, useValue: { recordSafe: vi.fn().mockResolvedValue(undefined) } },
        { provide: AsientosContablesService, useValue: asientos },
      ],
    });
    service = TestBed.inject(TesoreriaService);
    vi.mocked(update).mockResolvedValue(undefined);
  });

  it('aprueba el reverso antes de marcar el movimiento como anulado', async () => {
    vi.mocked(get).mockResolvedValue({
      exists: () => true,
      val: () => movimiento,
    } as never);

    await service.anularMovimiento(movimiento);

    expect(asientos.crearReverso).toHaveBeenCalledWith(asientoOriginal);
    expect(asientos.guardarBorrador).toHaveBeenCalledWith(
      expect.objectContaining({
        origenModulo: 'BANCOS',
        origenId: 'mov-1',
        asientoReversadoId: 'asi-1',
        fecha: '2026-08-28',
        periodo: '2026-08',
      }),
    );
    expect(asientos.aprobarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rev-1', fecha: '2026-08-28', periodo: '2026-08' }),
    );
    expect(asientos.marcarReversado).toHaveBeenCalledWith('asi-1');

    const patches = vi.mocked(update).mock.calls.map((call) => call[1] as Record<string, unknown>);
    expect(patches[0]).toEqual(
      expect.objectContaining({
        'contabilidad/tenant-1/bancos/tesoreria/mov-1/asientoReversoId': 'rev-1',
      }),
    );
    expect(patches[1]).toEqual(
      expect.objectContaining({
        'contabilidad/tenant-1/bancos/tesoreria/mov-1/estado': 'ANULADO',
        'contabilidad/tenant-1/bancos/tesoreria/mov-1/asientoReversoId': 'rev-1',
      }),
    );
    expect(asientos.aprobarAsiento.mock.invocationCallOrder[0]).toBeLessThan(
      asientos.marcarReversado.mock.invocationCallOrder[0],
    );
    expect(asientos.marcarReversado.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(update).mock.invocationCallOrder[1],
    );
  });

  it('retoma el reverso vinculado sin crear otro cuando el primer intento quedó a medias', async () => {
    const movimientoPendiente = { ...movimiento, asientoReversoId: 'rev-1' };
    vi.mocked(get).mockResolvedValue({
      exists: () => true,
      val: () => movimientoPendiente,
    } as never);
    asientos.getAsientoById
      .mockResolvedValueOnce(asientoOriginal)
      .mockResolvedValueOnce({ ...reverso, id: 'rev-1' });

    await service.anularMovimiento(movimiento);

    expect(asientos.crearReverso).not.toHaveBeenCalled();
    expect(asientos.guardarBorrador).not.toHaveBeenCalled();
    expect(asientos.aprobarAsiento).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rev-1', fecha: '2026-08-28', periodo: '2026-08' }),
    );
    expect(asientos.marcarReversado).toHaveBeenCalledWith('asi-1');
    expect(vi.mocked(update)).toHaveBeenCalledTimes(1);
  });

  it('no anula el movimiento cuando no tiene asiento contable vinculado', async () => {
    vi.mocked(get).mockResolvedValue({
      exists: () => true,
      val: () => ({ ...movimiento, asientoId: null }),
    } as never);

    await expect(service.anularMovimiento(movimiento)).rejects.toThrow(
      /no tiene un asiento contable vinculado/i,
    );

    expect(asientos.guardarBorrador).not.toHaveBeenCalled();
    expect(vi.mocked(update)).not.toHaveBeenCalled();
  });

  it('detiene la anulación si el reverso ya aprobado pertenece a otro período', async () => {
    vi.mocked(get).mockResolvedValue({
      exists: () => true,
      val: () => ({ ...movimiento, asientoReversoId: 'rev-1' }),
    } as never);
    asientos.getAsientoById
      .mockResolvedValueOnce(asientoOriginal)
      .mockResolvedValueOnce({ ...reverso, id: 'rev-1', estado: 'APROBADO' });

    await expect(service.anularMovimiento(movimiento)).rejects.toThrow(/otro período contable/i);

    expect(asientos.marcarReversado).not.toHaveBeenCalled();
    expect(vi.mocked(update)).not.toHaveBeenCalled();
  });
});
