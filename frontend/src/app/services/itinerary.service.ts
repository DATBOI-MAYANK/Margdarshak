import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, shareReplay, tap } from 'rxjs';
import { Itinerary, ItineraryInput } from '../models/itinerary.model';
import { environment } from '../../environments/environment';
import { getApiUrl } from '../core/services/runtime-config';

@Injectable({
  providedIn: 'root'
})
export class ItineraryService {
  private apiUrl = `${getApiUrl()}/itineraries`;
  
  // Cache for itineraries list
  private itinerariesCache$ = new BehaviorSubject<Itinerary[] | null>(null);
  private lastFetchTime = 0;
  private cacheDuration = 30000; // 30 seconds cache

  constructor(private http: HttpClient) {}

  createItinerary(data: ItineraryInput): Observable<{ message: string; itinerary: Itinerary }> {
    return this.http.post<{ message: string; itinerary: Itinerary }>(this.apiUrl, data).pipe(
      tap(() => {
        // Invalidate cache when new itinerary is created
        this.invalidateCache();
      })
    );
  }

  getAllItineraries(filters?: {
    destination?: string;
    startDate?: string;
    endDate?: string;
    minBudget?: number;
    maxBudget?: number;
  }, forceRefresh = false): Observable<{ itineraries: Itinerary[] }> {
    let params = new HttpParams();
    
    if (filters) {
      if (filters.destination) params = params.set('destination', filters.destination);
      if (filters.startDate) params = params.set('startDate', filters.startDate);
      if (filters.endDate) params = params.set('endDate', filters.endDate);
      if (filters.minBudget !== undefined && filters.minBudget !== null) params = params.set('minBudget', filters.minBudget.toString());
      if (filters.maxBudget !== undefined && filters.maxBudget !== null) params = params.set('maxBudget', filters.maxBudget.toString());
    }

    return this.http.get<{ itineraries: Itinerary[] }>(this.apiUrl, { params });
  }

  getItineraryById(id: number): Observable<{ itinerary: Itinerary }> {
    return this.http.get<{ itinerary: Itinerary }>(`${this.apiUrl}/${id}`);
  }

  updateItinerary(id: number, data: ItineraryInput): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${id}`, data).pipe(
      tap(() => this.invalidateCache())
    );
  }

  deleteItinerary(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.invalidateCache())
    );
  }

  // Regenerate activities for an itinerary using real API data
  regenerateActivities(id: number): Observable<{ message: string; activities: any[] }> {
    return this.http.post<{ message: string; activities: any[] }>(`${this.apiUrl}/${id}/regenerate`, {});
  }

  // Admin endpoints
  getAllItinerariesAdmin(): Observable<{ itineraries: Itinerary[] }> {
    return this.http.get<{ itineraries: Itinerary[] }>(`${this.apiUrl}/admin/all`);
  }

  getAnalytics(): Observable<{ analytics: any }> {
    return this.http.get<{ analytics: any }>(`${this.apiUrl}/admin/analytics`);
  }

  // Cache management
  private invalidateCache(): void {
    this.itinerariesCache$.next(null);
    this.lastFetchTime = 0;
  }
}
