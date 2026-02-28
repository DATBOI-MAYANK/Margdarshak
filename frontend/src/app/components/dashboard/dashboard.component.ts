import { Component, OnInit } from '@angular/core';
import { ItineraryService } from '../../services/itinerary.service';
import { AuthService } from '../../services/auth.service';
import { Itinerary } from '../../models/itinerary.model';
import { User, UserStats, Collaboration, CollaborationStats, TopCollaborator, MostSharedItinerary } from '../../models/user.model';
import { CollaboratorService } from '../../core/services/collaborator.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  analytics: any = null;
  allItineraries: Itinerary[] = [];
  allUsers: User[] = [];
  userStats: UserStats | null = null;
  
  // Collaboration tracking
  collaborations: Collaboration[] = [];
  collaborationStats: CollaborationStats | null = null;
  topCollaborators: TopCollaborator[] = [];
  mostSharedItineraries: MostSharedItinerary[] = [];
  
  loading = true;
  errorMessage = '';
  currentUserId: number | undefined;

  displayedColumns: string[] = ['id', 'user', 'destination', 'dates', 'budget', 'activities'];
  userDisplayedColumns: string[] = ['user', 'email', 'role', 'status', 'created', 'actions'];
  collabDisplayedColumns: string[] = ['itinerary', 'collaborator', 'inviter', 'permission', 'status', 'date'];

  constructor(
    private itineraryService: ItineraryService,
    private authService: AuthService,
    private collaboratorService: CollaboratorService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.currentUserId = this.authService.getCurrentUser()?.id;
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;

    // Load analytics
    this.itineraryService.getAnalytics().subscribe({
      next: (response) => {
        this.analytics = response.analytics;
      },
      error: (error) => {
        this.errorMessage = 'Failed to load analytics';
      }
    });

    // Load all itineraries
    this.itineraryService.getAllItinerariesAdmin().subscribe({
      next: (response) => {
        this.allItineraries = response.itineraries;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = 'Failed to load itineraries';
        this.loading = false;
      }
    });

    // Load all users
    this.authService.getAllUsers().subscribe({
      next: (response) => {
        this.allUsers = response.users;
      },
      error: (error) => {
        console.error('Failed to load users');
      }
    });

    // Load user statistics
    this.authService.getUserStats().subscribe({
      next: (response) => {
        this.userStats = response.stats;
      },
      error: (error) => {
        console.error('Failed to load user stats');
      }
    });

    // Load collaboration data
    this.collaboratorService.getAllCollaborations().subscribe({
      next: (response) => {
        console.log('Collaboration data loaded:', response);
        this.collaborations = response.collaborations || [];
        this.collaborationStats = response.stats;
        this.topCollaborators = response.topCollaborators || [];
        this.mostSharedItineraries = response.mostShared || [];
      },
      error: (error) => {
        console.error('Failed to load collaborations:', error);
      }
    });
  }

  // User Management Methods
  toggleUserRole(user: User): void {
    if (user.id === this.currentUserId) {
      this.snackBar.open('Cannot change your own role', 'Close', { duration: 3000 });
      return;
    }

    const newRole = user.role === 'Admin' ? 'Traveler' : 'Admin';
    
    if (confirm(`Change ${user.name}'s role to ${newRole}?`)) {
      this.authService.updateUserRole(user.id!, newRole).subscribe({
        next: (response) => {
          this.snackBar.open(response.message, 'Close', { duration: 3000 });
          user.role = newRole;
          this.loadUserStats();
        },
        error: (error) => {
          this.snackBar.open(error.error?.error || 'Failed to update role', 'Close', { duration: 3000 });
        }
      });
    }
  }

  toggleUserStatus(user: User): void {
    if (user.id === this.currentUserId) {
      this.snackBar.open('Cannot change your own status', 'Close', { duration: 3000 });
      return;
    }

    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    const action = newStatus === 'suspended' ? 'suspend' : 'activate';
    
    if (confirm(`Are you sure you want to ${action} ${user.name}?`)) {
      this.authService.updateUserStatus(user.id!, newStatus).subscribe({
        next: (response) => {
          this.snackBar.open(response.message, 'Close', { duration: 3000 });
          user.status = newStatus;
          this.loadUserStats();
        },
        error: (error) => {
          this.snackBar.open(error.error?.error || 'Failed to update status', 'Close', { duration: 3000 });
        }
      });
    }
  }

  deleteUser(user: User): void {
    if (user.id === this.currentUserId) {
      this.snackBar.open('Cannot delete your own account', 'Close', { duration: 3000 });
      return;
    }

    if (confirm(`⚠️ WARNING: This will permanently delete ${user.name}'s account and all their itineraries. This action cannot be undone. Continue?`)) {
      this.authService.deleteUser(user.id!).subscribe({
        next: (response) => {
          this.snackBar.open(response.message, 'Close', { duration: 3000 });
          this.allUsers = this.allUsers.filter(u => u.id !== user.id);
          this.loadUserStats();
          this.loadDashboardData();
        },
        error: (error) => {
          this.snackBar.open(error.error?.error || 'Failed to delete user', 'Close', { duration: 3000 });
        }
      });
    }
  }

  private loadUserStats(): void {
    this.authService.getUserStats().subscribe({
      next: (response) => {
        this.userStats = response.stats;
      }
    });
  }
}
