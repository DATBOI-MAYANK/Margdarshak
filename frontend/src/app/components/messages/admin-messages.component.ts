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
                <div class="stat-item" (click)="ticketFilter = 'all'; loadTickets()" [class.active-filter]="ticketFilter === 'all'">
                  <mat-icon>inbox</mat-icon>
                  <span class="stat-value">{{ stats.total }}</span>
                  <span class="stat-label">Total</span>
                </div>
                <div class="stat-item pending" (click)="ticketFilter = 'pending'; loadTickets()" [class.active-filter]="ticketFilter === 'pending'">
                  <mat-icon>schedule</mat-icon>
                  <span class="stat-value">{{ stats.pending }}</span>
                  <span class="stat-label">Pending</span>
                </div>
                <div class="stat-item resolved" (click)="ticketFilter = 'read'; loadTickets()" [class.active-filter]="ticketFilter === 'read'">
                  <mat-icon>check_circle</mat-icon>
                  <span class="stat-value">{{ stats.resolved }}</span>
                  <span class="stat-label">Resolved</span>
                </div>
              </div>

              <!-- Filter & Refresh -->
              <div class="filter-row">
                <mat-form-field appearance="outline">
                  <mat-label>Filter</mat-label>
                  <mat-select [(ngModel)]="ticketFilter" (selectionChange)="loadTickets()">
                    <mat-option value="all">All Tickets</mat-option>
                    <mat-option value="pending">Pending</mat-option>
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
                <mat-icon>{{ ticketFilter === 'pending' ? 'thumb_up' : 'check_circle' }}</mat-icon>
                <p>{{ ticketFilter === 'pending' ? 'No pending tickets — all caught up!' : 'No tickets found' }}</p>
              </div>

              <div *ngIf="!loadingTickets && tickets.length > 0" class="ticket-list">
                <div *ngFor="let ticket of tickets" 
                     class="ticket-card"
                     [class.ticket-pending]="ticket.status === 'pending'"
                     [class.ticket-read]="ticket.status === 'read'"
                     [class.ticket-resolved]="ticket.status === 'resolved' || ticket.status === 'closed'"
                     (click)="openTicket(ticket)">
                  <div class="ticket-status-bar"></div>
                  <div class="ticket-icon">
                    <mat-icon *ngIf="ticket.status === 'pending'">error_outline</mat-icon>
                    <mat-icon *ngIf="ticket.status === 'read'">mark_email_read</mat-icon>
                    <mat-icon *ngIf="ticket.status === 'resolved' || ticket.status === 'closed'">check_circle</mat-icon>
                  </div>
                  <div class="ticket-content">
                    <div class="ticket-subject">{{ ticket.subject }}</div>
                    <div class="ticket-sender">{{ ticket.sender_name }} ({{ ticket.sender_email }})</div>
                    <div class="ticket-bottom">
                      <span class="ticket-time">{{ ticket.created_at | date:'short' }}</span>
                      <span class="status-badge" [class]="'status-' + ticket.status">
                        {{ ticket.status === 'pending' ? 'Pending' : ticket.status === 'read' ? 'Replied' : 'Resolved' }}
                      </span>
                      <mat-chip *ngIf="ticket.reply_count > 0" class="reply-chip">
                        {{ ticket.reply_count }} {{ ticket.reply_count === 1 ? 'reply' : 'replies' }}
                      </mat-chip>
                    </div>
                  </div>
                  <button mat-icon-button class="resolve-btn"
                          *ngIf="ticket.status !== 'resolved' && ticket.status !== 'closed'"
                          (click)="quickResolve(ticket, $event)" matTooltip="Mark as Resolved">
                    <mat-icon>done_all</mat-icon>
                  </button>
                </div>
              </div>
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
      gap: 16px;
      margin-bottom: 24px;

      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px 24px;
        background: #f5f5f5;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;
        min-width: 100px;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        &.active-filter {
          border-color: #667eea;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.25);
        }

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

    .ticket-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ticket-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
      border: 1px solid #e0e0e0;
      background: white;

      &:hover {
        box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        transform: translateY(-1px);
      }

      &.ticket-pending {
        border-left: 4px solid #ff9800;
        background: linear-gradient(135deg, #fff8e1 0%, #fff3e0 100%);

        .ticket-icon mat-icon { color: #ff9800; }
      }

      &.ticket-read {
        border-left: 4px solid #2196f3;
        background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #e3f2fd 100%);

        .ticket-icon mat-icon { color: #2196f3; }
      }

      &.ticket-resolved {
        border-left: 4px solid #4caf50;
        background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #e8f5e9 100%);

        .ticket-icon mat-icon { color: #4caf50; }
      }
    }

    .ticket-icon {
      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }
    }

    .ticket-content {
      flex: 1;
      min-width: 0;

      .ticket-subject {
        font-weight: 600;
        font-size: 1rem;
        color: #333;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 4px;
      }

      .ticket-sender {
        font-size: 0.85rem;
        color: #666;
        margin-bottom: 6px;
      }

      .ticket-bottom {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;

        .ticket-time {
          font-size: 0.8rem;
          color: #999;
        }
      }
    }

    .status-badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;

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

    .reply-chip {
      font-size: 0.7rem !important;
      min-height: 20px !important;
      background: #ede7f6 !important;
      color: #5e35b1 !important;
    }

    .resolve-btn {
      color: #4caf50;
      opacity: 0.6;
      transition: opacity 0.2s;

      &:hover {
        opacity: 1;
      }
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
      is_read: ticket.status !== 'pending',
      is_broadcast: false,
      parent_id: null,
      created_at: ticket.created_at,
      sender_name: ticket.sender_name,
      sender_email: ticket.sender_email,
      status: ticket.status
    };

    const dialogRef = this.dialog.open(MessageDetailDialogComponent, {
      width: '650px',
      maxHeight: '90vh',
      data: { message, isAdmin: true, ticketStatus: ticket.status }
    });

    dialogRef.afterClosed().subscribe(() => {
      this.loadTickets();
    });
  }

  quickResolve(ticket: SupportTicket, event: MouseEvent): void {
    event.stopPropagation();
    this.messageService.resolveTicket(ticket.id).subscribe({
      next: () => {
        this.snackBar.open('Ticket marked as resolved', 'Close', { duration: 3000 });
        this.loadTickets();
      },
      error: () => {
        this.snackBar.open('Failed to resolve ticket', 'Close', { duration: 3000 });
      }
    });
  }
}
