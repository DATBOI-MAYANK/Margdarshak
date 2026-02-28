import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  FormControl,
} from "@angular/forms";
import { Router } from "@angular/router";
import { ItineraryService } from "../../services/itinerary.service";
import { PageTitleService } from "../../services/page-title.service";
import { CityService } from "../../services/city.service";
import { Observable, of, Subscription } from "rxjs";
import {
  map,
  startWith,
  debounceTime,
  distinctUntilChanged,
  switchMap,
} from "rxjs/operators";
import { DestinationMapComponent } from "../../shared/components/destination-map/destination-map.component";
import { MatAutocompleteSelectedEvent } from "@angular/material/autocomplete";
import { MAPBOX_TOKEN } from "../../config/mapbox.config";

@Component({
  selector: "app-itinerary-creation",
  templateUrl: "./itinerary-creation.component.html",
  styleUrls: ["./itinerary-creation.component.scss"],
})
export class ItineraryCreationComponent implements OnInit, OnDestroy {
  @ViewChild("destinationMap") destinationMap!: DestinationMapComponent;

  itineraryForm!: FormGroup;
  loading = false;
  errorMessage = "";
  minDate = new Date();

  // City autocomplete
  filteredCities!: Observable<string[]>;
  destinationControl = new FormControl("", [Validators.required]);
  isSearching = false;
  selectedDestinationCoords: [number, number] | null = null;

  // Source location
  sourceMode: 'current' | 'custom' = 'current';
  sourceControl = new FormControl("");
  filteredSourceCities!: Observable<string[]>;
  isSourceSearching = false;
  isRefreshingSource = false;
  sourceLocationName: string = '';
  selectedSourceCoords: [number, number] | null = null;
  private currentLocationCoords: [number, number] | null = null;

  constructor(
    private fb: FormBuilder,
    private itineraryService: ItineraryService,
    private cityService: CityService,
    private pageTitle: PageTitleService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.itineraryForm = this.fb.group({
      destination: this.destinationControl,
      start_date: ["", [Validators.required]],
      end_date: ["", [Validators.required]],
      budget: [0, [Validators.required, Validators.min(0.01)]],
      preferences: [""],
      notes: [""],
      activities: this.fb.array([]),
    });

    // Setup dynamic city autocomplete with API
    this.filteredCities = this.destinationControl.valueChanges.pipe(
      startWith(""),
      debounceTime(300), // Wait 300ms after user stops typing
      distinctUntilChanged(),
      switchMap((value) => {
        this.isSearching = true;
        if (!value || value.length < 2) {
          this.isSearching = false;
          return of(this.cityService.getPopularDestinations());
        }
        return this.cityService.searchCities(value, 15).pipe(
          map((cities) => {
            this.isSearching = false;
            return cities;
          })
        );
      })
    );

    // Setup source city autocomplete
    this.filteredSourceCities = this.sourceControl.valueChanges.pipe(
      startWith(""),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((value) => {
        this.isSourceSearching = true;
        if (!value || value.length < 2) {
          this.isSourceSearching = false;
          return of(this.cityService.getPopularDestinations());
        }
        return this.cityService.searchCities(value, 15).pipe(
          map((cities) => {
            this.isSourceSearching = false;
            return cities;
          })
        );
      })
    );

    // Detect current location on init
    this.detectCurrentLocation();
  }

