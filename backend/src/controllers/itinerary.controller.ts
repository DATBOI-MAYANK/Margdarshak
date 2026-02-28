import { Response } from 'express';
import { validationResult } from 'express-validator';
import pool from '../config/database';
import { Itinerary, Activity } from '../models/itinerary.model';
import { AuthRequest } from '../middleware/auth.middleware';
import axios from 'axios';

// Helper function to parse media_paths (can be JSON array or comma-separated string)
function parseMediaPaths(mediaPaths: any): string[] {
  if (!mediaPaths) return [];
  if (Array.isArray(mediaPaths)) return mediaPaths;
  if (typeof mediaPaths === 'string') {
    if (mediaPaths.startsWith('[')) {
      try {
        return JSON.parse(mediaPaths);
      } catch {
        return mediaPaths.split(',').map(p => p.trim()).filter(p => p);
      }
    }
    return mediaPaths.split(',').map(p => p.trim()).filter(p => p);
  }
  return [];
}

export class ItineraryController {
  // Country to capital/major city mapping
  private countryToCity: Record<string, string> = {
    'russia': 'moscow',
    'america': 'new york',
    'usa': 'new york',
    'united states': 'new york',
    'japan': 'tokyo',
    'china': 'beijing',
    'india': 'delhi',
    'france': 'paris',
    'italy': 'rome',
    'spain': 'barcelona',
    'germany': 'berlin',
    'uk': 'london',
    'united kingdom': 'london',
    'england': 'london',
    'australia': 'sydney',
    'brazil': 'rio de janeiro',
    'mexico': 'mexico city',
    'canada': 'toronto',
    'thailand': 'bangkok',
    'south korea': 'seoul',
    'korea': 'seoul',
    'egypt': 'cairo',
    'uae': 'dubai',
    'netherlands': 'amsterdam',
    'greece': 'athens',
    'turkey': 'istanbul',
    'portugal': 'lisbon',
    'austria': 'vienna',
    'czech republic': 'prague',
    'switzerland': 'zurich',
    'belgium': 'brussels',
    'sweden': 'stockholm',
    'denmark': 'copenhagen',
    'norway': 'oslo',
    'ireland': 'dublin',
    'scotland': 'edinburgh',
    'singapore': 'singapore',
    'malaysia': 'kuala lumpur',
    'indonesia': 'bali',
    'vietnam': 'hanoi',
    'philippines': 'manila',
    'new zealand': 'auckland',
    'south africa': 'cape town',
    'morocco': 'marrakech',
    'argentina': 'buenos aires',
  };

  // City coordinates database for reliable geocoding
  private cityCoordinates: Record<string, { lat: number; lon: number }> = {
    // Europe
    'paris': { lat: 48.8566, lon: 2.3522 },
    'london': { lat: 51.5074, lon: -0.1278 },
    'rome': { lat: 41.9028, lon: 12.4964 },
    'barcelona': { lat: 41.3851, lon: 2.1734 },
    'amsterdam': { lat: 52.3676, lon: 4.9041 },
    'berlin': { lat: 52.52, lon: 13.405 },
    'vienna': { lat: 48.2082, lon: 16.3738 },
    'prague': { lat: 50.0755, lon: 14.4378 },
    'athens': { lat: 37.9838, lon: 23.7275 },
    'lisbon': { lat: 38.7223, lon: -9.1393 },
    'madrid': { lat: 40.4168, lon: -3.7038 },
    'venice': { lat: 45.4408, lon: 12.3155 },
    'florence': { lat: 43.7696, lon: 11.2558 },
    'munich': { lat: 48.1351, lon: 11.582 },
    'zurich': { lat: 47.3769, lon: 8.5417 },
    'brussels': { lat: 50.8503, lon: 4.3517 },
    'stockholm': { lat: 59.3293, lon: 18.0686 },
    'copenhagen': { lat: 55.6761, lon: 12.5683 },
    'oslo': { lat: 59.9139, lon: 10.7522 },
    'dublin': { lat: 53.3498, lon: -6.2603 },
    'edinburgh': { lat: 55.9533, lon: -3.1883 },
    // Russia
    'moscow': { lat: 55.7558, lon: 37.6173 },
    'st petersburg': { lat: 59.9343, lon: 30.3351 },
    'saint petersburg': { lat: 59.9343, lon: 30.3351 },
    // Asia
    'tokyo': { lat: 35.6762, lon: 139.6503 },
    'kyoto': { lat: 35.0116, lon: 135.7681 },
    'osaka': { lat: 34.6937, lon: 135.5023 },
    'singapore': { lat: 1.3521, lon: 103.8198 },
    'hong kong': { lat: 22.3193, lon: 114.1694 },
    'bangkok': { lat: 13.7563, lon: 100.5018 },
    'seoul': { lat: 37.5665, lon: 126.978 },
    'beijing': { lat: 39.9042, lon: 116.4074 },
    'shanghai': { lat: 31.2304, lon: 121.4737 },
    'dubai': { lat: 25.2048, lon: 55.2708 },
    'mumbai': { lat: 19.076, lon: 72.8777 },
    'delhi': { lat: 28.7041, lon: 77.1025 },
    'bali': { lat: -8.4095, lon: 115.1889 },
    'kuala lumpur': { lat: 3.139, lon: 101.6869 },
    'taipei': { lat: 25.033, lon: 121.5654 },
    'istanbul': { lat: 41.0082, lon: 28.9784 },
    'hanoi': { lat: 21.0278, lon: 105.8342 },
    'manila': { lat: 14.5995, lon: 120.9842 },
    // Americas
    'new york': { lat: 40.7128, lon: -74.006 },
    'los angeles': { lat: 34.0522, lon: -118.2437 },
    'san francisco': { lat: 37.7749, lon: -122.4194 },
    'las vegas': { lat: 36.1699, lon: -115.1398 },
    'miami': { lat: 25.7617, lon: -80.1918 },
    'chicago': { lat: 41.8781, lon: -87.6298 },
    'boston': { lat: 42.3601, lon: -71.0589 },
    'washington': { lat: 38.9072, lon: -77.0369 },
    'seattle': { lat: 47.6062, lon: -122.3321 },
    'toronto': { lat: 43.6532, lon: -79.3832 },
    'vancouver': { lat: 49.2827, lon: -123.1207 },
    'mexico city': { lat: 19.4326, lon: -99.1332 },
    'cancun': { lat: 21.1619, lon: -86.8515 },
    'rio de janeiro': { lat: -22.9068, lon: -43.1729 },
    'buenos aires': { lat: -34.6037, lon: -58.3816 },
    // Oceania
    'sydney': { lat: -33.8688, lon: 151.2093 },
    'melbourne': { lat: -37.8136, lon: 144.9631 },
    'auckland': { lat: -36.8485, lon: 174.7633 },
    // Africa
    'cairo': { lat: 30.0444, lon: 31.2357 },
    'cape town': { lat: -33.9249, lon: 18.4241 },
    'marrakech': { lat: 31.6295, lon: -7.9811 },
    // India
    'jaipur': { lat: 26.9124, lon: 75.7873 },
    'goa': { lat: 15.2993, lon: 74.124 },
    'agra': { lat: 27.1767, lon: 78.0081 },
    'bangalore': { lat: 12.9716, lon: 77.5946 },
    'chennai': { lat: 13.0827, lon: 80.2707 },
    'kolkata': { lat: 22.5726, lon: 88.3639 },
    'hyderabad': { lat: 17.385, lon: 78.4867 },
    'kerala': { lat: 10.8505, lon: 76.2711 },
    'varanasi': { lat: 25.3176, lon: 82.9739 },
    'udaipur': { lat: 24.5854, lon: 73.7125 },
    // France
    'nice': { lat: 43.7102, lon: 7.262 },
    'lyon': { lat: 45.764, lon: 4.8357 },
    'marseille': { lat: 43.2965, lon: 5.3698 },
  };

