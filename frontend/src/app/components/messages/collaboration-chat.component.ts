import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { getApiBase } from '../../core/services/runtime-config';

import { ChatService, ChatMessage, ChatParticipant } from '../../core/services/chat.service';
import { SocketService } from '../../core/services/socket.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-collaboration-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatMenuModule,
    MatSnackBarModule
  ],
  template: `
    <div class="chat-container" [class.expanded]="isExpanded">
      <!-- Chat Header -->
      <div class="chat-header" (click)="toggleExpand()">
        <div class="header-left">
          <mat-icon>chat</mat-icon>
          <span class="title">Team Chat</span>
          <span class="participant-count" *ngIf="participants.length > 0">
            {{ participants.length }} members
          </span>
        </div>
        <div class="header-right">
          <span class="unread-badge" *ngIf="unreadCount > 0">{{ unreadCount }}</span>
          <mat-icon class="expand-icon">{{ isExpanded ? 'expand_more' : 'expand_less' }}</mat-icon>
        </div>
      </div>

      <!-- Chat Body -->
      <div class="chat-body" *ngIf="isExpanded">
        <!-- Participants -->
        <div class="participants-bar">
          <div class="participant-avatars">
            <div class="avatar" *ngFor="let p of participants.slice(0, 5)" [matTooltip]="p.name">
              <img
                *ngIf="getProfilePictureUrl(p.profile_picture)"
                class="avatar-img"
                [src]="getProfilePictureUrl(p.profile_picture)"
                [alt]="p.name"
                (error)="onAvatarError($event)">
              <span class="avatar-initial">{{ p.name.charAt(0).toUpperCase() }}</span>
            </div>
            <div class="avatar more" *ngIf="participants.length > 5">
              +{{ participants.length - 5 }}
            </div>
          </div>
          <span class="typing-indicator" *ngIf="typingUsers.length > 0">
            {{ getTypingText() }}
          </span>
        </div>

        <!-- Messages -->
        <div class="messages-container" #messagesContainer>
          <div *ngIf="loading" class="loading-spinner">
            <mat-spinner diameter="30"></mat-spinner>
          </div>

          <div *ngIf="!loading && messages.length === 0" class="empty-chat">
            <mat-icon>forum</mat-icon>
            <p>No messages yet. Start the conversation!</p>
          </div>

          <div class="message-list">
            <div *ngFor="let msg of messages; let i = index" 
                 class="message" 
                 [class.own]="msg.user_id === currentUserId"
                 [class.same-sender]="i > 0 && messages[i-1].user_id === msg.user_id">
              
              <div class="message-avatar" *ngIf="msg.user_id !== currentUserId && (i === 0 || messages[i-1].user_id !== msg.user_id)">
                <img
                  *ngIf="getProfilePictureUrl(msg.user_profile_picture)"
                  class="message-avatar-img"
                  [src]="getProfilePictureUrl(msg.user_profile_picture)"
                  [alt]="msg.user_name || 'User'"
                  (error)="onAvatarError($event)">
                <span class="message-avatar-initial">{{ msg.user_name ? msg.user_name.charAt(0).toUpperCase() : '?' }}</span>
              </div>
              
              <div class="message-content">
                <div class="message-header" *ngIf="msg.user_id !== currentUserId && (i === 0 || messages[i-1].user_id !== msg.user_id)">
                  <span class="sender-name">{{ msg.user_name }}</span>
                </div>
                <div class="message-bubble">
                  <p>{{ msg.message }}</p>
                  <span class="message-time">{{ msg.created_at | date:'shortTime' }}</span>
                </div>
              </div>

              <button mat-icon-button class="delete-btn" 
                      *ngIf="msg.user_id === currentUserId"
                      [matMenuTriggerFor]="messageMenu">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #messageMenu="matMenu">
                <button mat-menu-item (click)="deleteMessage(msg)">
                  <mat-icon>delete</mat-icon>
                  <span>Delete</span>
                </button>
              </mat-menu>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="chat-input">
          <input 
            [(ngModel)]="newMessage" 
            (keyup.enter)="sendMessage()"
            (input)="onTyping()"
            placeholder="Type a message..."
            [disabled]="sending">
          <button mat-icon-button color="primary" (click)="sendMessage()" [disabled]="!newMessage.trim() || sending">
            <mat-icon>send</mat-icon>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: min(350px, calc(100vw - 40px));
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      z-index: 1000;
      transition: all 0.3s ease;
    }

    .chat-container.expanded {
      height: min(500px, calc(100vh - 40px));
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      cursor: pointer;
      user-select: none;
    }

    .chat-header .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .chat-header .header-left mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .chat-header .header-left .title {
      font-weight: 700;
      letter-spacing: 0.2px;
    }

    .chat-header .header-left .participant-count {
      font-size: 0.8rem;
      opacity: 0.85;
      white-space: nowrap;
    }

    .chat-header .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .chat-header .header-right .unread-badge {
      background: #f44336;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 700;
      line-height: 1.2;
    }

    .chat-header .expand-icon {
      opacity: 0.9;
    }

    .chat-body {
      display: flex;
      flex-direction: column;
      height: calc(100% - 52px);
    }

    .participants-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 12px;
      background: #f5f5f5;
      border-bottom: 1px solid #eee;
    }

    .participants-bar .participant-avatars {
      display: flex;
      align-items: center;
    }

    .participants-bar .participant-avatars .avatar {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      border: 2px solid #ffffff;
      margin-left: -8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      position: relative;
      overflow: hidden;
    }

    .participants-bar .participant-avatars .avatar .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .participants-bar .participant-avatars .avatar .avatar-initial {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .participants-bar .participant-avatars .avatar:first-child {
      margin-left: 0;
    }

    .participants-bar .participant-avatars .avatar.more {
      background: #9e9e9e;
      font-size: 0.65rem;
    }

    .participants-bar .typing-indicator {
      font-size: 0.75rem;
      color: #666;
      font-style: italic;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      background: #fafafa;
    }

    .messages-container::-webkit-scrollbar { width: 10px; }
    .messages-container::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 10px; }
    .messages-container::-webkit-scrollbar-track { background: transparent; }

    .loading-spinner {
      display: flex;
      justify-content: center;
      padding: 20px;
    }

    .empty-chat {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #9e9e9e;
      gap: 12px;
      text-align: center;
    }

    .empty-chat mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    .empty-chat p {
      font-size: 0.9rem;
      margin: 0;
    }

    .message-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .message {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      max-width: 85%;
    }

    .message.own {
      flex-direction: row-reverse;
      margin-left: auto;
    }

    .message.own .message-bubble {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      border-radius: 16px 16px 4px 16px;
      box-shadow: 0 6px 18px rgba(102, 126, 234, 0.22);
    }

    .message.own .message-bubble .message-time {
      color: rgba(255, 255, 255, 0.7);
    }

    .message.same-sender .message-avatar {
      visibility: hidden;
    }

    .message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 999px;
      background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      flex-shrink: 0;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.14);
      position: relative;
      overflow: hidden;
    }

    .message-avatar .message-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .message-avatar .message-avatar-initial {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .message-content {
      display: flex;
      flex-direction: column;
    }

    .message-content .message-header {
      margin-bottom: 2px;
      margin-left: 12px;
    }

    .message-content .message-header .sender-name {
      font-size: 0.75rem;
      font-weight: 700;
      color: #666;
    }

    .message-bubble {
      background: #ffffff;
      padding: 8px 12px;
      border-radius: 16px 16px 16px 4px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .message-bubble p {
      margin: 0;
      font-size: 0.9rem;
      line-height: 1.4;
      word-wrap: break-word;
    }

    .message-bubble .message-time {
      display: block;
      font-size: 0.65rem;
      color: #999;
      text-align: right;
      margin-top: 4px;
    }

    .delete-btn {
      opacity: 0;
      transition: opacity 0.2s;
    }

    .message:hover .delete-btn {
      opacity: 1;
    }

    .chat-input {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid #eee;
      background: #ffffff;
    }

    .chat-input input {
      flex: 1;
      border: 1px solid #ddd;
      border-radius: 999px;
      padding: 10px 16px;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: #ffffff;
    }

    .chat-input input:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.18);
    }

    .chat-input button {
      flex-shrink: 0;
    }
  `]
})
export class CollaborationChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @Input() itineraryId!: number;
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  participants: ChatParticipant[] = [];
  typingUsers: { userId: number; userName: string }[] = [];

  newMessage = '';
  loading = true;
  sending = false;
  isExpanded = false;
  unreadCount = 0;
  currentUserId: number;

  private subscriptions: Subscription[] = [];
  private typingTimeout: any;
  private shouldScrollToBottom = true;
  private readonly backendBaseUrl = getApiBase();

  constructor(
    private chatService: ChatService,
    private socketService: SocketService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.currentUserId = this.authService.getCurrentUser()?.id || 0;
  }

  ngOnInit(): void {
    this.loadMessages();
    this.setupSocketListeners();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.socketService.leaveChat(this.itineraryId);
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
    }
  }

  loadMessages(): void {
    this.loading = true;
    this.chatService.getChatMessages(this.itineraryId).subscribe({
      next: (response) => {
        this.messages = response.messages;
        this.participants = response.participants;
        this.loading = false;
        this.shouldScrollToBottom = true;
        
        // Join socket room
        this.socketService.joinChat(this.itineraryId);
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load chat', 'Close', { duration: 3000 });
      }
    });
  }

  setupSocketListeners(): void {
    // Listen for new messages
    this.subscriptions.push(
      this.socketService.onChatMessage().subscribe(message => {
        if (message.itinerary_id === this.itineraryId) {
          if (!this.messages.some(m => m.id === message.id)) {
            this.messages.push(message);
          }
          this.shouldScrollToBottom = true;
          
          if (!this.isExpanded && message.user_id !== this.currentUserId) {
            this.unreadCount++;
          }
        }
      })
    );

    // Listen for message deletions
    this.subscriptions.push(
      this.socketService.onChatMessageDeleted().subscribe(data => {
        if (data.itineraryId === this.itineraryId) {
          this.messages = this.messages.filter(m => m.id !== data.messageId);
        }
      })
    );

    // Listen for typing indicators
    this.subscriptions.push(
      this.socketService.onUserTyping().subscribe(data => {
        if (data.userId !== this.currentUserId) {
          if (data.isTyping) {
            if (!this.typingUsers.find(u => u.userId === data.userId)) {
              this.typingUsers.push({ userId: data.userId, userName: data.userName });
            }
          } else {
            this.typingUsers = this.typingUsers.filter(u => u.userId !== data.userId);
          }
        }
      })
    );
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || this.sending) return;

    this.sending = true;
    const message = this.newMessage.trim();
    this.newMessage = '';

    this.chatService.sendChatMessage(this.itineraryId, message).subscribe({
      next: (response) => {
        this.sending = false;
        const created = response?.chatMessage;
        if (created && !this.messages.some(m => m.id === created.id)) {
          this.messages.push(created);
        }
        this.shouldScrollToBottom = true;
      },
      error: (err: HttpErrorResponse) => {
        this.sending = false;
        this.newMessage = message; // Restore message on error
        const serverMsg = (err?.error && (err.error.error || err.error.message)) ? (err.error.error || err.error.message) : '';
        const msg = err.status === 0
          ? 'Server unreachable. Please try again.'
          : err.status === 401
            ? 'Session expired. Please login again.'
            : serverMsg
              ? `Failed to send: ${serverMsg}`
              : 'Failed to send message';
        this.snackBar.open(msg, 'Close', { duration: 3500 });
      }
    });
  }

  deleteMessage(msg: ChatMessage): void {
    this.chatService.deleteChatMessage(msg.id).subscribe({
      next: () => {
        this.messages = this.messages.filter(m => m.id !== msg.id);
      },
      error: () => {
        this.snackBar.open('Failed to delete message', 'Close', { duration: 3000 });
      }
    });
  }

  onTyping(): void {
    this.socketService.sendTyping(this.itineraryId, true);
    
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.socketService.sendTyping(this.itineraryId, false);
    }, 2000);
  }

  toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      this.unreadCount = 0;
      this.shouldScrollToBottom = true;
    }
  }

  getTypingText(): string {
    if (this.typingUsers.length === 1) {
      return `${this.typingUsers[0].userName} is typing...`;
    } else if (this.typingUsers.length === 2) {
      return `${this.typingUsers[0].userName} and ${this.typingUsers[1].userName} are typing...`;
    } else if (this.typingUsers.length > 2) {
      return 'Several people are typing...';
    }
    return '';
  }

  getProfilePictureUrl(path?: string | null): string {
    const trimmed = (path || '').trim();
    if (!trimmed) return '';
    // If the picture is a base64 data URL, use it directly
    if (trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    const normalized = trimmed.replace(/^\//, '');
    return `${this.backendBaseUrl}/${normalized}`;
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img) {
      img.style.display = 'none';
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
        this.shouldScrollToBottom = false;
      }
    } catch (err) {}
  }
}
