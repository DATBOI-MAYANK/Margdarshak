import { Injectable } from '@angular/core';

export interface PackingItem {
  id: number;
  name: string;
  category: string;
  packed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PackingListService {

  generatePackingList(destination: string, duration: number, weather: string): PackingItem[] {
    const items: PackingItem[] = [];
    let id = 1;

    // Essentials (always needed)
    const essentials = [
      'Passport/ID',
      'Phone & Charger',
      'Wallet & Credit Cards',
      'Travel Insurance Documents',
      'Flight/Hotel Bookings',
      'Cash (Local Currency)'
    ];
    essentials.forEach(item => {
      items.push({ id: id++, name: item, category: 'Essentials', packed: false });
    });

    // Clothing based on duration
    const clothing = [
      'T-Shirts',
      'Pants/Jeans',
      'Underwear',
      'Socks',
      'Comfortable Walking Shoes',
      'Sleepwear',
      'Casual Outfit'
    ];
    clothing.forEach(item => {
      items.push({ id: id++, name: `${item} (${Math.min(duration, 7)}x)`, category: 'Clothing', packed: false });
    });

    // Weather-specific items
    const weatherLower = weather.toLowerCase();
    if (weatherLower.includes('rain') || weatherLower.includes('shower')) {
      items.push({ id: id++, name: 'Umbrella', category: 'Weather', packed: false });
      items.push({ id: id++, name: 'Waterproof Jacket', category: 'Weather', packed: false });
    }
    if (weatherLower.includes('sun') || weatherLower.includes('clear')) {
      items.push({ id: id++, name: 'Sunglasses', category: 'Weather', packed: false });
      items.push({ id: id++, name: 'Sunscreen', category: 'Weather', packed: false });
      items.push({ id: id++, name: 'Hat/Cap', category: 'Weather', packed: false });
    }
    if (weatherLower.includes('snow') || weatherLower.includes('cold')) {
      items.push({ id: id++, name: 'Winter Jacket', category: 'Weather', packed: false });
      items.push({ id: id++, name: 'Gloves', category: 'Weather', packed: false });
      items.push({ id: id++, name: 'Scarf', category: 'Weather', packed: false });
      items.push({ id: id++, name: 'Warm Boots', category: 'Weather', packed: false });
    }

    // Toiletries
    const toiletries = [
      'Toothbrush & Toothpaste',
      'Shampoo & Conditioner',
      'Deodorant',
      'Skincare Products',
      'Medications',
      'First Aid Kit'
    ];
    toiletries.forEach(item => {
      items.push({ id: id++, name: item, category: 'Toiletries', packed: false });
    });

    // Electronics
    const electronics = [
      'Phone Charger',
      'Power Bank',
      'Universal Adapter',
      'Camera',
      'Headphones'
    ];
    electronics.forEach(item => {
      items.push({ id: id++, name: item, category: 'Electronics', packed: false });
    });

    // Travel Comfort
    const comfort = [
      'Neck Pillow',
      'Eye Mask',
      'Snacks',
      'Water Bottle',
      'Book/Entertainment'
    ];
    comfort.forEach(item => {
      items.push({ id: id++, name: item, category: 'Travel Comfort', packed: false });
    });

    return items;
  }

  getCategories(items: PackingItem[]): string[] {
    return [...new Set(items.map(item => item.category))];
  }

  getItemsByCategory(items: PackingItem[], category: string): PackingItem[] {
    return items.filter(item => item.category === category);
  }

  getPackedCount(items: PackingItem[]): number {
    return items.filter(item => item.packed).length;
  }

  getPackingProgress(items: PackingItem[]): number {
    if (items.length === 0) return 0;
    return Math.round((this.getPackedCount(items) / items.length) * 100);
  }
}
