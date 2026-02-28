import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, interval } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { getApiUrl } from '../core/services/runtime-config';

export interface TimezoneInfo {
  timezone: string;
  utcOffset: number;
  currentTime: Date;
  displayTime: string;
  displayDate: string;
  abbreviation: string;
}

@Injectable({
  providedIn: 'root'
})
export class TimezoneService {
  private timezoneCache: Map<string, string> = new Map();

  constructor(private http: HttpClient) {}

  /**
   * Get timezone for a destination using geocoding
   */
  getTimezone(destination: string): Observable<string> {
    const cityName = destination.split(',')[0].trim().toLowerCase();
    
    // Check cache first
    if (this.timezoneCache.has(cityName)) {
      return of(this.timezoneCache.get(cityName)!);
    }

    // Use backend proxy to get coordinates and timezone
    return this.http.get<any>(`${getApiUrl()}/weather/geocode?name=${encodeURIComponent(cityName)}`).pipe(
      map(response => {
        if (response.results && response.results.length > 0) {
          const result = response.results[0];
          const timezone = result.timezone || this.guessTimezone(result.country_code, result.latitude);
          this.timezoneCache.set(cityName, timezone);
          return timezone;
        }
        return 'UTC';
      }),
      catchError(() => of('UTC'))
    );
  }

  /**
   * Guess timezone from country code and latitude
   */
  private guessTimezone(countryCode: string, latitude: number): string {
    const timezoneMap: Record<string, string> = {
      'US': latitude > 40 ? 'America/New_York' : 'America/Los_Angeles',
      'GB': 'Europe/London',
      'UK': 'Europe/London',
      'FR': 'Europe/Paris',
      'DE': 'Europe/Berlin',
      'IT': 'Europe/Rome',
      'ES': 'Europe/Madrid',
      'JP': 'Asia/Tokyo',
      'CN': 'Asia/Shanghai',
      'IN': 'Asia/Kolkata',
      'AU': 'Australia/Sydney',
      'BR': 'America/Sao_Paulo',
      'CA': 'America/Toronto',
      'MX': 'America/Mexico_City',
      'RU': 'Europe/Moscow',
      'KR': 'Asia/Seoul',
      'SG': 'Asia/Singapore',
      'HK': 'Asia/Hong_Kong',
      'TH': 'Asia/Bangkok',
      'AE': 'Asia/Dubai',
      'EG': 'Africa/Cairo',
      'ZA': 'Africa/Johannesburg',
      'NZ': 'Pacific/Auckland',
      'TR': 'Europe/Istanbul',
      'SA': 'Asia/Riyadh',
      'ID': 'Asia/Jakarta',
      'MY': 'Asia/Kuala_Lumpur',
      'PH': 'Asia/Manila',
      'VN': 'Asia/Ho_Chi_Minh',
      'PK': 'Asia/Karachi',
      'BD': 'Asia/Dhaka',
      'NL': 'Europe/Amsterdam',
      'BE': 'Europe/Brussels',
      'CH': 'Europe/Zurich',
      'AT': 'Europe/Vienna',
      'SE': 'Europe/Stockholm',
      'NO': 'Europe/Oslo',
      'DK': 'Europe/Copenhagen',
      'FI': 'Europe/Helsinki',
      'PL': 'Europe/Warsaw',
      'CZ': 'Europe/Prague',
      'GR': 'Europe/Athens',
      'PT': 'Europe/Lisbon',
      'IE': 'Europe/Dublin',
      'IL': 'Asia/Jerusalem',
      'AR': 'America/Argentina/Buenos_Aires',
      'CL': 'America/Santiago',
      'CO': 'America/Bogota',
      'PE': 'America/Lima'
    };
    
    return timezoneMap[countryCode?.toUpperCase()] || 'UTC';
  }

  /**
   * Get current time in a specific timezone
   */
  getCurrentTimeInTimezone(timezone: string): TimezoneInfo {
    try {
      const now = new Date();
      
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      
      const dateOptions: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };

      const timeFormatter = new Intl.DateTimeFormat('en-US', options);
      const dateFormatter = new Intl.DateTimeFormat('en-US', dateOptions);
      
      // Get timezone abbreviation
      const abbrevOptions: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        timeZoneName: 'short'
      };
      const abbrevFormatter = new Intl.DateTimeFormat('en-US', abbrevOptions);
      const parts = abbrevFormatter.formatToParts(now);
      const abbrevPart = parts.find(p => p.type === 'timeZoneName');
      const abbreviation = abbrevPart?.value || timezone.split('/').pop() || '';

      // Calculate UTC offset
      const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const utcOffset = (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);

      return {
        timezone,
        utcOffset,
        currentTime: now,
        displayTime: timeFormatter.format(now),
        displayDate: dateFormatter.format(now),
        abbreviation
      };
    } catch (error) {
      console.error('Error getting time for timezone:', timezone, error);
      return {
        timezone: 'UTC',
        utcOffset: 0,
        currentTime: new Date(),
        displayTime: new Date().toLocaleTimeString(),
        displayDate: new Date().toLocaleDateString(),
        abbreviation: 'UTC'
      };
    }
  }

  /**
   * Get timezone display name
   */
  getTimezoneDisplayName(timezone: string): string {
    const parts = timezone.split('/');
    if (parts.length >= 2) {
      return parts[parts.length - 1].replace(/_/g, ' ');
    }
    return timezone;
  }

  /**
   * Format UTC offset for display
   */
  formatUtcOffset(offset: number): string {
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const hours = Math.floor(absOffset);
    const minutes = Math.round((absOffset - hours) * 60);
    
    if (minutes === 0) {
      return `UTC${sign}${hours}`;
    }
    return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
  }
}
