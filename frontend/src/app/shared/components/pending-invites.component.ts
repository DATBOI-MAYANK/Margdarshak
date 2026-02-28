import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, interval } from 'rxjs';
import { CollaboratorService, PendingInvite } from '../../core/services/collaborator.service';

@Component({
  selector: 'app-pending-invites',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatMenuModule,
    MatDividerModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  template: `
    <button mat-icon-button 
            [matMenuTriggerFor]="inviteMenu"
            [matBadge]="pendingInvites.length" 
            [matBadgeHidden]="pendingInvites.length === 0"
            matBadgeColor="warn"
            matBadgeSize="small"
            matTooltip="Collaboration Invites"
            class="invite-button">
      <mat-icon>notifications</mat-icon>
    </button>

    <mat-menu #inviteMenu="matMenu" class="invite-menu">
      <div class="invite-header">
        <mat-icon>group_add</mat-icon>
        <span>Collaboration Invites</span>
      </div>
      <mat-divider></mat-divider>
      
      <div *ngIf="pendingInvites.length === 0" class="no-invites">
        <mat-icon>check_circle</mat-icon>
        <p>No pending invitations</p>
      </div>

      <div *ngFor="let invite of pendingInvites" class="invite-item">
        <div class="invite-info">
          <div class="invite-title">{{ invite.itinerary_title || invite.destination }}</div>
          <div class="invite-details">
            <span class="inviter">From: {{ invite.inviter_name || invite.inviter_email }}</span>
            <span class="destination">📍 {{ invite.destination }}</span>
            <span class="dates">📅 {{ invite.start_date | date:'MMM d' }} - {{ invite.end_date | date:'MMM d' }}</span>
            <span class="permission" [class.edit]="invite.permission === 'edit'">
              {{ invite.permission === 'edit' ? '✏️ Can Edit' : '👁️ View Only' }}
            </span>
          </div>
        </div>
        <div class="invite-actions">
          <button mat-icon-button color="primary" (click)="acceptInvite(invite, $event)" matTooltip="Accept">
            <mat-icon>check</mat-icon>
          </button>
          <button mat-icon-button color="warn" (click)="rejectInvite(invite, $event)" matTooltip="Reject">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <mat-divider *ngIf="pendingInvites.length > 0"></mat-divider>
      <button mat-menu-item *ngIf="pendingInvites.length > 0" routerLink="/itineraries" class="view-all">
        <mat-icon>list</mat-icon>
        <span>View My Itineraries</span>
      </button>
    </mat-menu>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
    }
    
    .invite-button {
      color: rgba(255, 255, 255, 0.9) !important;
      width: 40px !important;
      height: 40px !important;
      line-height: 40px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: all 0.3s ease !important;
    }
    
    .invite-button:hover {
      background: rgba(255, 255, 255, 0.15) !important;
      transform: scale(1.05);
    }

    .invite-button mat-icon {
      color: rgba(255, 255, 255, 0.9);
      font-size: 24px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    :host ::ng-deep .invite-menu {
      min-width: 340px;
      max-width: 400px;
    }

    .invite-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      font-weight: 600;
      font-size: 16px;
      color: #1a237e;
      background: linear-gradient(135deg, #f5f7fa 0%, #e8eaf6 100%);
    }

    .invite-header mat-icon {
      color: #5c6bc0;
    }

    .no-invites {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      color: #9e9e9e;
    }

    .no-invites mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
      color: #c8e6c9;
    }

    .invite-item {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #f0f0f0;
      transition: background 0.2s;
    }

    .invite-item:hover {
      background: #fafafa;
    }

    .invite-info {
      flex: 1;
      min-width: 0;
    }

    .invite-title {
      font-weight: 600;
      color: #333;
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .invite-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: #666;
    }

    .invite-details .inviter {
      color: #5c6bc0;
      font-weight: 500;
    }

    .invite-details .permission {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      background: #f5f5f5;
      font-size: 11px;
    }

    .invite-details .permission.edit {
      background: #e3f2fd;
      color: #1976d2;
    }

    .invite-actions {
      display: flex;
      gap: 4px;
      margin-left: 8px;
    }

    .invite-actions button {
      width: 32px;
      height: 32px;
    }

    .invite-actions button mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .view-all {
      color: #5c6bc0 !important;
      font-weight: 500;
    }
  `]
})
export class PendingInvitesComponent implements OnInit, OnDestroy {
  pendingInvites: PendingInvite[] = [];
  private subscription = new Subscription();

  constructor(
    private collaboratorService: CollaboratorService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPendingInvites();
    
    // Refresh every 30 seconds
    this.subscription.add(
      interval(30000).subscribe(() => this.loadPendingInvites())
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadPendingInvites(): void {
    this.collaboratorService.getPendingInvites().subscribe({
      next: (response) => {
        this.pendingInvites = response.invites;
      },
      error: (err) => {
        console.error('Failed to load pending invites:', err);
      }
    });
  }

  acceptInvite(invite: PendingInvite, event: Event): void {
    event.stopPropagation();
    this.collaboratorService.acceptInvite(invite.id).subscribe({
      next: () => {
        this.snackBar.open(`You can now access "${invite.itinerary_title || invite.destination}"!`, 'View', {
          duration: 5000
        }).onAction().subscribe(() => {
          window.location.href = `/itinerary/${invite.itinerary_id}`;
        });
        this.loadPendingInvites();
      },
      error: (err) => {
        this.snackBar.open('Failed to accept invite', 'Close', { duration: 3000 });
      }
    });
  }

  rejectInvite(invite: PendingInvite, event: Event): void {
    event.stopPropagation();
    this.collaboratorService.rejectInvite(invite.id).subscribe({
      next: () => {
        this.snackBar.open('Invite declined', 'OK', { duration: 3000 });
        this.loadPendingInvites();
      },
      error: (err) => {
        this.snackBar.open('Failed to decline invite', 'Close', { duration: 3000 });
      }
    });
  }
}
