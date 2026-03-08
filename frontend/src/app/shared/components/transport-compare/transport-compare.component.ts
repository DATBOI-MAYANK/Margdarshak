import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/* Material */
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';

/* App */
import { TransportService } from '../../../services/transport.service';
import { BudgetService } from '../../../services/budget.service';
import { TransportRouteMapComponent } from '../transport-route-map/transport-route-map.component';
import {
  TransportOption,
  TransportSearchParams,
  TransportComparisonResult,
  OptimizeStrategy,
  TripBudget,
} from '../../../models/transport.model';

@Component({
  selector: 'app-transport-compare',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule,
    TransportRouteMapComponent,
  ],
  template: `
    <!-- ─── Passenger selector row ─── -->
    <div class="control-row">
      <mat-form-field appearance="outline" class="passengers-field">
        <mat-label>Passengers</mat-label>
        <input matInput type="number" min="1" max="20"
               [(ngModel)]="passengers" (ngModelChange)="onPassengersChange()">
        <mat-icon matSuffix>group</mat-icon>
      </mat-form-field>

      <mat-form-field appearance="outline" class="strategy-field">
        <mat-label>Optimize for</mat-label>
        <mat-select [(ngModel)]="strategy" (ngModelChange)="onStrategyChange()">
          <mat-option value="cheapest">
            <mat-icon>savings</mat-icon> Cheapest
          </mat-option>
          <mat-option value="fastest">
            <mat-icon>speed</mat-icon> Fastest
          </mat-option>
          <mat-option value="balanced">
            <mat-icon>balance</mat-icon> Balanced
          </mat-option>
        </mat-select>
      </mat-form-field>

      <button mat-raised-button color="primary" class="compare-btn"
              [disabled]="!canSearch || searching"
              (click)="doSearch()">
        <mat-icon>compare_arrows</mat-icon>
        {{ searching ? 'Searching…' : 'Compare Fares' }}
      </button>
    </div>

    <!-- Hint when fields are missing -->
    <div class="hint-box" *ngIf="!canSearch">
      <mat-icon>info_outline</mat-icon>
      <span>Fill in <strong>source</strong>, <strong>destination</strong>, and <strong>start date</strong> above to compare fares.</span>
    </div>

    <!-- ─── Loading ─── -->
    <div class="loading-box" *ngIf="searching">
      <mat-spinner diameter="36"></mat-spinner>
      <span>Fetching bus, train &amp; flight fares…</span>
    </div>

    <!-- ─── Error ─── -->
    <div class="error-box" *ngIf="errorMsg && !searching">
      <mat-icon>error_outline</mat-icon>
      <span>{{ errorMsg }}</span>
    </div>

    <!-- ─── Results ─── -->
    <div class="results" *ngIf="result && result.options.length > 0 && !searching">

      <!-- Best option banner -->
      <div class="best-banner" *ngIf="result.bestOption">
        <mat-icon>emoji_events</mat-icon>
        <span>
          Best option ({{ strategy }}):
          <strong>{{ result.bestOption.provider }}</strong>
          — {{ result.bestOption.mode | titlecase }}
          — {{ result.bestOption.totalPrice | number:'1.2-2' | currency:'INR' }}
          — {{ formatDuration(result.bestOption.durationMinutes) }}
        </span>
      </div>

      <!-- ─── Route Map Visualization ─── -->
      <app-transport-route-map
        [source]="source"
        [destination]="destination"
        [options]="result.options"
        [selectedOption]="result.bestOption">
      </app-transport-route-map>

      <!-- Option cards -->
      <div class="option-grid">
        <mat-card *ngFor="let opt of result.options; let i = index"
                  class="option-card"
                  [class.recommended]="opt.recommended"
                  (click)="selectOption(opt)">

          <!-- Rank badge -->
          <div class="rank-badge" [class.gold]="i===0" [class.silver]="i===1" [class.bronze]="i===2">
            #{{ i + 1 }}
          </div>

          <div class="mode-icon-row">
            <mat-icon class="mode-icon">{{ modeIcon(opt.mode) }}</mat-icon>
            <span class="mode-label">{{ opt.mode | titlecase }}</span>
            <span class="provider">{{ opt.provider }}</span>
          </div>

          <mat-divider></mat-divider>

          <div class="detail-grid">
            <div class="detail-item">
              <mat-icon>attach_money</mat-icon>
              <div>
                <span class="detail-label">Total</span>
                <span class="detail-value price">{{ opt.totalPrice | currency:'INR' }}</span>
              </div>
            </div>
            <div class="detail-item">
              <mat-icon>person</mat-icon>
              <div>
                <span class="detail-label">Per Person</span>
                <span class="detail-value">{{ opt.pricePerPerson | currency:'INR' }}</span>
              </div>
            </div>
            <div class="detail-item">
              <mat-icon>schedule</mat-icon>
              <div>
                <span class="detail-label">Duration</span>
                <span class="detail-value">{{ formatDuration(opt.durationMinutes) }}</span>
              </div>
            </div>
            <div class="detail-item">
              <mat-icon>flight_takeoff</mat-icon>
              <div>
                <span class="detail-label">Departs</span>
                <span class="detail-value">{{ opt.departureTime }}</span>
              </div>
            </div>
            <div class="detail-item">
              <mat-icon>flight_land</mat-icon>
              <div>
                <span class="detail-label">Arrives</span>
                <span class="detail-value">{{ opt.arrivalTime }}</span>
              </div>
            </div>
            <div class="detail-item">
              <mat-icon>eco</mat-icon>
              <div>
                <span class="detail-label">CO₂</span>
                <span class="detail-value">{{ opt.co2Kg }} kg</span>
              </div>
            </div>
          </div>

          <!-- Route summary -->
          <div class="route-summary">
            <div class="route-cities">
              <span class="city-chip from">{{ source }}</span>
              <div class="route-line-mini" [style.borderColor]="getModeColor(opt.mode)">
                <mat-icon class="route-line-icon">{{ modeIcon(opt.mode) }}</mat-icon>
              </div>
              <span class="city-chip to">{{ destination }}</span>
            </div>
          </div>

          <div class="score-bar">
            <span>Score</span>
            <div class="bar-track">
              <div class="bar-fill" [style.width.%]="(1 - (opt.score || 0)) * 100"></div>
            </div>
            <span class="score-val">{{ ((1 - (opt.score || 0)) * 100) | number:'1.0-0' }}%</span>
          </div>

          <button mat-flat-button color="accent" class="select-btn"
                  *ngIf="opt.recommended">
            <mat-icon>check_circle</mat-icon> Recommended
          </button>
        </mat-card>
      </div>

      <!-- ─── Budget Breakdown ─── -->
      <div class="budget-section" *ngIf="budget">
        <h3><mat-icon>account_balance_wallet</mat-icon> Estimated Trip Budget</h3>
        <div class="budget-grid">
          <div class="budget-row header">
            <span>Category</span>
            <span>Details</span>
            <span>Amount</span>
          </div>
          <div class="budget-row" *ngFor="let item of budget.lineItems">
            <span class="cat">{{ item.category }}</span>
            <span class="desc">{{ item.label }}</span>
            <span class="amt">{{ item.amount | currency:'INR' }}</span>
          </div>
          <mat-divider></mat-divider>
          <div class="budget-row total">
            <span>Total Trip Cost</span>
            <span></span>
            <span class="amt">{{ budget.totalTrip | currency:'INR' }}</span>
          </div>
          <div class="budget-row per-day">
            <span>Average Per Day</span>
            <span>{{ budget.days }} days, {{ budget.passengers }} passengers</span>
            <span class="amt">{{ budget.totalPerDay | currency:'INR' }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ── Control row ── */
    .control-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .passengers-field { max-width: 130px; }
    .strategy-field   { max-width: 180px; }
    .compare-btn {
      height: 56px;
      border-radius: 12px;
      font-weight: 600;
      letter-spacing: .5px;
    }

    /* ── Loading ── */
    .loading-box {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px;
      justify-content: center;
      color: rgba(255,255,255,.8);
    }

    /* ── Error ── */
    .error-box {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 20px;
      background: rgba(244,67,54,.15);
      border: 1px solid rgba(244,67,54,.4);
      border-radius: 12px;
      margin-bottom: 16px;
      color: #ef9a9a;
      font-size: 14px;
    }
    .error-box mat-icon { color: #ef5350; }

    /* ── Hint ── */
    .hint-box {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 20px;
      background: rgba(255,255,255,.05);
      border: 1px dashed rgba(255,255,255,.15);
      border-radius: 12px;
      margin-top: 8px;
      color: rgba(255,255,255,.5);
      font-size: 14px;
    }
    .hint-box mat-icon { color: rgba(186,85,211,.6); }
    .hint-box strong { color: rgba(255,255,255,.8); }

    /* ── Best banner ── */
    .best-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 20px;
      background: linear-gradient(135deg, rgba(76,175,80,.25), rgba(139,195,74,.18));
      border: 1px solid rgba(76,175,80,.4);
      border-radius: 12px;
      margin-bottom: 20px;
      color: #a5d6a7;
      font-size: 15px;
    }
    .best-banner mat-icon {
      color: #ffd54f;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .best-banner strong { color: #fff; }

    /* ── Option grid ── */
    .option-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }

    .option-card {
      position: relative;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 16px;
      padding: 20px;
      cursor: pointer;
    }
    .option-card.recommended {
      border-color: rgba(76,175,80,.6);
    }

    /* Rank badge */
    .rank-badge {
      position: absolute; top: 12px; right: 14px;
      width: 30px; height: 30px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px;
      background: rgba(255,255,255,.1);
      color: rgba(255,255,255,.5);
    }
    .rank-badge.gold   { background: rgba(255,213,79,.25); color: #ffd54f; }
    .rank-badge.silver { background: rgba(189,189,189,.2); color: #bdbdbd; }
    .rank-badge.bronze { background: rgba(255,183,77,.18); color: #ffb74d; }

    /* Mode row */
    .mode-icon-row {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 12px;
    }
    .mode-icon { font-size: 28px; width: 28px; height: 28px; color: rgba(186,85,211,.9); }
    .mode-label { font-weight: 700; font-size: 16px; color: rgba(255,255,255,.9); }
    .provider { font-size: 13px; color: rgba(255,255,255,.55); margin-left: auto; }

    /* Detail grid */
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 14px 0;
    }
    .detail-item {
      display: flex; align-items: center; gap: 8px;
    }
    .detail-item mat-icon { font-size: 18px; width: 18px; height: 18px; color: rgba(255,255,255,.45); }
    .detail-label { font-size: 11px; color: rgba(255,255,255,.45); display: block; }
    .detail-value { font-size: 14px; color: rgba(255,255,255,.88); font-weight: 600; }
    .detail-value.price { color: #81c784; }

    /* Score bar */
    .score-bar {
      display: flex; align-items: center; gap: 8px;
      margin-top: 10px;
      font-size: 12px; color: rgba(255,255,255,.5);
    }

    /* Route summary inside card */
    .route-summary {
      margin-top: 12px;
      padding: 10px 0 4px;
      border-top: 1px solid rgba(255,255,255,.08);
    }
    .route-cities {
      display: flex;
      align-items: center;
      gap: 0;
      justify-content: center;
    }
    .city-chip {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: .5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100px;
    }
    .city-chip.from {
      background: rgba(76,175,80,.18);
      color: #81c784;
    }
    .city-chip.to {
      background: rgba(255,0,128,.14);
      color: #ff80ab;
    }
    .route-line-mini {
      flex: 1;
      min-width: 40px;
      border-top: 2px dashed rgba(186,85,211,.5);
      position: relative;
      margin: 0 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .route-line-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: rgba(255,255,255,.5);
      background: rgba(26,15,46,.9);
      padding: 2px;
      border-radius: 50%;
      position: absolute;
      top: -11px;
    }
    .bar-track {
      flex: 1; height: 6px; border-radius: 3px;
      background: rgba(255,255,255,.1);
    }
    .bar-fill {
      height: 100%; border-radius: 3px;
      background: linear-gradient(90deg, #ba55d3, #7c4dff);
    }
    .score-val { font-weight: 700; color: rgba(255,255,255,.7); }

    .select-btn {
      width: 100%; margin-top: 12px;
      border-radius: 10px; font-weight: 600;
    }

    /* ── Budget section ── */
    .budget-section {
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 16px;
      padding: 24px;
    }
    .budget-section h3 {
      display: flex; align-items: center; gap: 8px;
      font-size: 18px; font-weight: 700;
      color: rgba(255,255,255,.9);
      margin: 0 0 16px;
    }
    .budget-section h3 mat-icon { color: #ffd54f; }

    .budget-grid {
      display: grid;
      grid-template-columns: 1fr 2fr auto;
      gap: 8px 16px;
      font-size: 14px;
    }
    .budget-row { display: contents; }
    .budget-row.header span {
      font-weight: 700; font-size: 12px;
      text-transform: uppercase;
      color: rgba(255,255,255,.45);
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(255,255,255,.1);
    }
    .budget-row .cat  { color: rgba(255,255,255,.7); font-weight: 600; }
    .budget-row .desc { color: rgba(255,255,255,.5); }
    .budget-row .amt  { color: #81c784; font-weight: 700; text-align: right; }
    .budget-row.total .amt { font-size: 18px; color: #ffd54f; }
    .budget-row.total span:first-child { font-weight: 700; color: rgba(255,255,255,.9); padding-top: 12px; }
    .budget-row.total span { padding-top: 12px; }
    .budget-row.per-day span { color: rgba(255,255,255,.5); font-size: 13px; }
    .budget-row.per-day .amt { color: rgba(255,255,255,.6); font-size: 13px; }

    mat-divider { margin: 4px 0; grid-column: 1 / -1; }

    /* responsive */
    @media (max-width: 600px) {
      .option-grid { grid-template-columns: 1fr; }
      .control-row { flex-direction: column; align-items: stretch; }
      .passengers-field, .strategy-field { max-width: 100%; }
    }
  `],
})
export class TransportCompareComponent implements OnChanges {
  /** Inputs set by the parent (itinerary-creation form) */
  @Input() source = '';
  @Input() destination = '';
  @Input() date = '';
  @Input() tripDays = 1;

