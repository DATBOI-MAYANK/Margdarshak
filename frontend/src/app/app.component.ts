import { Component, OnInit } from "@angular/core";
import { Title } from "@angular/platform-browser";

@Component({
  selector: "app-root",
  template: `
    <app-navbar></app-navbar>
    <router-outlet></router-outlet>
  `,
  styles: [],
})
export class AppComponent implements OnInit {
  constructor(private title: Title) {}

  ngOnInit(): void {
    // ✅ Default tab title on app load
    this.title.setTitle("Voyage.IQ - Journey Planner");
  }
}
