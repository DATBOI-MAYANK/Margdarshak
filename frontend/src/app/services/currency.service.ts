import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError } from 'rxjs';

export interface ExchangeRates {
  base: string;
  rates: { [key: string]: number };
  date: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  // Using Frankfurter API - free, no API key needed
  private apiUrl = 'https://api.frankfurter.app';

  // Popular currencies with symbols
  readonly currencies: Currency[] = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
    { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
    { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
    { code: 'THB', name: 'Thai Baht', symbol: '฿' },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
    { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
    { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
    { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
    { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
    { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' }
  ];

  // Map destinations to their likely currencies
  private destinationCurrencies: { [key: string]: string } = {
    'paris': 'EUR', 'france': 'EUR', 'rome': 'EUR', 'italy': 'EUR',
    'berlin': 'EUR', 'germany': 'EUR', 'amsterdam': 'EUR', 'netherlands': 'EUR',
    'barcelona': 'EUR', 'madrid': 'EUR', 'spain': 'EUR',
    'london': 'GBP', 'uk': 'GBP', 'england': 'GBP',
    'tokyo': 'JPY', 'japan': 'JPY', 'osaka': 'JPY', 'kyoto': 'JPY',
    'sydney': 'AUD', 'melbourne': 'AUD', 'australia': 'AUD',
    'toronto': 'CAD', 'vancouver': 'CAD', 'canada': 'CAD',
    'new york': 'USD', 'los angeles': 'USD', 'usa': 'USD', 'miami': 'USD',
    'las vegas': 'USD', 'san francisco': 'USD', 'chicago': 'USD',
    'zurich': 'CHF', 'geneva': 'CHF', 'switzerland': 'CHF',
    'beijing': 'CNY', 'shanghai': 'CNY', 'china': 'CNY',
    'mumbai': 'INR', 'delhi': 'INR', 'india': 'INR', 'bangalore': 'INR',
    'mexico city': 'MXN', 'cancun': 'MXN', 'mexico': 'MXN',
    'singapore': 'SGD',
    'hong kong': 'HKD',
    'oslo': 'NOK', 'norway': 'NOK',
    'stockholm': 'SEK', 'sweden': 'SEK',
    'copenhagen': 'DKK', 'denmark': 'DKK',
    'auckland': 'NZD', 'new zealand': 'NZD',
    'cape town': 'ZAR', 'johannesburg': 'ZAR', 'south africa': 'ZAR',
    'rio de janeiro': 'BRL', 'sao paulo': 'BRL', 'brazil': 'BRL',
    'seoul': 'KRW', 'south korea': 'KRW',
    'bangkok': 'THB', 'phuket': 'THB', 'thailand': 'THB',
    'kuala lumpur': 'MYR', 'malaysia': 'MYR',
    'manila': 'PHP', 'philippines': 'PHP',
    'bali': 'IDR', 'jakarta': 'IDR', 'indonesia': 'IDR',
    'istanbul': 'TRY', 'turkey': 'TRY',
    'dubai': 'AED', 'abu dhabi': 'AED', 'uae': 'AED',
    'warsaw': 'PLN', 'krakow': 'PLN', 'poland': 'PLN',
    'prague': 'CZK', 'czech republic': 'CZK',
    'budapest': 'HUF', 'hungary': 'HUF'
  };

  constructor(private http: HttpClient) {}

  getExchangeRate(from: string, to: string): Observable<number> {
    if (from === to) {
      return of(1);
    }
    
    return this.http.get<any>(`${this.apiUrl}/latest?from=${from}&to=${to}`).pipe(
      map(response => response.rates[to] || 1),
      catchError(() => of(1))
    );
  }

  getMultipleRates(from: string, toCurrencies: string[]): Observable<ExchangeRates> {
    const toParam = toCurrencies.join(',');
    return this.http.get<ExchangeRates>(`${this.apiUrl}/latest?from=${from}&to=${toParam}`).pipe(
      catchError(() => of({ base: from, rates: {}, date: new Date().toISOString() }))
    );
  }

  convert(amount: number, rate: number): number {
    return amount * rate;
  }

  getCurrencyForDestination(destination: string): string {
    const lowerDest = destination.toLowerCase();
    
    // Check exact match first
    if (this.destinationCurrencies[lowerDest]) {
      return this.destinationCurrencies[lowerDest];
    }
    
    // Check if destination contains any known location
    for (const [location, currency] of Object.entries(this.destinationCurrencies)) {
      if (lowerDest.includes(location) || location.includes(lowerDest)) {
        return currency;
      }
    }
    
    // Default to EUR for unknown destinations
    return 'EUR';
  }

  getCurrencySymbol(code: string): string {
    const currency = this.currencies.find(c => c.code === code);
    return currency?.symbol || code;
  }

  getCurrencyName(code: string): string {
    const currency = this.currencies.find(c => c.code === code);
    return currency?.name || code;
  }

  formatCurrency(amount: number, currencyCode: string): string {
    const symbol = this.getCurrencySymbol(currencyCode);
    return `${symbol}${amount.toFixed(2)}`;
  }
}
