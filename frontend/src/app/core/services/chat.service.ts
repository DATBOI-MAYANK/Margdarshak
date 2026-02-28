import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { getApiUrl } from './runtime-config';

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

export interface ChatParticipant {
  id: number;
  name: string;
  email: string;
  profile_picture?: string;
}

export interface ChatMessagesResponse {
  messages: ChatMessage[];
  participants: ChatParticipant[];
  hasMore: boolean;
}

export interface UnreadChat {
  itinerary_id: number;
  destination: string;
  unread_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = `${getApiUrl()}/chat`;

  constructor(private http: HttpClient) {}

  getChatMessages(itineraryId: number, limit: number = 50, before?: number): Observable<ChatMessagesResponse> {
    const params: any = { limit };
    if (before) params.before = before;
    
    return this.http.get<ChatMessagesResponse>(`${this.apiUrl}/${itineraryId}`, { params });
  }

  sendChatMessage(itineraryId: number, message: string): Observable<{ message: string; chatMessage: ChatMessage }> {
    return this.http.post<{ message: string; chatMessage: ChatMessage }>(`${this.apiUrl}/${itineraryId}`, { message });
  }

  deleteChatMessage(messageId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/message/${messageId}`);
  }

  getUnreadChatCounts(): Observable<{ unreadChats: UnreadChat[] }> {
    return this.http.get<{ unreadChats: UnreadChat[] }>(`${this.apiUrl}/unread/counts`);
  }
}
