import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PlaceResult {
  name: string;
  coordinates: [number, number]; // [longitude, latitude]
}

export interface MapboxFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
  context?: Array<{
    id: string;
    text: string;
  }>;
}

export interface MapboxResponse {
  features: MapboxFeature[];
}

@Injectable({
  providedIn: 'root'
})
export class CityService {
  // Mapbox Geocoding API
  private apiUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
  private accessToken = environment.mapboxToken;

  // Fallback cities with coordinates
  private fallbackCities: PlaceResult[] = [
    { name: 'Noida, Uttar Pradesh, India', coordinates: [77.391, 28.535] },
    { name: 'New Delhi, Delhi, India', coordinates: [77.209, 28.614] },
    { name: 'Mumbai, Maharashtra, India', coordinates: [72.878, 19.076] },
    { name: 'Bangalore, Karnataka, India', coordinates: [77.594, 12.972] },
    { name: 'Paris, France', coordinates: [2.352, 48.857] },
    { name: 'London, United Kingdom', coordinates: [-0.118, 51.509] },
    { name: 'Tokyo, Japan', coordinates: [139.692, 35.690] },
    { name: 'New York, United States', coordinates: [-74.006, 40.713] },
    { name: 'Dubai, United Arab Emirates', coordinates: [55.270, 25.205] },
    { name: 'Singapore', coordinates: [103.820, 1.352] },
    { name: 'Bangkok, Thailand', coordinates: [100.502, 13.756] },
    { name: 'Sydney, Australia', coordinates: [151.209, -33.868] },
    { name: 'Bali, Indonesia', coordinates: [115.188, -8.410] },
    { name: 'Maldives', coordinates: [73.509, 4.176] }
  ];

  constructor(private http: HttpClient) {}

  /**
   * Search places using Mapbox Geocoding API - returns names only
   */
  searchCities(query: string, limit: number = 10): Observable<string[]> {
    return this.searchPlaces(query, limit).pipe(
      map(places => places.map(p => p.name))
    );
  }

  /**
   * Search places with coordinates using Mapbox Geocoding API
   */
  searchPlaces(query: string, limit: number = 10): Observable<PlaceResult[]> {
    if (!query || query.length < 2) {
      return of(this.fallbackCities.slice(0, limit));
    }

    const url = `${this.apiUrl}/${encodeURIComponent(query)}.json`;
    
    const params = {
      access_token: this.accessToken,
      autocomplete: 'true',
      types: 'place,locality,region,country',
      limit: limit.toString()
    };

    return this.http.get<MapboxResponse>(url, { params }).pipe(
      map(response => {
        if (response.features && response.features.length > 0) {
          return response.features.map(feature => ({
            name: feature.place_name,
            coordinates: feature.center as [number, number]
          }));
        }
        return this.filterFallbackCities(query, limit);
      }),
      catchError(error => {
        console.error('Mapbox API error:', error);
        return of(this.filterFallbackCities(query, limit));
      })
    );
  }

  /**
   * Get coordinates for a place name
   */
  getCoordinates(placeName: string): Observable<[number, number] | null> {
    const url = `${this.apiUrl}/${encodeURIComponent(placeName)}.json`;
    
    return this.http.get<MapboxResponse>(url, { 
      params: { 
        access_token: this.accessToken,
        limit: '1'
      } 
    }).pipe(
      map(response => {
        if (response.features && response.features.length > 0) {
          return response.features[0].center as [number, number];
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Filter fallback cities
   */
  private filterFallbackCities(query: string, limit: number): PlaceResult[] {
    const searchTerm = query.toLowerCase();
    return this.fallbackCities
      .filter(city => city.name.toLowerCase().includes(searchTerm))
      .slice(0, limit);
  }

  /**
   * Get popular destinations
   */
  getPopularDestinations(): string[] {
    return this.fallbackCities.map(c => c.name);
  }
}
