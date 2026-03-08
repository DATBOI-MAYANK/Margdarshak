import { Request, Response } from 'express';
import axios from 'axios';

/* ═══════════════════════════════════════════════════════
   AMADEUS  –  Flight Offers Search (test sandbox)
   ═══════════════════════════════════════════════════════ */
const AMADEUS_BASE = 'https://test.api.amadeus.com';
const AMADEUS_KEY = process.env.AMADEUS_API_KEY || '';
const AMADEUS_SECRET = process.env.AMADEUS_API_SECRET || '';

let amadeusToken = '';
let amadeusTokenExpiry = 0;

async function getAmadeusToken(): Promise<string> {
  if (amadeusToken && Date.now() < amadeusTokenExpiry) return amadeusToken;

  const res = await axios.post(
    `${AMADEUS_BASE}/v1/security/oauth2/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: AMADEUS_KEY,
      client_secret: AMADEUS_SECRET,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  amadeusToken = res.data.access_token;
  amadeusTokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
  return amadeusToken;
}

/* ═══════════════════════════════════════════════════════
   IRCTC / RapidAPI  –  Train search
   ═══════════════════════════════════════════════════════ */
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const IRCTC_HOST = 'irctc1.p.rapidapi.com';

/* ═══════════════════════════════════════════════════════
   IATA / Station code lookups
   ═══════════════════════════════════════════════════════ */

// Common Indian city → IATA airport code mapping
const IATA_MAP: Record<string, string> = {
  'delhi': 'DEL', 'new delhi': 'DEL', 'noida': 'DEL', 'gurgaon': 'DEL', 'gurugram': 'DEL',
  'mumbai': 'BOM', 'bombay': 'BOM',
  'bangalore': 'BLR', 'bengaluru': 'BLR',
  'hyderabad': 'HYD',
  'chennai': 'MAA', 'madras': 'MAA',
  'kolkata': 'CCU', 'calcutta': 'CCU',
  'pune': 'PNQ',
  'ahmedabad': 'AMD',
  'jaipur': 'JAI',
  'goa': 'GOI', 'panaji': 'GOI',
  'lucknow': 'LKO',
  'kochi': 'COK', 'cochin': 'COK',
  'chandigarh': 'IXC',
  'indore': 'IDR',
  'patna': 'PAT',
  'bhopal': 'BHO',
  'varanasi': 'VNS',
  'srinagar': 'SXR',
  'thiruvananthapuram': 'TRV', 'trivandrum': 'TRV',
  'coimbatore': 'CJB',
  'nagpur': 'NAG',
  'amritsar': 'ATQ',
  'ranchi': 'IXR',
  'bhubaneswar': 'BBI',
  'visakhapatnam': 'VTZ', 'vizag': 'VTZ',
  'mangalore': 'IXE', 'mangaluru': 'IXE',
  'udaipur': 'UDR',
  // International
  'london': 'LHR', 'paris': 'CDG', 'tokyo': 'NRT', 'new york': 'JFK',
  'dubai': 'DXB', 'singapore': 'SIN', 'bangkok': 'BKK', 'sydney': 'SYD',
  'hong kong': 'HKG', 'toronto': 'YYZ', 'los angeles': 'LAX',
  'san francisco': 'SFO', 'amsterdam': 'AMS', 'rome': 'FCO',
  'frankfurt': 'FRA', 'istanbul': 'IST', 'kuala lumpur': 'KUL',
  'bali': 'DPS', 'denpasar': 'DPS', 'maldives': 'MLE', 'male': 'MLE',
  'cairo': 'CAI', 'lisbon': 'LIS', 'prague': 'PRG', 'zurich': 'ZRH',
  'barcelona': 'BCN', 'madrid': 'MAD', 'berlin': 'BER',
  'seoul': 'ICN', 'beijing': 'PEK', 'shanghai': 'PVG',
  'mumbai, maharashtra, india': 'BOM', 'new delhi, delhi, india': 'DEL',
  'bangalore, karnataka, india': 'BLR',
};

// Common Indian city → railway station code mapping
const STATION_MAP: Record<string, string> = {
  'delhi': 'NDLS', 'new delhi': 'NDLS', 'noida': 'NDLS',
  'mumbai': 'CSMT', 'bombay': 'CSMT',
  'bangalore': 'SBC', 'bengaluru': 'SBC',
  'hyderabad': 'SC',
  'chennai': 'MAS', 'madras': 'MAS',
  'kolkata': 'HWH', 'calcutta': 'HWH',
  'pune': 'PUNE',
  'ahmedabad': 'ADI',
  'jaipur': 'JP',
  'goa': 'MAO', 'panaji': 'MAO',
  'lucknow': 'LKO',
  'kochi': 'ERS', 'cochin': 'ERS',
  'chandigarh': 'CDG',
  'bhopal': 'BPL',
  'varanasi': 'BSB',
  'patna': 'PNBE',
  'indore': 'INDB',
  'nagpur': 'NGP',
  'amritsar': 'ASR',
  'coimbatore': 'CBE',
  'thiruvananthapuram': 'TVC', 'trivandrum': 'TVC',
  'bhubaneswar': 'BBS',
  'visakhapatnam': 'VSKP', 'vizag': 'VSKP',
  'mangalore': 'MAQ', 'mangaluru': 'MAQ',
  'udaipur': 'UDZ',
  'agra': 'AGC',
  'ranchi': 'RNC',
};

function resolveIATA(city: string): string | null {
  const key = city.toLowerCase().replace(/,.*$/, '').trim();
  return IATA_MAP[key] || IATA_MAP[city.toLowerCase().trim()] || null;
}

function resolveStation(city: string): string | null {
  const key = city.toLowerCase().replace(/,.*$/, '').trim();
  return STATION_MAP[key] || null;
}

/* ═══════════════════════════════════════════════════════
   Helper: format minutes to "Xh Ym"
   ═══════════════════════════════════════════════════════ */

function durationToMinutes(isoDuration: string): number {
  // PT2H30M → 150
  const h = isoDuration.match(/(\d+)H/);
  const m = isoDuration.match(/(\d+)M/);
  return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
}

/* ═══════════════════════════════════════════════════════
   BUS estimation (no free API)
   ═══════════════════════════════════════════════════════ */

function estimateBusOptions(source: string, dest: string, passengers: number) {
  const dist = estimateDistance(source, dest);
  const providers = ['RedBus Express', 'GreenLine Travels', 'Royal Cruiser'];
  return providers.map((prov, i) => {
    const speed = 45 + i * 5;
    const dur = Math.round((dist / speed) * 60);
    const basePrice = +(dist * (3.5 + i * 1.0)).toFixed(2);
    const dep = 6 + i * 3;
    return {
      mode: 'bus' as const,
      provider: prov,
      pricePerPerson: basePrice,
      totalPrice: +(basePrice * passengers).toFixed(2),
      durationMinutes: dur,
      departureTime: fmtTime(dep, 0),
      arrivalTime: fmtTime(dep, dur),
      co2Kg: +(dist * 0.027).toFixed(1),
    };
  });
}

function estimateDistance(a: string, b: string): number {
  let h = 0;
  const s = a.toLowerCase() + '|' + b.toLowerCase();
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return 100 + (Math.abs(h) % 2400);
}

function fmtTime(baseHour: number, addMin: number): string {
  const d = new Date(2025, 0, 1, baseHour, 0);
  d.setMinutes(d.getMinutes() + addMin);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/* ═══════════════════════════════════════════════════════
   CONTROLLER: POST /api/transport/search
   ═══════════════════════════════════════════════════════ */

export const searchTransport = async (req: Request, res: Response) => {
  try {
    const { source, destination, date, passengers = 1 } = req.body;

    if (!source || !destination || !date) {
      return res.status(400).json({ error: 'source, destination, and date are required' });
    }

    console.log(`🚀 Transport search: ${source} → ${destination}, date=${date}, pax=${passengers}`);

    const results: any[] = [];
    const errors: string[] = [];

    // ─── Flights (Amadeus) ───
    const originIATA = resolveIATA(source);
    const destIATA = resolveIATA(destination);

    if (originIATA && destIATA && AMADEUS_KEY) {
      try {
        const token = await getAmadeusToken();
        const flightRes = await axios.get(`${AMADEUS_BASE}/v2/shopping/flight-offers`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            originLocationCode: originIATA,
            destinationLocationCode: destIATA,
            departureDate: date,
            adults: passengers,
            nonStop: false,
            max: 5,
            currencyCode: 'INR',
          },
          timeout: 15000,
        });

        const offers = flightRes.data?.data || [];
        for (const offer of offers) {
          const seg = offer.itineraries?.[0];
          const totalPrice = parseFloat(offer.price?.total || '0');
          const perPerson = +(totalPrice / passengers).toFixed(2);
          const dur = seg?.duration ? durationToMinutes(seg.duration) : 0;

          // Get carrier info
          const firstSeg = seg?.segments?.[0];
          const carrier = flightRes.data?.dictionaries?.carriers?.[firstSeg?.carrierCode] || firstSeg?.carrierCode || 'Airline';
          const depTime = firstSeg?.departure?.at ? new Date(firstSeg.departure.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
          const lastSeg = seg?.segments?.[seg.segments.length - 1];
          const arrTime = lastSeg?.arrival?.at ? new Date(lastSeg.arrival.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
          const stops = (seg?.segments?.length || 1) - 1;

          results.push({
            mode: 'flight',
            provider: `${carrier}${stops > 0 ? ` (${stops} stop${stops > 1 ? 's' : ''})` : ' (Non-stop)'}`,
            pricePerPerson: perPerson,
            totalPrice,
            durationMinutes: dur,
            departureTime: depTime,
            arrivalTime: arrTime,
            co2Kg: +(estimateDistance(source, destination) * 0.115).toFixed(1),
            source: 'amadeus',
          });
        }

        console.log(`  ✈ Amadeus returned ${offers.length} flight offers`);
      } catch (flightErr: any) {
        const msg = flightErr.response?.data?.errors?.[0]?.detail || flightErr.message;
        console.error(`  ✈ Amadeus error: ${msg}`);
        errors.push(`Flights: ${msg}`);
      }
    } else {
      if (!originIATA || !destIATA) {
        errors.push(`Flights: Could not resolve IATA codes for "${!originIATA ? source : destination}"`);
      }
    }

    // ─── Determine if route is domestic (India ↔ India) ───
    // If both cities have Indian railway station codes, it's domestic
    const fromStation = resolveStation(source);
    const toStation = resolveStation(destination);
    const isDomestic = !!(fromStation && toStation);

    console.log(`  🌍 Route type: ${isDomestic ? 'Domestic (India)' : 'International'} — trains/buses ${isDomestic ? 'enabled' : 'skipped'}`);

    // ─── Trains (IRCTC / RapidAPI) — only for domestic routes ───
    if (isDomestic && fromStation && toStation && RAPIDAPI_KEY) {
      try {
        // Search trains between stations
        const trainRes = await axios.get(`https://${IRCTC_HOST}/api/v3/trainBetweenStations`, {
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': IRCTC_HOST,
          },
          params: {
            fromStationCode: fromStation,
            toStationCode: toStation,
            dateOfJourney: date,
          },
          timeout: 15000,
        });

        const trains = trainRes.data?.data || [];
        // Take top 5 trains
        const topTrains = trains.slice(0, 5);

        for (const train of topTrains) {
          const trainName = train.train_name || train.trainName || 'Train';
          const trainNumber = train.train_number || train.trainNumber || '';
          const dur = parseInt(train.duration_h || '0') * 60 + parseInt(train.duration_m || '0');

          // Estimate train fare (IRCTC free tier doesn't always include fares)
          const dist = estimateDistance(source, destination);
          const baseFare = train.fare || +(dist * 6).toFixed(2);
          const perPerson = +baseFare;
          const depTime = train.from_std || train.departureTime || '';
          const arrTime = train.to_std || train.arrivalTime || '';

          results.push({
            mode: 'train',
            provider: `${trainName} (${trainNumber})`,
            pricePerPerson: perPerson,
            totalPrice: +(perPerson * passengers).toFixed(2),
            durationMinutes: dur || Math.round((dist / 80) * 60),
            departureTime: depTime,
            arrivalTime: arrTime,
            co2Kg: +(dist * 0.014).toFixed(1),
            source: 'irctc',
          });
        }

        console.log(`  🚆 IRCTC returned ${topTrains.length} trains`);
      } catch (trainErr: any) {
        const msg = trainErr.response?.data?.message || trainErr.message;
        console.error(`  🚆 IRCTC error: ${msg}`);
        errors.push(`Trains: ${msg}`);

        // Fallback: generate estimated trains
        pushEstimatedTrains(results, source, destination, passengers);
      }
    } else if (isDomestic) {
      // No station codes found — use estimates for domestic
      pushEstimatedTrains(results, source, destination, passengers);
      if (!fromStation || !toStation) {
        errors.push(`Trains: No station code for "${!fromStation ? source : destination}" — showing estimates`);
      }
    }

    // ─── Buses (estimated) — only for domestic routes ───
    if (isDomestic) {
      const buses = estimateBusOptions(source, destination, passengers);
      results.push(...buses);
    }

    // Return
    return res.json({
      options: results,
      source,
      destination,
      date,
      passengers,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('Transport search error:', err.message);
    return res.status(500).json({ error: 'Transport search failed', details: err.message });
  }
};

