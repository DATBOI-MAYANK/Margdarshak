import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { MessageService } from '../../core/services/message.service';

@Component({
  selector: 'app-contact-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="contact-dialog">
      <h2 mat-dialog-title>
        <mat-icon>support_agent</mat-icon>
        Contact Support
      </h2>

      <mat-dialog-content>
        <p class="info-text">Have a question or need help? Send us a message and we'll get back to you soon.</p>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Category</mat-label>
          <mat-select [(ngModel)]="category">
            <mat-option value="general">General Inquiry</mat-option>
            <mat-option value="technical">Technical Issue</mat-option>
            <mat-option value="collaboration">Collaboration Issue</mat-option>
            <mat-option value="account">Account Related</mat-option>
            <mat-option value="feedback">Feedback</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Subject</mat-label>
          <input matInput [(ngModel)]="subject" placeholder="Brief description of your issue" maxlength="200">
          <mat-hint>{{ subject.length }}/200</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Message</mat-label>
          <textarea matInput [(ngModel)]="content" rows="6" placeholder="Describe your issue or question in detail..." maxlength="2000"></textarea>
          <mat-hint>{{ content.length }}/2000</mat-hint>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close [disabled]="sending">Cancel</button>
        <button mat-raised-button color="primary" (click)="send()" [disabled]="!isValid() || sending">
          <mat-spinner *ngIf="sending" diameter="20"></mat-spinner>
          <mat-icon *ngIf="!sending">send</mat-icon>
          {{ sending ? 'Sending...' : 'Send Message' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .contact-dialog {
      & h2 {
        display: flex;
        align-items: center;
        gap: 12px;
        color: #333;

        & mat-icon {
          color: #667eea;
        }
      }

      .info-text {
        color: #666;
        margin-bottom: 20px;
      }

      .full-width {
        width: 100%;
        margin-bottom: 16px;
      }

      & mat-dialog-actions button {
        display: flex;
        align-items: center;
        gap: 8px;

        & mat-spinner {
          margin-right: 8px;
        }
      }
    }
  `]
})
export class ContactFormDialogComponent {
  category = 'general';
  subject = '';
  content = '';
  sending = false;

  constructor(
    private dialogRef: MatDialogRef<ContactFormDialogComponent>,
    private messageService: MessageService,
    private snackBar: MatSnackBar
  ) {}

  isValid(): boolean {
    return this.subject.trim().length >= 1 && this.content.trim().length >= 1;
  }

  send(): void {
    if (!this.isValid()) return;

    this.sending = true;
    this.messageService.sendSupportMessage(this.subject.trim(), this.content.trim(), this.category).subscribe({
      next: (response) => {
        this.sending = false;
        this.snackBar.open(`✅ ${response.confirmation}. Ticket #${response.ticketId}`, 'Close', { duration: 5000 });
        this.dialogRef.close(true);
      },
      error: (error) => {
        this.sending = false;
        this.snackBar.open('Failed to send message. Please try again.', 'Close', { duration: 3000 });
      }
    });
  }
}
