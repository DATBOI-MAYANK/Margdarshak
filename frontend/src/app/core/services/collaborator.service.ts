import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { getApiUrl } from './runtime-config';
import { Collaboration, CollaborationStats, TopCollaborator, MostSharedItinerary } from '../../models/user.model';

export interface Collaborator {
  id: number;
  itinerary_id: number;
  user_id: number;
  permission: 'view' | 'edit';
  status?: 'pending' | 'accepted' | 'rejected';
  invited_by: number;
  invited_at: string;
  email: string;
  name: string;
  invited_by_email?: string;
  invited_by_name?: string;
}

export interface PendingInvite {
  id: number;
  itinerary_id: number;
  permission: 'view' | 'edit';
  invited_at: string;
  itinerary_title: string;
  destination: string;
  start_date: string;
  end_date: string;
  inviter_email: string;
  inviter_name: string;
}

export interface SharedItinerary {
  id: number;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  budget: number;
  permission: 'view' | 'edit';
  owner_email: string;
  owner_name: string;
}

export interface OwnerInfo {
  id: number;
  name: string;
  email: string;
}

export interface CollaboratorsResponse {
  collaborators: Collaborator[];
  owner: OwnerInfo;
  isOwner: boolean;
  currentUserId: number;
}

export interface AllCollaborationsResponse {
  collaborations: Collaboration[];
  stats: CollaborationStats;
  topCollaborators: TopCollaborator[];
  mostShared: MostSharedItinerary[];
}

@Injectable({
  providedIn: 'root'
})
export class CollaboratorService {
  private apiUrl = `${getApiUrl()}/collaborators`;
  
  // Track pending invites count for notification badge
  private pendingCountSubject = new BehaviorSubject<number>(0);
  pendingCount$ = this.pendingCountSubject.asObservable();

  // Emit when an invite is accepted (so itinerary list can refresh)
  private inviteAcceptedSubject = new Subject<number>();
  inviteAccepted$ = this.inviteAcceptedSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get all collaborators for an itinerary
   */
  getCollaborators(itineraryId: number): Observable<CollaboratorsResponse> {
    return this.http.get<CollaboratorsResponse>(`${this.apiUrl}/${itineraryId}`);
  }

  /**
   * Invite a user to collaborate
   */
  inviteCollaborator(itineraryId: number, email: string, permission: 'view' | 'edit' = 'edit'): Observable<{ message: string; collaborator: Collaborator }> {
    return this.http.post<{ message: string; collaborator: Collaborator }>(
      `${this.apiUrl}/${itineraryId}/invite`,
      { email, permission }
    );
  }

  /**
   * Update collaborator permission
   */
  updatePermission(itineraryId: number, collaboratorId: number, permission: 'view' | 'edit'): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/${itineraryId}/${collaboratorId}`,
      { permission }
    );
  }

  /**
   * Remove a collaborator
   */
  removeCollaborator(itineraryId: number, collaboratorId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${itineraryId}/${collaboratorId}`);
  }

  /**
   * Get all itineraries shared with the current user
   */
  getSharedWithMe(): Observable<{ itineraries: SharedItinerary[] }> {
    return this.http.get<{ itineraries: SharedItinerary[] }>(`${this.apiUrl}/shared-with-me`);
  }

  /**
   * Get pending invitations for current user
   */
  getPendingInvites(): Observable<{ invites: PendingInvite[] }> {
    return this.http.get<{ invites: PendingInvite[] }>(`${this.apiUrl}/pending-invites`).pipe(
      tap(response => this.pendingCountSubject.next(response.invites.length))
    );
  }

  /**
   * Accept a collaboration invite
   */
  acceptInvite(inviteId: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/invites/${inviteId}/accept`, {}).pipe(
      tap(() => this.inviteAcceptedSubject.next(inviteId))
    );
  }

  /**
   * Reject a collaboration invite
   */
  rejectInvite(inviteId: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/invites/${inviteId}/reject`, {});
  }

  /**
   * Refresh the pending count
   */
  refreshPendingCount(): void {
    this.getPendingInvites().subscribe();
  }

  /**
   * Admin: Get all collaborations across all itineraries
   */
  getAllCollaborations(): Observable<AllCollaborationsResponse> {
    return this.http.get<AllCollaborationsResponse>(`${this.apiUrl}/admin/all`);
  }
}
