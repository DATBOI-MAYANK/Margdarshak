import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import * as mapboxgl from "mapbox-gl";
import { MAPBOX_TOKEN } from "../../../config/mapbox.config";

@Component({
  selector: "app-destination-map",
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <!-- Backdrop for fullscreen mode -->
    <div class="map-backdrop" *ngIf="isExpanded" (click)="toggleExpand()"></div>

    <div
      #fullscreenContainer
      class="map-container"
      [class.expanded]="isExpanded"
    >
      <!-- Map Header -->
      <div class="map-header">
        <div class="header-left">
          <mat-icon class="map-icon">map</mat-icon>
          <span class="title">Trip Route</span>
        </div>
        <div class="header-right">
          <button
            mat-icon-button
            (click)="refreshMyLocation(); $event.stopPropagation()"
            class="refresh-btn"
            [disabled]="refreshingLocation"
            title="Refresh your live location"
          >
            <mat-icon [class.spinning]="refreshingLocation">my_location</mat-icon>
          </button>
          <button
            mat-icon-button
            (click)="toggleExpand(); $event.stopPropagation()"
            class="expand-btn"
          >
            <mat-icon>{{
              isExpanded ? "fullscreen_exit" : "fullscreen"
            }}</mat-icon>
          </button>
        </div>
      </div>

      <!-- Loading Overlay (outside map container) -->
      <div *ngIf="loading" class="map-loading">
        <mat-spinner diameter="40"></mat-spinner>
        <span>Loading map...</span>
      </div>

      <!-- Map Container (must be empty for Mapbox) -->
      <div #mapContainer class="map-wrapper" [class.hidden]="loading"></div>

      <!-- Distance Info Card -->
      <div class="distance-card" *ngIf="distance && !loading">
        <div class="distance-item">
          <mat-icon>my_location</mat-icon>
          <div class="location-info">
            <span class="label">Source</span>
            <span class="value">{{
              myLocationName || "Detecting location..."
            }}</span>
          </div>
        </div>

        <div class="route-line">
          <div class="line"></div>
          <div class="distance-badge">
            <mat-icon>straighten</mat-icon>
            <span>{{ distance }} km</span>
          </div>
          <div class="line"></div>
        </div>

        <div class="distance-item">
          <mat-icon>place</mat-icon>
          <div class="location-info">
            <span class="label">Destination</span>
            <span class="value">{{
              destinationName || "Select destination"
            }}</span>
          </div>
        </div>

        <div class="travel-info" *ngIf="distance">
          <div class="travel-mode">
            <mat-icon>flight</mat-icon>
            <span>~{{ getFlightTime() }}</span>
          </div>
          <div class="travel-mode">
            <mat-icon>directions_car</mat-icon>
            <span>~{{ getDriveTime() }}</span>
          </div>
        </div>
      </div>

      <!-- No destination message -->
      <div class="no-destination" *ngIf="!destinationName && !loading">
        <mat-icon>travel_explore</mat-icon>
        <span>Select a destination to see the route</span>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }

      .map-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(8px);
        z-index: 999;
        animation: fadeIn 0.3s ease;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .map-container {
        background: rgba(25, 25, 35, 0.9);
        border-radius: 20px;
        border: 1px solid rgba(138, 43, 226, 0.3);
        overflow: hidden;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3),
          0 0 60px rgba(138, 43, 226, 0.1);
      }

      .map-container.expanded {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        border-radius: 0;
      }

      .map-container.expanded .map-wrapper {
        height: calc(100% - 180px);
      }

      .map-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        background: linear-gradient(
          135deg,
          rgba(138, 43, 226, 0.2),
          rgba(186, 85, 211, 0.1)
        );
        border-bottom: 1px solid rgba(138, 43, 226, 0.2);
      }

      .map-header .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .map-header .header-left .map-icon {
        color: #ffffff;
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      .map-header .header-left .title {
        font-family: "Poppins", sans-serif;
        font-size: 1.1rem;
        font-weight: 600;
        color: #ffffff;
      }

      .map-header .refresh-btn {
        color: #00ff80;
        transition: all 0.3s ease;
      }

      .map-header .refresh-btn:hover:not([disabled]) {
        background: rgba(0, 255, 128, 0.15);
      }

      .map-header .refresh-btn[disabled] {
        color: rgba(0, 255, 128, 0.4);
        cursor: not-allowed;
      }

      .map-header .refresh-btn .spinning {
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .map-header .expand-btn {
        color: #ba55d3;
        transition: all 0.3s ease;
      }

      .map-header .expand-btn:hover {
        background: rgba(138, 43, 226, 0.2);
      }

      .map-wrapper {
        height: 300px;
        position: relative;
        background: #1a1a2e;
      }

      .map-wrapper.hidden {
        visibility: hidden;
      }

      .map-wrapper ::ng-deep .mapboxgl-map {
        width: 100%;
        height: 100%;
      }

      .map-wrapper ::ng-deep .mapboxgl-ctrl-logo,
      .map-wrapper ::ng-deep .mapboxgl-ctrl-attrib {
        display: none !important;
      }

      .map-wrapper ::ng-deep .mapboxgl-ctrl-group {
        background: rgba(25, 25, 35, 0.9);
        border: 1px solid rgba(138, 43, 226, 0.3);
        border-radius: 12px;
        overflow: hidden;
      }
      .map-wrapper ::ng-deep .mapboxgl-ctrl-group button {
        filter: brightness(2.5) saturate(1.2);
      }

      .map-wrapper ::ng-deep .mapboxgl-ctrl-group button {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.9) !important;
      }

      .map-wrapper ::ng-deep .mapboxgl-ctrl-group button:hover {
        background: rgba(138, 43, 226, 0.2);
        color: #ffffff;
      }

      .map-loading {
        position: absolute;
        top: 68px; /* Below header */
        left: 0;
        right: 0;
        height: 300px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        background: rgba(10, 10, 10, 0.95);
        z-index: 10;
      }

      .map-container.expanded .map-loading {
        height: calc(100% - 68px);
      }

      .map-loading span {
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.9rem;
      }

      .map-loading ::ng-deep .mat-mdc-progress-spinner circle {
        stroke: #ba55d3;
      }

      .distance-card {
        padding: 20px;
        background: linear-gradient(
          180deg,
          rgba(138, 43, 226, 0.1),
          transparent
        );
      }

      .distance-card .distance-item {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 16px;
        background: rgba(138, 43, 226, 0.1);
        border-radius: 12px;
        border: 1px solid rgba(138, 43, 226, 0.2);
      }

      .distance-card .distance-item mat-icon {
        color: #ba55d3;
        font-size: 22px;
        width: 22px;
        height: 22px;
      }

      .distance-card .distance-item:first-child mat-icon {
        color: #00ff80;
      }

      .distance-card .distance-item:last-of-type mat-icon {
        color: #ff0080;
      }

      .distance-card .distance-item .location-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .distance-card .distance-item .location-info .label {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .distance-card .distance-item .location-info .value {
        font-size: 0.95rem;
        font-weight: 500;
        color: #ffffff;
      }

      .distance-card .route-line {
        display: flex;
        align-items: center;
        padding: 8px 0;
        margin: 0 20px;
      }

      .distance-card .route-line .line {
        flex: 1;
        height: 2px;
        background: linear-gradient(90deg, #00ff80, #ba55d3, #ff0080);
        border-radius: 1px;
      }

      .distance-card .route-line .distance-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        background: linear-gradient(135deg, #8a2be2, #ba55d3);
        border-radius: 20px;
        margin: 0 12px;
        box-shadow: 0 4px 15px rgba(138, 43, 226, 0.4);
      }

      .distance-card .route-line .distance-badge mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #ffffff;
      }

      .distance-card .route-line .distance-badge span {
        font-size: 0.85rem;
        font-weight: 600;
        color: #ffffff;
      }

      .distance-card .travel-info {
        display: flex;
        justify-content: center;
        gap: 24px;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid rgba(138, 43, 226, 0.2);
      }

      .distance-card .travel-info .travel-mode {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: rgba(138, 43, 226, 0.15);
        border-radius: 10px;
        transition: all 0.3s ease;
      }

      .distance-card .travel-info .travel-mode:hover {
        background: rgba(138, 43, 226, 0.25);
      }

      .distance-card .travel-info .travel-mode mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #ba55d3;
      }

      .distance-card .travel-info .travel-mode span {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.9);
        font-weight: 500;
      }

      .no-destination {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 30px;
        gap: 12px;
        color: rgba(255, 255, 255, 0.5);
      }

      .no-destination mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: rgba(138, 43, 226, 0.5);
        animation: pulse 2s ease-in-out infinite;
      }

      .no-destination span {
        font-size: 0.9rem;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 0.5;
          transform: scale(1);
        }
        50% {
          opacity: 1;
          transform: scale(1.1);
        }
      }

      /* Custom markers */
      :host ::ng-deep .marker-my-location {
        width: 24px;
        height: 24px;
        background: #249adf; /* deep blue */
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 20px rgba(0, 255, 128, 0.6),
          0 0 40px rgba(0, 255, 128, 0.3);
        cursor: pointer;
        animation: pulseMarker 2s ease-in-out infinite;
      }

      :host ::ng-deep .marker-destination {
        width: 30px;
        height: 30px;
        background: linear-gradient(135deg, #ff0080, #ff4da6);
        border: 3px solid #ffffff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 0 20px rgba(255, 0, 128, 0.6),
          0 0 40px rgba(255, 0, 128, 0.3);
        cursor: pointer;
      }

      @keyframes pulseMarker {
        0%,
        100% {
          box-shadow: 0 0 20px rgba(0, 255, 128, 0.6),
            0 0 40px rgba(0, 255, 128, 0.3);
        }
        50% {
          box-shadow: 0 0 30px rgba(0, 255, 128, 0.8),
            0 0 60px rgba(0, 255, 128, 0.5);
        }
      }
    `,
  ],
})
export class DestinationMapComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild("mapContainer", { static: true }) mapContainer!: ElementRef;
  @ViewChild("fullscreenContainer", { static: true })
  fullscreenContainer!: ElementRef<HTMLElement>;

  @Input() destinationName: string = "";
  @Input() destinationCoords: [number, number] | null = null;
  @Input() sourceCoords: [number, number] | null = null;
  @Input() sourceName: string = "";
  @Input() useCustomSource: boolean = false;
  @Output() mapReady = new EventEmitter<void>();

  map!: mapboxgl.Map;
  myLocationMarker!: mapboxgl.Marker;
  destinationMarker!: mapboxgl.Marker;
  routeLine: any;

  myLocation: [number, number] = [77.391, 28.535]; // Default: Noida
  myLocationName: string = "";
  distance: number = 0;
  loading: boolean = true;
  isExpanded: boolean = false;
  refreshingLocation: boolean = false;

  private accessToken = MAPBOX_TOKEN;

  ngOnInit(): void {
    (mapboxgl as any).accessToken = this.accessToken;
    document.addEventListener("fullscreenchange", this.onFullscreenChange);
  }

  ngAfterViewInit(): void {
    this.getCurrentLocation();
  }

  getCurrentLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          this.myLocation = [
            position.coords.longitude,
            position.coords.latitude,
          ];
          // Get location name first, then init map
          this.myLocationName = await this.reverseGeocode(this.myLocation);
          this.initMap();
        },
        async (error) => {
          console.warn("Geolocation error:", error);
          // Use default location (Noida) and get its name
          this.myLocationName = await this.reverseGeocode(this.myLocation);
          this.initMap();
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      // Get default location name
      this.reverseGeocode(this.myLocation).then((name) => {
        this.myLocationName = name;
        this.initMap();
      });
    }
  }

  initMap(): void {
    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: "mapbox://styles/mapbox/light-v11",
      center: this.myLocation,
      zoom: 10,
      pitch: 45,
      bearing: -17.6,
    });

    this.map.addControl(new mapboxgl.NavigationControl(), "top-right");

    this.map.on("load", () => {
      this.loading = false;
      this.addMyLocationMarker();

      if (this.destinationCoords) {
        this.updateDestination(this.destinationName, this.destinationCoords);
      }

      this.mapReady.emit();
    });
  }

  addMyLocationMarker(): void {
    const el = document.createElement("div");
    el.className = "marker-my-location";

    this.myLocationMarker = new mapboxgl.Marker(el)
      .setLngLat(this.myLocation)
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px; font-family: Poppins, sans-serif;">
          <strong style="color: #2b1d44;">📍 Your Location</strong><br>
          <span style="color: #666; font-size: 12px;">${
            this.myLocationName || "Current Position"
          }</span>
        </div>
      `)
      )
      .addTo(this.map);
  }

  updateDestination(name: string, coords: [number, number]): void {
    this.destinationName = name;
    this.destinationCoords = coords;

    // Remove existing destination marker
    if (this.destinationMarker) {
      this.destinationMarker.remove();
    }

    // Add destination marker
    const el = document.createElement("div");
    el.className = "marker-destination";

    this.destinationMarker = new mapboxgl.Marker(el)
      .setLngLat(coords)
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px; font-family: Poppins, sans-serif;">
          <strong style="color: #ff0080;">🎯 Destination</strong><br>
          <span style="color: #666; font-size: 12px;">${name}</span>
        </div>
      `)
      )
      .addTo(this.map);

    // Calculate distance
    this.distance = this.calculateDistance(this.myLocation, coords);

    // Draw route
    this.drawRoute(this.myLocation, coords);

    // Fit bounds to show both markers
    const bounds = new mapboxgl.LngLatBounds()
      .extend(this.myLocation)
      .extend(coords);

    this.map.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      duration: 1500,
    });
  }

  drawRoute(start: [number, number], end: [number, number]): void {
    // Remove existing route
    if (this.map.getLayer("route")) {
      this.map.removeLayer("route");
      this.map.removeSource("route");
    }
    if (this.map.getLayer("route-glow")) {
      this.map.removeLayer("route-glow");
    }

    // Create curved line between points
    const midPoint: [number, number] = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2 + Math.abs(end[1] - start[1]) * 0.3,
    ];

    const route = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: this.generateCurve(start, midPoint, end, 50),
      },
    };

    this.map.addSource("route", {
      type: "geojson",
      data: route as any,
    });

    // Glow effect
    this.map.addLayer({
      id: "route-glow",
      type: "line",
      source: "route",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#ba55d3",
        "line-width": 8,
        "line-blur": 8,
        "line-opacity": 0.5,
      },
    });

    // Main route line
    this.map.addLayer({
      id: "route",
      type: "line",
      source: "route",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#ff0080",
        "line-width": 3,
        "line-dasharray": [2, 2],
      },
    });
  }

  generateCurve(
    start: [number, number],
    control: [number, number],
    end: [number, number],
    segments: number
  ): [number, number][] {
    const points: [number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x =
        Math.pow(1 - t, 2) * start[0] +
        2 * (1 - t) * t * control[0] +
        Math.pow(t, 2) * end[0];
      const y =
        Math.pow(1 - t, 2) * start[1] +
        2 * (1 - t) * t * control[1] +
        Math.pow(t, 2) * end[1];
      points.push([x, y]);
    }
    return points;
  }

  calculateDistance(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(coord2[1] - coord1[1]);
    const dLon = this.toRad(coord2[0] - coord1[0]);
    const lat1 = this.toRad(coord1[1]);
    const lat2 = this.toRad(coord2[1]);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  async reverseGeocode(coords: [number, number]): Promise<string> {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords[0]},${coords[1]}.json?access_token=${this.accessToken}&types=place,locality,neighborhood`
      );
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        // Get the most specific location name (city/locality)
        const feature = data.features[0];
        // Extract city and country for cleaner display
        const parts = feature.place_name.split(", ");
        if (parts.length >= 2) {
          // Return "City, Country" or "City, State, Country" for cleaner display
          return parts.slice(0, Math.min(3, parts.length)).join(", ");
        }
        return feature.place_name;
      }
    } catch (error) {
      console.error("Reverse geocode error:", error);
    }
    return "";
  }

  getFlightTime(): string {
    if (!this.distance) return "-";
    const hours = Math.round(this.distance / 800); // ~800 km/h average
    if (hours < 1) return "< 1 hr";
    return `${hours} hr${hours > 1 ? "s" : ""}`;
  }

  getDriveTime(): string {
    if (!this.distance) return "-";
    const hours = Math.round(this.distance / 60); // ~60 km/h average
    if (hours < 1) return "< 1 hr";
    if (hours > 24) {
      const days = Math.round(hours / 24);
      return `${days} day${days > 1 ? "s" : ""}`;
    }
    return `${hours} hr${hours > 1 ? "s" : ""}`;
  }

  refreshMyLocation(): void {
    if (this.refreshingLocation) return;
    this.refreshingLocation = true;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          this.myLocation = [
            position.coords.longitude,
            position.coords.latitude,
          ];
          this.myLocationName = await this.reverseGeocode(this.myLocation);

          // Update marker position
          if (this.myLocationMarker) {
            this.myLocationMarker.setLngLat(this.myLocation);
            this.myLocationMarker.setPopup(
              new mapboxgl.Popup({ offset: 25 }).setHTML(`
                <div style="padding: 8px; font-family: Poppins, sans-serif;">
                  <strong style="color: #2b1d44;">📍 Your Location</strong><br>
                  <span style="color: #666; font-size: 12px;">${this.myLocationName || 'Current Position'}</span>
                </div>
              `)
            );
          }

          // Recalculate route & distance if destination exists
          if (this.destinationCoords) {
            this.distance = this.calculateDistance(this.myLocation, this.destinationCoords);
            this.drawRoute(this.myLocation, this.destinationCoords);

            const bounds = new mapboxgl.LngLatBounds()
              .extend(this.myLocation)
              .extend(this.destinationCoords);
            this.map.fitBounds(bounds, {
              padding: { top: 50, bottom: 50, left: 50, right: 50 },
              duration: 1500,
            });
          } else {
            this.map.flyTo({ center: this.myLocation, zoom: 12, duration: 1500 });
          }

          this.refreshingLocation = false;
        },
        (error) => {
          console.warn('Location refresh failed:', error);
          this.refreshingLocation = false;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      this.refreshingLocation = false;
    }
  }

  updateSource(name: string, coords: [number, number]): void {
    this.myLocation = coords;
    this.myLocationName = name;

    // Update marker position
    if (this.myLocationMarker) {
      this.myLocationMarker.setLngLat(coords);
      this.myLocationMarker.setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px; font-family: Poppins, sans-serif;">
            <strong style="color: #2b1d44;">📍 ${name ? 'Source' : 'Your Location'}</strong><br>
            <span style="color: #666; font-size: 12px;">${name || 'Current Position'}</span>
          </div>
        `)
      );
    }

    // Recalculate route & distance if destination exists
    if (this.destinationCoords) {
      this.distance = this.calculateDistance(coords, this.destinationCoords);
      this.drawRoute(coords, this.destinationCoords);

      const bounds = new mapboxgl.LngLatBounds()
        .extend(coords)
        .extend(this.destinationCoords);
      this.map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        duration: 1500,
      });
    } else {
      this.map.flyTo({ center: coords, zoom: 12, duration: 1500 });
    }
  }

  toggleExpand(): void {
    const shouldExpand = !this.isExpanded;
    this.isExpanded = shouldExpand;

    // Try real fullscreen if supported; otherwise fall back to CSS "expanded" layout.
    if (shouldExpand) {
      document.body.style.overflow = "hidden";

      const el = this.fullscreenContainer?.nativeElement;
      if (
        el &&
        document.fullscreenEnabled &&
        typeof el.requestFullscreen === "function"
      ) {
        el.requestFullscreen().catch(() => {
          // Ignore (user gesture restrictions / browser policy). CSS expanded still works.
        });
      }
    } else {
      document.body.style.overflow = "";
      if (
        document.fullscreenElement &&
        typeof document.exitFullscreen === "function"
      ) {
        document.exitFullscreen().catch(() => {
          // Ignore
        });
      }
    }

    // Resize map after animation completes
    setTimeout(() => {
      if (this.map) {
        this.map.resize();
      }
    }, 450);
  }

  private syncExpandedFromFullscreen(): void {
    const inFullscreen = !!document.fullscreenElement;
    // If user presses ESC, keep UI state consistent.
    if (this.isExpanded !== inFullscreen && inFullscreen) {
      this.isExpanded = true;
      document.body.style.overflow = "hidden";
      return;
    }
    if (!inFullscreen && this.isExpanded && document.fullscreenEnabled) {
      // If fullscreen ended, collapse overlay state as well.
      this.isExpanded = false;
      document.body.style.overflow = "";
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
    if (this.map) {
      this.map.remove();
    }
  }

  private onFullscreenChange = (): void => {
    this.syncExpandedFromFullscreen();
    // Fullscreen changes affect layout; ensure map redraws.
    if (this.map) {
      setTimeout(() => this.map?.resize(), 0);
    }
  };
}