  // Fetch real attractions using Geoapify Places API
  private async fetchRealPlaces(destination: string): Promise<any[]> {
    let cityName = destination.split(',')[0].trim().toLowerCase();
    console.log(`Fetching real places for: ${cityName}`);
    
    // If it's a country name, map to its capital/major city
    if (this.countryToCity[cityName]) {
      const mappedCity = this.countryToCity[cityName];
      console.log(`Mapped country "${cityName}" to city "${mappedCity}"`);
      cityName = mappedCity;
    }
    
    const apiKey = process.env.GEOAPIFY_API_KEY || '6a8acffbf63449619c9f4161cd8e13e2';
    
    // Get coordinates for the city
    let lat, lon;
    if (this.cityCoordinates[cityName]) {
      lat = this.cityCoordinates[cityName].lat;
      lon = this.cityCoordinates[cityName].lon;
      console.log(`Using cached coordinates for ${cityName}: lat=${lat}, lon=${lon}`);
    } else {
      // Try geocoding the city name
      try {
        const geocodeResponse = await axios.get(`https://api.geoapify.com/v1/geocode/search`, {
          params: {
            text: destination,
            apiKey: apiKey,
            limit: 1
          }
        });
        
        if (geocodeResponse.data.features && geocodeResponse.data.features.length > 0) {
          const coords = geocodeResponse.data.features[0].geometry.coordinates;
          lon = coords[0];
          lat = coords[1];
          console.log(`Geocoded ${destination} to lat:${lat}, lon:${lon}`);
        } else {
          console.log(`Could not geocode ${destination}, using city-specific activities`);
          return this.getCitySpecificActivities(destination);
        }
      } catch (geoError) {
        console.log(`Geocoding failed for ${destination}, using city-specific activities`);
        return this.getCitySpecificActivities(destination);
      }
    }

    try {
      // Fetch tourist attractions using Geoapify Places API
      const placesResponse = await axios.get(`https://api.geoapify.com/v2/places`, {
        params: {
          categories: 'tourism.sights,tourism.attraction,entertainment.museum,heritage',
          filter: `circle:${lon},${lat},15000`,
          limit: 20,
          apiKey: apiKey
        }
      });

      if (!placesResponse.data.features || placesResponse.data.features.length === 0) {
        console.log('No places found from Geoapify, using city-specific activities');
        return this.getCitySpecificActivities(destination);
      }

      const places = placesResponse.data.features.map((feature: any) => {
        const props = feature.properties;
        const categories = props.categories || [];
        
        return {
          name: props.name || props.address_line1 || 'Unknown Place',
          kinds: categories.join(','),
          duration: this.estimateDurationFromCategory(categories),
          cost: this.estimateCostFromCategory(categories)
        };
      }).filter((place: any) => place.name && place.name !== 'Unknown Place');

      console.log(`Found ${places.length} real places from Geoapify for ${cityName}`);
      
      if (places.length < 5) {
        // Supplement with city-specific activities if not enough results
        const cityActivities = this.getCitySpecificActivities(destination);
        return [...places, ...cityActivities].slice(0, 20);
      }

      return places;
    } catch (error) {
      console.error('Geoapify API error:', error);
      return this.getCitySpecificActivities(destination);
    }
  }

  private estimateDurationFromCategory(categories: string[]): number {
    const catStr = categories.join(',').toLowerCase();
    if (catStr.includes('museum')) return 3;
    if (catStr.includes('castle') || catStr.includes('palace')) return 2.5;
    if (catStr.includes('park') || catStr.includes('garden')) return 2;
    if (catStr.includes('church') || catStr.includes('temple')) return 1.5;
    if (catStr.includes('monument') || catStr.includes('memorial')) return 1;
    if (catStr.includes('entertainment')) return 2.5;
    return 2;
  }

  private estimateCostFromCategory(categories: string[]): number {
    const catStr = categories.join(',').toLowerCase();
    if (catStr.includes('museum')) return 15;
    if (catStr.includes('castle') || catStr.includes('palace')) return 20;
    if (catStr.includes('entertainment')) return 25;
    if (catStr.includes('park') || catStr.includes('garden')) return 0;
    if (catStr.includes('church') || catStr.includes('memorial')) return 0;
    if (catStr.includes('heritage')) return 10;
    return 10;
  }

  private estimateDuration(kinds: string): number {
    if (kinds.includes('museums')) return 3;
    if (kinds.includes('theatres_and_entertainments')) return 2.5;
    if (kinds.includes('natural')) return 2;
    if (kinds.includes('cultural')) return 2;
    return 2;
  }

  private estimateCost(kinds: string): number {
    if (kinds.includes('museums')) return 25;
    if (kinds.includes('amusements')) return 50;
    if (kinds.includes('theatres')) return 40;
    if (kinds.includes('natural')) return 0;
    if (kinds.includes('cultural')) return 15;
    return 20;
  }

