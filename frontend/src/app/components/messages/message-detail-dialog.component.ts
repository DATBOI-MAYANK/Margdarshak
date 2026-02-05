import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { MessageService, Message } from '../../core/services/message.service';

@Component({
  selector: 'app-message-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="message-detail-dialog">
      <div class="message-header">
        <mat-icon [class]="getTypeClass()">{{ getTypeIcon() }}</mat-icon>
        <div class="header-content">
          <h2>{{ message.subject }}</h2>
          <div class="meta">
            <span class="sender">From: {{ message.sender_name || 'System' }}</span>
            <span class="date">{{ message.created_at | date:'medium' }}</span>
          </div>
        </div>
        <mat-chip *ngIf="message.priority === 'urgent'" class="priority-chip urgent">Urgent</mat-chip>
        <mat-chip *ngIf="message.priority === 'high'" class="priority-chip high">High Priority</mat-chip>
      </div>

      <mat-divider></mat-divider>

      <mat-dialog-content>
        <div class="message-body">
          {{ message.content }}
        </div>

        <!-- Thread/Replies -->
        <div *ngIf="thread.length > 1" class="thread-section">
          <h4>Conversation Thread</h4>
          <div *ngFor="let msg of thread" class="thread-message" [class.reply]="msg.id !== message.id">
            <div class="thread-header">
              <strong>{{ msg.sender_name }}</strong>
              <span class="role-badge" [class]="msg.sender_role?.toLowerCase()">{{ msg.sender_role }}</span>
              <span class="time">{{ msg.created_at | date:'short' }}</span>
            </div>
            <p>{{ msg.content }}</p>
          </div>
        </div>

        <!-- Reply Form (Admin only for support queries) -->
        <div *ngIf="isAdmin && message.type === 'support_query'" class="reply-section">
          <mat-divider></mat-divider>
          <h4>Reply to this message</h4>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Your Reply</mat-label>
            <textarea matInput [(ngModel)]="replyContent" rows="4" placeholder="Type your response..."></textarea>
          </mat-form-field>
          <button mat-raised-button color="primary" (click)="sendReply()" [disabled]="!replyContent.trim() || sending">
            <mat-spinner *ngIf="sending" diameter="20"></mat-spinner>
            <mat-icon *ngIf="!sending">reply</mat-icon>
            {{ sending ? 'Sending...' : 'Send Reply' }}
          </button>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .message-detail-dialog {
      min-width: 500px;

      .message-header {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 16px;

        & mat-icon {
          font-size: 40px;
          width: 40px;
          height: 40px;
          padding: 8px;
          border-radius: 8px;

          &.admin {
            background: #ffebee;
            color: #f44336;
          }

          &.support {
            background: #e3f2fd;
            color: #2196f3;
          }

          &.system {
            background: #f5f5f5;
            color: #9e9e9e;
          }
        }

        .header-content {
          flex: 1;

          & h2 {
            margin: 0 0 8px 0;
            font-size: 1.3rem;
          }

          .meta {
            display: flex;
            gap: 16px;
            color: #666;
            font-size: 0.9rem;
          }
        }
      }

      .priority-chip {
        &.urgent {
          background: #f44336 !important;
          color: white !important;
        }

        &.high {
          background: #ff9800 !important;
          color: white !important;
        }
      }

      .message-body {
        padding: 20px;
        background: #fafafa;
        border-radius: 8px;
        margin: 16px 0;
        white-space: pre-wrap;
        line-height: 1.6;
      }

      .thread-section {
        margin-top: 24px;

        & h4 {
          color: #666;
          margin-bottom: 16px;
        }

        .thread-message {
          padding: 12px;
          background: #f5f5f5;
          border-radius: 8px;
          margin-bottom: 12px;

          &.reply {
            background: #e3f2fd;
            border-left: 3px solid #2196f3;
          }

          .thread-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;

            .role-badge {
              font-size: 0.7rem;
              padding: 2px 6px;
              border-radius: 4px;

              &.admin {
                background: #f44336;
                color: white;
              }

              &.traveler {
                background: #4caf50;
                color: white;
              }
            }

            .time {
              color: #999;
              font-size: 0.8rem;
              margin-left: auto;
            }
          }

          & p {
            margin: 0;
            color: #333;
          }
        }
      }

      .reply-section {
        margin-top: 24px;
        padding-top: 16px;

        & h4 {
          color: #666;
          margin: 16px 0;
        }

        .full-width {
          width: 100%;
        }

        & button {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }
    }
  `]
})
export class MessageDetailDialogComponent implements OnInit {
  message: Message;
  isAdmin: boolean;
  thread: Message[] = [];
  replyContent = '';
  sending = false;
  loading = true;

  constructor(
    private dialogRef: MatDialogRef<MessageDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { message: Message; isAdmin: boolean },
    private messageService: MessageService,
    private snackBar: MatSnackBar
  ) {
    this.message = data.message;
    this.isAdmin = data.isAdmin;
  }

  ngOnInit(): void {
    this.loadThread();
  }

  loadThread(): void {
    this.messageService.getMessageThread(this.message.id).subscribe({
      next: (response) => {
        this.thread = response.messages;
        this.loading = false;
      },
      error: () => {
        this.thread = [this.message];
        this.loading = false;
      }
    });
  }

  getTypeIcon(): string {
    switch (this.message.type) {
      case 'admin_notice': return 'campaign';
      case 'support_query': return 'help';
      case 'support_reply': return 'reply';
      default: return 'mail';
    }
  }

  getTypeClass(): string {
    if (this.message.type === 'admin_notice') return 'admin';
    if (this.message.type === 'support_query' || this.message.type === 'support_reply') return 'support';
    return 'system';
  }

  sendReply(): void {
    if (!this.replyContent.trim()) return;

    this.sending = true;
    this.messageService.replySupportMessage(this.message.id, this.replyContent.trim()).subscribe({
      next: () => {
        this.sending = false;
        this.snackBar.open('Reply sent successfully', 'Close', { duration: 3000 });
        this.loadThread();
        this.replyContent = '';
      },
      error: () => {
        this.sending = false;
        this.snackBar.open('Failed to send reply', 'Close', { duration: 3000 });
      }
    });
  }
}
