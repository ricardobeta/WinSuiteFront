import { Injectable, inject } from '@angular/core';
import { Database, get, onValue, push, ref as databaseRef, remove, runTransaction, set } from '@angular/fire/database';
import { Storage, deleteObject, getDownloadURL, ref as storageRef, uploadBytesResumable } from '@angular/fire/storage';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';
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

  getUsage(): Observable<ArchivosUsage> {
    return new Observable<ArchivosUsage>((subscriber) => {
      const tenantId = this.authService.getTenantId();
      const statsRef = databaseRef(this.database, this.getStatsPath(tenantId));

      const unsubscribe = onValue(
        statsRef,
        (snapshot) => {
          const value = (snapshot.val() as Partial<ArchivosUsage> | null) ?? null;
          subscriber.next({
            totalBytes: typeof value?.totalBytes === 'number' ? value.totalBytes : 0,
            totalCount: typeof value?.totalCount === 'number' ? value.totalCount : 0,
            updatedAt: typeof value?.updatedAt === 'number' ? value.updatedAt : undefined
          });
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    });
  }

  async getUsageOnce(): Promise<ArchivosUsage> {
    const tenantId = this.authService.getTenantId();
    const snapshot = await get(databaseRef(this.database, this.getStatsPath(tenantId)));
    const value = (snapshot.val() as Partial<ArchivosUsage> | null) ?? null;

    return {
      totalBytes: typeof value?.totalBytes === 'number' ? value.totalBytes : 0,
      totalCount: typeof value?.totalCount === 'number' ? value.totalCount : 0,
      updatedAt: typeof value?.updatedAt === 'number' ? value.updatedAt : undefined
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
        subscriber.error(error instanceof Error ? error : new Error('No se pudo resolver el tenantId.'));
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

  private async reserveUsage(tenantId: string, fileSize: number): Promise<void> {
    const statsRef = databaseRef(this.database, this.getStatsPath(tenantId));

    const result = await runTransaction(statsRef, (current) => {
      const safe = (current as Partial<ArchivosUsage> | null) ?? null;
      const totalBytes = typeof safe?.totalBytes === 'number' ? safe.totalBytes : 0;
      const totalCount = typeof safe?.totalCount === 'number' ? safe.totalCount : 0;

      if (totalBytes + fileSize > ARCHIVO_MAX_TOTAL_BYTES) {
        return;
      }

      return {
        totalBytes: totalBytes + fileSize,
        totalCount: totalCount + 1,
        updatedAt: Date.now()
      };
    });

    if (!result.committed) {
      throw new Error('El limite total de 20 MB ya fue alcanzado. Elimina archivos para liberar espacio.');
    }
  }

  private async adjustUsage(tenantId: string, bytesDelta: number, countDelta: number): Promise<void> {
    const statsRef = databaseRef(this.database, this.getStatsPath(tenantId));

    await runTransaction(statsRef, (current) => {
      const safe = (current as Partial<ArchivosUsage> | null) ?? null;
      const totalBytes = typeof safe?.totalBytes === 'number' ? safe.totalBytes : 0;
      const totalCount = typeof safe?.totalCount === 'number' ? safe.totalCount : 0;

      return {
        totalBytes: Math.max(0, totalBytes + bytesDelta),
        totalCount: Math.max(0, totalCount + countDelta),
        updatedAt: Date.now()
      };
    });
  }

  private getArchivosPath(tenantId: string): string {
    return `archivos/${tenantId}`;
  }

  private getStatsPath(tenantId: string): string {
    return `archivos_stats/${tenantId}`;
  }
}
