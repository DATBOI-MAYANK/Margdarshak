import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import * as mapboxgl from 'mapbox-gl';
import { MAPBOX_TOKEN } from '../../../config/mapbox.config';
import { TransportOption, TransportMode } from '../../../models/transport.model';

/* ── Colours per transport mode ── */
const MODE_COLORS: Record<TransportMode, string> = {
  flight: '#7c4dff',
  train: '#00bcd4',
  bus: '#ff9800',
};

const MODE_GLOW: Record<TransportMode, string> = {
  flight: 'rgba(124, 77, 255, .4)',
  train: 'rgba(0, 188, 212, .4)',
  bus: 'rgba(255, 152, 0, .4)',
};

@Component({
  selector: 'app-transport-route-map',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatChipsModule],
  template: `
    <div class="route-map-wrapper" [class.expanded]="isExpanded">
      <!-- Legend -->
      <div class="map-legend">
        <span class="legend-item" *ngFor="let m of modes"
              [class.active]="activeMode === m || activeMode === 'all'"
              (click)="toggleMode(m)">
          <span class="legend-dot" [style.background]="modeColor(m)"></span>
          {{ m | titlecase }}
        </span>
        <span class="legend-item" [class.active]="activeMode === 'all'"
              (click)="toggleMode('all')">
          <span class="legend-dot" style="background: linear-gradient(135deg,#7c4dff,#00bcd4,#ff9800);"></span>
          All
        </span>
        <button mat-icon-button class="expand-btn" (click)="toggleExpand()">
          <mat-icon>{{ isExpanded ? 'fullscreen_exit' : 'fullscreen' }}</mat-icon>
        </button>
      </div>

      <!-- Map container -->
      <div #routeMapContainer class="route-map-container"></div>

      <!-- Route info overlay -->
      <div class="route-info" *ngIf="selectedOption">
        <mat-icon>{{ modeIconName(selectedOption.mode) }}</mat-icon>
        <div class="route-info-text">
          <strong>{{ selectedOption.provider }}</strong>
          <span>{{ formatDuration(selectedOption.durationMinutes) }} · {{ selectedOption.totalPrice | currency:'INR' }}</span>
        </div>
      </div>

      <!-- Distance badge -->
      <div class="distance-badge" *ngIf="distance > 0">
        <mat-icon>straighten</mat-icon>
        {{ distance }} km
      </div>
    </div>
  `,
  styles: [
    `
    .route-map-wrapper {
      position: relative;
      border-radius: 16px;
      overflow: hidden;
      height: 340px;
      margin-bottom: 20px;
      border: 1px solid rgba(255,255,255,.1);
    }
    .route-map-wrapper.expanded {
      height: 540px;
    }

    .route-map-container {
      width: 100%;
      height: 100%;
    }

    /* Legend bar */
    .map-legend {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(26, 15, 46, .85);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.12);
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,.5);
      cursor: pointer;
    }
    .legend-item.active {
      color: #fff;
      background: rgba(255,255,255,.12);
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }
    .expand-btn {
      margin-left: auto;
      color: rgba(255,255,255,.6);
    }

    /* Route info */
    .route-info {
      position: absolute;
      bottom: 14px;
      left: 14px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      background: rgba(26, 15, 46, .9);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.12);
      color: #fff;
    }
    .route-info mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: #ba55d3;
    }
    .route-info-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .route-info-text strong {
      font-size: 14px;
    }
    .route-info-text span {
      font-size: 12px;
      color: rgba(255,255,255,.6);
    }

    /* Distance badge */
    .distance-badge {
      position: absolute;
      bottom: 14px;
      right: 14px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: rgba(26, 15, 46, .9);
      backdrop-filter: blur(12px);
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,.12);
      font-size: 13px;
      font-weight: 700;
      color: rgba(255,255,255,.8);
    }
    .distance-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #ba55d3;
    }

    @media (max-width: 600px) {
      .route-map-wrapper { height: 260px; }
      .route-map-wrapper.expanded { height: 420px; }
    }
    `,
  ],
})
export class TransportRouteMapComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild('routeMapContainer', { static: true })
  mapElRef!: ElementRef<HTMLElement>;

  /** Source / destination city names */
  @Input() source = '';
  @Input() destination = '';

  /** All transport options from the search (used to draw multi-mode routes) */
  @Input() options: TransportOption[] = [];

  /** Currently selected / highlighted option */
  @Input() selectedOption: TransportOption | null = null;

  map!: mapboxgl.Map;
  private sourceCoords: [number, number] | null = null;
  private destCoords: [number, number] | null = null;
  private mapReady = false;
  private accessToken = MAPBOX_TOKEN;
  private sourceMarker?: mapboxgl.Marker;
  private destMarker?: mapboxgl.Marker;

  modes: TransportMode[] = ['flight', 'train', 'bus'];
  activeMode: TransportMode | 'all' = 'all';
  distance = 0;
  isExpanded = false;

  /* ───── lifecycle ───── */

  ngAfterViewInit(): void {
    (mapboxgl as any).accessToken = this.accessToken;
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      (changes['source'] || changes['destination']) &&
      this.source &&
      this.destination
    ) {
      this.geocodeAndDraw();
    }
    if (changes['selectedOption'] && this.mapReady) {
      this.highlightOption();
    }
    if (changes['options'] && this.mapReady && this.sourceCoords && this.destCoords) {
      this.drawAllRoutes();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  /* ───── map init ───── */

  private initMap(): void {
    this.map = new mapboxgl.Map({
      container: this.mapElRef.nativeElement,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [78.9629, 20.5937], // Default: India center
      zoom: 4,
      pitch: 30,
    });

    this.map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'bottom-right'
    );

    this.map.on('load', () => {
      this.mapReady = true;
      if (this.source && this.destination) {
        this.geocodeAndDraw();
      }
    });
  }

  /* ───── geocoding ───── */

  private async geocodeAndDraw(): Promise<void> {
    if (!this.mapReady) return;

    const [sCoords, dCoords] = await Promise.all([
      this.geocode(this.source),
      this.geocode(this.destination),
    ]);

    if (!sCoords || !dCoords) return;

    this.sourceCoords = sCoords;
    this.destCoords = dCoords;
    this.distance = this.calcDistance(sCoords, dCoords);

    this.placeMarkers();
    this.drawAllRoutes();
    this.fitBounds();
  }

  private async geocode(
    query: string
  ): Promise<[number, number] | null> {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${this.accessToken}&limit=1&types=place,locality`
      );
      const data = await res.json();
      if (data.features?.length) {
        const [lng, lat] = data.features[0].center;
        return [lng, lat];
      }
    } catch (e) {
      console.error('Geocode error:', e);
    }
    return null;
  }

  /* ───── markers ───── */

  private placeMarkers(): void {
    // Remove existing
    if (this.sourceMarker) this.sourceMarker.remove();
    if (this.destMarker) this.destMarker.remove();

    if (!this.sourceCoords || !this.destCoords) return;

    // Source marker
    const sEl = document.createElement('div');
    sEl.innerHTML = `<div style="
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, #4caf50, #81c784);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 12px rgba(76,175,80,.5);
      font-size: 16px; cursor: pointer;
    ">📍</div>`;

    this.sourceMarker = new mapboxgl.Marker(sEl)
      .setLngLat(this.sourceCoords)
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="padding:8px;font-family:Poppins,sans-serif;">
            <strong style="color:#2b1d44">🚀 ${this.source}</strong><br>
            <span style="color:#666;font-size:12px">Departure</span>
          </div>`
        )
      )
      .addTo(this.map);

    // Destination marker
    const dEl = document.createElement('div');
    dEl.innerHTML = `<div style="
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, #ff0080, #ff5252);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 12px rgba(255,0,128,.5);
      font-size: 16px; cursor: pointer;
    ">🎯</div>`;

    this.destMarker = new mapboxgl.Marker(dEl)
      .setLngLat(this.destCoords)
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="padding:8px;font-family:Poppins,sans-serif;">
            <strong style="color:#ff0080">🎯 ${this.destination}</strong><br>
            <span style="color:#666;font-size:12px">Arrival</span>
          </div>`
        )
      )
      .addTo(this.map);
  }

  /* ───── route drawing ───── */

  private drawAllRoutes(): void {
    if (!this.sourceCoords || !this.destCoords) return;

    // Determine which modes have options
    const presentModes = new Set<TransportMode>();
    this.options.forEach((o) => presentModes.add(o.mode));

    // Always draw all three — even if no real option, still show a faint path
    for (const mode of this.modes) {
      this.drawModeRoute(
        mode,
        this.sourceCoords,
        this.destCoords,
        presentModes.has(mode)
      );
    }

    this.highlightOption();
  }

  private drawModeRoute(
    mode: TransportMode,
    start: [number, number],
    end: [number, number],
    hasData: boolean
  ): void {
    const routeId = `route-${mode}`;
    const glowId = `route-${mode}-glow`;

    // Remove if existing
    if (this.map.getLayer(glowId)) this.map.removeLayer(glowId);
    if (this.map.getLayer(routeId)) this.map.removeLayer(routeId);
    if (this.map.getSource(routeId)) this.map.removeSource(routeId);

    // Visibility
    const show =
      this.activeMode === 'all' || this.activeMode === mode;

    // Build coordinates based on mode
    let coords: [number, number][];

    switch (mode) {
      case 'flight':
        // High curved arc
        coords = this.generateArc(start, end, 0.35, 60);
        break;
      case 'train':
        // Slightly curved (low arc) to signify rail
        coords = this.generateArc(start, end, 0.12, 40);
        break;
      case 'bus':
        // Nearly straight / slight curve (road feel)
        coords = this.generateArc(start, end, 0.05, 30);
        break;
    }

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    };

    this.map.addSource(routeId, { type: 'geojson', data: geojson });

    // Glow layer
    this.map.addLayer({
      id: glowId,
      type: 'line',
      source: routeId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
        visibility: show ? 'visible' : 'none',
      },
      paint: {
        'line-color': MODE_GLOW[mode],
        'line-width': hasData ? 10 : 4,
        'line-blur': hasData ? 10 : 4,
        'line-opacity': hasData ? 0.55 : 0.2,
      },
    });

    // Main line
    const dashArray: number[] | undefined =
      mode === 'flight'
        ? [2, 3]
        : mode === 'train'
        ? [4, 2]
        : undefined; // bus = solid

    this.map.addLayer({
      id: routeId,
      type: 'line',
      source: routeId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
        visibility: show ? 'visible' : 'none',
      },
      paint: {
        'line-color': MODE_COLORS[mode],
        'line-width': hasData ? 3 : 1.5,
        'line-opacity': hasData ? 1 : 0.35,
        ...(dashArray ? { 'line-dasharray': dashArray as any } : {}),
      },
    });
  }

  private highlightOption(): void {
    if (!this.selectedOption) return;
    // Bring the selected mode's layers to top with stronger appearance
    const selMode = this.selectedOption.mode;
    for (const mode of this.modes) {
      const routeId = `route-${mode}`;
      const glowId = `route-${mode}-glow`;
      const isSelected = mode === selMode;
      if (this.map.getLayer(routeId)) {
        this.map.setPaintProperty(
          routeId,
          'line-width',
          isSelected ? 4.5 : 2
        );
        this.map.setPaintProperty(
          routeId,
          'line-opacity',
          isSelected ? 1 : 0.3
        );
      }
      if (this.map.getLayer(glowId)) {
        this.map.setPaintProperty(
          glowId,
          'line-width',
          isSelected ? 14 : 4
        );
        this.map.setPaintProperty(
          glowId,
          'line-opacity',
          isSelected ? 0.65 : 0.15
        );
      }
    }
  }

  /* ───── geometry helpers ───── */

  /** Quadratic Bézier arc between two points. arcHeight is fraction of distance. */
  private generateArc(
    start: [number, number],
    end: [number, number],
    arcHeight: number,
    segments: number
  ): [number, number][] {
    const midLng = (start[0] + end[0]) / 2;
    const midLat = (start[1] + end[1]) / 2;

    // Offset midpoint upward (perpendicular to line direction) for arc
    const dLng = end[0] - start[0];
    const dLat = end[1] - start[1];
    const dist = Math.sqrt(dLng * dLng + dLat * dLat);

    // Perpendicular offset (rotate 90°)
    const offsetLng = (-dLat / dist) * dist * arcHeight;
    const offsetLat = (dLng / dist) * dist * arcHeight;

    const control: [number, number] = [
      midLng + offsetLng,
      midLat + offsetLat,
    ];

    const pts: [number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x =
        (1 - t) * (1 - t) * start[0] +
        2 * (1 - t) * t * control[0] +
        t * t * end[0];
      const y =
        (1 - t) * (1 - t) * start[1] +
        2 * (1 - t) * t * control[1] +
        t * t * end[1];
      pts.push([x, y]);
    }
    return pts;
  }

  private calcDistance(a: [number, number], b: [number, number]): number {
    const R = 6371;
    const dLat = this.toRad(b[1] - a[1]);
    const dLon = this.toRad(b[0] - a[0]);
    const lat1 = this.toRad(a[1]);
    const lat2 = this.toRad(b[1]);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
  }

  private toRad(d: number): number {
    return (d * Math.PI) / 180;
  }

  private fitBounds(): void {
    if (!this.sourceCoords || !this.destCoords) return;
    const bounds = new mapboxgl.LngLatBounds()
      .extend(this.sourceCoords)
      .extend(this.destCoords);
    this.map.fitBounds(bounds, {
      padding: { top: 70, bottom: 60, left: 60, right: 60 },
      duration: 1200,
    });
  }

  /* ───── UI helpers ───── */

  toggleMode(mode: TransportMode | 'all'): void {
    this.activeMode = mode;
    for (const m of this.modes) {
      const show = mode === 'all' || mode === m;
      const vis = show ? 'visible' : 'none';
      if (this.map.getLayer(`route-${m}`))
        this.map.setLayoutProperty(`route-${m}`, 'visibility', vis);
      if (this.map.getLayer(`route-${m}-glow`))
        this.map.setLayoutProperty(`route-${m}-glow`, 'visibility', vis);
    }
  }

  toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
    setTimeout(() => this.map?.resize(), 350);
  }

  modeColor(mode: TransportMode): string {
    return MODE_COLORS[mode];
  }

  modeIconName(mode: string): string {
    switch (mode) {
      case 'bus':
        return 'directions_bus';
      case 'train':
        return 'train';
      case 'flight':
        return 'flight';
      default:
        return 'commute';
    }
  }

  formatDuration(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
}
