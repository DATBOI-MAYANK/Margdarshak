import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

export interface EditingUser {
  oduserId: number;
  email: string;
  name: string;
  socketId: string;
  activeField?: string;
}

export interface FieldChange {
  field: string;
  value: any;
  userId: number;
  userName: string;
  timestamp: number;
}

export interface FieldLock {
  field: string;
  userId: number;
  userName: string;
}

export interface ActivityChange {
  action: 'add' | 'update' | 'delete';
  index?: number;
  activity?: any;
  userId: number;
  userName: string;
  timestamp: number;
}

export interface ChatMessage {
  id: number;
  itinerary_id: number;
  user_id: number;
  message: string;
  created_at: Date;
  user_name?: string;
  user_email?: string;
  user_profile_picture?: string;
}

export interface NotificationEvent {
  type: string;
  title: string;
  content: string;
  priority?: string;
  itineraryId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private currentRoom: string | null = null;
  private currentChatRoom: string | null = null;

  // Observables for real-time events
  private connectedSubject = new BehaviorSubject<boolean>(false);
  private editorsSubject = new BehaviorSubject<EditingUser[]>([]);
  private fieldUpdateSubject = new Subject<FieldChange>();
  private fieldLockSubject = new Subject<FieldLock>();
  private fieldUnlockSubject = new Subject<{ field: string; userId: number }>();
  private activityUpdateSubject = new Subject<ActivityChange>();
  private userJoinedSubject = new Subject<{ userId: number; name: string; email: string }>();
  private userLeftSubject = new Subject<{ userId: number; name: string }>();
  private errorSubject = new Subject<{ message: string }>();
  
  // Chat events
  private chatMessageSubject = new Subject<ChatMessage>();
  private chatMessageDeletedSubject = new Subject<{ messageId: number; itineraryId: number }>();
  private userTypingSubject = new Subject<{ userId: number; userName: string; isTyping: boolean }>();
  
  // Notifications
  private notificationSubject = new Subject<NotificationEvent>();

  // Public observables
  connected$ = this.connectedSubject.asObservable();
  editors$ = this.editorsSubject.asObservable();
  fieldUpdate$ = this.fieldUpdateSubject.asObservable();
  fieldLock$ = this.fieldLockSubject.asObservable();
  fieldUnlock$ = this.fieldUnlockSubject.asObservable();
  activityUpdate$ = this.activityUpdateSubject.asObservable();
  userJoined$ = this.userJoinedSubject.asObservable();
  userLeft$ = this.userLeftSubject.asObservable();
  error$ = this.errorSubject.asObservable();

