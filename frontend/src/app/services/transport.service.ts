import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  TransportOption,
  TransportSearchParams,
  TransportComparisonResult,
  OptimizeStrategy,
} from '../models/transport.model';
import { getApiUrl } from '../core/services/runtime-config';

/**
 * Service that calls the backend /api/transport/search endpoint
 * which fetches real fares from Amadeus (flights) and IRCTC (trains),
 * plus bus estimates.  The ranking / optimisation is done client-side.
 */
@Injectable({ providedIn: 'root' })
export class TransportService {
  private apiUrl = `${getApiUrl()}/transport`;

  constructor(private http: HttpClient) {}

  /* ──────────────── public API ──────────────── */

  search(
    params: TransportSearchParams,
    strategy: OptimizeStrategy = 'balanced'
  ): Observable<TransportComparisonResult> {
    return this.http
      .post<{ options: TransportOption[]; errors?: string[] }>(
        `${this.apiUrl}/search`,
        {
          source: params.source,
          destination: params.destination,
          date: params.date,
          passengers: params.passengers,
        }
      )
      .pipe(
        map((res) => {
          const options = res.options || [];
          const ranked = this._rank(options, strategy, params.passengers);
          ranked.errors = res.errors;
          return ranked;
        })
      );
  }

  /* ──────────────── ranking / optimisation ──────────────── */

  private _rank(
    options: TransportOption[],
    strategy: OptimizeStrategy,
    passengers: number
  ): TransportComparisonResult {
    if (options.length === 0) {
      // Return empty result so UI can show "no results"
      return { options: [], bestOption: null as any, strategy };
    }

    const prices = options.map((o) => o.totalPrice);
    const durations = options.map((o) => o.durationMinutes);
    const minP = Math.min(...prices),  maxP = Math.max(...prices);
    const minD = Math.min(...durations), maxD = Math.max(...durations);
    const rangeP = maxP - minP || 1;
    const rangeD = maxD - minD || 1;

    let wPrice: number, wTime: number;
    switch (strategy) {
      case 'cheapest': wPrice = 0.85; wTime = 0.15; break;
      case 'fastest':  wPrice = 0.15; wTime = 0.85; break;
      default:         wPrice = 0.50; wTime = 0.50; break;
    }

    options.forEach((o) => {
      const normP = (o.totalPrice - minP) / rangeP;
      const normD = (o.durationMinutes - minD) / rangeD;
      o.score = +(normP * wPrice + normD * wTime).toFixed(3);
      o.recommended = false;
    });

    options.sort((a, b) => (a.score ?? 1) - (b.score ?? 1));
    if (options.length > 0) options[0].recommended = true;

    return { options, bestOption: options[0], strategy };
  }
}
