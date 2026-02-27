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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

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
    MatSnackBarModule,
    MatCheckboxModule,
    MatTooltipModule
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
        <div class="header-badges">
          <mat-chip *ngIf="message.priority === 'urgent'" class="priority-chip urgent">Urgent</mat-chip>
          <mat-chip *ngIf="message.priority === 'high'" class="priority-chip high">High Priority</mat-chip>
          <span class="status-indicator" [class]="'status-' + ticketStatus" *ngIf="isAdmin && ticketStatus">
            <mat-icon>{{ getStatusIcon() }}</mat-icon>
            {{ getStatusLabel() }}
          </span>
        </div>
      </div>

      <mat-divider></mat-divider>

      <mat-dialog-content>
        <div class="message-body">
          {{ message.content }}
        </div>

        <!-- Thread/Replies -->
        <div *ngIf="thread.length > 1" class="thread-section">
          <h4>
            <mat-icon>forum</mat-icon>
            Conversation Thread ({{ thread.length }} messages)
          </h4>
          <div *ngFor="let msg of thread" class="thread-message" [class.reply]="msg.id !== message.id" [class.admin-reply]="msg.sender_role === 'Admin'">
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

          <div *ngIf="ticketStatus !== 'resolved' && ticketStatus !== 'closed'" class="reply-form">
            <h4>
              <mat-icon>reply</mat-icon>
              Reply to this ticket
            </h4>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Your Reply</mat-label>
              <textarea matInput [(ngModel)]="replyContent" rows="4" placeholder="Type your response..."></textarea>
            </mat-form-field>

            <div class="reply-actions">
              <mat-checkbox [(ngModel)]="resolveOnReply" color="primary">
                Mark as resolved after sending
              </mat-checkbox>
              <div class="action-buttons">
                <button mat-raised-button color="primary" (click)="sendReply()" [disabled]="!replyContent.trim() || sending">
                  <mat-spinner *ngIf="sending" diameter="20"></mat-spinner>
                  <mat-icon *ngIf="!sending">send</mat-icon>
                  {{ sending ? 'Sending...' : 'Send Reply' }}
                </button>
                <button mat-stroked-button color="accent" (click)="resolveTicket()" [disabled]="resolving"
                        matTooltip="Resolve without sending a reply">
                  <mat-spinner *ngIf="resolving" diameter="20"></mat-spinner>
                  <mat-icon *ngIf="!resolving">done_all</mat-icon>
                  {{ resolving ? 'Resolving...' : 'Resolve' }}
                </button>
              </div>
            </div>
          </div>

          <div *ngIf="ticketStatus === 'resolved' || ticketStatus === 'closed'" class="resolved-banner">
            <mat-icon>verified</mat-icon>
            <span>This ticket has been resolved.</span>
          </div>
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
        align-items: center;
        gap: 16px;
        padding: 16px;
        flex-wrap: wrap;

        > mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
          padding: 10px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

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
          min-width: 200px;

          & h2 {
            margin: 0 0 6px 0;
            font-size: 1.3rem;
            line-height: 1.3;
          }

          .meta {
            display: flex;
            align-items: center;
            gap: 16px;
            color: #666;
            font-size: 0.9rem;
          }
        }
      }

      .header-badges {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        flex-shrink: 0;
      }

      .status-indicator {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 6px 14px;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;

        :is(mat-icon) {
          font-size: 16px;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        &.status-pending {
          background: #fff3e0;
          color: #e65100;
          border: 1px solid #ffcc80;
        }

        &.status-read {
          background: #e3f2fd;
          color: #1565c0;
          border: 1px solid #90caf9;
        }

        &.status-resolved, &.status-closed {
          background: #e8f5e9;
          color: #2e7d32;
          border: 1px solid #a5d6a7;
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
          display: flex;
          align-items: center;
          gap: 8px;
          color: #555;
          margin-bottom: 16px;

          :is(mat-icon) {
            font-size: 20px;
            width: 20px;
            height: 20px;
            color: #667eea;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }

        .thread-message {
          padding: 14px;
          background: #f5f5f5;
          border-radius: 10px;
          margin-bottom: 12px;
          border-left: 3px solid #e0e0e0;
          transition: box-shadow 0.2s;

          &:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          }

          &.admin-reply {
            background: #e8eaf6;
            border-left: 3px solid #667eea;
          }

          &.reply:not(.admin-reply) {
            background: #e3f2fd;
            border-left: 3px solid #2196f3;
          }

          .thread-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
            flex-wrap: wrap;

            :is(strong) {
              font-size: 0.95rem;
              line-height: 1;
            }

            .role-badge {
              font-size: 0.7rem;
              padding: 3px 10px;
              border-radius: 6px;
              font-weight: 600;
              line-height: 1.2;
              display: inline-flex;
              align-items: center;
              vertical-align: middle;

              &.admin {
                background: #667eea;
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
              line-height: 1;
              white-space: nowrap;
            }
          }

          & p {
            margin: 0;
            color: #333;
            line-height: 1.6;
          }
        }
      }

      .reply-section {
        margin-top: 24px;
        padding-top: 16px;
      }

      .reply-form {
        & h4 {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #555;
          margin: 16px 0;

          :is(mat-icon) {
            font-size: 20px;
            width: 20px;
            height: 20px;
            color: #667eea;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }

        .full-width {
          width: 100%;
        }
      }

      .reply-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;

        .action-buttons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;

          & button {
            display: flex;
            align-items: center;
            gap: 8px;
          }
        }
      }

      .resolved-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        margin-top: 16px;
        background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
        border-radius: 10px;
        color: #2e7d32;
        font-weight: 500;

        :is(mat-icon) {
          font-size: 24px;
          width: 24px;
          height: 24px;
          color: #4caf50;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        :is(span) {
          line-height: 1.4;
        }
      }
    }
  `]
})
export class MessageDetailDialogComponent implements OnInit {
  message: Message;
  isAdmin: boolean;
  ticketStatus: string;
  thread: Message[] = [];
  replyContent = '';
  sending = false;
  resolving = false;
  loading = true;
  resolveOnReply = false;

  constructor(
    private dialogRef: MatDialogRef<MessageDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { message: Message; isAdmin: boolean; ticketStatus?: string },
    private messageService: MessageService,
    private snackBar: MatSnackBar
  ) {
    this.message = data.message;
    this.isAdmin = data.isAdmin;
    this.ticketStatus = data.ticketStatus || (data.message as any).status || 'pending';
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

  getStatusIcon(): string {
    switch (this.ticketStatus) {
      case 'pending': return 'schedule';
      case 'read': return 'mark_email_read';
      case 'resolved':
      case 'closed': return 'check_circle';
      default: return 'help_outline';
    }
  }

  getStatusLabel(): string {
    switch (this.ticketStatus) {
      case 'pending': return 'Pending';
      case 'read': return 'Replied';
      case 'resolved':
      case 'closed': return 'Resolved';
      default: return this.ticketStatus;
    }
  }

  sendReply(): void {
    if (!this.replyContent.trim()) return;

    this.sending = true;
    this.messageService.replySupportMessage(this.message.id, this.replyContent.trim(), this.resolveOnReply).subscribe({
      next: (response) => {
        this.sending = false;
        this.ticketStatus = response.status || (this.resolveOnReply ? 'resolved' : 'read');
        this.snackBar.open(
          this.resolveOnReply ? 'Reply sent & ticket resolved' : 'Reply sent successfully',
          'Close', { duration: 3000 }
        );
        this.loadThread();
        this.replyContent = '';
        this.resolveOnReply = false;
      },
      error: () => {
        this.sending = false;
        this.snackBar.open('Failed to send reply', 'Close', { duration: 3000 });
      }
    });
  }

  resolveTicket(): void {
    this.resolving = true;
    this.messageService.resolveTicket(this.message.id).subscribe({
      next: (response) => {
        this.resolving = false;
        this.ticketStatus = response.status || 'resolved';
        this.snackBar.open('Ticket resolved', 'Close', { duration: 3000 });
        this.loadThread();
      },
      error: () => {
        this.resolving = false;
        this.snackBar.open('Failed to resolve ticket', 'Close', { duration: 3000 });
      }
    });
  }
}
