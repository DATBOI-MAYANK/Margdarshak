import { Injectable } from "@angular/core";
import { Title } from "@angular/platform-browser";

@Injectable({ providedIn: "root" })
export class PageTitleService {
  private readonly baseTitle = "Voyage.IQ";

  constructor(private title: Title) {}

  setDefault() {
    this.title.setTitle(`${this.baseTitle} - Journey Planner`);
  }

  setDestination(destination: string) {
    if (!destination) {
      this.setDefault();
      return;
    }

    const firstWord = destination
      .split(/[ ,]/)[0] // split by space OR comma
      .trim();
    this.title.setTitle(`${this.baseTitle} - ${firstWord}`);
  }
}
