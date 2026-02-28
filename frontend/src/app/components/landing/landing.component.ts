import { Component, HostListener, ViewChild, ElementRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: "app-landing",
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatToolbarModule, MatIconModule],
  templateUrl: "./landing.component.html",
  styleUrls: ["./landing.component.css"],
})
export class LandingComponent {
  hasUserScrolled = false;
  indicatorInitialized = false;

  /* ===============================
     HEADER + NAV STATE
  =============================== */

  headerVisible = false;
  activeSection = "home";
  // Show the landing header only on wider screens; hide on phones to avoid duplicate navbars
  showLandingHeader = window.innerWidth > 640;

  @ViewChild("navIndicator")
  navIndicator!: ElementRef;

  /* ===============================
     AUTH BUTTON STATE
  =============================== */

  animating = false;

  constructor(private router: Router) {}

  /* ===============================
     RESIZE HANDLING
  =============================== */
  @HostListener("window:resize")
  onResize(): void {
    // Update header visibility based on screen width
    this.showLandingHeader = window.innerWidth > 640;
    
    // Re-position nav indicator if visible
    if (this.headerVisible && this.showLandingHeader) {
      this.moveNavIndicator();
    }
  }

  /* ===============================
     SCROLL HANDLING
  =============================== */
  @HostListener("window:scroll")
  onScroll(): void {
    const scrollY = window.scrollY || 0;

    // Nav visibility based on scroll
    const shouldShowNav = scrollY > 20;

    // Detect nav appearing for the first time
    if (shouldShowNav && !this.headerVisible) {
      this.headerVisible = true;

      // 🔑 FORCE indicator to start at Home
      this.activeSection = "home";
      this.indicatorInitialized = false;
      this.moveNavIndicator();
      return;
    }

    // Hide nav + indicator when back to top
    if (!shouldShowNav) {
      this.headerVisible = false;
      this.indicatorInitialized = false;
      this.resetIndicator();
      return;
    }

    // Normal scroll behavior
    this.headerVisible = true;
    this.updateActiveSection();
  }

  private resetIndicator(): void {
    if (!this.navIndicator) return;

    const indicatorEl = this.navIndicator.nativeElement as HTMLElement;

    indicatorEl.style.opacity = "0";
    indicatorEl.style.width = "0";
  }

  private updateActiveSection(): void {
    const scrollY = window.scrollY || 0;
    const viewportBottom = scrollY + window.innerHeight;
    const pageHeight = document.documentElement.scrollHeight;

    /* ===============================
     EDGE CASE 1: Bottom of page
     =============================== */
    if (viewportBottom >= pageHeight - 5) {
      if (this.activeSection !== "contact" || !this.indicatorInitialized) {
        this.activeSection = "contact";
        this.moveNavIndicator();
      }
      return;
    }

    const homeEl = document.getElementById("home");
    const featuresEl = document.getElementById("features");
    const howEl = document.getElementById("how");
    const aboutEl = document.getElementById("about");
    const contactEl = document.getElementById("contact");

    const referenceLine = 140; // SAME value you already use

    let currentSection = this.activeSection || "home";

    /* ===============================
     NORMAL SECTION DETECTION
     =============================== */
    if (contactEl && contactEl.getBoundingClientRect().top <= referenceLine) {
      currentSection = "contact";
    } else if (
      aboutEl &&
      aboutEl.getBoundingClientRect().top <= referenceLine
    ) {
      currentSection = "about";
    } else if (howEl && howEl.getBoundingClientRect().top <= referenceLine) {
      /* ===============================
       EDGE CASE 2: Showcase → HOW
       =============================== */
      currentSection = "how";
    } else if (
      featuresEl &&
      featuresEl.getBoundingClientRect().top <= referenceLine
    ) {
      currentSection = "features";
    } else if (homeEl) {
      currentSection = "home";
    }

    if (currentSection !== this.activeSection || !this.indicatorInitialized) {
      this.activeSection = currentSection;
      this.moveNavIndicator();
    }
  }

  private moveNavIndicator(): void {
    if (!this.navIndicator || !this.headerVisible) return;

    const headerEl = document.querySelector(".landing-header") as HTMLElement;
    if (!headerEl) return;

    const activeLink = document.querySelector(
      `.nav-links a[data-section="${this.activeSection}"]`
    ) as HTMLElement;

    if (!activeLink) return;

    const linkRect = activeLink.getBoundingClientRect();
    const headerRect = headerEl.getBoundingClientRect();

    const indicatorEl = this.navIndicator.nativeElement as HTMLElement;

    const extraPadding = 10;

    indicatorEl.style.left =
      linkRect.left - headerRect.left - extraPadding + "px";

    indicatorEl.style.width = linkRect.width + extraPadding * 2 + "px";

    // 🔑 SHOW indicator
    indicatorEl.style.opacity = "1";
    this.indicatorInitialized = true;
  }

  /* ===============================
     AUTH BUTTON ANIMATION
  =============================== */

  onAuthClick(): void {
    if (this.animating) return;

    // Respect reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.router.navigate(["/login"]);
      return;
    }

    this.animating = true;

    const btn = document.querySelector(".auth-animate-btn") as HTMLElement;

    if (!btn) return;

    const text = btn.querySelector(".text-layer") as HTMLElement;

    // Phase 1: Expand button
    btn.classList.add("animate");

    // Phase 2: Hide text
    setTimeout(() => {
      text?.classList.add("hide");
    }, 260);

    // Phase 3: Fade out button
    setTimeout(() => {
      btn.classList.add("fade-out");
    }, 1400);

    // Phase 4: Navigate
    setTimeout(() => {
      this.router.navigate(["/login"]);
    }, 1400);
  }
  ngAfterViewInit(): void {
    const track = document.getElementById("showcaseTrack");
    if (!track) return;

    const positions = ["pos-1", "pos-2", "pos-3", "pos-4", "pos-5"];

    setInterval(() => {
      const items = Array.from(track.children) as HTMLElement[];

      items.forEach((item) => {
        const currentPos = positions.find((p) => item.classList.contains(p));
        if (!currentPos) return;

        const index = positions.indexOf(currentPos);
        item.classList.remove(currentPos);

        const nextIndex = (index + 1) % positions.length;
        item.classList.add(positions[nextIndex]);
      });
    }, 3000); // 🔑 speed of circulation
  }
}
