import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';
import { ItineraryService } from '../../services/itinerary.service';
import { Itinerary } from '../../models/itinerary.model';
import { SocketService, EditingUser, FieldChange, FieldLock, ActivityChange } from '../../core/services/socket.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { CollaboratorDialogComponent } from '../../shared/components/collaborator-dialog.component';
import { CollaborationService } from '../../services/collaboration.service';

@Component({
  selector: 'app-itinerary-edit',
  templateUrl: './itinerary-edit.component.html',
  styleUrls: ['./itinerary-edit.component.scss']
})
export class ItineraryEditComponent implements OnInit, OnDestroy {
  itineraryForm!: FormGroup;
  itineraryId!: number;
  loading = true;
  saving = false;
  errorMessage = '';
  minDate = new Date();
  uploadedMedia: Array<{ filename: string; path: string }> = [];
  hasCollaborators = false;

  // Real-time collaboration
  activeEditors: EditingUser[] = [];
  lockedFields: Map<string, { userId: number; userName: string }> = new Map();
  isConnected = false;
  private destroy$ = new Subject<void>();
  private isApplyingRemoteChange = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private itineraryService: ItineraryService,
    private socketService: SocketService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private collaborationService: CollaborationService
  ) {}

  ngOnInit(): void {
    this.itineraryId = this.route.snapshot.params['id'];
    this.initializeForm();
    this.loadItinerary();
    this.setupRealTimeSync();
    this.checkCollaborators();
  }

  private checkCollaborators(): void {
    this.collaborationService.getCollaborators(this.itineraryId).subscribe({
      next: (response) => {
        this.hasCollaborators = response.collaborators && response.collaborators.length > 0;
      },
      error: () => {
        this.hasCollaborators = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.socketService.leaveRoom(this.itineraryId);
    this.socketService.disconnect();
  }

  private setupRealTimeSync(): void {
    // Connect and join room
    this.socketService.connect();
    this.socketService.joinRoom(this.itineraryId);

    // Track connection status
    this.socketService.connected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.isConnected = connected;
      });

    // Track active editors
    this.socketService.editors$
      .pipe(takeUntil(this.destroy$))
      .subscribe(editors => {
        this.activeEditors = editors;
      });

    // Handle user joined
    this.socketService.userJoined$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.snackBar.open(`${user.name} joined editing`, 'OK', { duration: 3000 });
      });

    // Handle user left
    this.socketService.userLeft$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.snackBar.open(`${user.name} left editing`, 'OK', { duration: 3000 });
        // Clear their locks
        this.lockedFields.forEach((lock, field) => {
          if (lock.userId === user.userId) {
            this.lockedFields.delete(field);
          }
        });
      });

    // Handle field updates from others
    this.socketService.fieldUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(change => {
        this.applyRemoteFieldChange(change);
      });

    // Handle field locks
    this.socketService.fieldLock$
      .pipe(takeUntil(this.destroy$))
      .subscribe(lock => {
        this.lockedFields.set(lock.field, { userId: lock.userId, userName: lock.userName });
      });

    // Handle field unlocks
    this.socketService.fieldUnlock$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.lockedFields.delete(data.field);
      });

    // Handle activity updates
    this.socketService.activityUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(change => {
        this.applyRemoteActivityChange(change);
      });
  }

  private applyRemoteFieldChange(change: FieldChange): void {
    this.isApplyingRemoteChange = true;
    
    if (change.field.startsWith('activities.')) {
      // Handle activity field change
      const parts = change.field.split('.');
      const activityIndex = parseInt(parts[1]);
      const fieldName = parts[2];
      const activityGroup = this.activities.at(activityIndex);
      if (activityGroup) {
        activityGroup.get(fieldName)?.setValue(change.value, { emitEvent: false });
      }
    } else {
      // Handle main form field change
      this.itineraryForm.get(change.field)?.setValue(change.value, { emitEvent: false });
    }
    
    this.isApplyingRemoteChange = false;
  }

  private applyRemoteActivityChange(change: ActivityChange): void {
    this.isApplyingRemoteChange = true;
    
    switch (change.action) {
      case 'add':
        this.addActivity(change.activity);
        break;
      case 'delete':
        if (change.index !== undefined) {
          this.activities.removeAt(change.index);
        }
        break;
      case 'update':
        if (change.index !== undefined && change.activity) {
          const activityGroup = this.activities.at(change.index);
          if (activityGroup) {
            activityGroup.patchValue(change.activity, { emitEvent: false });
          }
        }
        break;
    }
    
    this.isApplyingRemoteChange = false;
    this.snackBar.open(`${change.userName} ${change.action}ed an activity`, 'OK', { duration: 2000 });
  }

  // Field focus handler for real-time
  onFieldFocus(fieldName: string): void {
    this.socketService.emitFieldFocus(this.itineraryId, fieldName);
  }

  // Field blur handler for real-time
  onFieldBlur(fieldName: string): void {
    this.socketService.emitFieldBlur(this.itineraryId, fieldName);
  }

  // Emit field change for real-time sync
  onFieldChange(fieldName: string, value: any): void {
    if (!this.isApplyingRemoteChange) {
      this.socketService.emitFieldChange(this.itineraryId, fieldName, value);
    }
  }

  // Check if field is locked by another user
  isFieldLocked(fieldName: string): boolean {
    return this.lockedFields.has(fieldName);
  }

  // Get who locked the field
  getFieldLocker(fieldName: string): string | null {
    const lock = this.lockedFields.get(fieldName);
    return lock ? lock.userName : null;
  }

  initializeForm(): void {
    this.itineraryForm = this.fb.group({
      destination: ['', [Validators.required]],
      start_date: ['', [Validators.required]],
      end_date: ['', [Validators.required]],
      budget: [0, [Validators.required, Validators.min(0.01)]],
      notes: [''],
      media_paths: [''],
      activities: this.fb.array([])
    });
  }

  loadItinerary(): void {
    this.itineraryService.getItineraryById(this.itineraryId).subscribe({
      next: (response) => {
        const itinerary = response.itinerary;
        this.itineraryForm.patchValue({
          destination: itinerary.destination,
          start_date: itinerary.start_date,
          end_date: itinerary.end_date,
          budget: itinerary.budget,
          notes: itinerary.notes || '',
          media_paths: itinerary.media_paths || ''
        });

        // Load existing media
        if (itinerary.media_paths) {
          const mediaPathsValue = itinerary.media_paths as unknown;
          if (typeof mediaPathsValue === 'string') {
            const paths = (mediaPathsValue as string).split(',').filter((p: string) => p.trim());
            this.uploadedMedia = paths.map((path: string) => ({
              filename: path.split('/').pop() || path,
              path: path.trim()
            }));
          } else if (Array.isArray(mediaPathsValue)) {
            this.uploadedMedia = (mediaPathsValue as string[]).map((path: string) => ({
              filename: path.split('/').pop() || path,
              path: path.trim()
            }));
          }
        }

        if (itinerary.activities) {
          itinerary.activities.forEach(activity => {
            this.addActivity(activity);
          });
        }

        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = 'Failed to load itinerary';
        this.loading = false;
      }
    });
  }

  get activities(): FormArray {
    return this.itineraryForm.get('activities') as FormArray;
  }

  addActivity(activity?: any): void {
    const activityGroup = this.fb.group({
      name: [activity?.name || '', Validators.required],
      time: [activity?.time || '', Validators.required],
      duration: [activity?.duration || '', Validators.required],
      estimatedCost: [activity?.estimatedCost || 0, Validators.min(0)],
      location: [activity?.location || '']
    });
    this.activities.push(activityGroup);
    
    // Emit to other editors if not applying remote change
    if (!this.isApplyingRemoteChange) {
      this.socketService.emitActivityChange(this.itineraryId, 'add', this.activities.length - 1, activity);
    }
  }

  removeActivity(index: number): void {
    this.activities.removeAt(index);
    
    // Emit to other editors if not applying remote change
    if (!this.isApplyingRemoteChange) {
      this.socketService.emitActivityChange(this.itineraryId, 'delete', index);
    }
  }

  onSubmit(): void {
    if (this.itineraryForm.invalid) {
      return;
    }

    const startDate = new Date(this.itineraryForm.value.start_date);
    const endDate = new Date(this.itineraryForm.value.end_date);
    
    if (endDate < startDate) {
      this.errorMessage = 'End date must be after start date';
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    const formData = {
      ...this.itineraryForm.value,
      start_date: typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0],
      end_date: typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0]
    };

    this.itineraryService.updateItinerary(this.itineraryId, formData).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/itineraries', this.itineraryId]);
      },
      error: (error) => {
        this.saving = false;
        this.errorMessage = error.error?.error || 'Failed to update itinerary';
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/itineraries', this.itineraryId]);
  }

  openCollaboratorDialog(): void {
    this.dialog.open(CollaboratorDialogComponent, {
      width: '550px',
      data: { itineraryId: this.itineraryId }
    });
  }

  onMediaUploaded(files: Array<{ filename: string; path: string }>): void {
    this.uploadedMedia = files;
    this.updateMediaPaths();
  }

  onMediaRemoved(event: { index: number; file: { filename: string; path: string } }): void {
    this.updateMediaPaths();
  }

  private updateMediaPaths(): void {
    const paths = this.uploadedMedia.map(f => f.path).join(',');
    this.itineraryForm.patchValue({ media_paths: paths });
  }
}
