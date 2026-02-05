import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MessageService, SupportTicket, SupportStats } from '../../core/services/message.service';
import { MessageDetailDialogComponent } from './message-detail-dialog.component';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-admin-messages',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatListModule,
    MatChipsModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    MatDialogModule,
    MatTooltipModule
  ],
  template: `
    <div class="admin-messages-container">
      <div class="page-header">
        <h1>
          <mat-icon>admin_panel_settings</mat-icon>
          Admin Communication Center
        </h1>
      </div>

      <mat-card class="admin-card">
        <mat-tab-group animationDuration="200ms">
          <!-- Broadcast Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>campaign</mat-icon>
              <span class="tab-label">Send Broadcast</span>
            </ng-template>

            <div class="tab-content">
              <div class="broadcast-form">
                <h3>
                  <mat-icon>public</mat-icon>
                  Send Notice to All Travelers
                </h3>
                <p class="info-text">This message will be sent to all active travelers on the platform.</p>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Priority</mat-label>
                  <mat-select [(ngModel)]="broadcastPriority">
                    <mat-option value="low">Low</mat-option>
                    <mat-option value="normal">Normal</mat-option>
                    <mat-option value="high">High</mat-option>
                    <mat-option value="urgent">Urgent</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Subject</mat-label>
                  <input matInput [(ngModel)]="broadcastSubject" placeholder="e.g., System Maintenance Notice" maxlength="200">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Message</mat-label>
                  <textarea matInput [(ngModel)]="broadcastContent" rows="6" placeholder="Write your announcement here..." maxlength="5000"></textarea>
                  <mat-hint>{{ broadcastContent.length }}/5000</mat-hint>
                </mat-form-field>

                <button mat-raised-button color="primary" (click)="sendBroadcast()" 
                        [disabled]="!broadcastSubject.trim() || !broadcastContent.trim() || sendingBroadcast">
                  <mat-spinner *ngIf="sendingBroadcast" diameter="20"></mat-spinner>
                  <mat-icon *ngIf="!sendingBroadcast">send</mat-icon>
                  {{ sendingBroadcast ? 'Sending...' : 'Send to All Travelers' }}
                </button>
              </div>
            </div>
          </mat-tab>

          <!-- Support Tickets Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>support</mat-icon>
              <span class="tab-label">Support Tickets</span>
              <span class="badge" *ngIf="stats && stats.pending">{{ stats.pending }}</span>
            </ng-template>

            <div class="tab-content">
              <!-- Stats -->
              <div class="stats-row" *ngIf="stats">
                <div class="stat-item">
                  <mat-icon>inbox</mat-icon>
                  <span class="stat-value">{{ stats.total }}</span>
                  <span class="stat-label">Total</span>
                </div>
                <div class="stat-item pending">
                  <mat-icon>pending</mat-icon>
                  <span class="stat-value">{{ stats.pending }}</span>
                  <span class="stat-label">Pending</span>
                </div>
                <div class="stat-item resolved">
                  <mat-icon>check_circle</mat-icon>
                  <span class="stat-value">{{ stats.resolved }}</span>
                  <span class="stat-label">Resolved</span>
                </div>
              </div>

              <!-- Filter -->
              <div class="filter-row">
                <mat-form-field appearance="outline">
                  <mat-label>Filter</mat-label>
                  <mat-select [(ngModel)]="ticketFilter" (selectionChange)="loadTickets()">
                    <mat-option value="all">All Tickets</mat-option>
                    <mat-option value="unread">Pending</mat-option>
                    <mat-option value="read">Resolved</mat-option>
                  </mat-select>
                </mat-form-field>
                <button mat-icon-button (click)="loadTickets()" matTooltip="Refresh">
                  <mat-icon>refresh</mat-icon>
                </button>
              </div>

              <div *ngIf="loadingTickets" class="loading-spinner">
                <mat-spinner diameter="40"></mat-spinner>
              </div>

              <div *ngIf="!loadingTickets && tickets.length === 0" class="empty-state">
                <mat-icon>check_circle</mat-icon>
                <p>No support tickets</p>
              </div>

              <mat-list *ngIf="!loadingTickets && tickets.length > 0">
                <mat-list-item *ngFor="let ticket of tickets" 
                               [class.unread]="!ticket.is_read"
                               (click)="openTicket(ticket)">
                  <mat-icon matListItemIcon [class.pending]="!ticket.is_read">
                    {{ ticket.is_read ? 'check_circle' : 'error' }}
                  </mat-icon>
                  <div matListItemTitle>{{ ticket.subject }}</div>
                  <div matListItemLine class="ticket-info">
                    <span class="sender">{{ ticket.sender_name }} ({{ ticket.sender_email }})</span>
                  </div>
                  <div matListItemLine class="ticket-meta">
                    <span class="time">{{ ticket.created_at | date:'short' }}</span>
                    <mat-chip *ngIf="ticket.reply_count > 0" class="reply-chip">
                      {{ ticket.reply_count }} {{ ticket.reply_count === 1 ? 'reply' : 'replies' }}
                    </mat-chip>
                  </div>
                </mat-list-item>
              </mat-list>
            </div>
          </mat-tab>

          <!-- Send to User Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>person</mat-icon>
              <span class="tab-label">Send to User</span>
            </ng-template>

            <div class="tab-content">
              <div class="send-user-form">
                <h3>
                  <mat-icon>person_add</mat-icon>
                  Send Direct Message to User
                </h3>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Select User</mat-label>
                  <mat-select [(ngModel)]="selectedUserId">
                    <mat-option *ngFor="let user of users" [value]="user.id">
                      {{ user.name }} ({{ user.email }}) - {{ user.role }}
                    </mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Priority</mat-label>
                  <mat-select [(ngModel)]="directPriority">
                    <mat-option value="low">Low</mat-option>
                    <mat-option value="normal">Normal</mat-option>
                    <mat-option value="high">High</mat-option>
                    <mat-option value="urgent">Urgent</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Subject</mat-label>
                  <input matInput [(ngModel)]="directSubject" placeholder="Message subject" maxlength="200">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Message</mat-label>
                  <textarea matInput [(ngModel)]="directContent" rows="6" placeholder="Write your message..." maxlength="5000"></textarea>
                </mat-form-field>

                <button mat-raised-button color="primary" (click)="sendToUser()" 
                        [disabled]="!selectedUserId || !directSubject.trim() || !directContent.trim() || sendingDirect">
                  <mat-spinner *ngIf="sendingDirect" diameter="20"></mat-spinner>
                  <mat-icon *ngIf="!sendingDirect">send</mat-icon>
                  {{ sendingDirect ? 'Sending...' : 'Send Message' }}
                </button>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </div>
  `,
  styles: [`
    .admin-messages-container {
      padding: 24px;
      max-width: 1000px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 24px;

      & h1 {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0;
        font-size: 1.8rem;
        color: #333;

        & mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
          color: #667eea;
        }
      }
    }

    .admin-card {
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }

    ::ng-deep .mat-mdc-tab-group {
      .mat-mdc-tab-labels {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 16px 16px 0 0;
      }

      .mat-mdc-tab {
        color: rgba(255, 255, 255, 0.7);
        
        &.mdc-tab--active {
          color: white;
        }
      }
    }

    .tab-label {
      margin-left: 8px;
    }

    .badge {
      margin-left: 8px;
      background: #f44336;
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .tab-content {
      padding: 24px;
    }

    .broadcast-form, .send-user-form {
      max-width: 600px;

      & h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #333;
        margin-bottom: 8px;

        & mat-icon {
          color: #667eea;
        }
      }

      .info-text {
        color: #666;
        margin-bottom: 24px;
      }

      .full-width {
        width: 100%;
        margin-bottom: 16px;
      }

      & button {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .stats-row {
      display: flex;
      gap: 24px;
      margin-bottom: 24px;

      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px 24px;
        background: #f5f5f5;
        border-radius: 12px;

        & mat-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
          margin-bottom: 8px;
          color: #666;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #333;
        }

        .stat-label {
          font-size: 0.85rem;
          color: #666;
        }

        &.pending {
          background: #fff3e0;
          & mat-icon { color: #ff9800; }
        }

        &.resolved {
          background: #e8f5e9;
          & mat-icon { color: #4caf50; }
        }
      }
    }

    .filter-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;

      & mat-form-field {
        width: 200px;
      }
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      padding: 40px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      color: #9e9e9e;

      & mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        color: #4caf50;
      }
    }

    mat-list-item {
      cursor: pointer;
      border-radius: 8px;
      margin-bottom: 8px;
      transition: background 0.2s;

      &:hover {
        background: #f5f5f5;
      }

      &.unread {
        background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
        border-left: 4px solid #ff9800;
      }

      & mat-icon.pending {
        color: #ff9800;
      }
    }

    .ticket-info {
      color: #666;
      font-size: 0.9rem;
    }

    .ticket-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #999;
      font-size: 0.8rem;
    }

    .reply-chip {
      font-size: 0.7rem !important;
      min-height: 20px !important;
      background: #e3f2fd !important;
      color: #1976d2 !important;
    }
  `]
})
export class AdminMessagesComponent implements OnInit {
  // Broadcast
  broadcastPriority = 'normal';
  broadcastSubject = '';
  broadcastContent = '';
  sendingBroadcast = false;

