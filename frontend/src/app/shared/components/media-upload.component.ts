import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UploadService, UploadResponse, UploadProgress } from '../../core/services/upload.service';

@Component({
  selector: 'app-media-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule
  ],
  template: `
    <div class="media-upload-container">
      <div class="upload-area" 
           [class.drag-over]="isDragOver"
           (dragover)="onDragOver($event)"
           (dragleave)="onDragLeave($event)"
           (drop)="onDrop($event)">
        
        <mat-icon class="upload-icon">cloud_upload</mat-icon>
        <p class="upload-text">Drag & drop images here</p>
        <p class="upload-subtext">or</p>
        
        <button mat-raised-button color="primary" type="button" (click)="fileInput.click()">
          <mat-icon>add_photo_alternate</mat-icon>
          Choose Files
        </button>
        
        <input #fileInput type="file" 
               [accept]="acceptedTypes" 
               [multiple]="multiple"
               (change)="onFileSelected($event)"
               hidden>
        
        <p class="file-hint">Supported formats: JPG, PNG, GIF, WebP (Max 5MB each)</p>
      </div>

      <!-- Upload Progress -->
      <div *ngIf="uploading" class="upload-progress">
        <mat-progress-bar mode="determinate" [value]="uploadProgress"></mat-progress-bar>
        <span class="progress-text">Uploading... {{ uploadProgress }}%</span>
      </div>

      <!-- Uploaded Files Preview -->
      <div *ngIf="uploadedFiles.length > 0" class="uploaded-files">
        <h4>Uploaded Media ({{ uploadedFiles.length }})</h4>
        <div class="file-grid">
          <div *ngFor="let file of uploadedFiles; let i = index" class="file-item">
            <img [src]="getFileUrl(file.path)" [alt]="file.filename" class="file-preview">
            <div class="file-overlay">
              <button mat-icon-button color="warn" type="button" (click)="removeFile(i)" title="Remove">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
            <span class="file-name">{{ file.filename | slice:0:15 }}{{ file.filename.length > 15 ? '...' : '' }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .media-upload-container {
      width: 100%;
    }

    .upload-area {
      border: 2px dashed #ccc;
      border-radius: 12px;
      padding: 40px 20px;
      text-align: center;
      background: #fafafa;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .upload-area:hover,
    .upload-area.drag-over {
      border-color: #3f51b5;
      background: #f0f3ff;
    }

    .upload-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #9e9e9e;
      margin-bottom: 16px;
    }

    .upload-text {
      font-size: 16px;
      color: #666;
      margin: 0 0 8px 0;
    }

    .upload-subtext {
      font-size: 14px;
      color: #999;
      margin: 0 0 16px 0;
    }

    .file-hint {
      font-size: 12px;
      color: #999;
      margin: 16px 0 0 0;
    }

    .upload-progress {
      margin-top: 16px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .progress-text {
      display: block;
      text-align: center;
      margin-top: 8px;
      color: #666;
      font-size: 14px;
    }

    .uploaded-files {
      margin-top: 24px;
    }

    .uploaded-files h4 {
      margin: 0 0 16px 0;
      color: #333;
      font-weight: 500;
    }

    .file-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 16px;
    }

    .file-item {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .file-preview {
      width: 100%;
      height: 100px;
      object-fit: cover;
      display: block;
    }

    .file-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .file-item:hover .file-overlay {
      opacity: 1;
    }

    .file-name {
      display: block;
      padding: 8px;
      font-size: 11px;
      color: #666;
      text-align: center;
      background: #f9f9f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `]
})
export class MediaUploadComponent {
  @Input() multiple: boolean = true;
  @Input() acceptedTypes: string = 'image/jpeg,image/png,image/gif,image/webp';
  @Input() uploadedFiles: Array<{ filename: string; path: string }> = [];
  
  @Output() filesUploaded = new EventEmitter<Array<{ filename: string; path: string }>>();
  @Output() fileRemoved = new EventEmitter<{ index: number; file: { filename: string; path: string } }>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  isDragOver = false;
  uploading = false;
  uploadProgress = 0;

  constructor(
    private uploadService: UploadService,
    private snackBar: MatSnackBar
  ) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFiles(Array.from(files));
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFiles(Array.from(input.files));
      input.value = ''; // Reset input
    }
  }

  private processFiles(files: File[]): void {
    // Validate files
    const validFiles: File[] = [];
    for (const file of files) {
      const validation = this.uploadService.validateFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        this.snackBar.open(`${file.name}: ${validation.error}`, 'Close', { duration: 4000 });
      }
    }

    if (validFiles.length === 0) {
      return;
    }

    // Upload files
    this.uploading = true;
    this.uploadProgress = 0;

    if (validFiles.length === 1) {
      this.uploadSingleFile(validFiles[0]);
    } else {
      this.uploadMultipleFiles(validFiles);
    }
  }

  private uploadSingleFile(file: File): void {
    this.uploadService.uploadFileWithProgress(file).subscribe({
      next: (result) => {
        if ('progress' in result) {
          this.uploadProgress = result.progress;
        } else {
          // Upload complete
          this.uploadedFiles.push({
            filename: result.filename,
            path: result.path
          });
          this.filesUploaded.emit(this.uploadedFiles);
          this.uploading = false;
          this.snackBar.open('File uploaded successfully!', 'Close', { duration: 3000 });
        }
      },
      error: (error) => {
        console.error('Upload error:', error);
        this.uploading = false;
        this.snackBar.open('Upload failed. Please try again.', 'Close', { duration: 4000 });
      }
    });
  }

  private uploadMultipleFiles(files: File[]): void {
    this.uploadService.uploadMultipleFiles(files).subscribe({
      next: (result) => {
        this.uploadedFiles.push(...result.files);
        this.filesUploaded.emit(this.uploadedFiles);
        this.uploading = false;
        this.snackBar.open(`${result.files.length} files uploaded successfully!`, 'Close', { duration: 3000 });
      },
      error: (error) => {
        console.error('Upload error:', error);
        this.uploading = false;
        this.snackBar.open('Upload failed. Please try again.', 'Close', { duration: 4000 });
      }
    });
  }

  removeFile(index: number): void {
    const file = this.uploadedFiles[index];
    
    this.uploadService.deleteFile(file.filename).subscribe({
      next: () => {
        this.uploadedFiles.splice(index, 1);
        this.fileRemoved.emit({ index, file });
        this.snackBar.open('File removed', 'Close', { duration: 2000 });
      },
      error: (error) => {
        console.error('Delete error:', error);
        this.snackBar.open('Failed to remove file', 'Close', { duration: 3000 });
      }
    });
  }

  getFileUrl(path: string): string {
    return this.uploadService.getFileUrl(path);
  }
}
