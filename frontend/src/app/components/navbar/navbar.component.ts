import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { MessageService } from '../../core/services/message.service';
import { SocketService } from '../../core/services/socket.service';
import { Subscription } from 'rxjs';
import { getApiBase } from '../../core/services/runtime-config';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isLoggedIn = false;
  isAdmin = false;
  notificationCount = 0;
  apiUrl = getApiBase();

  private subscriptions: Subscription[] = [];

  constructor(
    public authService: AuthService,
    private router: Router,
    private messageService: MessageService,
    private socketService: SocketService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state changes
    const authSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
      this.isAdmin = user?.role === 'Admin';
      
      // Force change detection to ensure UI updates
      this.cdr.detectChanges();
      
      if (user) {
        this.loadNotificationCount();
        this.setupSocketListeners();
      } else {
        // Clear socket connection when logged out
        this.socketService.disconnect();
        this.notificationCount = 0;
      }
    });
    this.subscriptions.push(authSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadNotificationCount(): void {
    this.messageService.getNotifications(true).subscribe({
      next: (response) => {
        this.notificationCount = response.unreadCount;
      }
    });
  }

  setupSocketListeners(): void {
    this.socketService.connect();
    
    this.subscriptions.push(
      this.socketService.onNotification().subscribe(() => {
        this.notificationCount++;
      })
    );

    this.subscriptions.push(
      this.messageService.notificationCount$.subscribe(count => {
        this.notificationCount = count;
      })
    );
  }

  logout(): void {
    this.socketService.disconnect();
    this.authService.logout();
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  getProfilePictureUrl(): string | null {
    if (this.currentUser?.profile_picture) {
      // If the picture is already a data URL (base64), use it directly
      if (this.currentUser.profile_picture.startsWith('data:')) {
        return this.currentUser.profile_picture;
      }
      // Legacy: old file-path-based pictures (fallback)
      return `${this.apiUrl}/${this.currentUser.profile_picture}`;
    }
    return null;
  }
}
