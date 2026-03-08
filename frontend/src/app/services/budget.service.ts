import { Injectable } from '@angular/core';
import {
  TransportOption,
  TripBudget,
  BudgetLineItem,
} from '../models/transport.model';

/**
 * Generates a full trip budget breakdown including travel, food,
 * local transport, accommodation and miscellaneous costs.
 *
 * Estimates are per-person per-day multiplied by trip length and
 * passenger count. The travel cost comes from the chosen
 * `TransportOption`.
 */
@Injectable({ providedIn: 'root' })
export class BudgetService {

  /**
   * @param transport  The selected transport option (includes totalPrice)
   * @param days       Number of trip days
   * @param passengers Number of travellers
   * @param destination Destination city (used for cost-of-living estimate)
   */
  generateBudget(
    transport: TransportOption,
    days: number,
    passengers: number,
    destination: string
  ): TripBudget {
    const costMultiplier = this._costOfLivingFactor(destination);

    // ── Per-person per-day estimates (INR) ──
    const foodPerDayPP       = +(800 * costMultiplier).toFixed(2);
    const localTransportPP   = +(350  * costMultiplier).toFixed(2);
    const accommodationPP    = +(2000 * costMultiplier).toFixed(2);
    const miscPP             = +(300  * costMultiplier).toFixed(2);

    // ── Totals ──
    const travelCost         = transport.totalPrice;                              // already total
    const foodCost           = +(foodPerDayPP * days * passengers).toFixed(2);
    const localTransportCost = +(localTransportPP * days * passengers).toFixed(2);
    const accommodationCost  = +(accommodationPP * days * passengers).toFixed(2);
    const miscCost           = +(miscPP * days * passengers).toFixed(2);
    const totalTrip          = +(travelCost + foodCost + localTransportCost + accommodationCost + miscCost).toFixed(2);
    const totalPerDay        = days > 0 ? +(totalTrip / days).toFixed(2) : totalTrip;

    const lineItems: BudgetLineItem[] = [
      { category: 'Travel',          label: `${transport.mode} – ${transport.provider} (${passengers} pax)`, amount: travelCost },
      { category: 'Food',            label: `₹${foodPerDayPP}/person/day × ${days} days × ${passengers} pax`, amount: +foodCost, perDay: true },
      { category: 'Local Transport', label: `₹${localTransportPP}/person/day × ${days} days × ${passengers} pax`, amount: +localTransportCost, perDay: true },
      { category: 'Accommodation',   label: `₹${accommodationPP}/person/day × ${days} days × ${passengers} pax`, amount: +accommodationCost, perDay: true },
      { category: 'Miscellaneous',   label: `₹${miscPP}/person/day × ${days} days × ${passengers} pax`, amount: +miscCost, perDay: true },
    ];

    return {
      travelCost,
      foodCost: +foodCost,
      localTransportCost: +localTransportCost,
      accommodationCost: +accommodationCost,
      miscCost: +miscCost,
      totalPerDay,
      totalTrip,
      days,
      passengers,
      lineItems,
    };
  }

  /**
   * Very simple cost-of-living factor based on destination keywords.
   * Returns a multiplier (1.0 = baseline India domestic).
   */
  private _costOfLivingFactor(dest: string): number {
    const d = dest.toLowerCase();

    // Expensive cities / regions
    if (/tokyo|london|paris|new york|zurich|sydney|singapore|dubai/.test(d)) return 2.5;
    if (/bangkok|bali|istanbul|cairo|lisbon|prague/.test(d)) return 1.6;
    if (/goa|jaipur|mumbai|delhi|bangalore|kolkata|hyderabad|chennai/.test(d)) return 1.0;

    // Default moderate
    return 1.3;
  }
}