  private detectCurrentLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          this.currentLocationCoords = [
            position.coords.longitude,
            position.coords.latitude,
          ];
          if (this.sourceMode === 'current') {
            this.selectedSourceCoords = this.currentLocationCoords;
          }
          // Reverse geocode to get name
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${position.coords.longitude},${position.coords.latitude}.json?access_token=${MAPBOX_TOKEN}&types=place,locality,neighborhood`
            );
            const data = await response.json();
            if (data.features && data.features.length > 0) {
              const parts = data.features[0].place_name.split(', ');
              this.sourceLocationName = parts.slice(0, Math.min(3, parts.length)).join(', ');
            }
          } catch (e) {
            this.sourceLocationName = 'Location detected';
          }
        },
        () => {
          this.sourceLocationName = 'Could not detect location';
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }

  setSourceMode(mode: 'current' | 'custom'): void {
    this.sourceMode = mode;
    if (mode === 'current') {
      this.selectedSourceCoords = this.currentLocationCoords;
      // Update the map to use current location
      if (this.destinationMap && this.currentLocationCoords) {
        this.destinationMap.updateSource(this.sourceLocationName, this.currentLocationCoords);
      }
    } else {
      // If custom mode and we have a previously selected custom source, keep it
      if (!this.selectedSourceCoords || this.selectedSourceCoords === this.currentLocationCoords) {
        this.selectedSourceCoords = null;
        this.sourceLocationName = '';
      }
    }
  }

  refreshSourceLocation(): void {
    this.isRefreshingSource = true;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          this.currentLocationCoords = [
            position.coords.longitude,
            position.coords.latitude,
          ];
          this.selectedSourceCoords = this.currentLocationCoords;
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${position.coords.longitude},${position.coords.latitude}.json?access_token=${MAPBOX_TOKEN}&types=place,locality,neighborhood`
            );
            const data = await response.json();
            if (data.features && data.features.length > 0) {
              const parts = data.features[0].place_name.split(', ');
              this.sourceLocationName = parts.slice(0, Math.min(3, parts.length)).join(', ');
            }
          } catch (e) {
            this.sourceLocationName = 'Location detected';
          }
          // Update map
          if (this.destinationMap) {
            this.destinationMap.updateSource(this.sourceLocationName, this.currentLocationCoords!);
          }
          this.isRefreshingSource = false;
        },
        () => {
          this.isRefreshingSource = false;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      this.isRefreshingSource = false;
    }
  }

  onSourceSelected(event: MatAutocompleteSelectedEvent): void {
    const selectedCity = event.option.value;
    if (selectedCity) {
      this.cityService.getCoordinates(selectedCity).subscribe((coords) => {
        if (coords) {
          this.selectedSourceCoords = coords;
          this.sourceLocationName = selectedCity;
          if (this.destinationMap) {
            this.destinationMap.updateSource(selectedCity, coords);
          }
        }
      });
    }
  }

  onDestinationSelected(event: any): void {
    const selectedCity = event.option.value;
    if (selectedCity) {
      this.cityService.getCoordinates(selectedCity).subscribe((coords) => {
        if (coords && this.destinationMap) {
          this.selectedDestinationCoords = coords;
          this.destinationMap.updateDestination(selectedCity, coords);
        }
      });
    }
  }

  get activities(): FormArray {
    return this.itineraryForm.get("activities") as FormArray;
  }

  addActivity(): void {
    const activityGroup = this.fb.group({
      name: ["", Validators.required],
      time: ["", Validators.required],
      duration: ["", Validators.required],
      estimatedCost: [0, Validators.min(0)],
      location: [""],
    });
    this.activities.push(activityGroup);
  }

  removeActivity(index: number): void {
    this.activities.removeAt(index);
  }

  private apiCompleted = false;
  private apiError = false;
  private apiResponse: any = null;
  private iconTimeouts: any[] = [];
  private animationTimeout: any = null;

  onSubmit(): void {
    if (this.itineraryForm.invalid) return;

    const startDate = new Date(this.itineraryForm.value.start_date);
    const endDate = new Date(this.itineraryForm.value.end_date);

    if (endDate < startDate) {
      this.errorMessage = "End date must be after start date";
      return;
    }

    // Reset state
    this.loading = true;
    this.loadingPhase = 1;
    this.currentIconIndex = 0;
    this.errorMessage = "";
    this.apiCompleted = false;
    this.apiError = false;
    this.apiResponse = null;
    this.clearAnimationTimeouts();

    const formData = {
      ...this.itineraryForm.value,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
    };

    const ICON_DURATION = 1200; // Slightly faster icons
    const TOTAL_ICON_TIME = ICON_DURATION * this.barrelIcons.length;
    const MIN_RUNNER_TIME = 800;

    // 🔁 ICON SEQUENCE
    this.barrelIcons.forEach((_, index) => {
      const timeout = setTimeout(() => {
        if (this.loading && !this.apiError) {
          this.currentIconIndex = index;
        }
      }, ICON_DURATION * index);
      this.iconTimeouts.push(timeout);
    });

    // 🚀 API CALL (parallel)
    this.itineraryService.createItinerary(formData).subscribe({
      next: (response) => {
        this.apiResponse = response;
        this.apiCompleted = true;
        // If animations are done, navigate immediately
        this.checkAndNavigate();
      },
      error: (error) => {
        this.apiError = true;
        this.clearAnimationTimeouts();
        this.stopRunnerAnimation();
        this.loading = false;
        this.loadingPhase = 1;
        
        // Better error messages
        if (error.status === 408 || error.name === 'TimeoutError') {
          this.errorMessage = "Request timed out. The server might be busy. Please try again.";
        } else if (error.status === 0) {
          this.errorMessage = "Network error. Please check your internet connection.";
        } else if (error.status === 401) {
          this.errorMessage = "Session expired. Please log in again.";
        } else {
          this.errorMessage = error.error?.error || "Failed to create itinerary. Please try again.";
        }
      },
    });

    // 🎬 AFTER ICONS → RUNNER
    this.animationTimeout = setTimeout(() => {
      if (this.apiError) return;
      
      this.loadingPhase = 0 as any;

      setTimeout(() => {
        if (this.apiError) return;
        
        this.loadingPhase = 2;
        this.startRunnerAnimation();

        // Check if API already completed
        setTimeout(() => {
          this.checkAndNavigate();
        }, MIN_RUNNER_TIME);
      }, 50);
    }, TOTAL_ICON_TIME);
  }

  private clearAnimationTimeouts(): void {
    this.iconTimeouts.forEach(t => clearTimeout(t));
    this.iconTimeouts = [];
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
      this.animationTimeout = null;
    }
  }

  private checkAndNavigate(): void {
    // Only navigate if API completed successfully and we're in runner phase (or past icon phase)
    if (!this.apiCompleted || this.apiError || !this.apiResponse) return;
    if (this.loadingPhase !== 2 && this.loading) return; // Still in icon animation
    
    this.loading = false;
    this.stopRunnerAnimation();
    
    const destination = this.itineraryForm.value.destination;
    if (destination) {
      this.pageTitle.setDestination(destination);
    }
    
    const createdId = this.apiResponse?.itinerary?.id;
    if (createdId) {
      this.router.navigate(["/itineraries", createdId]);
    } else {
      this.router.navigate(["/itineraries"]);
    }
  }

  ngOnDestroy(): void {
    this.clearAnimationTimeouts();
    this.stopRunnerAnimation();
  }

  cancel(): void {
    this.router.navigate(["/itineraries"]);
  }

  loadingPhase: 1 | 2 = 1;

  barrelIcons: string[] = [
    "assets/icons/newform/g1.svg",
    "assets/icons/newform/g2.svg",
    "assets/icons/newform/g3.svg",
    "assets/icons/newform/g4.svg",
    "assets/icons/newform/g5.svg",
  ];

  currentIconIndex = 0;

  runnerFrames: string[] = [
    "assets/icons/newform/run1.svg",
    "assets/icons/newform/run2.svg",
  ];

  currentRunnerFrame = 0;
  runnerInterval!: any;

  startRunnerAnimation() {
    this.currentRunnerFrame = 0;
    this.runnerX = -30;

    this.runnerInterval = setInterval(() => {
      // Alternate legs
      this.currentRunnerFrame =
        (this.currentRunnerFrame + 1) % this.runnerFrames.length;

      // Move forward
      this.runnerX += this.runnerStep;

      // Stop when fully out on right
      if (this.runnerX > 260) {
        // approx button width
        this.stopRunnerAnimation();
      }
    }, 80); // FAST cadence → realistic run
  }

  stopRunnerAnimation() {
    clearInterval(this.runnerInterval);
  }

  runnerX = -70; // start outside left
  runnerStep = 8; // how much it moves each step (px)
}