/* Fallback estimated trains */
function pushEstimatedTrains(arr: any[], source: string, dest: string, passengers: number) {
  const dist = estimateDistance(source, dest);
  const providers = ['Rajdhani Express', 'Shatabdi Express', 'Vande Bharat'];
  for (let i = 0; i < providers.length; i++) {
    const speed = 70 + i * 15;
    const dur = Math.round((dist / speed) * 60);
    const basePrice = +(dist * (5.0 + i * 1.3)).toFixed(2);
    const dep = 5 + i * 4;
    arr.push({
      mode: 'train',
      provider: `${providers[i]} (est.)`,
      pricePerPerson: basePrice,
      totalPrice: +(basePrice * passengers).toFixed(2),
      durationMinutes: dur,
      departureTime: fmtTime(dep, 0),
      arrivalTime: fmtTime(dep, dur),
      co2Kg: +(dist * 0.014).toFixed(1),
      source: 'estimate',
    });
  }
}

/* ═══════════════════════════════════════════════════════
   CONTROLLER: GET /api/transport/iata?city=...
   Resolve a city name to IATA code (utility)
   ═══════════════════════════════════════════════════════ */
export const getIATACode = (req: Request, res: Response) => {
  const city = (req.query.city as string) || '';
  const code = resolveIATA(city);
  return res.json({ city, iata: code });
};
