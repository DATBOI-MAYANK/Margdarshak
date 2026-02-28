import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Subscription } from 'rxjs';

import { MessageService, Message, Notification, MessagesResponse, NotificationsResponse } from '../../core/services/message.service';
import { AuthService } from '../../services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { ContactFormDialogComponent } from './contact-form-dialog.component';
import { MessageDetailDialogComponent } from './message-detail-dialog.component';

@Component({
  selector: 'app-message-center',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatListModule,
    MatChipsModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule
  ],
  template: `
    <div class="message-center-container">
      <div class="message-header">
        <h1>
          <mat-icon>mail</mat-icon>
          Message Center
        </h1>
        <div class="header-actions">
          <button mat-raised-button color="primary" (click)="openContactForm()" *ngIf="!isAdmin">
            <mat-icon>support_agent</mat-icon>
            Contact Support
          </button>
          <button mat-icon-button (click)="markAllRead()" matTooltip="Mark all as read" *ngIf="notificationCount > 0">
            <mat-icon>done_all</mat-icon>
          </button>
          <button mat-icon-button (click)="refresh()" matTooltip="Refresh">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </div>

      <mat-card class="message-card">
        <mat-tab-group (selectedTabChange)="onTabChange($event)" animationDuration="200ms">
          <!-- Notifications Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>notifications</mat-icon>
              <span class="tab-label">Notifications</span>
              <span class="badge" *ngIf="notificationCount > 0">{{ notificationCount }}</span>
            </ng-template>

            <div class="tab-content">
              <div *ngIf="loadingNotifications" class="loading-spinner">
                <mat-spinner diameter="40"></mat-spinner>
              </div>

              <div *ngIf="!loadingNotifications && notifications.length === 0" class="empty-state">
                <mat-icon>notifications_none</mat-icon>
                <p>No notifications yet</p>
              </div>

              <mat-list *ngIf="!loadingNotifications && notifications.length > 0">
                <mat-list-item *ngFor="let notification of notifications" 
                               [class.unread]="!notification.is_read"
                               (click)="openNotification(notification)">
                  <mat-icon matListItemIcon [class]="getNotificationIconClass(notification.type)">
                    {{ getNotificationIcon(notification.type) }}
                  </mat-icon>
                  <div matListItemTitle>{{ notification.title }}</div>
                  <div matListItemLine class="notification-content">{{ notification.content }}</div>
                  <div matListItemLine class="notification-time">{{ notification.created_at | date:'short' }}</div>
                  <button mat-icon-button matListItemMeta (click)="deleteNotification(notification, $event)">
                    <mat-icon>close</mat-icon>
                  </button>
                </mat-list-item>
              </mat-list>
            </div>
          </mat-tab>

          <!-- Messages Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>inbox</mat-icon>
              <span class="tab-label">Messages</span>
              <span class="badge" *ngIf="unreadMessageCount > 0">{{ unreadMessageCount }}</span>
            </ng-template>

            <div class="tab-content">
              <div *ngIf="loadingMessages" class="loading-spinner">
                <mat-spinner diameter="40"></mat-spinner>
              </div>

              <div *ngIf="!loadingMessages && messages.length === 0" class="empty-state">
                <mat-icon>mail_outline</mat-icon>
                <p>No messages yet</p>
              </div>

              <mat-list *ngIf="!loadingMessages && messages.length > 0">
                <mat-list-item *ngFor="let message of messages" 
                               [class.unread]="!message.is_read"
                               (click)="openMessage(message)">
                  <mat-icon matListItemIcon [class]="getMessageIconClass(message)">
                    {{ getMessageIcon(message) }}
                  </mat-icon>
                  <div matListItemTitle class="message-subject">
                    {{ message.subject }}
                    <mat-chip *ngIf="message.priority === 'urgent'" class="priority-chip urgent">Urgent</mat-chip>
                    <mat-chip *ngIf="message.priority === 'high'" class="priority-chip high">High</mat-chip>
                  </div>
                  <div matListItemLine class="message-preview">{{ message.content | slice:0:80 }}...</div>
                  <div matListItemLine class="message-meta">
                    <span class="sender">{{ message.sender_name || 'System' }}</span>
                    <span class="time">{{ message.created_at | date:'short' }}</span>
                  </div>
                </mat-list-item>
              </mat-list>
            </div>
          </mat-tab>

          <!-- Sent Tab (for support queries sent by user) -->
          <mat-tab *ngIf="!isAdmin">
            <ng-template mat-tab-label>
              <mat-icon>send</mat-icon>
              <span class="tab-label">Sent</span>
            </ng-template>

            <div class="tab-content">
              <div *ngIf="loadingSent" class="loading-spinner">
                <mat-spinner diameter="40"></mat-spinner>
              </div>

              <div *ngIf="!loadingSent && sentMessages.length === 0" class="empty-state">
                <mat-icon>outbox</mat-icon>
                <p>No sent messages yet</p>
              </div>

              <mat-list *ngIf="!loadingSent && sentMessages.length > 0">
                <mat-list-item *ngFor="let message of sentMessages" (click)="openMessage(message)">
                  <mat-icon matListItemIcon class="sent-icon">send</mat-icon>
                  <div matListItemTitle>{{ message.subject }}</div>
                  <div matListItemLine class="message-preview">{{ message.content | slice:0:80 }}...</div>
                  <div matListItemLine class="message-time">{{ message.created_at | date:'short' }}</div>
                </mat-list-item>
              </mat-list>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </div>
  `,
  styles: [`
    .message-center-container {
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .message-header h1 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-size: 1.8rem;
      color: #333;
    }

    .message-header h1 mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #667eea;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .message-card {
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }

    ::ng-deep .mat-mdc-tab-group .mat-mdc-tab-labels {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px 16px 0 0;
    }

    ::ng-deep .mat-mdc-tab-group .mat-mdc-tab {
      color: rgba(255, 255, 255, 0.7);
    }

    ::ng-deep .mat-mdc-tab-group .mat-mdc-tab.mdc-tab--active {
      color: white;
    }

    ::ng-deep .mat-mdc-tab-group .mdc-tab-indicator__content--underline {
      border-color: white;
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
      min-height: 400px;
      padding: 16px;
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 200px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: #9e9e9e;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }

    .empty-state p {
      font-size: 1.1rem;
    }

    ::ng-deep mat-list-item {
      cursor: pointer;
      border-radius: 8px;
      margin-bottom: 8px;
      transition: background 0.2s;
      min-height: 72px !important;
      padding: 12px 16px !important;
    }

    ::ng-deep mat-list-item:hover {
      background: #f5f5f5;
    }

    ::ng-deep mat-list-item.unread {
      background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%);
      border-left: 4px solid #4caf50;
    }

    ::ng-deep .mdc-list-item__content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      overflow: visible !important;
    }

    ::ng-deep .mdc-list-item__primary-text {
      font-weight: 600 !important;
      font-size: 1rem !important;
      color: #333 !important;
      white-space: normal !important;
      overflow: visible !important;
    }

    ::ng-deep .mdc-list-item__secondary-text {
      font-size: 0.85rem !important;
      color: #666 !important;
      white-space: normal !important;
      overflow: visible !important;
      line-height: 1.4 !important;
    }

    ::ng-deep .mat-mdc-list-item-icon {
      margin-right: 16px !important;
      font-size: 28px !important;
      width: 28px !important;
      height: 28px !important;
    }

    .notification-icon.message { color: #2196f3; }
    .notification-icon.collaboration { color: #ff9800; }
    .notification-icon.system { color: #9e9e9e; }
    .notification-icon.admin_notice { color: #f44336; }

    .message-icon.admin { color: #f44336; }
    .message-icon.support { color: #2196f3; }
    .message-icon.system { color: #9e9e9e; }

    .sent-icon {
      color: #4caf50;
    }

    .notification-content, .message-preview {
      color: #666;
      font-size: 0.85rem;
      line-height: 1.4;
    }

    .notification-time, .message-time {
      color: #9e9e9e;
      font-size: 0.8rem;
      margin-top: 4px;
    }

    .message-subject {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .priority-chip {
      font-size: 0.65rem !important;
      min-height: 20px !important;
      padding: 0 8px !important;
    }

    .priority-chip.urgent {
      background: #f44336 !important;
      color: white !important;
    }

    .priority-chip.high {
      background: #ff9800 !important;
      color: white !important;
    }

    .message-meta {
      display: flex;
      gap: 16px;
      color: #9e9e9e;
      font-size: 0.8rem;
      margin-top: 4px;
    }

    .message-meta .sender {
      font-weight: 500;
      color: #666;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .message-center-container {
        padding: 16px 12px;
      }

      .message-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 16px;
      }

      .message-header h1 {
        font-size: 1.3rem;
        gap: 8px;
      }

      .message-header h1 mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      .header-actions {
        width: 100%;
        justify-content: flex-end;
      }

      .header-actions button[mat-raised-button] {
        font-size: 0.8rem;
        padding: 0 12px;
      }

      .tab-label {
        margin-left: 4px;
        font-size: 0.8rem;
      }

      .tab-content {
        min-height: 300px;
        padding: 8px;
      }

      .badge {
        margin-left: 4px;
        padding: 1px 6px;
        font-size: 0.7rem;
      }
    }

    @media (max-width: 480px) {
      .message-center-container {
        padding: 12px 8px;
      }

      .message-header h1 {
        font-size: 1.15rem;
      }

      .tab-label {
        display: none;
      }

      .tab-content {
        padding: 4px;
      }
    }
  `]
})
export class MessageCenterComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  messages: Message[] = [];
  sentMessages: Message[] = [];

  notificationCount = 0;
  unreadMessageCount = 0;

  loadingNotifications = true;
  loadingMessages = false;
  loadingSent = false;

  isAdmin = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private messageService: MessageService,
    private authService: AuthService,
    private socketService: SocketService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.getCurrentUser()?.role === 'Admin';
    this.loadNotifications();
    
    // Listen for real-time notifications
    this.subscriptions.push(
      this.socketService.onNotification().subscribe(notification => {
        this.notificationCount++;
        this.loadNotifications();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadNotifications(): void {
    this.loadingNotifications = true;
    this.messageService.getNotifications().subscribe({
      next: (response) => {
        this.notifications = response.notifications;
        this.notificationCount = response.unreadCount;
        this.loadingNotifications = false;
      },
      error: () => {
        this.loadingNotifications = false;
        this.snackBar.open('Failed to load notifications', 'Close', { duration: 3000 });
      }
    });
  }

  loadMessages(): void {
    this.loadingMessages = true;
    this.messageService.getMessages().subscribe({
      next: (response) => {
        this.messages = response.messages.filter(m => m.type !== 'support_query' || this.isAdmin);
        this.unreadMessageCount = response.unreadCount;
        this.loadingMessages = false;
      },
      error: () => {
        this.loadingMessages = false;
        this.snackBar.open('Failed to load messages', 'Close', { duration: 3000 });
      }
    });
  }

  loadSentMessages(): void {
    this.loadingSent = true;
    this.messageService.getMessages('support_query').subscribe({
      next: (response) => {
        this.sentMessages = response.messages.filter(m => m.sender_id === this.authService.getCurrentUser()?.id);
        this.loadingSent = false;
      },
      error: () => {
        this.loadingSent = false;
      }
    });
  }

  onTabChange(event: any): void {
    switch (event.index) {
      case 0:
        if (this.notifications.length === 0) this.loadNotifications();
        break;
      case 1:
        if (this.messages.length === 0) this.loadMessages();
        break;
      case 2:
        if (this.sentMessages.length === 0) this.loadSentMessages();
        break;
    }
  }

  refresh(): void {
    this.loadNotifications();
    this.loadMessages();
    if (!this.isAdmin) this.loadSentMessages();
  }

  markAllRead(): void {
    this.messageService.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.forEach(n => n.is_read = true);
        this.notificationCount = 0;
        this.snackBar.open('All notifications marked as read', 'Close', { duration: 2000 });
      }
    });
  }

  openNotification(notification: Notification): void {
    if (!notification.is_read) {
      this.messageService.markNotificationRead(notification.id).subscribe(() => {
        notification.is_read = true;
      });
    }

    if (notification.link) {
      // Navigate to link
      window.location.href = notification.link;
    }
  }

  deleteNotification(notification: Notification, event: Event): void {
    event.stopPropagation();
    this.messageService.deleteNotification(notification.id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(n => n.id !== notification.id);
        if (!notification.is_read) this.notificationCount--;
        this.snackBar.open('Notification deleted', 'Close', { duration: 2000 });
      }
    });
  }

  openMessage(message: Message): void {
    if (!message.is_read) {
      this.messageService.markMessageRead(message.id).subscribe(() => {
        message.is_read = true;
      });
    }

    this.dialog.open(MessageDetailDialogComponent, {
      width: '600px',
      data: { message, isAdmin: this.isAdmin }
    });
  }

  openContactForm(): void {
    const dialogRef = this.dialog.open(ContactFormDialogComponent, {
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadSentMessages();
      }
    });
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'message': return 'mail';
      case 'collaboration': return 'group';
      case 'system': return 'info';
      case 'admin_notice': return 'campaign';
      default: return 'notifications';
    }
  }

  getNotificationIconClass(type: string): string {
    return `notification-icon ${type}`;
  }

  getMessageIcon(message: Message): string {
    if (message.type === 'admin_notice') return 'campaign';
    if (message.type === 'support_query') return 'help';
    if (message.type === 'support_reply') return 'reply';
    return 'mail';
  }

  getMessageIconClass(message: Message): string {
    if (message.type === 'admin_notice') return 'message-icon admin';
    if (message.type === 'support_query' || message.type === 'support_reply') return 'message-icon support';
    return 'message-icon system';
  }
}
