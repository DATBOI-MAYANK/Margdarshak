import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpProgressEvent } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getApiUrl, getApiBase } from './runtime-config';

export interface UploadResponse {
  message: string;
  filename: string;
  path: string;
}

export interface MultipleUploadResponse {
  message: string;
  files: Array<{ filename: string; path: string }>;
}

export interface UploadProgress {
  progress: number;
  loaded: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private apiUrl = `${getApiUrl()}/upload`;

  constructor(private http: HttpClient) {}

  /**
   * Upload a single file
   */
  uploadFile(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<UploadResponse>(this.apiUrl, formData);
  }

  /**
   * Upload a single file with progress tracking
   */
  uploadFileWithProgress(file: File): Observable<UploadProgress | UploadResponse> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<UploadResponse>(this.apiUrl, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      map((event: HttpEvent<UploadResponse>) => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            const progressEvent = event as HttpProgressEvent;
            const total = progressEvent.total || 0;
            const loaded = progressEvent.loaded;
            const progress = total ? Math.round((loaded / total) * 100) : 0;
            return { progress, loaded, total } as UploadProgress;
          case HttpEventType.Response:
            return event.body as UploadResponse;
          default:
            return { progress: 0, loaded: 0, total: 0 } as UploadProgress;
        }
      })
    );
  }

  /**
   * Upload multiple files
   */
  uploadMultipleFiles(files: File[]): Observable<MultipleUploadResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });

    return this.http.post<MultipleUploadResponse>(`${this.apiUrl}/multiple`, formData);
  }

  /**
   * Delete an uploaded file
   */
  deleteFile(filename: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${filename}`);
  }

  /**
   * Get full URL for an uploaded file
   */
  getFileUrl(path: string): string {
    if (path.startsWith('http')) {
      return path;
    }
    return `${getApiBase()}/${path}`;
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File, maxSizeMB: number = 5, allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']): { valid: boolean; error?: string } {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}`
      };
    }

    // Check file size
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File too large. Maximum size: ${maxSizeMB}MB`
      };
    }

    return { valid: true };
  }
}
