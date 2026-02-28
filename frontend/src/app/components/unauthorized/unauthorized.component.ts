import { Component } from '@angular/core';

@Component({
  selector: 'app-unauthorized',
  template: `
    <div class="unauthorized-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Access Denied</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-icon color="warn">block</mat-icon>
          <p>You do not have permission to access this page.</p>
          <button mat-raised-button color="primary" routerLink="/itineraries">
            Go to Itineraries
          </button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .unauthorized-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      padding: 20px;
    }

    mat-card {
      text-align: center;
      padding: 40px;
    }

    mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin: 20px 0;
    }

    p {
      margin: 20px 0;
      font-size: 1.2em;
    }
  `]
})
export class UnauthorizedComponent {}