  constructor(private authService: AuthService) {}

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      console.error('No auth token available for socket connection');
      return;
    }

    // Resolve socket base URL from environment. If the built `apiUrl` is missing,
    // still points to localhost, or is the relative '/api', fall back to the
    // deployed Render backend URL so sockets work in production preview builds.
    let baseUrl = '';
    try {
      baseUrl = (environment.apiUrl || '').replace('/api', '');
    } catch (e) {
      baseUrl = '';
    }
    if (!baseUrl || baseUrl.includes('localhost') || baseUrl === '/api') {
      baseUrl = 'https://smartitinery2-1.onrender.com';
    }
    
    this.socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.setupEventListeners();
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      if (this.currentRoom) {
        this.leaveRoom(parseInt(this.currentRoom.split(':')[1]));
      }
      this.socket.disconnect();
      this.socket = null;
      this.connectedSubject.next(false);
    }
  }

  /**
   * Join an itinerary editing room
   */
  joinRoom(itineraryId: number): void {
    if (!this.socket?.connected) {
      this.connect();
      // Wait for connection then join
      this.socket?.once('connect', () => {
        this.emitJoinRoom(itineraryId);
      });
    } else {
      this.emitJoinRoom(itineraryId);
    }
  }

  private emitJoinRoom(itineraryId: number): void {
    this.currentRoom = `itinerary:${itineraryId}`;
    this.socket?.emit('join-room', { itineraryId });
  }

  /**
   * Leave the current editing room
   */
  leaveRoom(itineraryId: number): void {
    this.socket?.emit('leave-room', { itineraryId });
    this.currentRoom = null;
    this.editorsSubject.next([]);
  }

  /**
   * Emit field change to other editors
   */
  emitFieldChange(itineraryId: number, field: string, value: any): void {
    this.socket?.emit('field-change', { itineraryId, field, value });
  }

  /**
   * Emit field focus (lock)
   */
  emitFieldFocus(itineraryId: number, field: string): void {
    this.socket?.emit('field-focus', { itineraryId, field });
  }

  /**
   * Emit field blur (unlock)
   */
  emitFieldBlur(itineraryId: number, field: string): void {
    this.socket?.emit('field-blur', { itineraryId, field });
  }

  /**
   * Emit activity change
   */
  emitActivityChange(itineraryId: number, action: 'add' | 'update' | 'delete', index?: number, activity?: any): void {
    this.socket?.emit('activity-change', { itineraryId, action, index, activity });
  }

  // =============================================
  // Chat Methods
  // =============================================

  /**
   * Join a chat room for collaboration
   */
  joinChat(itineraryId: number): void {
    if (!this.socket?.connected) {
      this.connect();
      this.socket?.once('connect', () => {
        this.emitJoinChat(itineraryId);
      });
    } else {
      this.emitJoinChat(itineraryId);
    }
  }

  private emitJoinChat(itineraryId: number): void {
    this.currentChatRoom = `chat:${itineraryId}`;
    this.socket?.emit('join-chat', { itineraryId });
  }

  /**
   * Leave a chat room
   */
  leaveChat(itineraryId: number): void {
    this.socket?.emit('leave-chat', { itineraryId });
    this.currentChatRoom = null;
  }

  /**
   * Send typing indicator
   */
  sendTyping(itineraryId: number, isTyping: boolean): void {
    this.socket?.emit('chat-typing', { itineraryId, isTyping });
  }

  /**
   * Observable for chat messages
   */
  onChatMessage(): Observable<ChatMessage> {
    return this.chatMessageSubject.asObservable();
  }

  /**
   * Observable for chat message deletions
   */
  onChatMessageDeleted(): Observable<{ messageId: number; itineraryId: number }> {
    return this.chatMessageDeletedSubject.asObservable();
  }

  /**
   * Observable for typing indicators
   */
  onUserTyping(): Observable<{ userId: number; userName: string; isTyping: boolean }> {
    return this.userTypingSubject.asObservable();
  }

  /**
   * Observable for notifications
   */
  onNotification(): Observable<NotificationEvent> {
    return this.notificationSubject.asObservable();
  }

  /**
   * Setup socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🔌 Socket connected');
      this.connectedSubject.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      this.connectedSubject.next(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.errorSubject.next({ message: 'Connection failed' });
    });

    // Room events
    this.socket.on('current-editors', (editors: EditingUser[]) => {
      this.editorsSubject.next(editors);
    });

    this.socket.on('user-joined', (data: { userId: number; name: string; email: string }) => {
      const currentEditors = this.editorsSubject.value;
      if (!currentEditors.find(e => e.oduserId === data.userId)) {
        this.editorsSubject.next([...currentEditors, {
          oduserId: data.userId,
          email: data.email,
          name: data.name,
          socketId: ''
        }]);
      }
      this.userJoinedSubject.next(data);
    });

    this.socket.on('user-left', (data: { userId: number; name: string }) => {
      const currentEditors = this.editorsSubject.value.filter(e => e.oduserId !== data.userId);
      this.editorsSubject.next(currentEditors);
      this.userLeftSubject.next(data);
    });

    // Field events
    this.socket.on('field-update', (change: FieldChange) => {
      this.fieldUpdateSubject.next(change);
    });

    this.socket.on('field-locked', (lock: FieldLock) => {
      this.fieldLockSubject.next(lock);
    });

    this.socket.on('field-unlocked', (data: { field: string; userId: number }) => {
      this.fieldUnlockSubject.next(data);
    });

    // Activity events
    this.socket.on('activity-update', (change: ActivityChange) => {
      this.activityUpdateSubject.next(change);
    });

    // Error events
    this.socket.on('error', (error: { message: string }) => {
      this.errorSubject.next(error);
    });

    // Chat events
    this.socket.on('chat_message', (message: ChatMessage) => {
      this.chatMessageSubject.next(message);
    });

    this.socket.on('chat_message_deleted', (data: { messageId: number; itineraryId: number }) => {
      this.chatMessageDeletedSubject.next(data);
    });

    this.socket.on('user-typing', (data: { userId: number; userName: string; isTyping: boolean }) => {
      this.userTypingSubject.next(data);
    });

    // Notification events
    this.socket.on('notification', (notification: NotificationEvent) => {
      this.notificationSubject.next(notification);
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
