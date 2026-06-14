export const ARCHIVO_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const ARCHIVO_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const ARCHIVO_ALLOWED_EXTENSIONS = ['xls', 'xlsx', 'csv', 'png', 'jpg', 'jpeg', 'webp'] as const;

export type ArchivoExtension = (typeof ARCHIVO_ALLOWED_EXTENSIONS)[number];

export interface ArchivoItem {
  id: string;
  tenantId: string;
  name: string;
  sizeBytes: number;
  contentType?: string;
  extension?: ArchivoExtension | string;
  sourceModule?: string;
  uploadedBy?: string;
  uploadedById?: string;
  uploadedAt: number;
  storagePath: string;
  downloadUrl: string;
}

export interface ArchivosUsage {
  totalBytes: number;
  totalCount: number;
  updatedAt?: number;
}

export interface ArchivoUploadOptions {
  sourceModule?: string;
}

export type ArchivoUploadStatus = 'uploading' | 'success';

export interface ArchivoUploadEvent {
  status: ArchivoUploadStatus;
  progress: number;
  item?: ArchivoItem;
}