  @Output() transportSelected = new EventEmitter<TransportOption>();
  @Output() budgetGenerated = new EventEmitter<TripBudget>();

  passengers = 1;
  strategy: OptimizeStrategy = 'balanced';
  searching = false;
  result: TransportComparisonResult | null = null;
  budget: TripBudget | null = null;
  errorMsg = '';

  constructor(
    private transportService: TransportService,
    private budgetService: BudgetService,
  ) {}

  get canSearch(): boolean {
    return !!(this.source && this.destination && this.date);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Auto-reset results if key inputs change
    if (changes['source'] || changes['destination'] || changes['date']) {
      this.result = null;
      this.budget = null;
    }
  }

  doSearch(): void {
    if (!this.canSearch) return;
    this.searching = true;
    this.result = null;
    this.budget = null;
    this.errorMsg = '';

    const params: TransportSearchParams = {
      source: this.source,
      destination: this.destination,
      date: this.date,
      passengers: this.passengers,
    };

    this.transportService.search(params, this.strategy).subscribe({
      next: (res) => {
        this.searching = false;
        if (!res.options || res.options.length === 0) {
          this.result = null;
          const apiErrors = res.errors?.length ? res.errors.join('; ') : '';
          this.errorMsg = apiErrors
            ? `No transport options found. API said: ${apiErrors}`
            : 'No transport options found for this route. Try different cities or dates.';
          return;
        }
        this.result = res;
        if (res.bestOption) {
          this._buildBudget(res.bestOption);
        }
      },
      error: (err) => {
        console.error('Transport search error:', err);
        this.errorMsg = err?.message || err?.error?.error || 'Failed to fetch fares. Make sure the backend is running.';
        this.searching = false;
      },
    });
  }