  private getFallbackActivities(): any[] {
    return [
      { name: 'City Walking Tour', kinds: 'tour', duration: 3, cost: 25 },
      { name: 'Local Museum Visit', kinds: 'museum', duration: 2.5, cost: 20 },
      { name: 'Historic Landmark Tour', kinds: 'historic', duration: 2, cost: 15 },
      { name: 'Local Market Experience', kinds: 'shopping', duration: 2, cost: 20 },
      { name: 'Traditional Cuisine Tasting', kinds: 'food', duration: 2, cost: 40 },
      { name: 'Park & Gardens Visit', kinds: 'nature', duration: 2, cost: 0 },
      { name: 'Cultural Performance', kinds: 'cultural', duration: 2, cost: 35 }
    ];
  }

  // City-specific real attractions for popular destinations
  private getCitySpecificActivities(destination: string): any[] {
    const cityName = destination.split(',')[0].trim().toLowerCase();
    
    const cityActivities: Record<string, any[]> = {
      // France / Paris - with French names for translate button
      'paris': [
        { name: 'Tour Eiffel (Eiffel Tower)', kinds: 'architecture,monuments', duration: 3, cost: 28 },
        { name: 'Musée du Louvre (Louvre Museum)', kinds: 'museums,art', duration: 4, cost: 17 },
        { name: 'Cathédrale Notre-Dame de Paris', kinds: 'churches,historic', duration: 1.5, cost: 0 },
        { name: 'Arc de Triomphe de l\'Étoile', kinds: 'monuments,architecture', duration: 1.5, cost: 13 },
        { name: 'Basilique du Sacré-Cœur', kinds: 'churches,cultural', duration: 2, cost: 0 },
        { name: 'Musée d\'Orsay', kinds: 'museums,art', duration: 3, cost: 16 },
        { name: 'Château de Versailles', kinds: 'historic,palaces', duration: 5, cost: 20 },
        { name: 'Avenue des Champs-Élysées', kinds: 'streets,shopping', duration: 2, cost: 0 },
        { name: 'Croisière sur la Seine', kinds: 'boat,sightseeing', duration: 1.5, cost: 15 },
        { name: 'Quartier Montmartre', kinds: 'neighborhoods,cultural', duration: 3, cost: 0 },
        { name: 'Centre Georges Pompidou', kinds: 'museums,modern_art', duration: 2.5, cost: 14 },
        { name: 'Jardin du Luxembourg', kinds: 'parks,nature', duration: 2, cost: 0 },
        { name: 'Quartier du Moulin Rouge', kinds: 'entertainment,cultural', duration: 2, cost: 0 },
        { name: 'Quartier du Marais', kinds: 'neighborhoods,historic', duration: 2.5, cost: 0 },
        { name: 'Jardin des Tuileries', kinds: 'parks,nature', duration: 1.5, cost: 0 }
      ],
      'france': [
        { name: 'Tour Eiffel (Eiffel Tower)', kinds: 'architecture,monuments', duration: 3, cost: 28 },
        { name: 'Musée du Louvre (Louvre Museum)', kinds: 'museums,art', duration: 4, cost: 17 },
        { name: 'Cathédrale Notre-Dame de Paris', kinds: 'churches,historic', duration: 1.5, cost: 0 },
        { name: 'Arc de Triomphe de l\'Étoile', kinds: 'monuments,architecture', duration: 1.5, cost: 13 },
        { name: 'Basilique du Sacré-Cœur', kinds: 'churches,cultural', duration: 2, cost: 0 },
        { name: 'Musée d\'Orsay', kinds: 'museums,art', duration: 3, cost: 16 },
        { name: 'Château de Versailles', kinds: 'historic,palaces', duration: 5, cost: 20 },
        { name: 'Avenue des Champs-Élysées', kinds: 'streets,shopping', duration: 2, cost: 0 },
        { name: 'Croisière sur la Seine', kinds: 'boat,sightseeing', duration: 1.5, cost: 15 },
        { name: 'Quartier Montmartre', kinds: 'neighborhoods,cultural', duration: 3, cost: 0 },
        { name: 'Centre Georges Pompidou', kinds: 'museums,modern_art', duration: 2.5, cost: 14 },
        { name: 'Jardin du Luxembourg', kinds: 'parks,nature', duration: 2, cost: 0 }
      ],
      // London
      'london': [
        { name: 'Tower of London', kinds: 'historic,castles', duration: 3, cost: 30 },
        { name: 'British Museum', kinds: 'museums,history', duration: 4, cost: 0 },
        { name: 'Buckingham Palace', kinds: 'palaces,royal', duration: 2, cost: 30 },
        { name: 'Westminster Abbey', kinds: 'churches,historic', duration: 2, cost: 25 },
        { name: 'Big Ben & Parliament', kinds: 'monuments,architecture', duration: 1, cost: 0 },
        { name: 'London Eye', kinds: 'amusements,views', duration: 1.5, cost: 32 },
        { name: 'Tower Bridge', kinds: 'bridges,architecture', duration: 1.5, cost: 12 },
        { name: 'Hyde Park', kinds: 'parks,nature', duration: 2, cost: 0 },
        { name: 'St. Paul\'s Cathedral', kinds: 'churches,architecture', duration: 2, cost: 21 },
        { name: 'Natural History Museum', kinds: 'museums,science', duration: 3, cost: 0 },
        { name: 'Camden Market', kinds: 'markets,shopping', duration: 2.5, cost: 0 },
        { name: 'Covent Garden', kinds: 'entertainment,shopping', duration: 2, cost: 0 }
      ],
      // New York
      'new york': [
        { name: 'Statue of Liberty', kinds: 'monuments,iconic', duration: 4, cost: 24 },
        { name: 'Empire State Building', kinds: 'architecture,views', duration: 2, cost: 44 },
        { name: 'Central Park', kinds: 'parks,nature', duration: 3, cost: 0 },
        { name: 'Times Square', kinds: 'squares,entertainment', duration: 1.5, cost: 0 },
        { name: 'Metropolitan Museum of Art', kinds: 'museums,art', duration: 4, cost: 30 },
        { name: 'Brooklyn Bridge Walk', kinds: 'bridges,walking', duration: 2, cost: 0 },
        { name: '9/11 Memorial', kinds: 'memorials,historic', duration: 2, cost: 26 },
        { name: 'Top of the Rock', kinds: 'views,architecture', duration: 1.5, cost: 40 },
        { name: 'High Line Park', kinds: 'parks,urban', duration: 2, cost: 0 },
        { name: 'Broadway Show', kinds: 'entertainment,cultural', duration: 3, cost: 150 },
        { name: 'Grand Central Terminal', kinds: 'architecture,historic', duration: 1, cost: 0 },
        { name: 'Fifth Avenue Shopping', kinds: 'shopping,streets', duration: 2.5, cost: 0 }
      ],
      // Tokyo - with Japanese names for translate button
      'tokyo': [
        { name: '浅草寺 (Senso-ji Temple)', kinds: 'temples,historic', duration: 2, cost: 0 },
        { name: '東京スカイツリー (Tokyo Skytree)', kinds: 'architecture,views', duration: 2, cost: 21 },
        { name: '渋谷スクランブル交差点 (Shibuya Crossing)', kinds: 'squares,urban', duration: 1, cost: 0 },
        { name: '明治神宮 (Meiji Shrine)', kinds: 'shrines,cultural', duration: 2, cost: 0 },
        { name: '東京タワー (Tokyo Tower)', kinds: 'monuments,views', duration: 1.5, cost: 12 },
        { name: '築地場外市場 (Tsukiji Outer Market)', kinds: 'markets,food', duration: 2.5, cost: 30 },
        { name: '秋葉原 (Akihabara Electric Town)', kinds: 'shopping,technology', duration: 3, cost: 0 },
        { name: '皇居東御苑 (Imperial Palace Gardens)', kinds: 'parks,historic', duration: 2, cost: 0 },
        { name: '原宿 (Harajuku District)', kinds: 'neighborhoods,fashion', duration: 2, cost: 0 },
        { name: 'チームラボボーダレス (TeamLab Borderless)', kinds: 'museums,digital_art', duration: 3, cost: 32 },
        { name: '上野公園 (Ueno Park & Museums)', kinds: 'parks,museums', duration: 3, cost: 10 },
        { name: '新宿御苑 (Shinjuku Gyoen Garden)', kinds: 'gardens,nature', duration: 2, cost: 5 }
      ],
      // Dubai - with Arabic names for translate button
      'dubai': [
        { name: 'برج خليفة (Burj Khalifa)', kinds: 'architecture,views', duration: 2.5, cost: 50 },
        { name: 'دبي مول (Dubai Mall)', kinds: 'shopping,entertainment', duration: 4, cost: 0 },
        { name: 'نخلة جميرا (Palm Jumeirah)', kinds: 'islands,beach', duration: 3, cost: 0 },
        { name: 'مرسى دبي (Dubai Marina Walk)', kinds: 'waterfront,walking', duration: 2, cost: 0 },
        { name: 'برج العرب (Burj Al Arab)', kinds: 'architecture,iconic', duration: 1, cost: 0 },
        { name: 'سوق الذهب (Gold Souk)', kinds: 'markets,shopping', duration: 2, cost: 0 },
        { name: 'رحلة بحرية في خور دبي (Dubai Creek Dhow Cruise)', kinds: 'boat,sightseeing', duration: 2, cost: 25 },
        { name: 'برواز دبي (Dubai Frame)', kinds: 'architecture,views', duration: 1.5, cost: 15 },
        { name: 'سفاري الصحراء (Desert Safari)', kinds: 'adventure,desert', duration: 6, cost: 75 },
        { name: 'أكوافنتشر أتلانتس (Atlantis Aquaventure)', kinds: 'waterpark,amusements', duration: 5, cost: 90 },
        { name: 'سوق التوابل (Spice Souk)', kinds: 'markets,cultural', duration: 1.5, cost: 0 },
        { name: 'شاطئ جميرا (Jumeirah Beach)', kinds: 'beach,relaxation', duration: 3, cost: 0 }
      ],
      // Mumbai - with Hindi names for translate button
      'mumbai': [
        { name: 'गेटवे ऑफ इंडिया (Gateway of India)', kinds: 'monuments,historic', duration: 1.5, cost: 0 },
        { name: 'एलिफेंटा गुफाएं (Elephanta Caves)', kinds: 'caves,historic', duration: 4, cost: 10 },
        { name: 'मरीन ड्राइव (Marine Drive)', kinds: 'waterfront,walking', duration: 2, cost: 0 },
        { name: 'छत्रपति शिवाजी टर्मिनस (CST)', kinds: 'architecture,historic', duration: 1, cost: 0 },
        { name: 'धोबी घाट (Dhobi Ghat)', kinds: 'cultural,unique', duration: 1.5, cost: 0 },
        { name: 'हाजी अली दरगाह (Haji Ali Dargah)', kinds: 'religious,architecture', duration: 1.5, cost: 0 },
        { name: 'संजय गांधी राष्ट्रीय उद्यान (Sanjay Gandhi National Park)', kinds: 'parks,nature', duration: 4, cost: 5 },
        { name: 'कोलाबा कॉजवे (Colaba Causeway)', kinds: 'shopping,markets', duration: 2.5, cost: 0 },
        { name: 'बॉलीवुड स्टूडियो टूर (Bollywood Studio Tour)', kinds: 'entertainment,tours', duration: 3, cost: 35 },
        { name: 'जुहू बीच (Juhu Beach)', kinds: 'beach,local', duration: 2, cost: 0 },
        { name: 'चोर बाज़ार (Chor Bazaar)', kinds: 'markets,antiques', duration: 2, cost: 0 },
        { name: 'सिद्धिविनायक मंदिर (Siddhivinayak Temple)', kinds: 'temples,religious', duration: 1.5, cost: 0 }
      ],
      // Singapore - with Chinese names for translate button
      'singapore': [
        { name: '滨海湾金沙酒店 (Marina Bay Sands)', kinds: 'architecture,iconic', duration: 2, cost: 23 },
        { name: '滨海湾花园 (Gardens by the Bay)', kinds: 'gardens,nature', duration: 3, cost: 28 },
        { name: '圣淘沙岛 (Sentosa Island)', kinds: 'entertainment,beach', duration: 5, cost: 40 },
        { name: '新加坡动物园 (Singapore Zoo)', kinds: 'zoo,nature', duration: 4, cost: 45 },
        { name: '乌节路购物 (Orchard Road)', kinds: 'shopping,streets', duration: 3, cost: 0 },
        { name: '克拉码头 (Clarke Quay)', kinds: 'entertainment,nightlife', duration: 2.5, cost: 0 },
        { name: '牛车水中国城 (Chinatown Heritage)', kinds: 'neighborhoods,cultural', duration: 2, cost: 0 },
        { name: '小印度 (Little India)', kinds: 'neighborhoods,cultural', duration: 2, cost: 0 },
        { name: '鱼尾狮公园 (Merlion Park)', kinds: 'monuments,iconic', duration: 1, cost: 0 },
        { name: '艺术科学博物馆 (ArtScience Museum)', kinds: 'museums,modern', duration: 2.5, cost: 20 },
        { name: '小贩中心美食之旅 (Hawker Centre Food Tour)', kinds: 'food,cultural', duration: 2, cost: 15 },
        { name: '夜间野生动物园 (Night Safari)', kinds: 'zoo,night', duration: 3, cost: 55 }
      ],
      // Rome - with Italian names for translate button
      'rome': [
        { name: 'Colosseo (Colosseum)', kinds: 'historic,monuments', duration: 3, cost: 18 },
        { name: 'Musei Vaticani (Vatican Museums)', kinds: 'museums,art', duration: 4, cost: 20 },
        { name: 'Basilica di San Pietro (St. Peter\'s Basilica)', kinds: 'churches,architecture', duration: 2, cost: 0 },
        { name: 'Cappella Sistina (Sistine Chapel)', kinds: 'art,churches', duration: 1.5, cost: 0 },
        { name: 'Fontana di Trevi (Trevi Fountain)', kinds: 'fountains,monuments', duration: 1, cost: 0 },
        { name: 'Foro Romano (Roman Forum)', kinds: 'historic,ruins', duration: 2.5, cost: 16 },
        { name: 'Pantheon', kinds: 'temples,architecture', duration: 1.5, cost: 0 },
        { name: 'Piazza di Spagna (Spanish Steps)', kinds: 'monuments,squares', duration: 1, cost: 0 },
        { name: 'Piazza Navona', kinds: 'squares,baroque', duration: 1, cost: 0 },
        { name: 'Galleria Borghese (Borghese Gallery)', kinds: 'museums,art', duration: 2.5, cost: 15 },
        { name: 'Quartiere Trastevere (Trastevere District)', kinds: 'neighborhoods,food', duration: 3, cost: 0 },
        { name: 'Castel Sant\'Angelo', kinds: 'castles,historic', duration: 2, cost: 15 }
      ],
      // Barcelona - with Spanish/Catalan names for translate button
      'barcelona': [
        { name: 'Basílica de la Sagrada Família', kinds: 'churches,architecture', duration: 2.5, cost: 26 },
        { name: 'Parc Güell', kinds: 'parks,architecture', duration: 2, cost: 10 },
        { name: 'La Rambla', kinds: 'streets,walking', duration: 2, cost: 0 },
        { name: 'Barri Gòtic (Gothic Quarter)', kinds: 'neighborhoods,historic', duration: 2.5, cost: 0 },
        { name: 'Casa Batlló', kinds: 'architecture,modernist', duration: 1.5, cost: 35 },
        { name: 'Estadi Camp Nou', kinds: 'sports,tours', duration: 2.5, cost: 28 },
        { name: 'Mercat de la Boqueria', kinds: 'markets,food', duration: 1.5, cost: 0 },
        { name: 'Platja de la Barceloneta', kinds: 'beach,relaxation', duration: 3, cost: 0 },
        { name: 'Museu Picasso', kinds: 'museums,art', duration: 2, cost: 12 },
        { name: 'Castell de Montjuïc', kinds: 'castles,views', duration: 2.5, cost: 9 },
        { name: 'Casa Milà (La Pedrera)', kinds: 'architecture,modernist', duration: 1.5, cost: 25 },
        { name: 'Font Màgica de Montjuïc', kinds: 'entertainment,night', duration: 1, cost: 0 }
      ],
      // Bangkok - with Thai names for translate button
      'bangkok': [
        { name: 'พระบรมมหาราชวัง (Grand Palace)', kinds: 'palaces,temples', duration: 3, cost: 15 },
        { name: 'วัดโพธิ์ (Wat Pho)', kinds: 'temples,cultural', duration: 2, cost: 5 },
        { name: 'วัดอรุณ (Wat Arun)', kinds: 'temples,architecture', duration: 1.5, cost: 3 },
        { name: 'ตลาดนัดจตุจักร (Chatuchak Weekend Market)', kinds: 'markets,shopping', duration: 4, cost: 0 },
        { name: 'ถนนข้าวสาร (Khao San Road)', kinds: 'streets,nightlife', duration: 2, cost: 0 },
        { name: 'ล่องเจ้าพระยา (Chao Phraya River Cruise)', kinds: 'boat,sightseeing', duration: 2, cost: 20 },
        { name: 'บ้านจิม ทอมป์สัน (Jim Thompson House)', kinds: 'museums,architecture', duration: 1.5, cost: 6 },
        { name: 'ตลาดน้ำ (Floating Markets)', kinds: 'markets,cultural', duration: 4, cost: 25 },
        { name: 'เยาวราช (Chinatown Yaowarat)', kinds: 'neighborhoods,food', duration: 2.5, cost: 0 },
        { name: 'มาบุญครอง (MBK Shopping Center)', kinds: 'shopping,malls', duration: 2, cost: 0 },
        { name: 'สวนลุมพินี (Lumphini Park)', kinds: 'parks,nature', duration: 2, cost: 0 },
        { name: 'เรียนทำอาหารไทย (Thai Cooking Class)', kinds: 'cultural,food', duration: 3, cost: 40 }
      ],
      // Sydney
      'sydney': [
        { name: 'Sydney Opera House', kinds: 'architecture,iconic', duration: 2, cost: 43 },
        { name: 'Sydney Harbour Bridge', kinds: 'bridges,views', duration: 2, cost: 0 },
        { name: 'Bondi Beach', kinds: 'beach,surfing', duration: 4, cost: 0 },
        { name: 'Taronga Zoo', kinds: 'zoo,nature', duration: 4, cost: 47 },
        { name: 'The Rocks Historic Area', kinds: 'historic,neighborhoods', duration: 2.5, cost: 0 },
        { name: 'Royal Botanic Garden', kinds: 'gardens,nature', duration: 2, cost: 0 },
        { name: 'Darling Harbour', kinds: 'waterfront,entertainment', duration: 3, cost: 0 },
        { name: 'Manly Beach & Ferry', kinds: 'beach,boat', duration: 4, cost: 15 },
        { name: 'Queen Victoria Building', kinds: 'architecture,shopping', duration: 1.5, cost: 0 },
        { name: 'Blue Mountains Day Trip', kinds: 'nature,hiking', duration: 8, cost: 100 },
        { name: 'Sydney Fish Market', kinds: 'markets,food', duration: 1.5, cost: 0 },
        { name: 'Circular Quay Walk', kinds: 'waterfront,walking', duration: 1, cost: 0 }
      ],
      // Moscow (Russia)
      'moscow': [
        { name: 'Красная площадь (Red Square)', kinds: 'landmark,historic', duration: 2, cost: 0 },
        { name: 'Кремль (Moscow Kremlin)', kinds: 'fortress,museums', duration: 4, cost: 20 },
        { name: 'Собор Василия Блаженного (St. Basil\'s Cathedral)', kinds: 'cathedral,architecture', duration: 1.5, cost: 10 },
        { name: 'Третьяковская галерея (Tretyakov Gallery)', kinds: 'art,museums', duration: 3, cost: 12 },
        { name: 'Большой театр (Bolshoi Theatre)', kinds: 'theater,architecture', duration: 3, cost: 50 },
        { name: 'Парк Горького (Gorky Park)', kinds: 'parks,recreation', duration: 3, cost: 0 },
        { name: 'ГУМ (GUM Department Store)', kinds: 'shopping,architecture', duration: 2, cost: 0 },
        { name: 'Московское метро (Moscow Metro Tour)', kinds: 'architecture,transport', duration: 2, cost: 2 },
        { name: 'Храм Христа Спасителя (Cathedral of Christ the Saviour)', kinds: 'cathedral,religious', duration: 1.5, cost: 0 },
        { name: 'Арбат (Arbat Street)', kinds: 'shopping,historic', duration: 2, cost: 0 },
        { name: 'ВДНХ (VDNKh Exhibition)', kinds: 'parks,museums', duration: 4, cost: 0 },
        { name: 'Новодевичий монастырь (Novodevichy Convent)', kinds: 'religious,historic', duration: 2, cost: 8 }
      ],
      // St Petersburg (Russia)
      'st petersburg': [
        { name: 'Эрмитаж (Hermitage Museum)', kinds: 'art,museums', duration: 5, cost: 15 },
        { name: 'Петергоф (Peterhof Palace)', kinds: 'palaces,gardens', duration: 5, cost: 20 },
        { name: 'Спас на Крови (Church of the Savior on Spilled Blood)', kinds: 'cathedral,architecture', duration: 1.5, cost: 8 },
        { name: 'Невский проспект (Nevsky Prospect)', kinds: 'shopping,historic', duration: 3, cost: 0 },
        { name: 'Казанский собор (Kazan Cathedral)', kinds: 'cathedral,architecture', duration: 1, cost: 0 },
        { name: 'Петропавловская крепость (Peter and Paul Fortress)', kinds: 'fortress,historic', duration: 3, cost: 10 },
        { name: 'Исаакиевский собор (St. Isaac\'s Cathedral)', kinds: 'cathedral,views', duration: 2, cost: 10 },
        { name: 'Русский музей (Russian Museum)', kinds: 'art,museums', duration: 3, cost: 12 },
        { name: 'Мариинский театр (Mariinsky Theatre)', kinds: 'theater,ballet', duration: 3, cost: 40 },
        { name: 'Летний сад (Summer Garden)', kinds: 'parks,gardens', duration: 2, cost: 0 },
        { name: 'Екатерининский дворец (Catherine Palace)', kinds: 'palaces,architecture', duration: 4, cost: 25 },
        { name: 'Юсуповский дворец (Yusupov Palace)', kinds: 'palaces,historic', duration: 2, cost: 15 }
      ],
      'saint petersburg': [
        { name: 'Эрмитаж (Hermitage Museum)', kinds: 'art,museums', duration: 5, cost: 15 },
        { name: 'Петергоф (Peterhof Palace)', kinds: 'palaces,gardens', duration: 5, cost: 20 },
        { name: 'Спас на Крови (Church of the Savior on Spilled Blood)', kinds: 'cathedral,architecture', duration: 1.5, cost: 8 },
        { name: 'Невский проспект (Nevsky Prospect)', kinds: 'shopping,historic', duration: 3, cost: 0 },
        { name: 'Казанский собор (Kazan Cathedral)', kinds: 'cathedral,architecture', duration: 1, cost: 0 },
        { name: 'Петропавловская крепость (Peter and Paul Fortress)', kinds: 'fortress,historic', duration: 3, cost: 10 },
        { name: 'Исаакиевский собор (St. Isaac\'s Cathedral)', kinds: 'cathedral,views', duration: 2, cost: 10 },
        { name: 'Русский музей (Russian Museum)', kinds: 'art,museums', duration: 3, cost: 12 }
      ],
      // Russia (mapped to Moscow)
      'russia': [
        { name: 'Красная площадь (Red Square)', kinds: 'landmark,historic', duration: 2, cost: 0 },
        { name: 'Кремль (Moscow Kremlin)', kinds: 'fortress,museums', duration: 4, cost: 20 },
        { name: 'Собор Василия Блаженного (St. Basil\'s Cathedral)', kinds: 'cathedral,architecture', duration: 1.5, cost: 10 },
        { name: 'Третьяковская галерея (Tretyakov Gallery)', kinds: 'art,museums', duration: 3, cost: 12 },
        { name: 'Большой театр (Bolshoi Theatre)', kinds: 'theater,architecture', duration: 3, cost: 50 },
        { name: 'Парк Горького (Gorky Park)', kinds: 'parks,recreation', duration: 3, cost: 0 },
        { name: 'ГУМ (GUM Department Store)', kinds: 'shopping,architecture', duration: 2, cost: 0 },
        { name: 'Московское метро (Moscow Metro Tour)', kinds: 'architecture,transport', duration: 2, cost: 2 },
        { name: 'Храм Христа Спасителя (Cathedral of Christ the Saviour)', kinds: 'cathedral,religious', duration: 1.5, cost: 0 },
        { name: 'Арбат (Arbat Street)', kinds: 'shopping,historic', duration: 2, cost: 0 },
        { name: 'ВДНХ (VDNKh Exhibition)', kinds: 'parks,museums', duration: 4, cost: 0 },
        { name: 'Новодевичий монастырь (Novodevichy Convent)', kinds: 'religious,historic', duration: 2, cost: 8 }
      ]
    };

    // Check for country name and map to city activities
    let lookupName = cityName;
    if (this.countryToCity[cityName]) {
      lookupName = this.countryToCity[cityName];
      console.log(`Checking city-specific activities for mapped city: ${lookupName}`);
    }

    // Return city-specific activities if available
    if (cityActivities[lookupName]) {
      console.log(`Using city-specific activities for ${lookupName}`);
      return cityActivities[lookupName];
    }
    
    // Also check original name
    if (cityActivities[cityName]) {
      console.log(`Using city-specific activities for ${cityName}`);
      return cityActivities[cityName];
    }

    // Return generic fallback for unknown cities
    console.log(`No city-specific activities for ${cityName}, using generic fallback`);
    return this.getFallbackActivities();
  }

