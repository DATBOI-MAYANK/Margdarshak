/** Supported transport modes */
export type TransportMode = 'bus' | 'train' | 'flight';

/** A single fare option returned by the transport comparison service */
export interface TransportOption {
  mode: TransportMode;
  provider: string;
  pricePerPerson: number;    // in INR
  totalPrice: number;        // price × passengers
  durationMinutes: number;   // travel time in minutes
  departureTime: string;     // e.g. "06:30 AM"
  arrivalTime: string;
  co2Kg: number;             // estimated CO₂ emission in kg
  /** Score computed by the optimiser (lower = better) */
  score?: number;
  /** Whether this option was picked as "best" */
  recommended?: boolean;
}

/** Parameters the user provides */
export interface TransportSearchParams {
  source: string;
  destination: string;
  date: string;              // ISO yyyy-MM-dd
  passengers: number;
}

/** Optimisation strategy the user can choose */
export type OptimizeStrategy = 'cheapest' | 'fastest' | 'balanced';

/** Result returned by the optimiser */
export interface TransportComparisonResult {
  options: TransportOption[];
  bestOption: TransportOption;
  strategy: OptimizeStrategy;
  errors?: string[];
}

/** Budget line item */
export interface BudgetLineItem {
  category: string;
  label: string;
  amount: number;
  perDay?: boolean;
}

/** Full trip budget breakdown */
export interface TripBudget {
  travelCost: number;
  foodCost: number;
  localTransportCost: number;
  accommodationCost: number;
  miscCost: number;
  totalPerDay: number;
  totalTrip: number;
  days: number;
  passengers: number;
  lineItems: BudgetLineItem[];
}
