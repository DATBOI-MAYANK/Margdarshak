import { NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Material Imports
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTabsModule } from '@angular/material/tabs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

// Charts
import { NgChartsModule } from 'ng2-charts';

// App Imports
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';

// Components
import { NavbarComponent } from './components/navbar/navbar.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { ItineraryListComponent } from './components/itinerary-list/itinerary-list.component';
import { ItineraryDetailsComponent } from './components/itinerary-details/itinerary-details.component';
import { ItineraryCreationComponent } from './components/itinerary-creation/itinerary-creation.component';
import { ItineraryEditComponent } from './components/itinerary-edit/itinerary-edit.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { UnauthorizedComponent } from './components/unauthorized/unauthorized.component';

// Standalone Components
import { MediaUploadComponent } from './shared/components/media-upload.component';
import { PendingInvitesComponent } from './shared/components/pending-invites.component';
import { MessageCenterComponent } from './components/messages/message-center.component';
import { ContactFormDialogComponent } from './components/messages/contact-form-dialog.component';
import { MessageDetailDialogComponent } from './components/messages/message-detail-dialog.component';
import { AdminMessagesComponent } from './components/messages/admin-messages.component';
import { CollaborationChatComponent } from './components/messages/collaboration-chat.component';
import { ShareItineraryDialogComponent } from './shared/components/share-itinerary-dialog.component';
import { ProfileComponent } from './components/profile/profile.component';
import { DestinationMapComponent } from './shared/components/destination-map/destination-map.component';

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    LoginComponent,
    RegisterComponent,
    ItineraryListComponent,
    ItineraryDetailsComponent,
    ItineraryCreationComponent,
    ItineraryEditComponent,
    DashboardComponent,
    UnauthorizedComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    // Material Modules
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatListModule,
    MatDividerModule,
    MatMenuModule,
    MatTableModule,
    MatChipsModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    MatBadgeModule,
    MatTabsModule,
    MatAutocompleteModule,
    NgChartsModule,
    // Standalone Components
    MediaUploadComponent,
    PendingInvitesComponent,
    MessageCenterComponent,
    ContactFormDialogComponent,
    MessageDetailDialogComponent,
    AdminMessagesComponent,
    CollaborationChatComponent,
    ShareItineraryDialogComponent,
    ProfileComponent,
    // Map Component
    DestinationMapComponent
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (authService: AuthService) => () => authService.initAuthState(),
      deps: [AuthService],
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
