import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { getApiUrl } from './runtime-config';

export interface Message {
  id: number;
  sender_id: number;
  recipient_id: number | null;
  type: 'admin_notice' | 'support_query' | 'support_reply' | 'system';
  subject: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_read: boolean;
  is_broadcast: boolean;
  parent_id: number | null;
  created_at: Date;
  sender_name?: string;
  sender_email?: string;
  sender_role?: string;
  recipient_name?: string;
  recipient_email?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: 'message' | 'collaboration' | 'system' | 'admin_notice';
  title: string;
  content: string | null;
  link: string | null;
  is_read: boolean;
  created_at: Date;
}

export interface SupportTicket {
  id: number;
  sender_id: number;
  subject: string;
  content: string;
  status: string;
  is_read: boolean;
  created_at: Date;
  sender_name: string;
  sender_email: string;
  reply_count: number;
}

export interface SupportStats {
  total: number;
  pending: number;
  resolved: number;
}

export interface MessagesResponse {
  messages: Message[];
  unreadCount: number;
  page: number;
  limit: number;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export interface SupportTicketsResponse {
  tickets: SupportTicket[];
  stats: SupportStats;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private apiUrl = `${getApiUrl()}/messages`;
  
  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  private notificationCountSubject = new BehaviorSubject<number>(0);
  notificationCount$ = this.notificationCountSubject.asObservable();

  constructor(private http: HttpClient) {}

  // =============================================
  // Messages
  // =============================================
  
  getMessages(type?: string, page: number = 1, limit: number = 20): Observable<MessagesResponse> {
    const params: any = { page, limit };
    if (type) params.type = type;
    
    return this.http.get<MessagesResponse>(this.apiUrl, { params }).pipe(
      tap(response => this.unreadCountSubject.next(response.unreadCount))
    );
  }

  getMessageThread(messageId: number): Observable<{ messages: Message[] }> {
    return this.http.get<{ messages: Message[] }>(`${this.apiUrl}/thread/${messageId}`);
  }

  markMessageRead(messageId: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${messageId}/read`, {}).pipe(
      tap(() => {
        const current = this.unreadCountSubject.value;
        if (current > 0) this.unreadCountSubject.next(current - 1);
      })
    );
  }

  // =============================================
  // Notifications
  // =============================================
  
  getNotifications(unreadOnly: boolean = false): Observable<NotificationsResponse> {
    return this.http.get<NotificationsResponse>(`${this.apiUrl}/notifications`, {
      params: { unreadOnly: unreadOnly.toString() }
    }).pipe(
      tap(response => this.notificationCountSubject.next(response.unreadCount))
    );
  }

  markNotificationRead(notificationId: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/notifications/${notificationId}/read`, {}).pipe(
      tap(() => {
        const current = this.notificationCountSubject.value;
        if (current > 0) this.notificationCountSubject.next(current - 1);
      })
    );
  }

  markAllNotificationsRead(): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/notifications/read-all`, {}).pipe(
      tap(() => this.notificationCountSubject.next(0))
    );
  }

  deleteNotification(notificationId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/notifications/${notificationId}`);
  }

  // =============================================
  // Support (Traveler)
  // =============================================
  
  sendSupportMessage(subject: string, content: string, category: string = 'general'): Observable<{ message: string; ticketId: number; confirmation: string }> {
    return this.http.post<{ message: string; ticketId: number; confirmation: string }>(`${this.apiUrl}/support`, {
      subject,
      content,
      category
    });
  }

  // =============================================
  // Admin functions
  // =============================================
  
  sendBroadcast(subject: string, content: string, priority: string = 'normal'): Observable<{ message: string; messageId: number; recipientCount: number }> {
    return this.http.post<{ message: string; messageId: number; recipientCount: number }>(`${this.apiUrl}/broadcast`, {
      subject,
      content,
      priority
    });
  }

  sendToUser(userId: number, subject: string, content: string, priority: string = 'normal'): Observable<{ message: string; messageId: number }> {
    return this.http.post<{ message: string; messageId: number }>(`${this.apiUrl}/send/${userId}`, {
      subject,
      content,
      priority
    });
  }

  getSupportTickets(status: string = 'all'): Observable<SupportTicketsResponse> {
    return this.http.get<SupportTicketsResponse>(`${this.apiUrl}/support/tickets`, {
      params: { status }
    });
  }

  replySupportMessage(messageId: number, content: string, resolve: boolean = false): Observable<{ message: string; replyId: number; status: string }> {
    return this.http.post<{ message: string; replyId: number; status: string }>(`${this.apiUrl}/support/${messageId}/reply`, {
      content,
      resolve
    });
  }

  resolveTicket(messageId: number): Observable<{ message: string; status: string }> {
    return this.http.post<{ message: string; status: string }>(`${this.apiUrl}/support/${messageId}/reply`, {
      content: 'Ticket resolved.',
      resolve: true
    });
  }

  // Update counts from external events (Socket.io)
  updateUnreadCount(count: number): void {
    this.unreadCountSubject.next(count);
  }

  incrementNotificationCount(): void {
    this.notificationCountSubject.next(this.notificationCountSubject.value + 1);
  }
}
