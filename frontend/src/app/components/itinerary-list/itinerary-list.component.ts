import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { ItineraryService } from "../../services/itinerary.service";
import { Itinerary } from "../../models/itinerary.model";
import { ShareItineraryDialogComponent } from "../../shared/components/share-itinerary-dialog.component";
import { ChatService } from "../../core/services/chat.service";
import { SocketService } from "../../core/services/socket.service";
import { CollaboratorService } from "../../core/services/collaborator.service";
import { Subscription } from "rxjs";

@Component({
  selector: "app-itinerary-list",
  templateUrl: "./itinerary-list.component.html",
  styleUrls: ["./itinerary-list.component.scss"],
})
export class ItineraryListComponent implements OnInit {
  itineraries: Itinerary[] = [];
  loading = true;
  errorMessage = "";

  unreadChatCounts: Record<number, number> = {};
  private subscriptions: Subscription[] = [];
  private unreadRefreshTimer: any;

  // Filters
  destinationFilter = "";
  minBudgetFilter?: number;
  maxBudgetFilter?: number;
  startDateFilter?: string;
  endDateFilter?: string;

  constructor(
    private itineraryService: ItineraryService,
    private router: Router,
    private dialog: MatDialog,
    private chatService: ChatService,
    private socketService: SocketService,
    private collaboratorService: CollaboratorService
  ) {}

