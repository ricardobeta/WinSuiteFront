import { Injectable, inject } from '@angular/core';
import { Database, get, ref } from '@angular/fire/database';

import { AuthService } from '../../../core/services/auth.service';
import {
  AsientoContable,
  BalanceComprobacionResultado,
  CuentaContable,
  EstadoFinancieroLinea,
  EstadoFinancieroSeccion,
  EstadoResultadoIntegralResultado,
  EstadoSituacionFinancieraResultado,
  FiltrosReporteContable,
  LibroDiarioFila,
  LibroMayorFila,
  LibroMayorResultado,
  SeccionReporteFinanciero,
  TipoCuenta
} from '../models/contabilidad.models';

@Injectable({
  providedIn: 'root'
})
export class ReportesContablesService {
  private readonly database = inject(Database);
  private readonly authService = inject(AuthService);

  private getTenantPath(): string {
    return `contabilidad/${this.authService.getTenantId()}`;
  }

  async getCuentas(): Promise<CuentaContable[]> {
    const snapshot = await get(ref(this.database, `${this.getTenantPath()}/planCuentas`));
    if (!snapshot.exists()) {
      return [];
    }

    const raw = snapshot.val() as Record<string, CuentaContable>;
    return Object.entries(raw)
      .map(([id, cuenta]) => ({ ...cuenta, id }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  }

  async getAsientosReportables(): Promise<AsientoContable[]> {
    const snapshot = await get(ref(this.database, `${this.getTenantPath()}/asientos`));
    if (!snapshot.exists()) {
      return [];
    }

    const raw = snapshot.val() as Record<string, AsientoContable>;
    return Object.entries(raw)
      .map(([id, asiento]) => ({
        ...asiento,
        id,
        lineas: Array.isArray(asiento.lineas) ? asiento.lineas : []
      }))
      .filter((asiento) => asiento.estado === 'APROBADO' || asiento.estado === 'REVERSADO')
      .sort((a, b) => {
        const byDate = a.fecha.localeCompare(b.fecha);
        return byDate !== 0 ? byDate : (a.numero ?? '').localeCompare(b.numero ?? '');
      });
  }

  async generarLibroDiario(filtros: FiltrosReporteContable): Promise<LibroDiarioFila[]> {
    const [asientos, cuentas] = await Promise.all([
      this.getAsientosReportables(),
      this.getCuentas()
    ]);
    const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta]));
    const texto = filtros.texto?.trim().toLowerCase() ?? '';

