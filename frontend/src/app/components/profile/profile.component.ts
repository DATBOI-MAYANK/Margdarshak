import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule, MatTabGroup } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { getApiBase } from '../../core/services/runtime-config';
import { ImageCropDialogComponent } from './image-crop-dialog/image-crop-dialog.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTabsModule,
    MatTooltipModule,
    MatDialogModule,
    MatMenuModule
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  @ViewChild('tabGroup') tabGroup!: MatTabGroup;
  
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  currentUser: User | null = null;
  loading = false;
  profileLoading = false;
  passwordLoading = false;
  uploadingPicture = false;
  removingPicture = false;
  hideCurrentPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;
  selectedTabIndex = 0;
  apiUrl = getApiBase();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.loadProfile();
    
    // Handle tab query parameter
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'password') {
        this.selectedTabIndex = 1;
      } else if (params['tab'] === 'account') {
        this.selectedTabIndex = 2;
      } else {
        this.selectedTabIndex = 0;
      }
    });
  }

  initForms(): void {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      contact_info: ['']
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    
    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  loadProfile(): void {
    this.loading = true;
    this.authService.getProfile().subscribe({
      next: (response) => {
        this.currentUser = response.user;
        this.profileForm.patchValue({
          name: response.user.name,
          email: response.user.email,
          contact_info: response.user.contact_info || ''
        });
        this.loading = false;
      },
      error: (error) => {
        this.snackBar.open('Failed to load profile', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  updateProfile(): void {
    if (this.profileForm.invalid) return;

    this.profileLoading = true;
    const { name, email, contact_info } = this.profileForm.value;

    this.authService.updateProfile({ name, email, contact_info }).subscribe({
      next: (response) => {
        this.snackBar.open('Profile updated successfully!', 'Close', { duration: 3000 });
        this.profileLoading = false;
        // Update local storage
        const user = this.authService.getCurrentUser();
        if (user) {
          user.name = name;
          user.email = email;
          user.contact_info = contact_info;
          localStorage.setItem('user', JSON.stringify(user));
        }
      },
      error: (error) => {
        this.snackBar.open(error.error?.error || 'Failed to update profile', 'Close', { duration: 3000 });
        this.profileLoading = false;
      }
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) return;

    this.passwordLoading = true;
    const { currentPassword, newPassword } = this.passwordForm.value;

    this.authService.changePassword({ currentPassword, newPassword }).subscribe({
      next: (response) => {
        this.snackBar.open('Password changed successfully!', 'Close', { duration: 3000 });
        this.passwordForm.reset();
        this.passwordLoading = false;
      },
      error: (error) => {
        this.snackBar.open(error.error?.error || 'Failed to change password', 'Close', { duration: 3000 });
        this.passwordLoading = false;
      }
    });
  }

  getErrorMessage(field: string, form: FormGroup): string {
    const control = form.get(field);
    if (!control) return '';
    
    if (control.hasError('required')) return `${field} is required`;
    if (control.hasError('email')) return 'Invalid email format';
    if (control.hasError('minlength')) {
      const minLength = control.errors?.['minlength'].requiredLength;
      return `Minimum ${minLength} characters required`;
    }
    if (control.hasError('passwordMismatch')) return 'Passwords do not match';
    
    return '';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.snackBar.open('Please select an image file', 'Close', { duration: 3000 });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.snackBar.open('File size must be less than 5MB', 'Close', { duration: 3000 });
        return;
      }
      
      // Open crop dialog
      this.openCropDialog(file);
    }
    
    // Reset input so same file can be selected again
    input.value = '';
  }

  openCropDialog(file: File): void {
    const dialogRef = this.dialog.open(ImageCropDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      data: { imageFile: file },
      panelClass: 'crop-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.uploadCroppedImage(result.file);
      }
    });
  }

  uploadCroppedImage(file: File): void {
    this.uploadingPicture = true;
    this.authService.uploadProfilePicture(file).subscribe({
      next: (response) => {
        this.snackBar.open('Profile picture updated successfully!', 'Close', { duration: 3000 });
        this.uploadingPicture = false;
        
        // Update current user - the auth service already updates localStorage and BehaviorSubject
        if (this.currentUser) {
          this.currentUser.profile_picture = response.profile_picture;
        }
      },
      error: (error) => {
        this.snackBar.open(error.error?.error || 'Failed to upload profile picture', 'Close', { duration: 3000 });
        this.uploadingPicture = false;
      }
    });
  }

  removeProfilePicture(): void {
    if (!this.currentUser?.profile_picture) return;
    
    this.removingPicture = true;
    this.authService.removeProfilePicture().subscribe({
      next: () => {
        this.snackBar.open('Profile picture removed', 'Close', { duration: 3000 });
        this.removingPicture = false;
        
        // Update current user - the auth service already updates localStorage and BehaviorSubject
        if (this.currentUser) {
          this.currentUser.profile_picture = undefined;
        }
      },
      error: (error) => {
        this.snackBar.open(error.error?.error || 'Failed to remove profile picture', 'Close', { duration: 3000 });
        this.removingPicture = false;
      }
    });
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