  ngOnInit(): void {
    this.loadItineraries();
    this.loadUnreadChatCounts();

    // Best-effort live updates (if websocket is available)
    this.socketService.connect();
    this.subscriptions.push(
      this.socketService.onNotification().subscribe((event) => {
        if (event?.type === "chat" && event?.itineraryId) {
          this.scheduleUnreadRefresh();
        }
      })
    );

    // Auto-refresh when invite is accepted
    this.subscriptions.push(
      this.collaboratorService.inviteAccepted$.subscribe(() => {
        this.loadItineraries();
        this.loadUnreadChatCounts();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    if (this.unreadRefreshTimer) {
      clearTimeout(this.unreadRefreshTimer);
      this.unreadRefreshTimer = null;
    }
  }

  loadItineraries(): void {
    this.loading = true;
    this.errorMessage = "";

    const filters: any = {};
    if (this.destinationFilter) filters.destination = this.destinationFilter;
    if (this.minBudgetFilter !== undefined && this.minBudgetFilter !== null)
      filters.minBudget = this.minBudgetFilter;
    if (this.maxBudgetFilter !== undefined && this.maxBudgetFilter !== null)
      filters.maxBudget = this.maxBudgetFilter;
    if (this.startDateFilter) filters.startDate = this.startDateFilter;
    if (this.endDateFilter) filters.endDate = this.endDateFilter;

    this.itineraryService.getAllItineraries(filters).subscribe({
      next: (response) => {
        this.itineraries = response.itineraries;
        this.loading = false;
        this.loadUnreadChatCounts();
      },
      error: (error) => {
        this.errorMessage = "Failed to load itineraries";
        this.loading = false;
      },
    });
  }

  getUnreadCount(itineraryId: number | undefined): number {
    if (!itineraryId) return 0;
    return this.unreadChatCounts[itineraryId] || 0;
  }

  private loadUnreadChatCounts(): void {
    this.chatService.getUnreadChatCounts().subscribe({
      next: (response) => {
        const map: Record<number, number> = {};
        for (const item of response?.unreadChats || []) {
          map[item.itinerary_id] = item.unread_count;
        }
        this.unreadChatCounts = map;
      },
      error: () => {
        // Non-blocking: chat badges just won't show
      },
    });
  }

  private scheduleUnreadRefresh(): void {
    if (this.unreadRefreshTimer) return;
    this.unreadRefreshTimer = setTimeout(() => {
      this.unreadRefreshTimer = null;
      this.loadUnreadChatCounts();
    }, 600);
  }

  applyFilters(): void {
    this.loadItineraries();
  }

  clearFilters(): void {
    this.destinationFilter = "";
    this.minBudgetFilter = undefined;
    this.maxBudgetFilter = undefined;
    this.startDateFilter = undefined;
    this.endDateFilter = undefined;
    this.loadItineraries();
  }

  viewDetails(id: number | undefined): void {
    if (id) {
      this.router.navigate(["/itineraries", id]);
    }
  }

  editItinerary(id: number | undefined): void {
    if (id) {
      this.router.navigate(["/itineraries", id, "edit"]);
    }
  }

  deleteItinerary(id: number | undefined): void {
    if (!id || !confirm("Are you sure you want to delete this itinerary?")) {
      return;
    }

    this.itineraryService.deleteItinerary(id).subscribe({
      next: () => {
        this.loadItineraries();
      },
      error: (error) => {
        alert("Failed to delete itinerary");
      },
    });
  }

  createNew(): void {
    this.router.navigate(["/itineraries/new"]);
  }

  getTotalBudget(): number {
    if (!this.itineraries || this.itineraries.length === 0) return 0;
    return this.itineraries.reduce((total, itinerary) => {
      const b = typeof itinerary.budget === 'string' ? parseFloat(itinerary.budget) : itinerary.budget;
      return total + (b || 0);
    }, 0);
  }

  shareItinerary(itinerary: Itinerary): void {
    this.dialog.open(ShareItineraryDialogComponent, {
      width: "600px",
      maxWidth: "95vw",
      data: { itinerary },
    });
  }

  calculateTotalExpenses(itinerary: Itinerary): number {
    if (!itinerary.activities) return 0;
    return itinerary.activities.reduce(
      (sum, activity) => sum + (activity.estimatedCost || 0),
      0
    );
  }

  getDuration(itinerary: Itinerary): number {
    const start = new Date(itinerary.start_date);
    const end = new Date(itinerary.end_date);
    return (
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
  }

  botOpen = false;
  userInput = "";
  showSuggestions = true;

  messages: { from: "bot" | "user"; text: string }[] = [
    {
      from: "bot",
      text: "Hi 👋 I can help you with planning, editing, sharing, or managing itineraries.",
    },
  ];

  quickHelp = [
    "How to create itinerary?",
    "Edit an itinerary",
    "Delete itinerary",
    "Share itinerary",
    "Budget tracking",
  ];

  toggleBot() {
    this.botOpen = !this.botOpen;
  }

  selectSuggestion(text: string) {
    this.userInput = text;
    this.sendMessage();
  }

  sendMessage() {
    const query = this.userInput.trim();
    if (!query) return;

    this.messages.push({ from: "user", text: query });
    this.userInput = "";
    this.showSuggestions = false;

    setTimeout(() => {
      const response = this.getBotResponse(query);

      this.messages.push({ from: "bot", text: response });

      // 👇 Return to help state
      setTimeout(() => {
        this.messages.push({
          from: "bot",
          text: "Can I help you with anything else?",
        });
        this.showSuggestions = true;
      }, 700);
    }, 400);
  }

  getBotResponse(query: string): string {
    const q = query.toLowerCase();

    // 🎯 CREATION
    if (q.includes("create") || q.includes("new itinerary")) {
      return `To create an itinerary:
1. Click “Create Itinerary”
2. Enter destination, dates, budget
3. Choose preferences
4. Generate and save`;
    }

    // ✏️ EDITING
    if (q.includes("edit") || q.includes("modify")) {
      return `Editing steps:
• Open itinerary
• Click Edit
• Modify activities, budget, or notes
• Save changes`;
    }

    // 🗑 DELETE
    if (q.includes("delete") || q.includes("remove")) {
      return `To delete:
• Open itinerary
• Click Delete
• Confirm (this cannot be undone)`;
    }

    // 📤 SHARE
    if (q.includes("share") || q.includes("send")) {
      return `Sharing options:
• Use Share button
• Copy link or system share
• Anyone with link can view`;
    }

    // 💰 BUDGET
    if (q.includes("budget") || q.includes("expense")) {
      return `Budget tracking:
• Costs auto-calculated from activities
• View remaining amount in Budget section
• Charts show daily spend`;
    }

    // 🌍 MAP / WEATHER
    if (q.includes("map") || q.includes("weather")) {
      return `Smart insights:
• Map shows destination overview
• Weather forecast auto-loaded per day
• Local time displayed for destination`;
    }

    // 🧳 PACKING
    if (q.includes("packing")) {
      return `Packing list is auto-generated based on:
• Destination
• Trip duration
• Weather conditions`;
    }

    // 🆘 FALLBACK
    return `I can help you with:
• Creating itineraries
• Editing or deleting plans
• Budget tracking
• Sharing trips
• Maps, weather & packing`;
  }
  closeBot() {
    this.botOpen = false;
  }
}
