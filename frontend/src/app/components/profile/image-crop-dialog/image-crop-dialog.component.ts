import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { ImageCropperModule, ImageCroppedEvent } from 'ngx-image-cropper';

export interface ImageCropDialogData {
  imageFile: File;
}

@Component({
  selector: 'app-image-crop-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    ImageCropperModule
  ],
  template: `
    <div class="crop-dialog">
      <h2 mat-dialog-title>
        <mat-icon>crop</mat-icon>
        Crop Profile Picture
      </h2>
      
      <mat-dialog-content>
        <div class="cropper-container">
          <image-cropper
            [imageFile]="data.imageFile"
            [maintainAspectRatio]="true"
            [aspectRatio]="1"
            [roundCropper]="true"
            [resizeToWidth]="300"
            format="png"
            output="blob"
            (imageCropped)="imageCropped($event)"
            (imageLoaded)="imageLoaded()"
            (cropperReady)="cropperReady()"
            (loadImageFailed)="loadImageFailed()">
          </image-cropper>
        </div>
        
        <div class="preview-section" *ngIf="croppedImage">
          <p>Preview:</p>
          <div class="preview-avatar">
            <img [src]="croppedImage" alt="Preview">
          </div>
        </div>
      </mat-dialog-content>
      
      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">
          <mat-icon>close</mat-icon>
          Cancel
        </button>
        <button mat-raised-button color="primary" (click)="onConfirm()" [disabled]="!croppedBlob && !croppedImage">
          <mat-icon>check</mat-icon>
          Apply
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .crop-dialog {
      min-width: 400px;
      max-width: 90vw;
    }
    
    h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      color: #1e3c72;
      
      & mat-icon {
        color: #667eea;
      }
    }
    
    mat-dialog-content {
      padding: 20px 0;
    }
    
    .cropper-container {
      max-height: 400px;
      overflow: hidden;
      border-radius: 12px;
      background: #f5f5f5;
    }
    
    .preview-section {
      margin-top: 20px;
      text-align: center;
      
      & p {
        margin: 0 0 12px;
        color: #666;
        font-size: 0.9rem;
      }
      
      .preview-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        overflow: hidden;
        margin: 0 auto;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border: 3px solid #667eea;
        
        & img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }
    }
    
    mat-dialog-actions {
      padding: 16px 0 0;
      margin: 0;
      
      & button {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
  `]
})
export class ImageCropDialogComponent {
  croppedImage: string = '';
  croppedBlob: Blob | null = null;

  constructor(
    public dialogRef: MatDialogRef<ImageCropDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ImageCropDialogData
  ) {}

  imageCropped(event: ImageCroppedEvent) {
    // Handle blob output (ngx-image-cropper v7+)
    if (event.blob) {
      this.croppedBlob = event.blob;
      // Create preview URL from blob
      this.croppedImage = URL.createObjectURL(event.blob);
    } else if (event.base64) {
      // Fallback for base64 output
      this.croppedImage = event.base64;
    }
  }

  imageLoaded() {
    // Image loaded
  }

  cropperReady() {
    // Cropper ready
  }

  loadImageFailed() {
    this.dialogRef.close();
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.croppedBlob) {
      // Use blob directly (ngx-image-cropper v7+)
      const file = new File([this.croppedBlob], 'profile-picture.png', { type: 'image/png' });
      this.dialogRef.close({ file, preview: this.croppedImage });
    } else if (this.croppedImage && this.croppedImage.startsWith('data:')) {
      // Fallback: Convert base64 to blob then to file
      const byteString = atob(this.croppedImage.split(',')[1]);
      const mimeString = this.croppedImage.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const file = new File([blob], 'profile-picture.png', { type: 'image/png' });
      this.dialogRef.close({ file, preview: this.croppedImage });
    }
  }
}
