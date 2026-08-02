import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ActualizarSuscripcionCuenta,
  ActualizarSuscripcionEmpresa,
  AjustesPago,
  AjusteBolsa,
  ComplementoPlataforma,
  ConsumoEmpresa,
  CuentaFila,
  EmpresaDetalle,
  EmpresaFila,
  OrdenCompra,
  PlanCuenta,
  PlanEmpresa
} from '../models/platform.models';

/**
 * Cliente del panel de super administracion. El acceso lo concede el backend por lista de
 * correos: el panel nunca lee la base de datos directamente, todo pasa por /api/platform/**.
 * El token lo adjunta el AuthInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class PlatformApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/platform`;

  // ---------------- Empresas ----------------

  listarEmpresas(query?: string): Observable<EmpresaFila[]> {
    const params = query ? new HttpParams().set('query', query) : undefined;
    return this.http.get<EmpresaFila[]>(`${this.base}/companies`, { params });
  }

  obtenerEmpresa(tenantId: string): Observable<EmpresaDetalle> {
    return this.http.get<EmpresaDetalle>(`${this.base}/companies/${tenantId}`);
  }

  actualizarSuscripcion(tenantId: string, payload: ActualizarSuscripcionEmpresa): Observable<EmpresaDetalle> {
    return this.http.put<EmpresaDetalle>(`${this.base}/companies/${tenantId}/subscription`, payload);
  }

  ajustarBolsa(tenantId: string, payload: AjusteBolsa): Observable<ConsumoEmpresa> {
    return this.http.post<ConsumoEmpresa>(`${this.base}/companies/${tenantId}/wallet`, payload);
  }

  reiniciarConsumo(tenantId: string, periodo?: string): Observable<ConsumoEmpresa> {
    const params = periodo ? new HttpParams().set('periodo', periodo) : undefined;
    return this.http.post<ConsumoEmpresa>(`${this.base}/companies/${tenantId}/usage/reset`, {}, { params });
  }

  // ---------------- Cuentas ----------------

  listarCuentas(): Observable<CuentaFila[]> {
    return this.http.get<CuentaFila[]>(`${this.base}/accounts`);
  }

  actualizarSuscripcionCuenta(userId: string, payload: ActualizarSuscripcionCuenta): Observable<CuentaFila> {
    return this.http.put<CuentaFila>(`${this.base}/accounts/${userId}/subscription`, payload);
  }

  // ---------------- Planes de empresa ----------------

  listarPlanesEmpresa(): Observable<PlanEmpresa[]> {
    return this.http.get<PlanEmpresa[]>(`${this.base}/plans`);
  }

  guardarPlanEmpresa(plan: PlanEmpresa): Observable<PlanEmpresa> {
    return this.http.put<PlanEmpresa>(`${this.base}/plans`, plan);
  }

  eliminarPlanEmpresa(planId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/plans/${planId}`);
  }

  // ---------------- Planes de cuenta ----------------

  listarPlanesCuenta(): Observable<PlanCuenta[]> {
    return this.http.get<PlanCuenta[]>(`${this.base}/account-plans`);
  }

  guardarPlanCuenta(plan: PlanCuenta): Observable<PlanCuenta> {
    return this.http.put<PlanCuenta>(`${this.base}/account-plans`, plan);
  }

  eliminarPlanCuenta(planId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/account-plans/${planId}`);
  }

  // ---------------- Complementos ----------------

  listarComplementos(): Observable<ComplementoPlataforma[]> {
    return this.http.get<ComplementoPlataforma[]>(`${this.base}/addons`);
  }

  guardarComplemento(addon: ComplementoPlataforma): Observable<ComplementoPlataforma> {
    return this.http.put<ComplementoPlataforma>(`${this.base}/addons`, addon);
  }

  eliminarComplemento(addonId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/addons/${addonId}`);
  }

  // ---------------- Ordenes de compra ----------------

  listarOrdenes(estado?: string): Observable<OrdenCompra[]> {
    const params = estado ? new HttpParams().set('estado', estado) : undefined;
    return this.http.get<OrdenCompra[]>(`${this.base}/orders`, { params });
  }

  /** Da por recibido el deposito y acredita la compra. */
  aprobarOrden(orderId: string): Observable<OrdenCompra> {
    return this.http.post<OrdenCompra>(`${this.base}/orders/${orderId}/approve`, {});
  }

  rechazarOrden(orderId: string, motivo: string): Observable<OrdenCompra> {
    return this.http.post<OrdenCompra>(`${this.base}/orders/${orderId}/reject`, { motivo });
  }

  /** Reintenta una orden que se quedo a medias tras cobrar. */
  reintentarOrden(orderId: string): Observable<OrdenCompra> {
    return this.http.post<OrdenCompra>(`${this.base}/orders/${orderId}/retry`, {});
  }

  // ---------------- Ajustes de cobro ----------------

  obtenerAjustesPago(): Observable<AjustesPago> {
    return this.http.get<AjustesPago>(`${this.base}/settings/pagos`);
  }

  guardarAjustesPago(ajustes: AjustesPago): Observable<AjustesPago> {
    return this.http.put<AjustesPago>(`${this.base}/settings/pagos`, ajustes);
  }
}