  // Support Tickets
  tickets: SupportTicket[] = [];
  stats: SupportStats | null = null;
  ticketFilter = 'all';
  loadingTickets = true;

  // Direct Message
  users: User[] = [];
  selectedUserId: number | null = null;
  directPriority = 'normal';
  directSubject = '';
  directContent = '';
  sendingDirect = false;

  constructor(
    private messageService: MessageService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadTickets();
    this.loadUsers();
  }

  loadTickets(): void {
    this.loadingTickets = true;
    this.messageService.getSupportTickets(this.ticketFilter).subscribe({
      next: (response) => {
        this.tickets = response.tickets;
        this.stats = response.stats;
        this.loadingTickets = false;
      },
      error: () => {
        this.loadingTickets = false;
        this.snackBar.open('Failed to load tickets', 'Close', { duration: 3000 });
      }
    });
  }

  loadUsers(): void {
    this.authService.getAllUsers().subscribe({
      next: (response) => {
        this.users = response.users;
      }
    });
  }

  sendBroadcast(): void {
    if (!this.broadcastSubject.trim() || !this.broadcastContent.trim()) return;

    this.sendingBroadcast = true;
    this.messageService.sendBroadcast(
      this.broadcastSubject.trim(),
      this.broadcastContent.trim(),
      this.broadcastPriority
    ).subscribe({
      next: (response) => {
        this.sendingBroadcast = false;
        this.snackBar.open(`✅ Broadcast sent to ${response.recipientCount} travelers`, 'Close', { duration: 5000 });
        this.broadcastSubject = '';
        this.broadcastContent = '';
        this.broadcastPriority = 'normal';
      },
      error: () => {
        this.sendingBroadcast = false;
        this.snackBar.open('Failed to send broadcast', 'Close', { duration: 3000 });
      }
    });
  }