  // Generate activities from real or fallback places
  private async generateActivities(destination: string, startDate: string, endDate: string, preferences?: string): Promise<Activity[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Fetch real places from Geoapify API
    const realPlaces = await this.fetchRealPlaces(destination);
    
    // Remove duplicates by name
    const uniquePlaces = realPlaces.filter((place, index, self) => 
      index === self.findIndex(p => p.name === place.name)
    );
    
    console.log(`Got ${realPlaces.length} places, ${uniquePlaces.length} unique for ${destination}`);
    
    const activities: Activity[] = [];
    const timeSlots = ['09:00', '12:00', '15:00']; // Morning, Afternoon, Evening
    const totalActivitiesNeeded = days * 3;
    
    // If we don't have enough unique places, adjust activities per day
    const activitiesPerDay = Math.min(3, Math.ceil(uniquePlaces.length / days));
    
    let placeIndex = 0;
    const usedPlaces = new Set<string>(); // Track used places to avoid repeats

    for (let i = 0; i < days; i++) {
      for (let j = 0; j < activitiesPerDay; j++) {
        // Stop if we've used all unique places
        if (placeIndex >= uniquePlaces.length) {
          break;
        }
        
        const place = uniquePlaces[placeIndex];
        
        // Skip if already used (shouldn't happen with unique filter, but extra safety)
        if (usedPlaces.has(place.name)) {
          placeIndex++;
          j--; // Retry this slot
          continue;
        }
        
        usedPlaces.add(place.name);
        activities.push({
          name: place.name,
          time: timeSlots[j],
          duration: `${place.duration} hours`,
          estimatedCost: place.cost,
          location: destination
        });
        
        placeIndex++;
      }
    }

    // If we have very few activities, add some generic ones
    if (activities.length < days) {
      const genericActivities = [
        { name: 'City Walking Tour', duration: '3 hours', cost: 0 },
        { name: 'Local Market Visit', duration: '2 hours', cost: 10 },
        { name: 'Traditional Restaurant', duration: '2 hours', cost: 25 },
        { name: 'Cultural Experience', duration: '2 hours', cost: 15 },
        { name: 'Scenic Viewpoint', duration: '1 hours', cost: 0 }
      ];
      
      let genericIndex = 0;
      while (activities.length < days * 2 && genericIndex < genericActivities.length) {
        const generic = genericActivities[genericIndex];
        if (!usedPlaces.has(generic.name)) {
          usedPlaces.add(generic.name);
          activities.push({
            name: generic.name,
            time: timeSlots[activities.length % 3],
            duration: generic.duration,
            estimatedCost: generic.cost,
            location: destination
          });
        }
        genericIndex++;
      }
    }

    return activities;
  }

