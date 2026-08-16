import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';

import { ConfigApplyResponse, ConfigScreenContext } from '../../../../core/services/ai-config-copilot.service';
import { FacturacionConfigService } from '../../../../core/services/facturacion-config.service';
import { PlanService } from '../../../../core/services/plan.service';
import {
  ConfigCopilotPanelComponent,
  ConfigDocumentoImportable
} from '../../../../shared/components/config-copilot-panel/config-copilot-panel.component';
import {
  ArchivoSelectorDialogComponent,
  ArchivoSelectorDialogData,
  ArchivoSelectorDialogResult
} from '../../../../shared/components/archivo-selector-dialog/archivo-selector-dialog.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SuccessSnackbarComponent } from '../../../../shared/components/success-snackbar/success-snackbar.component';
import {
  CatalogosFacturacion,
  ConfiguracionCorreoFactura,
  ConfiguracionFacturacion,
  EstablecimientoConfig,
  FirmaDigitalConfig,
  PuntoEmisionConfig
} from '../../../../shared/models/facturacion.models';
import { Almacen } from '../../../inventario/models/inventario.models';
import { AlmacenesService } from '../../../inventario/services/almacenes.service';

type CampoCatalogoMultiple =
  | 'formaPagoActivos'
  | 'tipoIdentificacionActivos'
  | 'codigoPorcentajeIvaActivos';