  sendToUser(): void {
    if (!this.selectedUserId || !this.directSubject.trim() || !this.directContent.trim()) return;

    this.sendingDirect = true;
    this.messageService.sendToUser(
      this.selectedUserId,
      this.directSubject.trim(),
      this.directContent.trim(),
      this.directPriority
    ).subscribe({
      next: () => {
        this.sendingDirect = false;
        this.snackBar.open('✅ Message sent successfully', 'Close', { duration: 3000 });
        this.directSubject = '';
        this.directContent = '';
        this.selectedUserId = null;
        this.directPriority = 'normal';
      },
      error: () => {
        this.sendingDirect = false;
        this.snackBar.open('Failed to send message', 'Close', { duration: 3000 });
      }
    });
  }

  openTicket(ticket: SupportTicket): void {
    const message = {
      id: ticket.id,
      sender_id: ticket.sender_id,
      recipient_id: null,
      type: 'support_query' as const,
      subject: ticket.subject,
      content: ticket.content,
      priority: 'normal' as const,
      is_read: ticket.is_read,
      is_broadcast: false,
      parent_id: null,
      created_at: ticket.created_at,
      sender_name: ticket.sender_name,
      sender_email: ticket.sender_email
    };

    const dialogRef = this.dialog.open(MessageDetailDialogComponent, {
      width: '600px',
      data: { message, isAdmin: true }
    });

    dialogRef.afterClosed().subscribe(() => {
      this.loadTickets();
    });
  }
}
