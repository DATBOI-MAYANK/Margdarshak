import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { ItineraryListComponent } from './components/itinerary-list/itinerary-list.component';
import { ItineraryDetailsComponent } from './components/itinerary-details/itinerary-details.component';
import { ItineraryCreationComponent } from './components/itinerary-creation/itinerary-creation.component';
import { ItineraryEditComponent } from './components/itinerary-edit/itinerary-edit.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { UnauthorizedComponent } from './components/unauthorized/unauthorized.component';
import { MessageCenterComponent } from './components/messages/message-center.component';
import { AdminMessagesComponent } from './components/messages/admin-messages.component';
import { ProfileComponent } from './components/profile/profile.component';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';

const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { 
    path: 'profile', 
    component: ProfileComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'itineraries', 
    component: ItineraryListComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'itineraries/new', 
    component: ItineraryCreationComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['Traveler', 'Admin'] }
  },
  { 
    path: 'itineraries/:id', 
    component: ItineraryDetailsComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'itineraries/:id/edit', 
    component: ItineraryEditComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['Traveler', 'Admin'] }
  },
  { 
    path: 'dashboard', 
    component: DashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['Admin'] }
  },
  {
    path: 'messages',
    component: MessageCenterComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'admin/messages',
    component: AdminMessagesComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['Admin'] }
  },
  { path: 'unauthorized', component: UnauthorizedComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
