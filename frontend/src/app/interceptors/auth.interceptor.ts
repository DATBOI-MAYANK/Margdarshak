import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer, BehaviorSubject, TimeoutError } from 'rxjs';
import { catchError, retry, timeout, finalize, switchMap, filter, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  
  // URLs that should not trigger logout on 401
  private authIgnoreUrls = ['/auth/login', '/auth/register'];

  // External API domains that should NOT receive our auth token
  private externalDomains = [
    'api.geoapify.com',
    'api.mapbox.com',
    'maps.geoapify.com',
    'api.openweathermap.org',
    'tile.openstreetmap.org'
  ];

  constructor(private authService: AuthService, private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();

    // Only add auth header to our own backend requests, not third-party APIs
    const isExternal = this.externalDomains.some(domain => req.url.includes(domain));

    if (token && !isExternal) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    // Skip retry/timeout logic for external API calls
    if (isExternal) {
      return next.handle(req);
    }

    // Set timeout based on request type (longer for itinerary creation)
    const requestTimeout = req.url.includes('/itineraries') && req.method === 'POST' 
      ? 120000 // 2 minutes for itinerary creation
      : 30000; // 30 seconds for other requests

    return next.handle(req).pipe(
      timeout(requestTimeout),
      retry({
        count: 2,
        delay: (error, retryCount) => {
          // Only retry on network errors or 5xx server errors
          if (error.status === 0 || (error.status >= 500 && error.status < 600)) {
            console.log(`Retrying request (attempt ${retryCount})...`);
            return timer(1000 * retryCount); // Exponential backoff
          }
          throw error;
        }
      }),
      catchError((error: HttpErrorResponse | TimeoutError) => {
        // Handle timeout errors
        if (error instanceof TimeoutError) {
          console.error('Request timed out:', req.url);
          return throwError(() => new HttpErrorResponse({
            error: { error: 'Request timed out. Please try again.' },
            status: 408,
            statusText: 'Request Timeout'
          }));
        }

        const httpError = error as HttpErrorResponse;

        // Handle 401 Unauthorized
        if (httpError.status === 401) {
          // Don't logout for auth endpoints
          const isAuthEndpoint = this.authIgnoreUrls.some(url => req.url.includes(url));
          if (!isAuthEndpoint && this.authService.isLoggedIn()) {
            // Only logout if token is actually expired (not just a network issue)
            this.authService.logout();
            this.router.navigate(['/login'], { 
              queryParams: { returnUrl: this.router.url, reason: 'session_expired' } 
            });
          }
        }
        
        // Handle network errors
        if (httpError.status === 0) {
          return throwError(() => new HttpErrorResponse({
            error: { error: 'Network error. Please check your connection.' },
            status: 0,
            statusText: 'Network Error'
          }));
        }

        return throwError(() => httpError);
      })
    );
  }
}
