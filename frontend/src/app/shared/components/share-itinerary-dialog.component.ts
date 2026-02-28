import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CollaborationService, Collaborator } from '../../services/collaboration.service';
import { Itinerary } from '../../models/itinerary.model';

@Component({
  selector: 'app-share-itinerary-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDividerModule,
    MatListModule,
    MatTooltipModule
  ],
  template: `
    <div class="share-dialog">
      <h2 mat-dialog-title>
        <mat-icon>share</mat-icon>
        Share Itinerary
      </h2>
      
      <mat-dialog-content>
        <div class="itinerary-info">
          <mat-icon>place</mat-icon>
          <div>
            <h3>{{ data.itinerary.destination }}</h3>
            <p>{{ data.itinerary.start_date | date:'mediumDate' }} - {{ data.itinerary.end_date | date:'mediumDate' }}</p>
          </div>
        </div>
        
        <mat-divider></mat-divider>
        
        <div class="share-form">
          <h4>
            <mat-icon>person_add</mat-icon>
            Invite People
          </h4>
          
          <form [formGroup]="shareForm" (ngSubmit)="shareItinerary()">
            <div class="form-row">
              <mat-form-field appearance="outline" class="email-field">
                <mat-label>Email Address</mat-label>
                <input matInput formControlName="email" placeholder="Enter email to invite">
                <mat-icon matPrefix>email</mat-icon>
                <mat-error *ngIf="shareForm.get('email')?.hasError('required')">Email is required</mat-error>
                <mat-error *ngIf="shareForm.get('email')?.hasError('email')">Invalid email format</mat-error>
              </mat-form-field>
              
              <mat-form-field appearance="outline" class="permission-field">
                <mat-label>Permission</mat-label>
                <mat-select formControlName="permission">
                  <mat-option value="view">
                    <mat-icon>visibility</mat-icon> View Only
                  </mat-option>
                  <mat-option value="edit">
                    <mat-icon>edit</mat-icon> Can Edit
                  </mat-option>
                </mat-select>
              </mat-form-field>
              
              <button mat-raised-button color="primary" type="submit" 
                      [disabled]="shareForm.invalid || sending">
                <mat-spinner *ngIf="sending" diameter="18"></mat-spinner>
                <mat-icon *ngIf="!sending">send</mat-icon>
                {{ sending ? 'Sending...' : 'Send Invite' }}
              </button>
            </div>
          </form>
        </div>
        
        <mat-divider></mat-divider>
        
        <div class="collaborators-section">
          <h4>
            <mat-icon>group</mat-icon>
            People with Access
          </h4>
          
          <div *ngIf="loadingCollabs" class="loading">
            <mat-spinner diameter="30"></mat-spinner>
          </div>
          
          <div *ngIf="!loadingCollabs && collaborators.length === 0" class="no-collabs">
            <mat-icon>person_off</mat-icon>
            <p>No collaborators yet. Invite someone!</p>
          </div>
          
          <mat-list *ngIf="!loadingCollabs && collaborators.length > 0">
            <mat-list-item *ngFor="let collab of collaborators" class="collab-item">
              <div class="collab-avatar" matListItemIcon>
                <mat-icon>person</mat-icon>
              </div>
              <div matListItemTitle>{{ collab.name }}</div>
              <div matListItemLine>{{ collab.email }}</div>
              <div matListItemMeta class="collab-actions">
                <mat-chip [color]="collab.role === 'edit' ? 'primary' : 'accent'" selected>
                  <mat-icon>{{ collab.role === 'edit' ? 'edit' : 'visibility' }}</mat-icon>
                  {{ collab.role === 'edit' ? 'Can Edit' : 'View Only' }}
                </mat-chip>
                <button mat-icon-button color="warn" (click)="removeCollaborator(collab)" 
                        matTooltip="Remove access">
                  <mat-icon>person_remove</mat-icon>
                </button>
              </div>
            </mat-list-item>
          </mat-list>
        </div>
        
        <mat-divider></mat-divider>
        
        <div class="share-link-section">
          <h4>
            <mat-icon>link</mat-icon>
            Copy Share Link
          </h4>
          <div class="link-row">
            <input readonly [value]="shareLink" class="share-link-input">
            <button mat-raised-button color="accent" (click)="copyLink()">
              <mat-icon>content_copy</mat-icon>
              Copy
            </button>
          </div>
          
          <h4>
            <mat-icon>share</mat-icon>
            Share via
          </h4>
          <div class="social-share-buttons">
            <button mat-fab class="whatsapp-btn" (click)="shareViaWhatsApp()" matTooltip="Share on WhatsApp">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </button>
            <button mat-fab class="telegram-btn" (click)="shareViaTelegram()" matTooltip="Share on Telegram">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </button>
            <button mat-fab class="facebook-btn" (click)="shareViaFacebook()" matTooltip="Share on Facebook">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </button>
            <button mat-fab class="twitter-btn" (click)="shareViaTwitter()" matTooltip="Share on X (Twitter)">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </button>
            <button mat-fab class="email-btn" (click)="shareViaEmail()" matTooltip="Share via Email">
              <mat-icon>email</mat-icon>
            </button>
          </div>
        </div>
      </mat-dialog-content>
      
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .share-dialog {
      min-width: 500px;
      max-width: 600px;
      
      @media (max-width: 600px) {
        min-width: auto;
      }
      
      & h2 {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #1e3c72;
        margin: 0;
        
        & mat-icon {
          color: #667eea;
        }
      }
    }
    
    mat-dialog-content {
      padding: 16px 24px !important;
    }
    
    .itinerary-info {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
      border-radius: 12px;
      margin-bottom: 20px;
      
      > mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: #667eea;
      }
      
      & h3 {
        margin: 0;
        font-size: 1.2rem;
        color: #1e3c72;
        text-transform: capitalize;
      }
      
      & p {
        margin: 4px 0 0;
        color: #666;
        font-size: 0.9rem;
      }
    }
    
    mat-divider {
      margin: 16px 0;
    }
    
    & h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1rem;
      color: #333;
      margin: 16px 0 12px;
      
      & mat-icon {
        color: #667eea;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }
    
    .form-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
      
      .email-field {
        flex: 1;
        min-width: 200px;
      }
      
      .permission-field {
        width: 140px;
      }
      
      & button {
        height: 56px;
        white-space: nowrap;
      }
    }
    
    .loading, .no-collabs {
      text-align: center;
      padding: 20px;
      color: #888;
      
      & mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: #ccc;
      }
      
      & p {
        margin: 8px 0 0;
      }
    }
    
    .collab-item {
      background: rgba(102, 126, 234, 0.05);
      border-radius: 10px;
      margin-bottom: 8px;
      
      .collab-avatar {
        background: linear-gradient(135deg, #667eea, #764ba2);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        
        & mat-icon {
          color: white;
        }
      }
      
      .collab-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
    
    .share-link-section {
      .link-row {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        
        .share-link-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #f8f9fa;
          font-size: 0.9rem;
          color: #666;
        }
        
        & button {
          white-space: nowrap;
        }
      }
      
      .social-share-buttons {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: center;
        padding: 8px 0;
        
        & button {
          width: 48px;
          height: 48px;
          min-width: 48px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        }
        
        .whatsapp-btn {
          background: #25D366;
          color: white;
        }
        
        .telegram-btn {
          background: #0088cc;
          color: white;
        }
        
        .facebook-btn {
          background: #1877F2;
          color: white;
        }
        
        .twitter-btn {
          background: #000;
          color: white;
        }
        
        .email-btn {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }
      }
    }
    
    mat-dialog-actions {
      padding: 16px 24px !important;
    }
  `]
})
export class ShareItineraryDialogComponent {
  shareForm: FormGroup;
  collaborators: Collaborator[] = [];
  loadingCollabs = false;
  sending = false;
  shareLink: string;