@Component({
  selector: 'app-configuracion-facturacion-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatRadioModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTableModule,
    MatTabsModule,
    ConfigCopilotPanelComponent
  ],
  templateUrl: './configuracion-facturacion-page.component.html',
  styleUrl: './configuracion-facturacion-page.component.scss'
})
export class ConfiguracionFacturacionPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly facturacionService = inject(FacturacionConfigService);
  private readonly planService = inject(PlanService);
  private correoBaseline = '';

  protected readonly columnasCatalogo = ['value', 'toggle'];
  protected readonly columnasEstablecimientos = ['codigo', 'nombre', 'direccion', 'almacenes', 'acciones'];
  protected readonly columnasPuntos = ['codigo', 'establecimiento', 'descripcion', 'firma', 'acciones'];
  protected readonly selectedTabIndex = signal(0);
  protected readonly almacenes = signal<Almacen[]>([]);
  protected readonly cargandoCatalogos = signal(true);
  protected readonly cargandoConfiguracion = signal(true);
  protected readonly cargandoCorreo = signal(true);
  protected readonly guardando = signal(false);
  protected readonly guardandoCorreo = signal(false);
  protected readonly probandoCorreo = signal(false);
  protected readonly mainDirty = signal(false);
  protected readonly correoDirty = signal(false);
  protected readonly passwordConfigured = signal(false);
  protected readonly permiteCopiaOculta = computed(
    () => (this.planService.plan()?.planId ?? 'free').toLowerCase() !== 'free',
  );
  /**
   * La configuracion cambio en otro sitio (el copiloto, u otra pestana) mientras habia
   * ediciones sin guardar. Se avisa en vez de pisar lo que el usuario tenia escrito.
   */
  protected readonly configuracionDesactualizada = signal(false);

  /** screenKey debe coincidir con el ConfigToolSet del backend. */
  protected readonly copilotContext: ConfigScreenContext = {
    route: '/workspace/facturacion/configuracion',
    module: 'Facturacion',
    page: 'Configuracion',
    screenKey: 'facturacion.configuracion'
  };
  protected readonly copilotEjemplos = [
    'Tengo un local en el centro y quiero facturar desde ahí',
    '¿Qué me falta para pasar a producción?',
    'Solo cobro en efectivo y transferencia'
  ];
  /**
   * Reutiliza el selector del módulo Archivos: busca entre lo ya subido o sube uno nuevo, con la
   * cuota y el almacenamiento que ese módulo ya controla.
   */
  protected readonly copilotDocumento: ConfigDocumentoImportable = {
    etiqueta: 'Importar el PDF del RUC',
    title: 'Importar el PDF del RUC',
    subtitle: 'Sube el certificado de RUC que descargas del portal del SRI, o reutiliza uno ya '
      + 'cargado. El PDF se queda en WinSuit: se extrae su texto en el servidor y solo ese texto '
      + 'se envía al proveedor de IA.',
    sourceModule: 'facturacion',
    allowUpload: true,
    extensions: ['pdf']
  };

  protected readonly catalogos = signal<CatalogosFacturacion>({
    formaPago: [],
    tipoIdentificacion: [],
    ambiente: [],
    codigoPorcentajeIva: []
  });

  protected readonly firmas = signal<FirmaDigitalConfig[]>([]);
  protected readonly configuracion = signal<ConfiguracionFacturacion>({
    formaPagoActivos: [],
    tipoIdentificacionActivos: [],
    ambienteActivo: null,
    codigoPorcentajeIvaActivos: [],
    establecimientos: [],
    puntosEmision: [],
    direccionMatriz: '',
    obligadoContabilidad: false,
    contribuyenteEspecial: '',
    agenteRetencion: '',
    contribuyenteRimpe: false,
    logoUrl: ''
  });

  protected readonly fiscalForm = this.formBuilder.nonNullable.group({
    direccionMatriz: ['', [Validators.required, Validators.maxLength(300)]],
    obligadoContabilidad: [false],
    // El XSD del SRI espera aquí el número de resolución (3-13 alfanuméricos), no un sí/no:
    // un "NO" copiado del RUC hace que la factura no valide.
    contribuyenteEspecial: ['', [Validators.pattern(/^[A-Za-z0-9]{3,13}$/)]],
    agenteRetencion: ['', [Validators.pattern(/^\d{0,8}$/)]],
    contribuyenteRimpe: [false],
    logoUrl: ['']
  });

  protected readonly correoForm = this.formBuilder.nonNullable.group({
    mode: ['SAAS_DEFAULT' as ConfiguracionCorreoFactura['mode']],
    host: [''],
    port: [587, [Validators.min(1), Validators.max(65535)]],
    username: [''],
    password: [''],
    fromAddress: ['', [Validators.email]],
    fromName: [''],
    replyTo: ['', [Validators.email]],
    bccAddress: ['', [Validators.email, Validators.maxLength(254)]],
    startTls: [true],
    ssl: [false],
    testRecipient: ['', [Validators.email]]
  });

  protected readonly establecimientoForm = this.formBuilder.nonNullable.group({
    codigo: ['', [Validators.required, Validators.pattern(/^[0-9]{3}$/)]],
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    direccion: ['', [Validators.maxLength(200)]],
    almacenes: [[] as string[]]
  });

  protected readonly puntoForm = this.formBuilder.nonNullable.group({
    establecimientoId: ['', [Validators.required]],
    codigo: ['', [Validators.required, Validators.pattern(/^[0-9]{3}$/)]],
    descripcion: ['', [Validators.required, Validators.maxLength(120)]],
    firmaId: ['', [Validators.required]]
  });

  constructor() {
    const almacenesService = inject(AlmacenesService);

    this.fiscalForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.mainDirty.set(true));

    this.correoForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.correoDirty.set(this.serializarCorreo() !== this.correoBaseline));

    almacenesService.getAlmacenesActivos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (almacenes) => this.almacenes.set(almacenes),
      error: () => this.mostrarMensaje('No se pudieron cargar los almacenes.', 'error')
    });

    this.facturacionService.getCatalogosFacturacion().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (catalogos) => {
        this.catalogos.set(catalogos);
        this.cargandoCatalogos.set(false);
      },
      error: () => {
        this.cargandoCatalogos.set(false);
        this.mostrarMensaje('No se pudieron cargar los catálogos del SRI.', 'error');
      }
    });

    this.facturacionService.getConfiguracion().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (configuracion) => {
        this.cargandoConfiguracion.set(false);
        // Es nuestra propia escritura volviendo: el estado local ya es el correcto.
        if (this.guardando()) {
          return;
        }
        // La suscripcion es en vivo. El estado sucio de esta pantalla vive tanto en la senal
        // 'configuracion' (catalogos, establecimientos, puntos) como en fiscalForm, y refrescar
        // aqui borraria sin aviso lo que el usuario tuviera a medias en cualquiera de los dos.
        if (this.mainDirty()) {
          this.configuracionDesactualizada.set(true);
          return;
        }
        this.aplicarConfiguracion(configuracion);
      },
      error: () => {
        this.cargandoConfiguracion.set(false);
        this.mostrarMensaje('No se pudo cargar la configuración guardada.', 'error');
      }
    });

    this.facturacionService.getFirmasDisponibles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (firmas) => this.firmas.set(firmas),
      error: () => this.mostrarMensaje('No se pudo cargar la lista de firmas.', 'error')
    });

    this.facturacionService.getConfiguracionCorreo().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (correo) => {
        this.passwordConfigured.set(!!correo.passwordConfigured);
        this.correoForm.patchValue({ ...correo, password: '' }, { emitEvent: false });
        this.correoBaseline = this.serializarCorreo();
        this.cargandoCorreo.set(false);
        this.correoDirty.set(false);
      },
      error: () => {
        this.cargandoCorreo.set(false);
        this.mostrarMensaje('No se pudo cargar la configuración de correo.', 'error');
      }
    });
  }

  private aplicarConfiguracion(configuracion: ConfiguracionFacturacion): void {
    this.configuracion.set(configuracion);
    this.fiscalForm.patchValue({
      direccionMatriz: configuracion.direccionMatriz,
      obligadoContabilidad: configuracion.obligadoContabilidad,
      contribuyenteEspecial: configuracion.contribuyenteEspecial ?? '',
      agenteRetencion: configuracion.agenteRetencion ?? '',
      contribuyenteRimpe: configuracion.contribuyenteRimpe,
      logoUrl: configuracion.logoUrl ?? ''
    }, { emitEvent: false });
    this.mainDirty.set(false);
    this.configuracionDesactualizada.set(false);
  }

  /**
   * El copiloto acaba de escribir. Si el usuario tenia ediciones sin guardar, el aviso se
   * enciende ya: sin esto no lo sabria hasta intentar guardar. Si no las tenia, la suscripcion
   * en vivo refresca la pantalla sola y un aviso solo confundiria.
   */
  protected onCopilotAplicado(respuesta: ConfigApplyResponse): void {
    if (respuesta.aplicadas > 0 && this.mainDirty()) {
      this.configuracionDesactualizada.set(true);
    }
  }

  /** Descarta las ediciones locales y vuelve a leer lo que hay guardado. */
  protected descartarMisCambios(): void {
    void this.facturacionService.getConfiguracionOnce()
      .then((configuracion) => this.aplicarConfiguracion(configuracion))
      .catch(() => this.mostrarMensaje('No se pudo recargar la configuración guardada.', 'error'));
  }

  protected isActivoMultiple(campo: CampoCatalogoMultiple, codigo: string): boolean {
    return this.configuracion()[campo].includes(codigo);
  }

  protected cantidadActivos(campo: CampoCatalogoMultiple): number {
    return this.configuracion()[campo].length;
  }

  protected toggleMultiple(campo: CampoCatalogoMultiple, codigo: string, checked: boolean): void {
    const current = this.configuracion();
    const activos = new Set(current[campo]);
    checked ? activos.add(codigo) : activos.delete(codigo);
    this.configuracion.set({ ...current, [campo]: Array.from(activos) });
    this.mainDirty.set(true);
  }

  protected seleccionarAmbiente(codigo: string): void {
    const current = this.configuracion();
    if (current.ambienteActivo === codigo) {
      return;
    }

    this.configuracion.set({ ...current, ambienteActivo: codigo });
    this.mainDirty.set(true);

    if (this.esAmbienteProduccion(codigo)) {
      this.mostrarMensaje(
        'Seleccionaste Producción. Verifica firmas y puntos de emisión antes de facturar.',
        'warning'
      );
    }
  }

  protected ambienteEsProduccion(): boolean {
    return this.esAmbienteProduccion(this.configuracion().ambienteActivo);
  }

  protected agregarEstablecimiento(): void {
    if (this.establecimientoForm.invalid) {
      this.establecimientoForm.markAllAsTouched();
      return;
    }

    const raw = this.establecimientoForm.getRawValue();
    const current = this.configuracion();
    const codigo = raw.codigo.trim();

    if (current.establecimientos.some((item) => item.codigo === codigo)) {
      this.mostrarMensaje('Ya existe un establecimiento con ese código.', 'warning');
      return;
    }

    const nuevo: EstablecimientoConfig = {
      id: this.generarIdEstablecimiento(),
      codigo,
      nombre: raw.nombre.trim(),
      direccion: raw.direccion?.trim(),
      almacenIds: Array.isArray(raw.almacenes) ? raw.almacenes.slice() : [],
      activo: true
    };

    this.configuracion.set({
      ...current,
      establecimientos: [...current.establecimientos, nuevo].sort((a, b) => a.codigo.localeCompare(b.codigo))
    });
    this.establecimientoForm.reset({ codigo: '', nombre: '', direccion: '', almacenes: [] });
    this.mainDirty.set(true);
  }

  protected eliminarEstablecimiento(establecimiento: EstablecimientoConfig): void {
    const puntosAsociados = this.configuracion().puntosEmision
      .filter((punto) => punto.establecimientoId === establecimiento.id).length;
    const detalle = puntosAsociados > 0
      ? ` También se eliminarán ${puntosAsociados} punto${puntosAsociados === 1 ? '' : 's'} de emisión asociado${puntosAsociados === 1 ? '' : 's'}.`
      : '';

    this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      maxWidth: 'calc(100vw - 32px)',
      data: {
        title: 'Eliminar establecimiento',
        message: `¿Deseas eliminar ${establecimiento.codigo} · ${establecimiento.nombre}?${detalle}`,
        confirmText: 'Eliminar'
      }
    }).afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }

      const current = this.configuracion();
      this.configuracion.set({
        ...current,
        establecimientos: current.establecimientos.filter((item) => item.id !== establecimiento.id),
        puntosEmision: current.puntosEmision.filter((punto) => punto.establecimientoId !== establecimiento.id)
      });
      this.mainDirty.set(true);
    });
  }

  protected agregarPuntoEmision(): void {
    if (this.puntoForm.invalid) {
      this.puntoForm.markAllAsTouched();
      return;
    }

    const raw = this.puntoForm.getRawValue();
    const current = this.configuracion();
    const codigo = raw.codigo.trim();
    const puntosEnEstablecimiento = current.puntosEmision
      .filter((punto) => punto.establecimientoId === raw.establecimientoId);

    if (puntosEnEstablecimiento.some((item) => item.codigo === codigo)) {
      this.mostrarMensaje('Ese establecimiento ya tiene un punto de emisión con el mismo código.', 'warning');
      return;
    }

    const nuevo: PuntoEmisionConfig = {
      id: this.generarIdPunto(),
      codigo,
      descripcion: raw.descripcion.trim(),
      firmaId: raw.firmaId,
      establecimientoId: raw.establecimientoId,
      activo: true
    };

    this.configuracion.set({
      ...current,
      puntosEmision: [...current.puntosEmision, nuevo].sort((a, b) => a.codigo.localeCompare(b.codigo))
    });
    this.puntoForm.reset({ establecimientoId: '', codigo: '', descripcion: '', firmaId: '' });
    this.mainDirty.set(true);
  }

  protected eliminarPunto(punto: PuntoEmisionConfig): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      maxWidth: 'calc(100vw - 32px)',
      data: {
        title: 'Eliminar punto de emisión',
        message: `¿Deseas eliminar ${punto.codigo} · ${punto.descripcion}?`,
        confirmText: 'Eliminar'
      }
    }).afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }

      const current = this.configuracion();
      this.configuracion.set({
        ...current,
        puntosEmision: current.puntosEmision.filter((item) => item.id !== punto.id)
      });
      this.mainDirty.set(true);
    });
  }

  protected nombreAlmacenesPorIds(ids?: string[] | null): string {
    if (!Array.isArray(ids) || ids.length === 0) {
      return 'Todos los almacenes';
    }

    const nombres = ids
      .map((id) => this.almacenes().find((almacen) => almacen.id === id)?.nombre ?? id)
      .filter(Boolean);
    return nombres.length > 0 ? nombres.join(', ') : 'Todos los almacenes';
  }

  protected nombreEstablecimientoPorId(id: string): string {
    const establecimiento = this.configuracion().establecimientos.find((item) => item.id === id);
    return establecimiento ? `${establecimiento.codigo} · ${establecimiento.nombre}` : 'Desconocido';
  }

  protected nombreFirmaPorId(firmaId: string): string {
    const firma = this.firmas().find((item) => item.id === firmaId);
    return firma ? this.etiquetaFirma(firma) : 'Sin firma';
  }

  protected etiquetaFirma(firma: FirmaDigitalConfig): string {
    const ruc = firma.ruc ? ` · ${firma.ruc}` : '';
    const razonSocial = firma.razonSocial ? ` · ${firma.razonSocial}` : '';
    return `${firma.nombreArchivo}${ruc}${razonSocial}`;
  }

  protected seleccionarLogo(): void {
    this.dialog.open<
      ArchivoSelectorDialogComponent,
      ArchivoSelectorDialogData,
      ArchivoSelectorDialogResult | null
    >(ArchivoSelectorDialogComponent, {
      data: {
        title: 'Logo de la empresa',
        subtitle: 'Selecciona una imagen ya cargada o sube el logo que aparecerá en el RIDE.',
        sourceModule: 'facturacion',
        extensions: ['png', 'jpg', 'jpeg']
      },
      width: '960px',
      maxWidth: '95vw',
      maxHeight: '92vh',
      autoFocus: false
    }).afterClosed().subscribe((resultado) => {
      const url = resultado?.archivo.downloadUrl?.trim();
      if (!url) {
        return;
      }
      this.fiscalForm.controls.logoUrl.setValue(url);
      this.fiscalForm.controls.logoUrl.markAsDirty();
      this.mostrarMensaje('Logo seleccionado. Guarda los cambios para aplicarlo al RIDE.', 'image');
    });
  }

  protected quitarLogo(): void {
    this.fiscalForm.controls.logoUrl.setValue('');
    this.fiscalForm.controls.logoUrl.markAsDirty();
  }

  protected async guardarConfiguracion(): Promise<void> {
    // Guardar ahora escribiria el nodo completo con un estado que ya no incluye lo que se
    // cambio por otro lado: perderia esos cambios en silencio.
    if (this.configuracionDesactualizada()) {
      this.mostrarMensaje(
        'La configuración cambió en otro sitio. Descarta tus cambios para ver la versión actual.',
        'warning'
      );
      return;
    }
    if (this.fiscalForm.invalid) {
      this.fiscalForm.markAllAsTouched();
      this.selectedTabIndex.set(0);
      this.mostrarMensaje('Revisa los campos tributarios antes de guardar.', 'warning');
      return;
    }

    this.guardando.set(true);
    try {
      const actualizada = { ...this.configuracion(), ...this.fiscalForm.getRawValue() };
      this.configuracion.set(actualizada);
      await this.facturacionService.guardarConfiguracion(actualizada);
      this.mainDirty.set(false);
      this.mostrarMensaje('Cambios de facturación guardados.', 'save');
    } catch {
      this.mostrarMensaje('No se pudieron guardar los cambios.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  protected guardarCorreo(): void {
    if (this.correoConfiguracionInvalida()) {
      this.correoForm.markAllAsTouched();
      this.mostrarMensaje('Revisa los datos del remitente antes de guardar.', 'warning');
      return;
    }

    this.guardandoCorreo.set(true);
    const raw = this.correoForm.getRawValue();
    const { testRecipient: _testRecipient, ...payload } = raw;
    this.facturacionService.guardarConfiguracionCorreo(payload).subscribe({
      next: (saved) => {
        this.passwordConfigured.set(!!saved.passwordConfigured);
        this.correoForm.controls.password.setValue('', { emitEvent: false });
        this.correoBaseline = this.serializarCorreo();
        this.guardandoCorreo.set(false);
        this.correoDirty.set(false);
        this.mostrarMensaje('Configuración de correo guardada.', 'mail');
      },
      error: (error) => {
        this.guardandoCorreo.set(false);
        this.mostrarMensaje(error?.error?.message ?? 'No se pudo guardar el correo.', 'error');
      }
    });
  }

  protected probarCorreo(): void {
    const recipient = this.correoForm.controls.testRecipient.value.trim();
    if (this.correoDirty()) {
      this.mostrarMensaje('Guarda los cambios antes de enviar una prueba.', 'warning');
      return;
    }
    if (!recipient || this.correoForm.controls.testRecipient.invalid) {
      this.mostrarMensaje('Ingresa un destinatario de prueba válido.', 'warning');
      return;
    }

    this.probandoCorreo.set(true);
    this.facturacionService.probarConfiguracionCorreo(recipient).subscribe({
      next: (result) => {
        this.probandoCorreo.set(false);
        this.mostrarMensaje(
          result.status === 'SENT'
            ? `Correo enviado mediante ${result.channelUsed}.`
            : (result.error ?? 'Falló el envío de prueba.'),
          result.status === 'SENT' ? 'mark_email_read' : 'error'
        );
      },
      error: () => {
        this.probandoCorreo.set(false);
        this.mostrarMensaje('No se pudo probar el correo.', 'error');
      }
    });
  }

  protected correoConfiguracionInvalida(): boolean {
    if (this.permiteCopiaOculta() && this.correoForm.controls.bccAddress.invalid) {
      return true;
    }
    if (this.correoForm.controls.mode.value === 'SAAS_DEFAULT') {
      return false;
    }

    const { host, port, fromAddress, replyTo } = this.correoForm.controls;
    return !host.value.trim()
      || port.invalid
      || port.value < 1
      || !fromAddress.value.trim()
      || fromAddress.invalid
      || replyTo.invalid;
  }

  private esAmbienteProduccion(codigo: string | null): boolean {
    if (!codigo) {
      return false;
    }
    const entrada = this.catalogos().ambiente.find((item) => item.code === codigo);
    return (entrada ? /prod/i.test(entrada.value) : false)
      || codigo === '2'
      || codigo.toUpperCase() === 'PRODUCCION';
  }

  private serializarCorreo(): string {
    const { testRecipient: _testRecipient, ...configuracionCorreo } = this.correoForm.getRawValue();
    return JSON.stringify(configuracionCorreo);
  }

  private mostrarMensaje(message: string, icon: string): void {
    this.snackBar.openFromComponent(SuccessSnackbarComponent, {
      data: { message, icon },
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  private generarIdEstablecimiento(): string {
    return `estab_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  private generarIdPunto(): string {
    return `pto_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }
}
