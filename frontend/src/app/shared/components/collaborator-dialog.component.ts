import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CollaboratorService, Collaborator, OwnerInfo } from '../../core/services/collaborator.service';

@Component({
  selector: 'app-collaborator-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>group_add</mat-icon>
      Manage Collaborators
    </h2>

    <mat-dialog-content>
      <!-- Owner Info (shown to collaborators) -->
      <div *ngIf="!isOwner && owner" class="owner-section">
        <h3>
          <mat-icon>admin_panel_settings</mat-icon>
          Itinerary Owner
        </h3>
        <div class="owner-info">
          <div class="owner-avatar">{{ getInitials(owner.name) }}</div>
          <div class="owner-details">
            <div class="owner-name">{{ owner.name }}</div>
            <div class="owner-email">{{ owner.email }}</div>
          </div>
          <mat-chip class="owner-chip">
            <mat-icon>star</mat-icon> Owner
          </mat-chip>
        </div>
      </div>

      <!-- Invite Form (only for owner) -->
      <form *ngIf="isOwner" [formGroup]="inviteForm" (ngSubmit)="inviteCollaborator()" class="invite-form">
        <mat-form-field appearance="outline" class="email-field">
          <mat-label>Email Address</mat-label>
          <input matInput formControlName="email" placeholder="traveler@example.com" type="email">
          <mat-icon matPrefix>email</mat-icon>
          <mat-error *ngIf="inviteForm.get('email')?.hasError('required')">Email is required</mat-error>
          <mat-error *ngIf="inviteForm.get('email')?.hasError('email')">Invalid email format</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="permission-field">
          <mat-label>Permission</mat-label>
          <mat-select formControlName="permission">
            <mat-option value="edit">
              <mat-icon>edit</mat-icon> Can Edit
            </mat-option>
            <mat-option value="view">
              <mat-icon>visibility</mat-icon> View Only
            </mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-raised-button color="primary" type="submit" [disabled]="inviteForm.invalid || inviting">
          <mat-icon>{{ inviting ? 'hourglass_empty' : 'person_add' }}</mat-icon>
          {{ inviting ? 'Inviting...' : 'Invite' }}
        </button>
      </form>

      <!-- Collaborators List -->
      <div class="collaborators-section">
        <h3>
          <mat-icon>people</mat-icon>
          {{ isOwner ? 'Current Collaborators' : 'Other Collaborators' }}
          <span class="count-badge">{{ displayCollaborators.length }}</span>
        </h3>

        <div *ngIf="loading" class="loading">
          <mat-spinner diameter="30"></mat-spinner>
        </div>

        <div *ngIf="!loading && displayCollaborators.length === 0" class="empty-state">
          <mat-icon>person_off</mat-icon>
          <p *ngIf="isOwner">No collaborators yet. Invite someone to start co-editing!</p>
          <p *ngIf="!isOwner">No other collaborators on this itinerary.</p>
        </div>

        <mat-list *ngIf="!loading && displayCollaborators.length > 0">
          <mat-list-item *ngFor="let collab of displayCollaborators" class="collaborator-item" 
                         [class.pending]="collab.status === 'pending'"
                         [class.is-you]="collab.user_id === currentUserId">
            <div class="collab-avatar" matListItemIcon [class.pending-avatar]="collab.status === 'pending'">
              {{ getInitials(collab.name) }}
            </div>
            <div matListItemTitle class="collab-name">
              {{ collab.name }}
              <span *ngIf="collab.user_id === currentUserId" class="you-badge">You</span>
              <span *ngIf="collab.status === 'pending'" class="pending-badge">⏳ Pending</span>
            </div>
            <div matListItemLine class="collab-email">{{ collab.email }}</div>
            <div matListItemMeta class="collab-actions">
              <mat-chip *ngIf="collab.status === 'accepted'" [class.view-chip]="collab.permission === 'view'" [class.edit-chip]="collab.permission === 'edit'">
                <mat-icon>{{ collab.permission === 'edit' ? 'edit' : 'visibility' }}</mat-icon>
                {{ collab.permission === 'edit' ? 'Editor' : 'Viewer' }}
              </mat-chip>
              <mat-chip *ngIf="collab.status === 'pending'" class="pending-chip">
                <mat-icon>hourglass_empty</mat-icon>
                Waiting
              </mat-chip>
              <button mat-icon-button color="warn" 
                      *ngIf="isOwner && collab.user_id !== currentUserId"
                      (click)="removeCollaborator(collab)"
                      [matTooltip]="collab.status === 'pending' ? 'Cancel invite' : 'Remove collaborator'">
                <mat-icon>{{ collab.status === 'pending' ? 'cancel' : 'person_remove' }}</mat-icon>
              </button>
            </div>
          </mat-list-item>
        </mat-list>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
    }

    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
      padding: 16px 24px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border-radius: 4px 4px 0 0;
      margin: -24px -24px 24px -24px;

      & mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
    }

    mat-dialog-content {
      min-width: 450px;
      max-height: 60vh;
    }

    /* Owner Section */
    .owner-section {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;

      & h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 12px 0;
        font-size: 16px;
        color: #333;

        & mat-icon {
          color: #ff9800;
        }
      }
    }

    .owner-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: linear-gradient(135deg, #fff8e1, #ffecb3);
      border-radius: 8px;
      border: 1px solid #ffcc80;
    }

    .owner-avatar {
      width: 45px;
      height: 45px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ff9800, #f57c00);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 16px;
    }

    .owner-details {
      flex: 1;
    }

    .owner-name {
      font-weight: 600;
      color: #333;
    }

    .owner-email {
      font-size: 13px;
      color: #666;
    }

    .owner-chip {
      background: linear-gradient(135deg, #ff9800, #f57c00) !important;
      color: white !important;
      
      & mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        margin-right: 4px;
      }
    }

    .invite-form {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #eee;

      .email-field {
        flex: 1;
      }

      .permission-field {
        width: 140px;
      }

      & button {
        margin-top: 4px;
        height: 56px;
      }
    }

    .collaborators-section {
      & h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 16px 0;
        font-size: 16px;
        color: #333;

        & mat-icon {
          color: #667eea;
        }

        .count-badge {
          background: #667eea;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }
      }
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 20px;
    }

    .empty-state {
      text-align: center;
      padding: 30px;
      color: #888;

      & mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 10px;
      }

      & p {
        margin: 0;
      }
    }

    .collaborator-item {
      margin-bottom: 8px;
      background: #f9f9f9;
      border-radius: 8px;

      .collab-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 14px;
      }

      .collab-name {
        font-weight: 500;
      }

      .collab-email {
        color: #888;
        font-size: 13px;
      }

      .collab-actions {
        display: flex;
        align-items: center;
        gap: 8px;

        & mat-chip {
          font-size: 12px;

          & mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
            margin-right: 4px;
          }

          &.edit-chip {
            background: #e3f2fd;
            color: #1976d2;
          }

          &.view-chip {
            background: #f3e5f5;
            color: #7b1fa2;
          }

          &.pending-chip {
            background: #fff3e0;
            color: #f57c00;
          }
        }
      }

      &.pending {
        background: #fffde7;
        border: 1px dashed #ffc107;
      }

      &.is-you {
        background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
        border: 1px solid #4caf50;
      }

      .pending-avatar {
        background: linear-gradient(135deg, #ffa726, #ff9800) !important;
      }

      .pending-badge {
        font-size: 11px;
        color: #f57c00;
        margin-left: 8px;
        font-weight: 400;
      }

      .you-badge {
        font-size: 11px;
        background: #4caf50;
        color: white;
        padding: 2px 8px;
        border-radius: 10px;
        margin-left: 8px;
        font-weight: 500;
      }
    }

    mat-dialog-actions {
      padding: 16px 24px;
      margin: 0 -24px -24px -24px;
      background: #f5f5f5;
    }
  `]
})
export class CollaboratorDialogComponent implements OnInit {
  inviteForm: FormGroup;
  collaborators: Collaborator[] = [];
  owner: OwnerInfo | null = null;
  isOwner = true;
  currentUserId = 0;
  loading = true;
  inviting = false;

  constructor(
    private fb: FormBuilder,
    private collaboratorService: CollaboratorService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<CollaboratorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { itineraryId: number }
  ) {
    this.inviteForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      permission: ['edit']
    });
  }

  ngOnInit(): void {
    this.loadCollaborators();
  }

  // Get collaborators to display (exclude current user if they're a collaborator viewing)
  get displayCollaborators(): Collaborator[] {
    return this.collaborators;
  }

  loadCollaborators(): void {
    this.loading = true;
    this.collaboratorService.getCollaborators(this.data.itineraryId).subscribe({
      next: (response) => {
        this.collaborators = response.collaborators;
        this.owner = response.owner;
        this.isOwner = response.isOwner;
        this.currentUserId = response.currentUserId;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading collaborators:', error);
        this.loading = false;
      }
    });
  }

  inviteCollaborator(): void {
    if (this.inviteForm.invalid) return;

    this.inviting = true;
    const { email, permission } = this.inviteForm.value;

    this.collaboratorService.inviteCollaborator(this.data.itineraryId, email, permission).subscribe({
      next: (response) => {
        this.snackBar.open('Collaborator invited successfully!', 'OK', { duration: 3000 });
        this.inviteForm.reset({ email: '', permission: 'edit' });
        this.loadCollaborators();
        this.inviting = false;
      },
      error: (error) => {
        this.snackBar.open(error.error?.error || 'Failed to invite collaborator', 'OK', { duration: 4000 });
        this.inviting = false;
      }
    });
  }

  removeCollaborator(collab: Collaborator): void {
    const message = collab.status === 'pending' 
      ? `Cancel invitation to ${collab.name || collab.email}?`
      : `Remove ${collab.name} from collaborators?`;
    if (!confirm(message)) return;

    this.collaboratorService.removeCollaborator(this.data.itineraryId, collab.id).subscribe({
      next: () => {
        this.snackBar.open('Collaborator removed', 'OK', { duration: 3000 });
        this.loadCollaborators();
      },
      error: (error) => {
        this.snackBar.open(error.error?.error || 'Failed to remove collaborator', 'OK', { duration: 4000 });
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.length > 1 
      ? `${parts[0]?.charAt(0) || ''}${parts[1]?.charAt(0) || ''}`.toUpperCase()
      : `${parts[0]?.charAt(0) || ''}`.toUpperCase();
  }
}