    return asientos
      .filter((asiento) => this.coincideAsiento(asiento, filtros))
      .flatMap((asiento) => asiento.lineas.map((linea) => {
        const cuenta = cuentasPorId.get(linea.cuentaId);
        return {
          asientoId: asiento.id,
          fecha: asiento.fecha,
          periodo: asiento.periodo,
          numero: asiento.numero ?? '',
          glosa: asiento.glosa,
          estado: asiento.estado,
          cuentaId: linea.cuentaId,
          codigoCuenta: linea.codigoCuenta,
          nombreCuenta: linea.nombreCuenta,
          debe: this.roundToTwo(linea.debe),
          haber: this.roundToTwo(linea.haber),
          tipoCuenta: cuenta?.tipo
        };
      }))
      .filter((fila) => !filtros.cuentaId || fila.cuentaId === filtros.cuentaId)
      .filter((fila) => !filtros.tipoCuenta || filtros.tipoCuenta === 'TODOS' || fila.tipoCuenta === filtros.tipoCuenta)
      .filter((fila) => !texto
        || fila.glosa.toLowerCase().includes(texto)
        || fila.numero.toLowerCase().includes(texto)
        || fila.codigoCuenta.toLowerCase().includes(texto)
        || fila.nombreCuenta.toLowerCase().includes(texto))
      .map(({ tipoCuenta: _tipoCuenta, ...fila }) => fila);
  }

  async generarLibroMayor(filtros: FiltrosReporteContable): Promise<LibroMayorResultado> {
    const [asientos, cuentas] = await Promise.all([
      this.getAsientosReportables(),
      this.getCuentas()
    ]);
    const cuentaIds = this.resolverCuentasMayor(cuentas, filtros);

    const movimientosPrevios = asientos
      .filter((asiento) => !!filtros.fechaDesde && asiento.fecha < filtros.fechaDesde)
      .flatMap((asiento) => asiento.lineas)
      .filter((linea) => cuentaIds.has(linea.cuentaId));

    let saldo = this.roundToTwo(movimientosPrevios.reduce((total, linea) => total + linea.debe - linea.haber, 0));
    const movimientos: LibroMayorFila[] = [];

    for (const asiento of asientos.filter((item) => this.coincideAsiento(item, filtros))) {
      for (const linea of asiento.lineas.filter((item) => cuentaIds.has(item.cuentaId))) {
        saldo = this.roundToTwo(saldo + linea.debe - linea.haber);
        movimientos.push({
          asientoId: asiento.id,
          fecha: asiento.fecha,
          periodo: asiento.periodo,
          numero: asiento.numero ?? '',
          // Nº de factura/documento origen: la referencia guarda el número del comprobante
          // (factura del proveedor, venta, recepción). En asientos manuales queda vacío.
          numeroFactura: asiento.origen !== 'MANUAL' ? (asiento.referencia ?? '') : '',
          concepto: linea.descripcion || asiento.glosa,
          cuentaId: linea.cuentaId,
          codigoCuenta: linea.codigoCuenta,
          nombreCuenta: linea.nombreCuenta,
          debe: this.roundToTwo(linea.debe),
          haber: this.roundToTwo(linea.haber),
          saldo
        });
      }
    }

    const totalDebe = this.roundToTwo(movimientos.reduce((total, fila) => total + fila.debe, 0));
    const totalHaber = this.roundToTwo(movimientos.reduce((total, fila) => total + fila.haber, 0));

    return {
      saldoAnterior: this.roundToTwo(movimientos.length ? movimientos[0].saldo - movimientos[0].debe + movimientos[0].haber : saldo),
      totalDebe,
      totalHaber,
      saldoFinal: saldo,
      movimientos
    };
  }

  async generarBalanceComprobacion(filtros: FiltrosReporteContable): Promise<BalanceComprobacionResultado> {
    const [asientos, cuentas] = await Promise.all([
      this.getAsientosReportables(),
      this.getCuentas()
    ]);
    const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta]));
    const acumulado = new Map<string, { debe: number; haber: number }>();

    for (const asiento of asientos.filter((item) => this.coincideAsiento(item, filtros))) {
      for (const linea of asiento.lineas) {
        const cuenta = cuentasPorId.get(linea.cuentaId);
        if (!cuenta) {
          continue;
        }
        if (filtros.tipoCuenta && filtros.tipoCuenta !== 'TODOS' && cuenta.tipo !== filtros.tipoCuenta) {
          continue;
        }
        if (filtros.cuentaId && linea.cuentaId !== filtros.cuentaId) {
          continue;
        }

        const current = acumulado.get(linea.cuentaId) ?? { debe: 0, haber: 0 };
        current.debe = this.roundToTwo(current.debe + linea.debe);
        current.haber = this.roundToTwo(current.haber + linea.haber);
        acumulado.set(linea.cuentaId, current);
      }
    }

    const filas = Array.from(acumulado.entries())
      .map(([cuentaId, valores]) => {
        const cuenta = cuentasPorId.get(cuentaId)!;
        const saldo = this.roundToTwo(valores.debe - valores.haber);
        return {
          cuentaId,
          codigoCuenta: cuenta.codigo,
          nombreCuenta: cuenta.nombre,
          tipo: cuenta.tipo,
          totalDebe: this.roundToTwo(valores.debe),
          totalHaber: this.roundToTwo(valores.haber),
          saldoDeudor: saldo > 0 ? saldo : 0,
          saldoAcreedor: saldo < 0 ? Math.abs(saldo) : 0
        };
      })
      .sort((a, b) => a.codigoCuenta.localeCompare(b.codigoCuenta, undefined, { numeric: true }));

    const totalDebe = this.roundToTwo(filas.reduce((total, fila) => total + fila.totalDebe, 0));
    const totalHaber = this.roundToTwo(filas.reduce((total, fila) => total + fila.totalHaber, 0));
    const totalSaldoDeudor = this.roundToTwo(filas.reduce((total, fila) => total + fila.saldoDeudor, 0));
    const totalSaldoAcreedor = this.roundToTwo(filas.reduce((total, fila) => total + fila.saldoAcreedor, 0));

    return {
      filas,
      totalDebe,
      totalHaber,
      totalSaldoDeudor,
      totalSaldoAcreedor,
      diferencia: this.roundToTwo(totalDebe - totalHaber)
    };
  }

  async generarEstadoSituacionFinanciera(fechaCorte: string): Promise<EstadoSituacionFinancieraResultado> {
    const [asientos, cuentas] = await Promise.all([
      this.getAsientosReportables(),
      this.getCuentas()
    ]);
    const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta]));
    const acumulado = new Map<string, number>();

    for (const asiento of asientos.filter((item) => item.fecha <= fechaCorte)) {
      for (const linea of asiento.lineas) {
        const cuenta = cuentasPorId.get(linea.cuentaId);
        if (!cuenta || !['ACTIVO', 'PASIVO', 'PATRIMONIO'].includes(cuenta.tipo) || cuenta.incluyeEnEstadoFinanciero === false) {
          continue;
        }

        const saldoContable = this.roundToTwo((acumulado.get(linea.cuentaId) ?? 0) + linea.debe - linea.haber);
        acumulado.set(linea.cuentaId, saldoContable);
      }
    }

    const lineas: EstadoFinancieroLinea[] = cuentas
      .filter((cuenta) => ['ACTIVO', 'PASIVO', 'PATRIMONIO'].includes(cuenta.tipo))
      .filter((cuenta) => cuenta.incluyeEnEstadoFinanciero !== false)
      .map((cuenta) => {
        const saldo = acumulado.get(cuenta.id ?? '') ?? 0;
        const monto = cuenta.tipo === 'ACTIVO' ? saldo : this.roundToTwo(-saldo);
        return {
          cuentaId: cuenta.id,
          codigoCuenta: cuenta.codigo,
          nombreCuenta: cuenta.nombre,
          seccion: this.resolverSeccion(cuenta),
          monto,
          orden: cuenta.ordenReporte ?? this.ordenDesdeCodigo(cuenta.codigo)
        };
      });

    const inicioEjercicio = `${fechaCorte.slice(0, 4)}-01-01`;
    const resultadoIntegral = await this.generarEstadoResultadoIntegral(inicioEjercicio, fechaCorte);
    const resultadoEjercicio = resultadoIntegral.resultadoNeto;

    if (resultadoEjercicio !== 0) {
      lineas.push({
        codigoCuenta: '3.5',
        nombreCuenta: 'Resultado del ejercicio',
        seccion: 'PATRIMONIO',
        monto: resultadoEjercicio,
        orden: 3050000,
        esCalculada: true
      });
    }

    const secciones = this.agruparSecciones(lineas, ['ACTIVO_CORRIENTE', 'ACTIVO_NO_CORRIENTE', 'PASIVO_CORRIENTE', 'PASIVO_NO_CORRIENTE', 'PATRIMONIO']);
    const totalActivo = this.totalSecciones(secciones, ['ACTIVO_CORRIENTE', 'ACTIVO_NO_CORRIENTE']);
    const totalPasivo = this.totalSecciones(secciones, ['PASIVO_CORRIENTE', 'PASIVO_NO_CORRIENTE']);
    const totalPatrimonio = this.totalSecciones(secciones, ['PATRIMONIO']);

    return {
      fechaCorte,
      secciones,
      totalActivo,
      totalPasivo,
      totalPatrimonio,
      resultadoEjercicio,
      diferencia: this.roundToTwo(totalActivo - totalPasivo - totalPatrimonio)
    };
  }

  async generarEstadoResultadoIntegral(fechaDesde: string, fechaHasta: string): Promise<EstadoResultadoIntegralResultado> {
    const [asientos, cuentas] = await Promise.all([
      this.getAsientosReportables(),
      this.getCuentas()
    ]);
    const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta]));
    const acumulado = new Map<string, number>();

    for (const asiento of asientos.filter((item) => item.fecha >= fechaDesde && item.fecha <= fechaHasta)) {
      for (const linea of asiento.lineas) {
        const cuenta = cuentasPorId.get(linea.cuentaId);
        if (!cuenta || !['INGRESO', 'GASTO', 'COSTO'].includes(cuenta.tipo) || cuenta.incluyeEnEstadoFinanciero === false) {
          continue;
        }

        const movimiento = cuenta.tipo === 'INGRESO' ? linea.haber - linea.debe : linea.debe - linea.haber;
        acumulado.set(linea.cuentaId, this.roundToTwo((acumulado.get(linea.cuentaId) ?? 0) + movimiento));
      }
    }

    const lineas: EstadoFinancieroLinea[] = cuentas
      .filter((cuenta) => ['INGRESO', 'GASTO', 'COSTO'].includes(cuenta.tipo))
      .filter((cuenta) => cuenta.incluyeEnEstadoFinanciero !== false)
      .map((cuenta) => {
        const monto = acumulado.get(cuenta.id ?? '') ?? 0;
        return {
          cuentaId: cuenta.id,
          codigoCuenta: cuenta.codigo,
          nombreCuenta: cuenta.nombre,
          seccion: this.resolverSeccion(cuenta),
          monto: this.roundToTwo(monto),
          orden: cuenta.ordenReporte ?? this.ordenDesdeCodigo(cuenta.codigo)
        };
      });

    const secciones = this.agruparSecciones(
      lineas,
      ['INGRESOS_OPERACIONALES', 'COSTOS', 'GASTOS_ADMINISTRATIVOS', 'GASTOS_VENTAS', 'GASTOS_FINANCIEROS', 'OTROS_INGRESOS', 'OTROS_GASTOS']
    );
    const totalIngresos = this.totalSecciones(secciones, ['INGRESOS_OPERACIONALES', 'OTROS_INGRESOS']);
    const totalCostos = this.totalSecciones(secciones, ['COSTOS']);
    const totalGastos = this.totalSecciones(secciones, ['GASTOS_ADMINISTRATIVOS', 'GASTOS_VENTAS', 'GASTOS_FINANCIEROS', 'OTROS_GASTOS']);
    const resultadoBruto = this.roundToTwo(this.totalSecciones(secciones, ['INGRESOS_OPERACIONALES']) - totalCostos);
    const resultadoOperacional = this.roundToTwo(resultadoBruto - this.totalSecciones(secciones, ['GASTOS_ADMINISTRATIVOS', 'GASTOS_VENTAS']));

    return {
      fechaDesde,
      fechaHasta,
      secciones,
      totalIngresos,
      totalCostos,
      totalGastos,
      resultadoBruto,
      resultadoOperacional,
      resultadoNeto: this.roundToTwo(totalIngresos - totalCostos - totalGastos)
    };
  }

  exportarCsv(filename: string, rows: Array<Record<string, string | number>>): void {
    const headers = Object.keys(rows[0] ?? {});
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => this.escapeCsv(row[header] ?? '')).join(','))
    ].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  roundToTwo(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private coincideAsiento(asiento: AsientoContable, filtros: FiltrosReporteContable): boolean {
    if (filtros.periodo && asiento.periodo !== filtros.periodo) {
      return false;
    }
    if (filtros.fechaDesde && asiento.fecha < filtros.fechaDesde) {
      return false;
    }
    if (filtros.fechaHasta && asiento.fecha > filtros.fechaHasta) {
      return false;
    }
    return true;
  }

  private resolverCuentasMayor(cuentas: CuentaContable[], filtros: FiltrosReporteContable): Set<string> {
    if (filtros.cuentaId) {
      return new Set([filtros.cuentaId]);
    }

    return new Set(
      cuentas
        .filter((cuenta) => cuenta.permiteMovimiento)
        .filter((cuenta) => !filtros.tipoCuenta || filtros.tipoCuenta === 'TODOS' || cuenta.tipo === filtros.tipoCuenta)
        .map((cuenta) => cuenta.id)
        .filter((id): id is string => !!id)
    );
  }

  private resolverSeccion(cuenta: CuentaContable): SeccionReporteFinanciero {
    if (cuenta.seccionReporte) {
      return cuenta.seccionReporte;
    }

    if (cuenta.codigo.startsWith('1.1')) {
      return 'ACTIVO_CORRIENTE';
    }
    if (cuenta.codigo.startsWith('1.2')) {
      return 'ACTIVO_NO_CORRIENTE';
    }
    if (cuenta.codigo.startsWith('2.1')) {
      return 'PASIVO_CORRIENTE';
    }
    if (cuenta.codigo.startsWith('2.2')) {
      return 'PASIVO_NO_CORRIENTE';
    }
    if (cuenta.tipo === 'PATRIMONIO') {
      return 'PATRIMONIO';
    }
    if (cuenta.codigo.startsWith('4.9')) {
      return 'OTROS_INGRESOS';
    }
    if (cuenta.tipo === 'INGRESO') {
      return 'INGRESOS_OPERACIONALES';
    }
    if (cuenta.tipo === 'COSTO' || cuenta.codigo.startsWith('5.1') || cuenta.codigo.startsWith('6')) {
      return 'COSTOS';
    }
    if (cuenta.codigo.startsWith('5.3')) {
      return 'GASTOS_VENTAS';
    }
    if (cuenta.codigo.startsWith('5.4')) {
      return 'GASTOS_FINANCIEROS';
    }
    if (cuenta.codigo.startsWith('5.9')) {
      return 'OTROS_GASTOS';
    }
    return 'GASTOS_ADMINISTRATIVOS';
  }

  private agruparSecciones(lineas: EstadoFinancieroLinea[], ordenSecciones: SeccionReporteFinanciero[]): EstadoFinancieroSeccion[] {
    return ordenSecciones
      .map((seccion, index) => {
        const sectionLines = lineas
          .filter((linea) => linea.seccion === seccion)
          .sort((a, b) => a.orden - b.orden || a.codigoCuenta.localeCompare(b.codigoCuenta, undefined, { numeric: true }));
        return {
          seccion,
          nombre: this.nombreSeccion(seccion),
          lineas: sectionLines,
          total: this.roundToTwo(sectionLines.reduce((total, linea) => total + linea.monto, 0)),
          orden: index + 1
        };
      })
      .filter((seccion) => seccion.lineas.length > 0 || seccion.total !== 0);
  }

  private totalSecciones(secciones: EstadoFinancieroSeccion[], keys: SeccionReporteFinanciero[]): number {
    return this.roundToTwo(secciones.filter((seccion) => keys.includes(seccion.seccion)).reduce((total, seccion) => total + seccion.total, 0));
  }

  private nombreSeccion(seccion: SeccionReporteFinanciero): string {
    const labels: Record<SeccionReporteFinanciero, string> = {
      ACTIVO_CORRIENTE: 'Activo corriente',
      ACTIVO_NO_CORRIENTE: 'Activo no corriente',
      PASIVO_CORRIENTE: 'Pasivo corriente',
      PASIVO_NO_CORRIENTE: 'Pasivo no corriente',
      PATRIMONIO: 'Patrimonio neto',
      INGRESOS_OPERACIONALES: 'Ingresos operacionales',
      COSTOS: 'Costos',
      GASTOS_ADMINISTRATIVOS: 'Gastos administrativos',
      GASTOS_VENTAS: 'Gastos de ventas',
      GASTOS_FINANCIEROS: 'Gastos financieros',
      OTROS_INGRESOS: 'Otros ingresos',
      OTROS_GASTOS: 'Otros gastos'
    };
    return labels[seccion];
  }

  private ordenDesdeCodigo(codigo: string): number {
    return codigo
      .split('.')
      .reduce((total, segment, index) => total + Number(segment || 0) * Math.pow(100, Math.max(0, 4 - index)), 0);
  }

  private escapeCsv(value: string | number): string {
    const text = String(value);
    if (!/[",\n\r]/.test(text)) {
      return text;
    }

    return `"${text.replace(/"/g, '""')}"`;
  }
}
