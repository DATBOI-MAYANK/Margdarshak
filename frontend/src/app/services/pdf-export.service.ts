import { Injectable } from "@angular/core";

declare var jspdf: any;

@Injectable({
  providedIn: "root",
})
export class PdfExportService {
  private agencyName = "Voyage.IQ";
  private agencyTagline = "Intent to Itinerary, Refined";
  private agencyContact = "contact@voyageiq.com | +91 98765 43210";

  async exportItineraryToPdf(
    itinerary: any,
    groupedActivities: any[],
    travelerName?: string
  ): Promise<void> {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Agency Header
    doc.setFillColor(63, 81, 181);
    doc.rect(0, 0, pageWidth, 40, "F");

    // Agency Name
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(this.agencyName, pageWidth / 2, 18, { align: "center" });

    // Agency Tagline
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text(this.agencyTagline, pageWidth / 2, 28, { align: "center" });

    // Agency Contact
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(this.agencyContact, pageWidth / 2, 36, { align: "center" });

    // Destination Title
    doc.setFontSize(24);
    doc.setTextColor(63, 81, 181);
    doc.setFont("helvetica", "bold");
    doc.text(itinerary.destination.toUpperCase(), pageWidth / 2, 55, {
      align: "center",
    });

    // Date Range
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    const startDate = new Date(itinerary.start_date).toLocaleDateString(
      "en-US",
      { month: "long", day: "numeric", year: "numeric" }
    );
    const endDate = new Date(itinerary.end_date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    doc.text(`${startDate} - ${endDate}`, pageWidth / 2, 63, {
      align: "center",
    });

    // Traveler Info Box
    doc.setFillColor(232, 234, 246);
    doc.roundedRect(15, 70, pageWidth - 30, 20, 3, 3, "F");

    doc.setFontSize(11);
    doc.setTextColor(63, 81, 181);
    doc.setFont("helvetica", "bold");
    doc.text("TRAVELER:", 25, 82);
    doc.setTextColor(60);
    doc.setFont("helvetica", "normal");
    const displayName = travelerName || itinerary.userName || "Valued Guest";
    doc.text(displayName, 55, 82);

    // Booking Reference
    doc.setFont("helvetica", "bold");
    doc.setTextColor(63, 81, 181);
    doc.text("REF:", pageWidth / 2 + 10, 82);
    doc.setTextColor(60);
    doc.setFont("helvetica", "normal");
    const bookingRef = `STI-${
      itinerary.id || "0000"
    }-${new Date().getFullYear()}`;
    doc.text(bookingRef, pageWidth / 2 + 25, 82);

    // Trip Overview Box
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(15, 95, pageWidth - 30, 35, 3, 3, "F");

    // Trip Overview Title
    doc.setFillColor(63, 81, 181);
    doc.rect(15, 95, pageWidth - 30, 8, "F");
    doc.setFontSize(10);
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.text("TRIP OVERVIEW", pageWidth / 2, 101, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.setFont("helvetica", "normal");
    const duration =
      Math.ceil(
        (new Date(itinerary.end_date).getTime() -
          new Date(itinerary.start_date).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;
    const totalCost =
      itinerary.activities?.reduce(
        (sum: number, a: any) => sum + (Number(a.estimatedCost) || 0),
        0
      ) || 0;
    const budget = Number(itinerary.budget) || 0;

    doc.text(`Duration: ${duration} days`, 25, 112);
    doc.text(`Budget: $${budget.toFixed(2)}`, 25, 120);
    doc.text(`Estimated Cost: $${totalCost.toFixed(2)}`, pageWidth / 2, 112);
    doc.text(
      `Remaining: $${(budget - totalCost).toFixed(2)}`,
      pageWidth / 2,
      120
    );

    let yPos = 145;

    // Daily Activities
    for (const dayGroup of groupedActivities) {
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Day Header
      doc.setFillColor(63, 81, 181);
      doc.roundedRect(15, yPos - 5, pageWidth - 30, 10, 2, 2, "F");

      doc.setFontSize(12);
      doc.setTextColor(255);
      const dayName = dayGroup.date.toLocaleDateString("en-US", {
        weekday: "long",
      });
      const dayDate = dayGroup.date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      doc.text(`Day ${dayGroup.day} - ${dayName}, ${dayDate}`, 20, yPos + 2);

      yPos += 15;

      // Activities Table for this day
      const tableData = dayGroup.activities.map(
        (activity: any, index: number) => {
          const cost = Number(activity.estimatedCost) || 0;
          return [
            activity.time || `${9 + index * 3}:00`,
            activity.name,
            activity.duration || "2 hours",
            cost > 0 ? `$${cost.toFixed(2)}` : "Free",
          ];
        }
      );

      autoTable(doc, {
        startY: yPos,
        head: [["Time", "Activity", "Duration", "Cost"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [92, 107, 192], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: "auto" },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
        },
        margin: { left: 15, right: 15 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Footer line
      doc.setDrawColor(63, 81, 181);
      doc.setLineWidth(0.5);
      doc.line(15, 280, pageWidth - 15, 280);

      // Footer text
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(this.agencyName, 15, 286);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, 286, {
        align: "center",
      });
      doc.text(new Date().toLocaleDateString(), pageWidth - 15, 286, {
        align: "right",
      });

      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        "Thank you for choosing Voyage.IQ. Have a wonderful trip!",
        pageWidth / 2,
        292,
        { align: "center" }
      );
    }

    // Save the PDF
    doc.save(
      `${itinerary.destination.replace(/[^a-z0-9]/gi, "_")}_Itinerary.pdf`
    );
  }
}
