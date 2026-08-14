import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Database, endAt, get, onValue, orderByChild, push, query, ref as databaseRef, remove, set, startAt } from '@angular/fire/database';
import { Storage, deleteObject, getDownloadURL, ref as storageRef, uploadBytesResumable } from '@angular/fire/storage';
import { Observable, firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { PlanService } from './plan.service';
import {
  ARCHIVO_ALLOWED_EXTENSIONS,
  ARCHIVO_MAX_FILE_BYTES,
  ARCHIVO_MAX_TOTAL_BYTES,
  ArchivoExtension,
  ArchivoItem,
  ArchivoUploadEvent,
  ArchivoUploadOptions,
  ArchivosUsage
} from '../../shared/models/archivos.models';

@Injectable({
  providedIn: 'root'
})
export class ArchivosService {
  private readonly database = inject(Database);
  private readonly storage = inject(Storage);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly planService = inject(PlanService);

  /**
   * Consumo de espacio publicado como observable. Se construye aqui, en el inicializador del
   * campo, porque toObservable() exige contexto de inyeccion: crearlo dentro de getUsage()
   * revienta con NG0203 en cuanto un componente lo llama desde ngOnInit.
   */
  private readonly usage$ = toObservable(
    computed(() => {
      const acumulado = this.planService.uso()?.acumulado ?? {};
      return {
        totalBytes: acumulado.storageBytes ?? 0,
        totalCount: (acumulado as Record<string, number>)['storageCount'] ?? 0,
        updatedAt: undefined
      } satisfies ArchivosUsage;
    })
  );

  getArchivos(): Observable<ArchivoItem[]> {
    return new Observable<ArchivoItem[]>((subscriber) => {
      const tenantId = this.authService.getTenantId();
      const archivosRef = databaseRef(this.database, this.getArchivosPath(tenantId));

      const unsubscribe = onValue(
        archivosRef,
        (snapshot) => {
          const archivos: ArchivoItem[] = [];

          snapshot.forEach((child) => {
            const value = child.val() as Partial<ArchivoItem> | null;
            if (!value) {
              return false;
            }

            archivos.push({
              id: child.key ?? value.id ?? '',
              tenantId: value.tenantId ?? tenantId,
              name: value.name ?? 'Sin nombre',
              sizeBytes: typeof value.sizeBytes === 'number' ? value.sizeBytes : 0,
              contentType: value.contentType,
              extension: value.extension,
              sourceModule: value.sourceModule,
              managedByBackend: value.managedByBackend,
              sourceEntityId: value.sourceEntityId,
              sourceVersion: value.sourceVersion,
              sha256: value.sha256,
              jobId: value.jobId,
              claveAcceso: value.claveAcceso,
              tipoArchivo: value.tipoArchivo,
              fechaEmision: value.fechaEmision,
              rucProveedor: value.rucProveedor,
              proveedor: value.proveedor,
              numeroDocumento: value.numeroDocumento,
              uploadedBy: value.uploadedBy,
              uploadedById: value.uploadedById,
              uploadedAt: typeof value.uploadedAt === 'number' ? value.uploadedAt : Date.now(),
              storagePath: value.storagePath ?? '',
              downloadUrl: value.downloadUrl ?? ''
            });

            return false;
          });

          archivos.sort((a, b) => b.uploadedAt - a.uploadedAt);
          subscriber.next(archivos);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getArchivosPorFechaEmision(fechaInicio: string, fechaFin: string): Promise<ArchivoItem[]> {
    const tenantId = this.authService.getTenantId();
    const porFechaEmisionQuery = query(
      databaseRef(this.database, this.getArchivosPath(tenantId)),
      orderByChild('fechaEmision'),
      startAt(fechaInicio),
      endAt(fechaFin)
    );
    const porNombreQuery = query(
      databaseRef(this.database, this.getArchivosPath(tenantId)),
      orderByChild('name'),
      startAt(fechaInicio),
      endAt(`${fechaFin}\uf8ff`)
    );
    const [porFechaEmision, porNombre] = await Promise.all([
      get(porFechaEmisionQuery),
      get(porNombreQuery)
    ]);
    const archivos: ArchivoItem[] = [];
    const vistos = new Set<string>();

    for (const snapshot of [porFechaEmision, porNombre]) {
      snapshot.forEach((child) => {
        const value = child.val() as Partial<ArchivoItem> | null;
        if (!value) {
          return false;
        }
        const id = child.key ?? value.id ?? '';
        if (!id || vistos.has(id)) {
          return false;
        }
        vistos.add(id);
        archivos.push(this.mapArchivoItem(id, tenantId, value));
        return false;
      });
    }

    archivos.sort((a, b) => b.uploadedAt - a.uploadedAt);
    return archivos;
  }

  /**
   * Consumo de espacio de la empresa. Sale del plan resuelto en el backend: el nodo
   * archivos_stats dejo de ser la fuente de verdad porque el cliente podia escribirlo.
   */
  getUsage(): Observable<ArchivosUsage> {
    return this.usage$;
  }

  async getUsageOnce(): Promise<ArchivosUsage> {
    await this.planService.refresh().catch(() => undefined);
    const acumulado = this.planService.uso()?.acumulado ?? {};
    return {
      totalBytes: acumulado.storageBytes ?? 0,
      totalCount: (acumulado as Record<string, number>)['storageCount'] ?? 0,
      updatedAt: undefined
    };
  }


  uploadArchivo(file: File, options: ArchivoUploadOptions = {}): Observable<ArchivoUploadEvent> {
    return new Observable<ArchivoUploadEvent>((subscriber) => {
      const validationError = this.validateFile(file);
      if (validationError) {
        subscriber.error(new Error(validationError));
        return;
      }

      let tenantId: string;
      try {
        tenantId = this.authService.getTenantId();
      } catch (error) {
        subscriber.error(error instanceof Error ? error : new Error('No se pudo identificar la empresa asociada a la sesion.'));
        return;
      }

      const metadataRef = push(databaseRef(this.database, this.getArchivosPath(tenantId)));
      const fileId = metadataRef.key;
      if (!fileId) {
        subscriber.error(new Error('No se pudo generar el identificador del archivo.'));
        return;
      }

      const storagePath = this.buildStoragePath(tenantId, fileId, file.name);
      const storageFileRef = storageRef(this.storage, storagePath);

      let cancelled = false;
      let uploadTask: ReturnType<typeof uploadBytesResumable> | null = null;

      const rollbackQuota = async () => {
        await this.adjustUsage(tenantId, -file.size, -1);
      };

      const onFailure = async (message: string) => {
        await rollbackQuota();
        if (!cancelled) {
          subscriber.error(new Error(message));
        }
      };

      this.reserveUsage(tenantId, file.size)
        .then(() => {
          uploadTask = uploadBytesResumable(storageFileRef, file, {
            contentType: file.type || undefined
          });

          uploadTask.on(
            'state_changed',
            (snapshot) => {
              if (cancelled) {
                return;
              }
              const progress = snapshot.totalBytes
                ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
                : 0;
              subscriber.next({
                status: 'uploading',
                progress
              });
            },
            () => {
              void onFailure('No se pudo subir el archivo. Intenta nuevamente.');
            },
            async () => {
              try {
                const downloadUrl = await getDownloadURL(uploadTask!.snapshot.ref);
                const extension = this.getExtension(file.name) ?? undefined;
                const profile = this.authService.currentProfile();
                const user = this.authService.currentUser();

                const uploadedBy =
                  profile?.fullName || user?.displayName || profile?.email || user?.email || 'Usuario';

                const uploadedById = profile?.userId || user?.uid || undefined;

                const item: ArchivoItem = {
                  id: fileId,
                  tenantId,
                  name: file.name,
                  sizeBytes: file.size,
                  contentType: file.type || undefined,
                  extension,
                  sourceModule: options.sourceModule ?? 'general',
                  uploadedBy,
                  uploadedById,
                  uploadedAt: Date.now(),
                  storagePath,
                  downloadUrl
                };

                await set(metadataRef, item);

                subscriber.next({
                  status: 'success',
                  progress: 100,
                  item
                });
                subscriber.complete();
              } catch (error) {
                try {
                  await deleteObject(storageFileRef);
                } catch {
                  // Ignore cleanup errors.
                }
                void onFailure('No se pudo guardar la metadata del archivo.');
              }
            }
          );
        })
        .catch((error) => {
          subscriber.error(error instanceof Error ? error : new Error('No se pudo reservar espacio.'));
        });

      return () => {
        cancelled = true;
        if (uploadTask && uploadTask.snapshot.state === 'running') {
          uploadTask.cancel();
        }
      };
    });
  }

  async deleteArchivo(item: ArchivoItem): Promise<void> {
    const tenantId = this.authService.getTenantId();
    const metadataRef = databaseRef(this.database, `${this.getArchivosPath(tenantId)}/${item.id}`);

    await remove(metadataRef);

    if (item.storagePath) {
      try {
        await deleteObject(storageRef(this.storage, item.storagePath));
      } catch {
        // Ignore storage delete errors.
      }
    }

    if (typeof item.sizeBytes === 'number' && item.sizeBytes > 0) {
      await this.adjustUsage(tenantId, -item.sizeBytes, -1);
    }
  }

  private validateFile(file: File): string | null {
    if (file.size > ARCHIVO_MAX_FILE_BYTES) {
      return 'El archivo supera el limite de 2 MB por archivo.';
    }

    const extension = this.getExtension(file.name);
    if (!extension || !ARCHIVO_ALLOWED_EXTENSIONS.includes(extension)) {
      return 'Tipo de archivo no permitido. Usa Excel, CSV, XML, PDF o imagenes.';
    }

    return null;
  }

  private getExtension(fileName: string): ArchivoExtension | null {
    const parts = fileName.split('.');
    if (parts.length <= 1) {
      return null;
    }
    const extension = parts.pop()?.toLowerCase() ?? null;
    if (extension && ARCHIVO_ALLOWED_EXTENSIONS.includes(extension as ArchivoExtension)) {
      return extension as ArchivoExtension;
    }

    return null;
  }

  private buildStoragePath(tenantId: string, fileId: string, fileName: string): string {
    const sanitized = this.sanitizeFileName(fileName);
    return `archivos/${tenantId}/${fileId}/${sanitized}`;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'archivo';
  }

  /**
   * El espacio lo concede el backend contra el plan de la empresa. Antes se contaba en
   * archivos_stats desde el navegador, que podia escribirlo: el tope era evadible.
   * Un 402 lo explica el QuotaInterceptor con la opcion de comprar mas espacio.
   */
  private async reserveUsage(_tenantId: string, fileSize: number): Promise<void> {
    await firstValueFrom(
      this.http.post<void>(`${environment.apiBaseUrl}/api/tenants/current/archivos/reservar`, {
        bytes: fileSize
      })
    );
    await this.planService.refresh().catch(() => undefined);
  }

  /** Devuelve espacio al borrar un archivo o al fallar una subida ya reservada. */
  private async adjustUsage(_tenantId: string, bytesDelta: number, _countDelta: number): Promise<void> {
    if (bytesDelta >= 0) {
      return;
    }
    await firstValueFrom(
      this.http.post<void>(`${environment.apiBaseUrl}/api/tenants/current/archivos/liberar`, {
        bytes: Math.abs(bytesDelta)
      })
    );
    await this.planService.refresh().catch(() => undefined);
  }

  /**
   * Busca un archivo por su clave de acceso SRI (compartida entre el XML y su RIDE/PDF),
   * opcionalmente filtrando por extensión (ej. 'pdf'). Devuelve el más reciente que coincida.
   */
  async buscarPorClaveAcceso(claveAcceso: string, extension?: string): Promise<ArchivoItem | null> {
    const clave = (claveAcceso ?? '').trim();
    if (!clave) {
      return null;
    }
    const tenantId = this.authService.getTenantId();
    const snapshot = await get(databaseRef(this.database, this.getArchivosPath(tenantId)));
    if (!snapshot.exists()) {
      return null;
    }
    const ext = extension?.toLowerCase();
    const coincidencias: ArchivoItem[] = [];
    snapshot.forEach((child) => {
      const value = child.val() as Partial<ArchivoItem> | null;
      if (!value || (value.claveAcceso ?? '').trim() !== clave) {
        return false;
      }
      const valueExt = (value.extension ?? '').toString().toLowerCase();
      if (ext && valueExt !== ext) {
        return false;
      }
      coincidencias.push({
        id: child.key ?? value.id ?? '',
        tenantId: value.tenantId ?? tenantId,
        name: value.name ?? 'Sin nombre',
        sizeBytes: typeof value.sizeBytes === 'number' ? value.sizeBytes : 0,
        contentType: value.contentType,
        extension: value.extension,
        sourceModule: value.sourceModule,
        managedByBackend: value.managedByBackend,
        sourceEntityId: value.sourceEntityId,
        sourceVersion: value.sourceVersion,
        sha256: value.sha256,
        jobId: value.jobId,
        claveAcceso: value.claveAcceso,
        tipoArchivo: value.tipoArchivo,
        fechaEmision: value.fechaEmision,
        rucProveedor: value.rucProveedor,
        proveedor: value.proveedor,
        numeroDocumento: value.numeroDocumento,
        uploadedBy: value.uploadedBy,
        uploadedById: value.uploadedById,
        uploadedAt: typeof value.uploadedAt === 'number' ? value.uploadedAt : Date.now(),
        storagePath: value.storagePath ?? '',
        downloadUrl: value.downloadUrl ?? ''
      });
      return false;
    });
    if (coincidencias.length === 0) {
      return null;
    }
    coincidencias.sort((a, b) => b.uploadedAt - a.uploadedAt);
    return coincidencias[0];
  }

  private mapArchivoItem(id: string, tenantId: string, value: Partial<ArchivoItem>): ArchivoItem {
    return {
      id,
      tenantId: value.tenantId ?? tenantId,
      name: value.name ?? 'Sin nombre',
      sizeBytes: typeof value.sizeBytes === 'number' ? value.sizeBytes : 0,
      contentType: value.contentType,
      extension: value.extension,
      sourceModule: value.sourceModule,
      managedByBackend: value.managedByBackend,
      sourceEntityId: value.sourceEntityId,
      sourceVersion: value.sourceVersion,
      sha256: value.sha256,
      jobId: value.jobId,
      claveAcceso: value.claveAcceso,
      tipoArchivo: value.tipoArchivo,
      fechaEmision: value.fechaEmision,
      rucProveedor: value.rucProveedor,
      proveedor: value.proveedor,
      numeroDocumento: value.numeroDocumento,
      uploadedBy: value.uploadedBy,
      uploadedById: value.uploadedById,
      uploadedAt: typeof value.uploadedAt === 'number' ? value.uploadedAt : Date.now(),
      storagePath: value.storagePath ?? '',
      downloadUrl: value.downloadUrl ?? ''
    };
  }

  private getArchivosPath(tenantId: string): string {
    return `archivos/${tenantId}`;
  }

}
