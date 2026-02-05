import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, of, catchError, map } from 'rxjs';
import { Router } from '@angular/router';
import { User, AuthResponse, LoginRequest, RegisterRequest, UserStats } from '../models/user.model';
import { environment } from '../../environments/environment';
import { getApiUrl } from '../core/services/runtime-config';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${getApiUrl()}/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(private http: HttpClient, private router: Router) {
    // Initialize auth state immediately
    this.initAuthState();
  }

  /**
   * Initialize auth state from localStorage
   * This is called immediately on service construction and can also be awaited
   */
  initAuthState(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise<void>((resolve) => {
      try {
        const token = this.getToken();
        const userStr = localStorage.getItem('user');
        
        if (token && userStr) {
          // Check if token is expired
          if (this.isTokenExpired(token)) {
            console.log('Token expired, clearing auth state');
            this.clearAuthData();
            resolve();
            return;
          }

          const user = JSON.parse(userStr);
          this.currentUserSubject.next(user);
          console.log('Auth state restored from storage');
          
          // Fetch fresh profile data from server after a short delay to avoid circular dependency
          // The delay ensures DI is fully resolved before making HTTP calls
          setTimeout(() => this.refreshUserProfile(), 100);
        }
      } catch (e) {
        console.error('Error loading auth state:', e);
        this.clearAuthData();
      }
      
      this.initialized = true;
      resolve();
    });

    return this.initPromise;
  }

  /**
   * Check if JWT token is expired
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp;
      if (!expiry) return false;
      
      // Check if token expires within the next minute (buffer)
      const now = Math.floor(Date.now() / 1000);
      return expiry < now + 60;
    } catch (e) {
      console.error('Error parsing token:', e);
      return true; // Consider invalid tokens as expired
    }
  }

  /**
   * Clear all auth data from storage
   */
  private clearAuthData(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  private loadUserFromStorage(): void {
    const token = this.getToken();
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        if (this.isTokenExpired(token)) {
          this.clearAuthData();
          return;
        }
        const user = JSON.parse(userStr);
        this.currentUserSubject.next(user);
      } catch (e) {
        this.logout();
      }
    }
  }

  /**
   * Refresh user profile from server to ensure data (like profile picture) is up to date
   * This runs in the background and doesn't block the app
   */
  private refreshUserProfile(): void {
    this.http.get<{ user: User }>(`${this.apiUrl}/profile`).subscribe({
      next: (response) => {
        if (response.user) {
          // Update localStorage and BehaviorSubject with fresh data
          localStorage.setItem('user', JSON.stringify(response.user));
          this.currentUserSubject.next(response.user);
          console.log('User profile refreshed from server');
        }
      },
      error: (error) => {
        // If we get a 401, the token is invalid
        if (error.status === 401) {
          console.log('Token invalid, clearing auth state');
          this.clearAuthData();
        } else {
          console.warn('Failed to refresh user profile:', error);
        }
      }
    });
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data).pipe(
      tap(response => {
        this.setSession(response);
      })
    );
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        this.setSession(response);
      })
    );
  }

  logout(): void {
    this.clearAuthData();
    this.router.navigate(['/login']);
  }

  /**
   * Verify token is still valid with the server
   * This helps ensure the session is truly valid, not just a stale token
   */
  verifySession(): Observable<boolean> {
    const token = this.getToken();
    if (!token || this.isTokenExpired(token)) {
      this.clearAuthData();
      return of(false);
    }

    return this.http.get<{ user: User }>(`${this.apiUrl}/profile`).pipe(
      map(response => {
        // Update stored user data with server data
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user));
          this.currentUserSubject.next(response.user);
        }
        return true;
      }),
      catchError(() => {
        // If profile fetch fails, clear auth state
        this.clearAuthData();
        return of(false);
      })
    );
  }

  private setSession(authResult: AuthResponse): void {
    localStorage.setItem('token', authResult.token);
    localStorage.setItem('user', JSON.stringify(authResult.user));
    this.currentUserSubject.next(authResult.user);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'Admin';
  }

  isTraveler(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'Traveler';
  }

  getProfile(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(`${this.apiUrl}/profile`);
  }

  updateProfile(data: { name: string; email: string; contact_info?: string }): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/profile`, data);
  }

  uploadProfilePicture(file: File): Observable<{ message: string; profile_picture: string }> {
    const formData = new FormData();
    formData.append('profile_picture', file);
    return this.http.post<{ message: string; profile_picture: string }>(`${this.apiUrl}/profile/picture`, formData).pipe(
      tap(response => {
        // Automatically update the current user with the new profile picture
        this.updateCurrentUser({ profile_picture: response.profile_picture });
      })
    );
  }

  removeProfilePicture(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/profile/picture`).pipe(
      tap(() => {
        // Automatically remove the profile picture from current user
        this.updateCurrentUser({ profile_picture: undefined });
      })
    );
  }

  updateCurrentUser(updates: Partial<User>): void {
    const user = this.getCurrentUser();
    if (user) {
      const updatedUser = { ...user, ...updates };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      this.currentUserSubject.next(updatedUser);
    }
  }

  changePassword(data: { currentPassword: string; newPassword: string }): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/change-password`, data);
  }

  getAllUsers(): Observable<{ users: User[] }> {
    return this.http.get<{ users: User[] }>(`${this.apiUrl}/users`);
  }

  // Admin Management Methods
  getUserStats(): Observable<{ stats: UserStats }> {
    return this.http.get<{ stats: UserStats }>(`${this.apiUrl}/users/stats`);
  }

  updateUserRole(userId: number, role: 'Traveler' | 'Admin'): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/users/${userId}/role`, { role });
  }

  updateUserStatus(userId: number, status: 'active' | 'suspended'): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/users/${userId}/status`, { status });
  }

  deleteUser(userId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/users/${userId}`);
  }
}