  selectOption(opt: TransportOption): void {
    // Update recommended flag
    if (this.result) {
      this.result.options.forEach(o => o.recommended = false);
      opt.recommended = true;
      this.result.bestOption = opt;
      // Force change detection on the map's selectedOption input
      this.result = { ...this.result, bestOption: opt };
    }
    this._buildBudget(opt);
    this.transportSelected.emit(opt);
  }

  onPassengersChange(): void {
    if (this.passengers < 1) this.passengers = 1;
    if (this.result) this.doSearch(); // re-run with new count
  }

  onStrategyChange(): void {
    if (this.result) this.doSearch();
  }

  formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  modeIcon(mode: string): string {
    switch (mode) {
      case 'bus':    return 'directions_bus';
      case 'train':  return 'train';
      case 'flight': return 'flight';
      default:       return 'commute';
    }
  }

  getModeColor(mode: string): string {
    switch (mode) {
      case 'flight': return '#7c4dff';
      case 'train':  return '#00bcd4';
      case 'bus':    return '#ff9800';
      default:       return '#ba55d3';
    }
  }

  private _buildBudget(opt: TransportOption): void {
    this.budget = this.budgetService.generateBudget(
      opt,
      this.tripDays,
      this.passengers,
      this.destination,
    );
    this.budgetGenerated.emit(this.budget);
  }
}
