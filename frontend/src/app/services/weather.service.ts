import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { getApiUrl } from '../core/services/runtime-config';

export interface WeatherData {
  date: Date;
  temp: number;
  tempMin: number;
  tempMax: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
}

export interface CurrentWeather {
  temp: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  city: string;
  country?: string;
}

interface GeoLocation {
  lat: number;
  lon: number;
  name: string;
  country: string;
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  // Use backend proxy to avoid CORS issues
  private baseUrl = `${getApiUrl()}/weather`;
  private geocodeUrl = `${getApiUrl()}/weather/geocode`;
  
  // Cache for geocoded locations
  private locationCache: Map<string, GeoLocation> = new Map();

  constructor(private http: HttpClient) {}

  // Geocode city name to coordinates using backend proxy
  private geocodeCity(destination: string): Observable<GeoLocation | null> {
    const cityName = destination.split(',')[0].trim().toLowerCase();
    
    // Check cache first
    if (this.locationCache.has(cityName)) {
      return of(this.locationCache.get(cityName)!);
    }

    // Use backend proxy to avoid CORS
    const url = `${this.geocodeUrl}?name=${encodeURIComponent(cityName)}`;

    return this.http.get<any>(url).pipe(
      map(response => {
        if (response.results && response.results.length > 0) {
          const result = response.results[0];
          const location: GeoLocation = {
            lat: result.latitude,
            lon: result.longitude,
            name: result.name,
            country: result.country || ''
          };
          // Cache the result
          this.locationCache.set(cityName, location);
          return location;
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  getWeatherForecast(destination: string, startDate: string, endDate: string): Observable<WeatherData[]> {
    return this.geocodeCity(destination).pipe(
      switchMap(location => {
        if (!location) {
          console.warn(`Could not find coordinates for: ${destination}, using mock data`);
          return of(this.getMockWeather(startDate, endDate));
        }

        const url = `${this.baseUrl}/forecast?latitude=${location.lat}&longitude=${location.lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max&timezone=auto&start_date=${startDate}&end_date=${endDate}`;

        return this.http.get<any>(url).pipe(
          map(response => this.mapWeatherResponse(response)),
          catchError(err => {
            console.error('Weather API error:', err);
            return of(this.getMockWeather(startDate, endDate));
          })
        );
      })
    );
  }

  getCurrentWeather(destination: string): Observable<CurrentWeather> {
    return this.geocodeCity(destination).pipe(
      switchMap(location => {
        if (!location) {
          console.warn(`Could not find coordinates for: ${destination}`);
          return of({
            temp: 20,
            description: 'Partly Cloudy',
            icon: 'cloud',
            humidity: 60,
            windSpeed: 12,
            city: destination.split(',')[0].trim()
          });
        }

        const url = `${this.baseUrl}/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;

        return this.http.get<any>(url).pipe(
          map(response => ({
            temp: Math.round(response.current.temperature_2m),
            description: this.getWeatherDescription(response.current.weather_code),
            icon: this.getWeatherIcon(response.current.weather_code),
            humidity: response.current.relative_humidity_2m,
            windSpeed: Math.round(response.current.wind_speed_10m),
            city: location.name,
            country: location.country
          })),
          catchError(() => of({
            temp: 20,
            description: 'Partly Cloudy',
            icon: 'cloud',
            humidity: 60,
            windSpeed: 12,
            city: location.name,
            country: location.country
          }))
        );
      })
    );
  }

  private mapWeatherResponse(response: any): WeatherData[] {
    const daily = response.daily;
    return daily.time.map((date: string, i: number) => ({
      date: new Date(date),
      temp: Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2),
      tempMin: Math.round(daily.temperature_2m_min[i]),
      tempMax: Math.round(daily.temperature_2m_max[i]),
      description: this.getWeatherDescription(daily.weathercode[i]),
      icon: this.getWeatherIcon(daily.weathercode[i]),
      humidity: daily.precipitation_probability_max[i] || 0,
      windSpeed: 0
    }));
  }

  private getWeatherDescription(code: number): string {
    const descriptions: Record<number, string> = {
      0: 'Clear Sky',
      1: 'Mainly Clear',
      2: 'Partly Cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Foggy',
      51: 'Light Drizzle',
      53: 'Drizzle',
      55: 'Heavy Drizzle',
      61: 'Light Rain',
      63: 'Rain',
      65: 'Heavy Rain',
      71: 'Light Snow',
      73: 'Snow',
      75: 'Heavy Snow',
      80: 'Rain Showers',
      81: 'Rain Showers',
      82: 'Heavy Showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm',
      99: 'Thunderstorm'
    };
    return descriptions[code] || 'Unknown';
  }

  private getWeatherIcon(code: number): string {
    // Using valid Material Icons that exist in the icon font
    // Reference: https://fonts.google.com/icons
    const iconMap: Record<number, string> = {
      0: 'wb_sunny',           // Clear sky - sun icon
      1: 'wb_sunny',           // Mainly clear - sun icon
      2: 'cloud',              // Partly cloudy - cloud icon (partly_cloudy_day doesn't exist)
      3: 'cloud',              // Overcast - cloud icon
      45: 'cloud',             // Foggy
      48: 'cloud',             // Depositing rime fog
      51: 'grain',             // Light drizzle
      53: 'grain',             // Moderate drizzle
      55: 'grain',             // Dense drizzle
      56: 'ac_unit',           // Freezing drizzle light
      57: 'ac_unit',           // Freezing drizzle dense
      61: 'water_drop',        // Light rain
      63: 'water_drop',        // Moderate rain
      65: 'water_drop',        // Heavy rain
      66: 'ac_unit',           // Freezing rain light
      67: 'ac_unit',           // Freezing rain heavy
      71: 'ac_unit',           // Light snow
      73: 'ac_unit',           // Moderate snow
      75: 'ac_unit',           // Heavy snow
      77: 'ac_unit',           // Snow grains
      80: 'water_drop',        // Rain showers slight
      81: 'water_drop',        // Rain showers moderate
      82: 'water_drop',        // Rain showers violent
      85: 'ac_unit',           // Snow showers slight
      86: 'ac_unit',           // Snow showers heavy
      95: 'thunderstorm',      // Thunderstorm
      96: 'thunderstorm',      // Thunderstorm with hail
      99: 'thunderstorm'       // Thunderstorm with heavy hail
    };
    
    return iconMap[code] || 'cloud';  // Default to cloud if unknown
  }

  private getMockWeather(startDate: string, endDate: string): WeatherData[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Use valid Material Icons only
    const mockConditions = [
      { description: 'Sunny', icon: 'wb_sunny' },
      { description: 'Partly Cloudy', icon: 'cloud' },
      { description: 'Cloudy', icon: 'cloud' },
      { description: 'Light Rain', icon: 'water_drop' }
    ];
    
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const condition = mockConditions[Math.floor(Math.random() * mockConditions.length)];
      return {
        date,
        temp: 15 + Math.floor(Math.random() * 15),
        tempMin: 10 + Math.floor(Math.random() * 10),
        tempMax: 20 + Math.floor(Math.random() * 10),
        description: condition.description,
        icon: condition.icon,
        humidity: 50 + Math.floor(Math.random() * 30),
        windSpeed: 5 + Math.floor(Math.random() * 20)
      };
    });
  }
}