  async createItinerary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { destination, start_date, end_date, budget, activities, notes, preferences } = req.body;

      // Generate activities if not provided (using real API)
      const finalActivities = activities && activities.length > 0 
        ? activities 
        : await this.generateActivities(destination, start_date, end_date, preferences);

      const insertResult = await pool.query(
        'INSERT INTO itineraries (user_id, destination, start_date, end_date, budget, activities, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [req.user.id, destination, start_date, end_date, budget, JSON.stringify(finalActivities), notes || null]
      );

      const itineraryId = insertResult.rows[0]?.id;

      res.status(201).json({
        message: 'Itinerary created successfully',
        itinerary: {
          id: itineraryId,
          user_id: req.user.id,
          destination,
          start_date,
          end_date,
          budget,
          activities: finalActivities,
          notes
        }
      });
    } catch (error) {
      console.error('Create itinerary error:', error);
      res.status(500).json({ error: 'Failed to create itinerary' });
    }
  }

  async getAllItineraries(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('GetAllItineraries - User:', req.user);
      
      if (!req.user || !req.user.id) {
        console.error('User not authenticated or missing ID');
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { destination, startDate, endDate, minBudget, maxBudget } = req.query;

      // Get own itineraries + shared itineraries (accepted collaborations)
      let query = `
        SELECT DISTINCT i.*, 
          CASE WHEN i.user_id = $1 THEN 'owner' ELSE 'collaborator' END as role,
          ic.permission as collab_permission,
          u.name as owner_name
        FROM itineraries i
        LEFT JOIN itinerary_collaborators ic ON i.id = ic.itinerary_id AND ic.user_id = $2 AND ic.status = 'accepted'
        LEFT JOIN users u ON i.user_id = u.id
        WHERE (i.user_id = $3 OR (ic.user_id = $4 AND ic.status = 'accepted'))
      `;
      const params: any[] = [req.user.id, req.user.id, req.user.id, req.user.id];

      if (destination) {
        query += ` AND i.destination LIKE $${params.length + 1}`;
        params.push(`%${destination}%`);
      }

      if (startDate) {
        query += ` AND i.start_date >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND i.end_date <= $${params.length + 1}`;
        params.push(endDate);
      }

      if (minBudget) {
        query += ` AND i.budget >= $${params.length + 1}`;
        params.push(minBudget);
      }

      if (maxBudget) {
        query += ` AND i.budget <= $${params.length + 1}`;
        params.push(maxBudget);
      }

      query += ' ORDER BY i.created_at DESC';

      const result = await pool.query(query, params);

      // Parse JSON fields only if they are strings
      const parsedItineraries = result.rows.map(itin => ({        ...itin,
        activities: typeof itin.activities === 'string' ? JSON.parse(itin.activities) : (itin.activities || []),
        media_paths: parseMediaPaths(itin.media_paths)
      }));

      res.json({ itineraries: parsedItineraries });
    } catch (error) {
      console.error('Get itineraries error:', error);
      res.status(500).json({ error: 'Failed to fetch itineraries' });
    }
  }

  async getItineraryById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { id } = req.params;

      // Check if user is owner OR a collaborator with access
      const result = await pool.query(
        `SELECT i.*,
          CASE WHEN i.user_id = $1 THEN 'owner' ELSE 'collaborator' END as role,
          ic.permission as collab_permission,
          u.name as owner_name
        FROM itineraries i
        LEFT JOIN itinerary_collaborators ic ON i.id = ic.itinerary_id AND ic.user_id = $2 AND ic.status = 'accepted'
        LEFT JOIN users u ON i.user_id = u.id
        WHERE i.id = $3 AND (i.user_id = $4 OR (ic.user_id = $5 AND ic.status = 'accepted'))`,
        [req.user.id, req.user.id, id, req.user.id, req.user.id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Itinerary not found' });
        return;
      }

      const itinerary = result.rows[0] as any;
      // Parse JSON fields only if they are strings
      itinerary.activities = typeof itinerary.activities === 'string' 
        ? JSON.parse(itinerary.activities) 
        : (itinerary.activities || []);
      itinerary.media_paths = parseMediaPaths(itinerary.media_paths);

      res.json({ itinerary });
    } catch (error) {
      console.error('Get itinerary by ID error:', error);
      res.status(500).json({ error: 'Failed to fetch itinerary' });
    }
  }

  async updateItinerary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { id } = req.params;
      const { destination, start_date, end_date, budget, activities, notes, media_paths } = req.body;

      // Check if itinerary exists and user is owner OR collaborator with edit permission
      const existingResult = await pool.query(
        `SELECT i.id, i.user_id,
          CASE WHEN i.user_id = $1 THEN 'edit' ELSE ic.permission END as effective_permission
        FROM itineraries i
        LEFT JOIN itinerary_collaborators ic ON i.id = ic.itinerary_id AND ic.user_id = $2 AND ic.status = 'accepted'
        WHERE i.id = $3 AND (i.user_id = $4 OR (ic.user_id = $5 AND ic.status = 'accepted'))`,
        [req.user.id, req.user.id, id, req.user.id, req.user.id]
      );

      if (existingResult.rows.length === 0) {
        res.status(404).json({ error: 'Itinerary not found' });
        return;
      }

      const record = existingResult.rows[0] as any;
      if (record.effective_permission !== 'edit') {
        res.status(403).json({ error: 'You only have view permission for this itinerary' });
        return;
      }

      // Handle media_paths - must be valid JSON for the database column
      // Convert to JSON array string, or null if empty
      let mediaPathsJson: string | null = null;
      if (media_paths && typeof media_paths === 'string' && media_paths.trim()) {
        // If it's a comma-separated string, convert to JSON array
        const pathsArray = media_paths.split(',').map((p: string) => p.trim()).filter((p: string) => p);
        mediaPathsJson = pathsArray.length > 0 ? JSON.stringify(pathsArray) : null;
      } else if (Array.isArray(media_paths) && media_paths.length > 0) {
        mediaPathsJson = JSON.stringify(media_paths);
      }

      await pool.query(
        'UPDATE itineraries SET destination = $1, start_date = $2, end_date = $3, budget = $4, activities = $5, notes = $6, media_paths = $7 WHERE id = $8',
        [destination, start_date, end_date, budget, JSON.stringify(activities), notes || '', mediaPathsJson, id]
      );

      res.json({ message: 'Itinerary updated successfully' });
    } catch (error) {
      console.error('Update itinerary error:', error);
      res.status(500).json({ error: 'Failed to update itinerary' });
    }
  }

  async deleteItinerary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM itineraries WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Itinerary not found' });
        return;
      }

      res.json({ message: 'Itinerary deleted successfully' });
    } catch (error) {
      console.error('Delete itinerary error:', error);
      res.status(500).json({ error: 'Failed to delete itinerary' });
    }
  }

  // Admin endpoint to view all itineraries
  async getAllItinerariesAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminResult = await pool.query(`
        SELECT i.*, u.name as user_name, u.email as user_email
        FROM itineraries i
        JOIN users u ON i.user_id = u.id
        ORDER BY i.created_at DESC
      `);

      // Parse JSON fields only if they are strings
      const parsedItineraries = adminResult.rows.map(itin => ({
        ...itin,
        activities: typeof itin.activities === 'string'
          ? JSON.parse(itin.activities)
          : (itin.activities || []),
        media_paths: parseMediaPaths(itin.media_paths)
      }));

      res.json({ itineraries: parsedItineraries });
    } catch (error) {
      console.error('Get all itineraries (admin) error:', error);
      res.status(500).json({ error: 'Failed to fetch itineraries' });
    }
  }

  // Regenerate activities for an itinerary using real API data
  async regenerateActivities(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { id } = req.params;

      // Get the itinerary
      const itineraryResult = await pool.query(
        'SELECT * FROM itineraries WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (itineraryResult.rows.length === 0) {
        res.status(404).json({ error: 'Itinerary not found' });
        return;
      }

      const itinerary = itineraryResult.rows[0] as any;
      
      console.log(`Regenerating activities for itinerary ${id} - ${itinerary.destination}`);

      // Generate new activities from real API
      const newActivities = await this.generateActivities(
        itinerary.destination,
        itinerary.start_date,
        itinerary.end_date
      );

      // Update the itinerary with new activities
      await pool.query(
        'UPDATE itineraries SET activities = $1 WHERE id = $2',
        [JSON.stringify(newActivities), id]
      );

      res.json({ 
        message: 'Activities regenerated successfully',
        activities: newActivities
      });
    } catch (error) {
      console.error('Regenerate activities error:', error);
      res.status(500).json({ error: 'Failed to regenerate activities' });
    }
  }

  // Get analytics data
  async getAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Total itineraries
      const totalResult = await pool.query('SELECT COUNT(*) as total FROM itineraries');
      const total = totalResult.rows[0].total;

      // Total travelers (exclude admins)
      const usersResult = await pool.query("SELECT COUNT(*) as total FROM users WHERE role = 'Traveler'");
      const totalUsers = usersResult.rows[0].total;

      // Popular destinations
      const destinationsResult = await pool.query(`
        SELECT destination, COUNT(*) as count
        FROM itineraries
        GROUP BY destination
        ORDER BY count DESC
        LIMIT 5
      `);

      // Average budget
      const budgetResult = await pool.query('SELECT AVG(budget) as avgBudget FROM itineraries');
      const avgBudget = budgetResult.rows[0].avgbudget;

      res.json({
        analytics: {
          totalItineraries: total,
          totalUsers,
          popularDestinations: destinationsResult.rows,
          averageBudget: avgBudget
        }
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  }
}