  constructor(
    public dialogRef: MatDialogRef<ShareItineraryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { itinerary: Itinerary },
    private fb: FormBuilder,
    private collaborationService: CollaborationService,
    private snackBar: MatSnackBar
  ) {
    this.shareForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      permission: ['view']
    });
    
    this.shareLink = `${window.location.origin}/itineraries/${data.itinerary.id}`;
    this.loadCollaborators();
  }

  loadCollaborators(): void {
    if (!this.data.itinerary.id) return;
    
    this.loadingCollabs = true;
    this.collaborationService.getCollaborators(this.data.itinerary.id).subscribe({
      next: (response) => {
        this.collaborators = response.collaborators || [];
        this.loadingCollabs = false;
      },
      error: () => {
        this.loadingCollabs = false;
      }
    });
  }

  shareItinerary(): void {
    if (this.shareForm.invalid || !this.data.itinerary.id) return;

    this.sending = true;
    const { email, permission } = this.shareForm.value;

    this.collaborationService.addCollaborator(this.data.itinerary.id, email, permission).subscribe({
      next: () => {
        this.snackBar.open('Invitation sent successfully!', 'Close', { duration: 3000 });
        this.shareForm.reset({ permission: 'view' });
        this.sending = false;
        this.loadCollaborators();
      },
      error: (error) => {
        this.snackBar.open(error.error?.error || 'Failed to send invitation', 'Close', { duration: 3000 });
        this.sending = false;
      }
    });
  }

  removeCollaborator(collab: Collaborator): void {
    if (!this.data.itinerary.id || !confirm(`Remove ${collab.name} from this itinerary?`)) return;

    this.collaborationService.removeCollaborator(this.data.itinerary.id, collab.id).subscribe({
      next: () => {
        this.snackBar.open('Collaborator removed', 'Close', { duration: 3000 });
        this.loadCollaborators();
      },
      error: (error) => {
        this.snackBar.open(error.error?.error || 'Failed to remove collaborator', 'Close', { duration: 3000 });
      }
    });
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.shareLink).then(() => {
      this.snackBar.open('Link copied to clipboard!', 'Close', { duration: 2000 });
    });
  }

  private getShareText(): string {
    const dest = this.data.itinerary.destination || 'my trip';
    const startDate = new Date(this.data.itinerary.start_date).toLocaleDateString();
    const endDate = new Date(this.data.itinerary.end_date).toLocaleDateString();
    return `🌍 Check out my travel itinerary to ${dest}! (${startDate} - ${endDate})`;
  }

  shareViaWhatsApp(): void {
    const text = encodeURIComponent(`${this.getShareText()}\n\n${this.shareLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  shareViaTelegram(): void {
    const text = encodeURIComponent(this.getShareText());
    const url = encodeURIComponent(this.shareLink);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  }

  shareViaFacebook(): void {
    const url = encodeURIComponent(this.shareLink);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  }

  shareViaTwitter(): void {
    const text = encodeURIComponent(this.getShareText());
    const url = encodeURIComponent(this.shareLink);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  }

  shareViaEmail(): void {
    const subject = encodeURIComponent(`Travel Itinerary: ${this.data.itinerary.destination}`);
    const body = encodeURIComponent(`${this.getShareText()}\n\nView the full itinerary here: ${this.shareLink}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }
}
