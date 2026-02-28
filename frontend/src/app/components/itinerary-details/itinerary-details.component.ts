import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  HostListener,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { ItineraryService } from "../../services/itinerary.service";
import { Itinerary, Activity } from "../../models/itinerary.model";
import {
  WeatherService,
  WeatherData,
  CurrentWeather,
} from "../../services/weather.service";
import { PdfExportService } from "../../services/pdf-export.service";
import { PageTitleService } from "../../services/page-title.service";
import {
  PackingListService,
  PackingItem,
} from "../../services/packing-list.service";
import { CurrencyService, Currency } from "../../services/currency.service";
import {
  TranslationService,
  Language,
  TranslationResult,
} from "../../services/translation.service";
import { TimezoneService, TimezoneInfo } from "../../services/timezone.service";
import { CollaborationService } from "../../services/collaboration.service";import { HotelService, Hotel } from '../../services/hotel.service';import { getApiBase } from '../../core/services/runtime-config';
import { ChartConfiguration, ChartData } from "chart.js";
import { Subscription, interval } from "rxjs";

interface DayGroup {
  day: number;
  date: Date;
  activities: Activity[];
  totalCost: number;
  weather?: WeatherData;
}

@Component({
  selector: "app-itinerary-details",
  templateUrl: "./itinerary-details.component.html",
  styleUrls: ["./itinerary-details.component.scss"],
})
export class ItineraryDetailsComponent implements OnInit, OnDestroy {
  itinerary?: Itinerary;
  loading = true;
  errorMessage = "";
  groupedActivities: DayGroup[] = [];
  regenerating = false;
  translating = false;
  translationEnabled = false;
  translatedNames: Map<string, string> = new Map();
  hasCollaborators = false;

  // Translation language selector
  selectedLanguage: string = "en";
  availableLanguages: Language[] = [];
  showLanguageSelector = false;
  languageSearchQuery: string = "";

  // Weather
  currentWeather?: CurrentWeather;
  weatherForecast: WeatherData[] = [];

  // Charts
  budgetChartData: ChartData<"pie"> = { labels: [], datasets: [] };
  dailySpendingData: ChartData<"bar"> = { labels: [], datasets: [] };

  // Packing List
  packingItems: PackingItem[] = [];
  packingCategories: string[] = [];
  showPackingList = false;

  // Currency Converter
  baseCurrency = "USD";
  targetCurrency = "EUR";
  currencyCode = "USD";
  exchangeRate = 1;
  convertAmount = 100;
  convertedAmount = 0;
  currencies: Currency[] = [];
  showCurrencyConverter = false;

  // Destination Clock
  destinationTimezone: string = "";
  destinationTime: TimezoneInfo | null = null;
  clockSubscription?: Subscription;

  // Hotels
  hotels: Hotel[] = [];
  loadingHotels = false;
  showHotels = false;
  hotelSearchCategory = 'hotels';
  hotelsLoaded = false;
  hotelStarFilter: number = 0;   // 0 = all, 1-5 = min stars
  hotelSortMode: 'recommended' | 'nearest' | 'rated' = 'recommended';
  private _bookingLinksCache = new Map<string, { name: string; icon: string; url: string; color: string }[]>();

  // Media Gallery / Lightbox
  lightboxOpen = false;
  lightboxIndex = 0;

  // Chart options
  pieChartOptions: ChartConfiguration<"pie">["options"] = {
    responsive: true,
    plugins: {
      legend: { position: "right" },
    },
  };

  barChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    scales: {
      y: { beginAtZero: true, title: { display: true, text: "Cost ($)" } },
    },
    plugins: {
      legend: { display: false },
    },
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private itineraryService: ItineraryService,
    private weatherService: WeatherService,
    private pageTitle: PageTitleService,
    private pdfExportService: PdfExportService,
    private packingListService: PackingListService,
    private currencyService: CurrencyService,
    private translationService: TranslationService,
    private timezoneService: TimezoneService,
    private collaborationService: CollaborationService,
    private hotelService: HotelService,
    private cdr: ChangeDetectorRef
  ) {
    this.currencies = this.currencyService.currencies;
    this.availableLanguages = this.translationService.supportedLanguages;
    this.selectedLanguage = this.translationService.targetLanguage;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.params["id"];
    this.loadItinerary(id);
    this.checkCollaborators(id);
  }

  private checkCollaborators(itineraryId: number): void {
    this.collaborationService.getCollaborators(itineraryId).subscribe({
      next: (response) => {
        this.hasCollaborators =
          response.collaborators && response.collaborators.length > 0;
      },
      error: () => {
        this.hasCollaborators = false;
      },
    });
  }

  ngOnDestroy(): void {
    // Clean up clock subscription
    if (this.clockSubscription) {
      this.clockSubscription.unsubscribe();
    }
  }

  loadItinerary(id: number): void {
    this.loading = true;
    this.itineraryService.getItineraryById(id).subscribe({
      next: (response) => {
        this.itinerary = response.itinerary;
        if (this.itinerary?.destination) {
          this.pageTitle.setDestination(this.itinerary.destination);
        }
        this.groupActivitiesByDay();
        this.loadWeather();
        this.generateCharts();
        this.generatePackingList();
        this.loadCurrencyInfo();
        this.loadDestinationClock(); // Load destination clock
        this.autoTranslateNames(); // Auto-translate on load
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = "Failed to load itinerary";
        this.loading = false;
      },
    });
  }

  /**
   * Automatically extract or translate non-English names
   */
  autoTranslateNames(): void {
    if (!this.itinerary?.activities) {
      console.log("No activities to translate");
      return;
    }

    console.log("Starting autoTranslateNames...");
    console.log(
      "Activities:",
      this.itinerary.activities.map((a) => a.name)
    );

    // Only extract Latin names if target is English
    if (this.selectedLanguage === "en") {
      this.itinerary.activities.forEach((activity) => {
        const extractedLatin = this.translationService.extractLatinName(
          activity.name
        );
        if (extractedLatin) {
          console.log(
            `Extracted Latin from "${activity.name}": "${extractedLatin}"`
          );
          this.translatedNames.set(activity.name, extractedLatin);
        }
      });
    }

    // Find names that still need translation
    const namesToTranslate = this.itinerary.activities
      .map((a) => a.name)
      .filter((name) => {
        const needsTranslation =
          !this.translatedNames.has(name) &&
          this.translationService.needsTranslation(name);
        console.log(`"${name}" needs translation: ${needsTranslation}`);
        return needsTranslation;
      });

    // Get unique names only
    const uniqueNames = [...new Set(namesToTranslate)];

    console.log(`Names to translate (${uniqueNames.length}):`, uniqueNames);

    if (uniqueNames.length === 0) {
      console.log("No names need translation");
      this.translationEnabled = true;
      this.cdr.detectChanges();
      return;
    }

    // Translate remaining names to selected language
    this.translating = true;
    console.log(
      `Translating ${uniqueNames.length} names to ${this.selectedLanguage}:`,
      uniqueNames
    );

    this.translationService
      .translateMultiple(uniqueNames, this.selectedLanguage)
      .subscribe({
        next: (results: TranslationResult[]) => {
          console.log("Translation results received:", results);
          results.forEach((result: TranslationResult) => {
            console.log(
              `Setting translation: "${result.original}" → "${result.translated}"`
            );
            this.translatedNames.set(result.original, result.translated);
          });
          console.log(
            "TranslatedNames map:",
            Array.from(this.translatedNames.entries())
          );
          this.translationEnabled = true;
          this.translating = false;
          this.cdr.detectChanges();
        },
        error: (error: any) => {
          console.error("Auto-translation failed:", error);
          this.translating = false;
          this.cdr.detectChanges();
        },
      });
  }

  /**
   * Change translation language
   */
  changeLanguage(langCode: string): void {
    if (langCode === this.selectedLanguage) return;

    this.selectedLanguage = langCode;
    this.translationService.targetLanguage = langCode;
    this.translatedNames.clear(); // Clear old translations
    this.showLanguageSelector = false;
    this.languageSearchQuery = ""; // Clear search

    // Re-translate with new language
    this.autoTranslateNames();
  }

  /**
   * Toggle language selector dropdown
   */
  toggleLanguageSelector(): void {
    this.showLanguageSelector = !this.showLanguageSelector;
    if (!this.showLanguageSelector) {
      this.languageSearchQuery = ""; // Clear search when closing
    }
  }

  /**
   * Get filtered languages based on search query
   */
  getFilteredLanguages(): Language[] {
    if (!this.languageSearchQuery.trim()) {
      return this.availableLanguages;
    }

    const query = this.languageSearchQuery.toLowerCase().trim();
    return this.availableLanguages.filter(
      (lang) =>
        lang.name.toLowerCase().includes(query) ||
        lang.nativeName.toLowerCase().includes(query) ||
        lang.code.toLowerCase().includes(query)
    );
  }

  /**
   * Get current language info
   */
  getCurrentLanguage(): Language | undefined {
    return this.availableLanguages.find(
      (l) => l.code === this.selectedLanguage
    );
  }

  loadWeather(): void {
    if (!this.itinerary) return;

    // Get current weather
    this.weatherService
      .getCurrentWeather(this.itinerary.destination)
      .subscribe((weather) => {
        this.currentWeather = weather;
      });

    // Get forecast
    const startDate = new Date(this.itinerary.start_date)
      .toISOString()
      .split("T")[0];
    const endDate = new Date(this.itinerary.end_date)
      .toISOString()
      .split("T")[0];

    this.weatherService
      .getWeatherForecast(this.itinerary.destination, startDate, endDate)
      .subscribe((forecast) => {
        this.weatherForecast = forecast;
        // Add weather to grouped activities
        this.groupedActivities.forEach((day, index) => {
          if (forecast[index]) {
            day.weather = forecast[index];
          }
        });
      });
  }

  /**
   * Load destination clock and start real-time updates
   */
  loadDestinationClock(): void {
    if (!this.itinerary) return;

    // Get timezone for the destination
    this.timezoneService
      .getTimezone(this.itinerary.destination)
      .subscribe((timezone) => {
        this.destinationTimezone = timezone;

        // Get initial time
        this.updateDestinationTime();

        // Update every second
        this.clockSubscription = interval(1000).subscribe(() => {
          this.updateDestinationTime();
        });
      });
  }

  /**
   * Update the destination time display
   */
  updateDestinationTime(): void {
    if (this.destinationTimezone) {
      this.destinationTime = this.timezoneService.getCurrentTimeInTimezone(
        this.destinationTimezone
      );
      this.cdr.detectChanges();
    }
  }

  /**
   * Get formatted UTC offset
   */
  getUtcOffset(): string {
    if (this.destinationTime) {
      return this.timezoneService.formatUtcOffset(
        this.destinationTime.utcOffset
      );
    }
    return "";
  }

  /**
   * Get timezone city name
   */
  getTimezoneCityName(): string {
    if (this.destinationTimezone) {
      return this.timezoneService.getTimezoneDisplayName(
        this.destinationTimezone
      );
    }
    return "";
  }

  generateCharts(): void {
    if (!this.itinerary?.activities) return;

    // Budget Pie Chart - Professional colors
    const spent = this.calculateTotalExpenses();
    const remaining = Math.max(0, this.itinerary.budget - spent);

    this.budgetChartData = {
      labels: ["Spent", "Remaining"],
      datasets: [
        {
          data: [spent, remaining],
          backgroundColor: ["#e74c3c", "#27ae60"],
          hoverBackgroundColor: ["#c0392b", "#219a52"],
          borderWidth: 0,
        },
      ],
    };

    // Daily Spending Bar Chart - Gradient-like colors
    const barColors = this.groupedActivities.map((_, i) => {
      const colors = [
        "#667eea",
        "#764ba2",
        "#f093fb",
        "#f5576c",
        "#4facfe",
        "#00f2fe",
      ];
      return colors[i % colors.length];
    });

    this.dailySpendingData = {
      labels: this.groupedActivities.map((g) => `Day ${g.day}`),
      datasets: [
        {
          data: this.groupedActivities.map((g) => g.totalCost),
          backgroundColor: barColors,
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    };
  }

  generatePackingList(): void {
    if (!this.itinerary) return;

    const weather = this.currentWeather?.description || "Partly Cloudy";
    this.packingItems = this.packingListService.generatePackingList(
      this.itinerary.destination,
      this.getDuration(),
      weather
    );
    this.packingCategories = this.packingListService.getCategories(
      this.packingItems
    );
  }

  togglePackingList(): void {
    this.showPackingList = !this.showPackingList;
  }

  togglePackedItem(item: PackingItem): void {
    item.packed = !item.packed;
  }

  getItemsByCategory(category: string): PackingItem[] {
    return this.packingListService.getItemsByCategory(
      this.packingItems,
      category
    );
  }

  getPackingProgress(): number {
    return this.packingListService.getPackingProgress(this.packingItems);
  }

  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      Essentials: "badge",
      Clothing: "checkroom",
      "Weather Gear": "umbrella",
      Toiletries: "shower",
      Electronics: "devices",
      "Travel Comfort": "airline_seat_recline_normal",
      Documents: "description",
      Health: "medical_services",
    };
    return icons[category] || "inventory_2";
  }

  // Currency Converter Methods
  loadCurrencyInfo(): void {
    if (!this.itinerary) return;

    // Auto-detect target currency based on destination
    this.targetCurrency = this.currencyService.getCurrencyForDestination(
      this.itinerary.destination
    );
    this.updateExchangeRate();
  }

  toggleCurrencyConverter(): void {
    this.showCurrencyConverter = !this.showCurrencyConverter;
  }

  updateExchangeRate(): void {
    this.currencyService
      .getExchangeRate(this.baseCurrency, this.targetCurrency)
      .subscribe((rate) => {
        this.exchangeRate = rate;
        this.calculateConversion();
      });
  }

  calculateConversion(): void {
    this.convertedAmount = this.currencyService.convert(
      this.convertAmount,
      this.exchangeRate
    );
  }

  onCurrencyChange(): void {
    this.updateExchangeRate();
  }

  getConvertedBudget(): number {
    if (!this.itinerary) return 0;
    return Number(this.itinerary.budget) * this.exchangeRate;
  }

  getConvertedExpenses(): number {
    return this.calculateTotalExpenses() * this.exchangeRate;
  }

  getCurrencySymbol(code: string): string {
    return this.currencyService.getCurrencySymbol(code);
  }

  async exportToPdf(): Promise<void> {
    if (!this.itinerary) return;
    // Get user name from localStorage
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const travelerName = user.name || user.email || "Valued Guest";
    await this.pdfExportService.exportItineraryToPdf(
      this.itinerary,
      this.groupedActivities,
      travelerName
    );
  }

  groupActivitiesByDay(): void {
    if (!this.itinerary?.activities || !this.itinerary.start_date) {
      this.groupedActivities = [];
      return;
    }

    const startDate = new Date(this.itinerary.start_date);
    const duration = this.getDuration();
    const activitiesPerDay = Math.ceil(
      this.itinerary.activities.length / duration
    );

    this.groupedActivities = [];

    for (let day = 1; day <= duration; day++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + day - 1);

      const startIndex = (day - 1) * activitiesPerDay;
      const endIndex = Math.min(
        startIndex + activitiesPerDay,
        this.itinerary.activities.length
      );
      const dayActivities = this.itinerary.activities.slice(
        startIndex,
        endIndex
      );

      if (dayActivities.length > 0) {
        this.groupedActivities.push({
          day: day,
          date: dayDate,
          activities: dayActivities,
          totalCost: dayActivities.reduce(
            (sum, a) => sum + (a.estimatedCost || 0),
            0
          ),
        });
      }
    }
  }

  calculateTotalExpenses(): number {
    if (!this.itinerary?.activities) return 0;
    return this.itinerary.activities.reduce(
      (sum, activity) => sum + (activity.estimatedCost || 0),
      0
    );
  }

  getTotalCost(): number {
    return this.calculateTotalExpenses();
  }

  getDuration(): number {
    if (!this.itinerary) return 0;
    const start = new Date(this.itinerary.start_date);
    const end = new Date(this.itinerary.end_date);
    return (
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
  }

  getRemainingBudget(): number {
    if (!this.itinerary) return 0;
    return this.itinerary.budget - this.calculateTotalExpenses();
  }

  editItinerary(): void {
    if (this.itinerary?.id) {
      this.router.navigate(["/itineraries", this.itinerary.id, "edit"]);
    }
  }

  deleteItinerary(): void {
    if (
      !this.itinerary?.id ||
      !confirm("Are you sure you want to delete this itinerary?")
    ) {
      return;
    }

    this.itineraryService.deleteItinerary(this.itinerary.id).subscribe({
      next: () => {
        this.router.navigate(["/itineraries"]);
      },
      error: (error) => {
        alert("Failed to delete itinerary");
      },
    });
  }

  regenerateActivities(): void {
    if (!this.itinerary?.id) return;

    if (
      !confirm(
        "This will fetch fresh places from the API and replace your current activities. Continue?"
      )
    ) {
      return;
    }

    this.regenerating = true;

    this.itineraryService.regenerateActivities(this.itinerary.id).subscribe({
      next: (response) => {
        // Update the itinerary with new activities
        if (this.itinerary) {
          this.itinerary.activities = response.activities;
          this.groupActivitiesByDay();
          this.generateCharts();
        }
        this.regenerating = false;
        alert(
          "Activities refreshed successfully with real places from the API!"
        );
      },
      error: (error) => {
        console.error("Failed to regenerate activities:", error);
        this.regenerating = false;
        alert("Failed to refresh activities. Please try again.");
      },
    });
  }

  goBack(): void {
    this.router.navigate(["/itineraries"]);
  }

  shareItinerary(): void {
    if (!this.itinerary) return;

    const shareData = {
      title: `Trip to ${this.itinerary.destination}`,
      text: `Check out my travel itinerary to ${
        this.itinerary.destination
      } from ${new Date(
        this.itinerary.start_date
      ).toLocaleDateString()} to ${new Date(
        this.itinerary.end_date
      ).toLocaleDateString()}!`,
      url: window.location.href,
    };

    // Check if Web Share API is supported
    if (navigator.share) {
      navigator
        .share(shareData)
        .then(() => console.log("Shared successfully"))
        .catch((error) => {
          // Fallback to clipboard
          this.copyToClipboard(shareData);
        });
    } else {
      // Fallback for browsers that don't support Web Share API
      this.copyToClipboard(shareData);
    }
  }

  private copyToClipboard(shareData: {
    title: string;
    text: string;
    url: string;
  }): void {
    const shareText = `${shareData.title}\n${shareData.text}\n\n${shareData.url}`;

    navigator.clipboard
      .writeText(shareText)
      .then(() => {
        alert(
          "✅ Share link copied to clipboard!\n\nYou can now paste it anywhere to share your itinerary."
        );
      })
      .catch(() => {
        // Final fallback - show text to copy manually
        prompt("Copy this link to share your itinerary:", shareData.url);
      });
  }

  getDayName(date: Date): string {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }

  // ==================== Translation Methods ====================

  toggleTranslation(): void {
    this.translationEnabled = !this.translationEnabled;

    // If enabling and no translations yet, trigger translation
    if (this.translationEnabled && this.translatedNames.size === 0) {
      this.autoTranslateNames();
    }
  }

  translateAllActivities(): void {
    if (!this.itinerary?.activities || this.translating) return;

    // Get all activity names that need translation
    const namesToTranslate = this.itinerary.activities
      .map((a) => a.name)
      .filter(
        (name) =>
          !this.translatedNames.has(name) &&
          this.translationService.needsTranslation(name)
      );

    if (namesToTranslate.length === 0) {
      return;
    }

    this.translating = true;

    // Translate all names
    this.translationService.translateMultiple(namesToTranslate).subscribe({
      next: (results: TranslationResult[]) => {
        results.forEach((result: TranslationResult) => {
          this.translatedNames.set(result.original, result.translated);
        });
        this.translating = false;
      },
      error: (error: any) => {
        console.error("Translation failed:", error);
        this.translating = false;
      },
    });
  }

  getDisplayName(activity: Activity): string {
    // First check if we have a translation cached
    const hasTranslation = this.translatedNames.has(activity.name);
    console.log(
      `getDisplayName("${activity.name}"): has translation = ${hasTranslation}`
    );

    if (hasTranslation) {
      const translated = this.translatedNames.get(activity.name)!;
      console.log(`  → Using cached translation: "${translated}"`);
      return translated;
    }

    // Try to extract English from mixed text (e.g., "魯班先師廟 Lo Pan Temple")
    const extractedEnglish = this.translationService.extractEnglishName(
      activity.name
    );
    if (extractedEnglish) {
      console.log(`  → Extracted English: "${extractedEnglish}"`);
      // Cache it for future use
      this.translatedNames.set(activity.name, extractedEnglish);
      return extractedEnglish;
    }

    console.log(`  → No translation yet, returning original`);
    // Return original name (will be translated asynchronously)
    return activity.name;
  }

  getOriginalName(activity: Activity): string {
    return activity.name;
  }

  isEnglish(text: string): boolean {
    return this.translationService.isEnglish(text);
  }

  hasNonEnglishActivities(): boolean {
    if (!this.itinerary?.activities) return false;
    const hasNonEnglish = this.itinerary.activities.some((a) =>
      this.translationService.needsTranslation(a.name)
    );
    console.log("hasNonEnglishActivities:", hasNonEnglish);
    return hasNonEnglish;
  }

  isTranslated(activity: Activity): boolean {
    return (
      this.translatedNames.has(activity.name) &&
      this.translatedNames.get(activity.name) !== activity.name
    );
  }

  // ==================== Media Gallery Methods ====================

  hasMediaFiles(): boolean {
    if (!this.itinerary) return false;
    const mediaPaths = this.itinerary.media_paths as unknown;
    if (!mediaPaths) return false;
    if (typeof mediaPaths === "string") {
      return (mediaPaths as string).trim().length > 0;
    }
    return Array.isArray(mediaPaths) && mediaPaths.length > 0;
  }

  getMediaFiles(): string[] {
    if (!this.itinerary || !this.itinerary.media_paths) return [];

    const mediaPaths = this.itinerary.media_paths as unknown;
    if (typeof mediaPaths === "string") {
      return (mediaPaths as string)
        .split(",")
        .filter((p: string) => p.trim().length > 0);
    }
    return Array.isArray(mediaPaths) ? mediaPaths : [];
  }

  getMediaUrl(path: string): string {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    // Construct URL based on runtime-config
    const baseUrl = getApiBase();
    return `${baseUrl}/${path.trim()}`;
  }

  openLightbox(index: number): void {
    this.lightboxIndex = index;
    this.lightboxOpen = true;
    document.body.style.overflow = "hidden";
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
    document.body.style.overflow = "";
  }

  prevImage(event: Event): void {
    event.stopPropagation();
    const files = this.getMediaFiles();
    this.lightboxIndex = (this.lightboxIndex - 1 + files.length) % files.length;
  }

  nextImage(event: Event): void {
    event.stopPropagation();
    const files = this.getMediaFiles();
    this.lightboxIndex = (this.lightboxIndex + 1) % files.length;
  }

  // ==================== HOTELS ====================

  loadHotels(): void {
    if (!this.itinerary?.destination) return;
    if (this.hotelsLoaded && this.hotelSearchCategory === 'hotels') return;

    this.loadingHotels = true;
    this.hotels = [];
    this._bookingLinksCache.clear();

    if (this.hotelSearchCategory === 'hotels') {
      this.hotelService.searchHotels(this.itinerary.destination, 20).subscribe({
        next: (hotels) => {
          this.hotels = hotels;
          this.loadingHotels = false;
          this.hotelsLoaded = true;
          this.hotelService.loadHotelPhotos(this.hotels);
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadingHotels = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      const categoryMap: Record<string, string> = {
        'restaurants': 'catering.restaurant',
        'cafes': 'catering.cafe',
        'attractions': 'tourism.attraction,tourism.sights',
        'shopping': 'commercial.shopping_mall,commercial.supermarket'
      };
      const category = categoryMap[this.hotelSearchCategory] || 'accommodation.hotel';
      this.hotelService.searchNearbyPlaces(this.itinerary.destination, category, 20).subscribe({
        next: (places) => {
          this.hotels = places;
          this.loadingHotels = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadingHotels = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  onHotelCategoryChange(): void {
    this.hotelsLoaded = false;
    this.hotelStarFilter = 0;
    this.hotelSortMode = 'recommended';
    this._bookingLinksCache.clear();
    this.loadHotels();
  }

  showHotelsTab(): void {
    this.showHotels = true;
    this.showPackingList = false;
    this.showCurrencyConverter = false;
    if (!this.hotelsLoaded) {
      this.loadHotels();
    }
  }

  getAccommodationType(categories: string[]): string {
    return this.hotelService.getAccommodationType(categories);
  }

  formatDistance(meters?: number): string {
    return this.hotelService.formatDistance(meters);
  }

  getStarsArray(stars?: number): number[] {
    if (!stars) return [];
    return Array(Math.round(stars)).fill(0);
  }

  getHotelMapUrl(lat: number, lon: number): string {
    return this.hotelService.getStaticMapUrl(lat, lon);
  }

  openInMaps(lat: number, lon: number, name: string): void {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place_id=${encodeURIComponent(name)}`;
    window.open(url, '_blank');
  }

  // ---- Star Rating Filter ----
  setStarFilter(stars: number): void {
    this.hotelStarFilter = this.hotelStarFilter === stars ? 0 : stars;
  }

  // ---- Sort Mode ----
  setHotelSort(mode: 'recommended' | 'nearest' | 'rated'): void {
    this.hotelSortMode = mode;
  }

  // ---- Filtered + Sorted Hotels ----
  get filteredHotels(): Hotel[] {
    let list = [...this.hotels];

    // Star filter
    if (this.hotelStarFilter > 0) {
      list = list.filter(h => (h.stars || 0) >= this.hotelStarFilter);
    }

    // Sort
    switch (this.hotelSortMode) {
      case 'nearest':
        list.sort((a, b) => (a.distance || 99999) - (b.distance || 99999));
        break;
      case 'rated':
        list.sort((a, b) => (b.stars || 0) - (a.stars || 0) || (b.rating || 0) - (a.rating || 0));
        break;
      case 'recommended':
      default:
        // Smart recommendation: weighted score (stars * 20 + rating * 10 - distance_km * 5)
        list.sort((a, b) => {
          const scoreA = (a.stars || 2) * 20 + (a.rating || 3) * 10 - ((a.distance || 5000) / 1000) * 5;
          const scoreB = (b.stars || 2) * 20 + (b.rating || 3) * 10 - ((b.distance || 5000) / 1000) * 5;
          return scoreB - scoreA;
        });
        break;
    }
    return list;
  }

  // ---- Booking Links ----
  getBookingLinks(hotel: Hotel): { name: string; icon: string; url: string; color: string }[] {
    const hotelName = encodeURIComponent(hotel.name);
    const dest = encodeURIComponent(this.itinerary?.destination || '');
    const fullQuery = encodeURIComponent(`${hotel.name} ${this.itinerary?.destination || ''}`.trim());
    return [
      {
        name: 'Booking.com',
        icon: 'travel_explore',
        url: `https://www.booking.com/searchresults.html?ss=${fullQuery}`,
        color: '#003580'
      },
      {
        name: 'MakeMyTrip',
        icon: 'flight_takeoff',
        url: `https://www.makemytrip.com/hotels/hotel-listing/?searchText=${hotelName}&city=${dest}`,
        color: '#eb2226'
      },
      {
        name: 'OYO',
        icon: 'night_shelter',
        url: `https://www.oyorooms.com/search?location=${dest}&searchType=city`,
        color: '#d1232a'
      },
      {
        name: 'Google Hotels',
        icon: 'hotel',
        url: `https://www.google.com/travel/hotels?q=${fullQuery}`,
        color: '#4285f4'
      }
    ];
  }

  getCachedBookingLinks(hotel: Hotel): { name: string; icon: string; url: string; color: string }[] {
    const key = `${hotel.lat}_${hotel.lon}`;
    if (!this._bookingLinksCache.has(key)) {
      this._bookingLinksCache.set(key, this.getBookingLinks(hotel));
    }
    return this._bookingLinksCache.get(key)!;
  }

  trackByHotelName(index: number, hotel: Hotel): string {
    return `${hotel.name}_${hotel.lat}_${hotel.lon}`;
  }

  onHotelImageError(hotel: Hotel): void {
    hotel.imageUrl = undefined;
    hotel.image = undefined;
  }

  getHotelPhotoUrl(hotel: Hotel): string {
    return this.hotelService.getHotelPhotoUrl(hotel);
  }

  getPlaceholderGradient(hotel: Hotel): string {
    return this.hotelService.getPlaceholderGradient(hotel.categories);
  }

  getPlaceholderIcon(hotel: Hotel): string {
    const type = this.getAccommodationType(hotel.categories).toLowerCase();
    switch (type) {
      case 'hotel': return 'apartment';
      case 'guest house': return 'cottage';
      case 'hostel': return 'bunk_bed';
      case 'motel': return 'night_shelter';
      case 'restaurant': return 'restaurant';
      case 'cafe': return 'local_cafe';
      default: return 'location_city';
    }
  }

  getEstimatedPriceRange(hotel: Hotel): string {
    const stars = hotel.stars || 2;
    if (stars >= 5) return '$$$$$';
    if (stars >= 4) return '$$$$';
    if (stars >= 3) return '$$$';
    if (stars >= 2) return '$$';
    return '$';
  }

  getGooglePhotosUrl(hotel: Hotel): string {
    return this.hotelService.getGooglePhotosUrl(hotel);
  }

  @HostListener("document:keydown", ["$event"])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.lightboxOpen) return;

    switch (event.key) {
      case "Escape":
        this.closeLightbox();
        break;
      case "ArrowLeft":
        this.prevImage(event);
        break;
      case "ArrowRight":
        this.nextImage(event);
        break;
    }
  }
}
