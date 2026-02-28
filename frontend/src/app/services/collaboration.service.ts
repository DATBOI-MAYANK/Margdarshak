import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { getApiUrl } from '../core/services/runtime-config';

export interface Collaborator {
  id: number;
  user_id: number;
  itinerary_id: number;
  role: string;
  joined_at: string;
  name: string;
  email: string;
}

export interface CollaboratorResponse {
  message: string;
  collaborators: Collaborator[];
}

@Injectable({
  providedIn: 'root'
})
export class CollaborationService {
  private apiUrl = `${getApiUrl()}/collaborators`;

  constructor(private http: HttpClient) {}

  getCollaborators(itineraryId: number): Observable<CollaboratorResponse> {
    return this.http.get<CollaboratorResponse>(`${this.apiUrl}/${itineraryId}`);
  }

  addCollaborator(itineraryId: number, email: string, permission: string = 'edit'): Observable<any> {
    return this.http.post(`${this.apiUrl}/${itineraryId}/invite`, { email, permission });
  }

  removeCollaborator(itineraryId: number, collaboratorId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${itineraryId}/${collaboratorId}`);
  }

  updateCollaboratorRole(itineraryId: number, userId: number, role: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${itineraryId}/role`, { userId, role });
  }
}
