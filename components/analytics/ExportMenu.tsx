"use client";

import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Download, FileText, FileSpreadsheet, Mail } from "lucide-react";
import { showToast } from "@/lib/toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DateRange } from "react-day-picker";

interface ExportData {
  overview: any;
  sequences: any[];
  contacts: any;
  tracker?: any;
}

interface ExportMenuProps {
  data: ExportData;
  dateRange?: DateRange;
}

/**
 * Render the ExportMenu component.
 * @param {ExportMenuProps} props - Component props.
 * @returns {unknown} JSX output for ExportMenu.
 * @example
 * <ExportMenu />
 */
export function ExportMenu({ data, dateRange }: ExportMenuProps) {
  const exportToPDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text("Analytics Report", 14, 20);

    // Date range
    if (dateRange?.from && dateRange?.to) {
      doc.setFontSize(10);
      doc.text(
        `Period: ${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`,
        14,
        30
      );
    }

    // Overview metrics
    doc.setFontSize(14);
    doc.text("Overview", 14, 45);
    doc.setFontSize(10);
    doc.text(`Total Contacts: ${data.overview.totalContacts}`, 20, 55);
    doc.text(`Total Outreach Items: ${data.overview.totalDrafts}`, 20, 62);
    doc.text(`Emails Sent: ${data.overview.emailsSent}`, 20, 69);
    doc.text(`Reply Rate: ${data.overview.replyRate}%`, 20, 76);

    if (data.tracker) {
      doc.text(`Tracker Reply Rate: ${data.tracker.replyRate}%`, 20, 83);
      doc.text(`Needs Follow-up: ${data.tracker.followUpNeeded}`, 20, 90);
    }

    // Sequence performance table
    if (data.sequences && data.sequences.length > 0) {
      doc.setFontSize(14);
      doc.text("Sequence Performance", 14, data.tracker ? 104 : 90);

      autoTable(doc, {
        startY: data.tracker ? 109 : 95,
        head: [["Sequence", "Enrolled", "Sent", "Replied", "Reply Rate"]],
        body: data.sequences.map((seq) => [
          seq.name,
          seq.enrolled,
          seq.sent,
          seq.replied,
          `${seq.replyRate.toFixed(1)}%`,
        ]),
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    // Save PDF
    doc.save(`analytics-report-${new Date().toISOString().split("T")[0]}.pdf`);
    showToast.success("PDF exported successfully");
  };

  const exportAllToCSV = () => {
    // Combine all data into one CSV
    let csv = "Analytics Report\n\n";

    // Overview
    csv += "Overview Metrics\n";
    csv += "Metric,Value\n";
    csv += `Total Contacts,${data.overview.totalContacts}\n`;
    csv += `Total Outreach Items,${data.overview.totalDrafts}\n`;
    csv += `Emails Sent,${data.overview.emailsSent}\n`;
    csv += `Reply Rate,${data.overview.replyRate}%\n`;
    csv += `Best Performing Sequence,${data.overview.bestPerformingSequence}\n\n`;

    if (data.tracker) {
      csv += "Tracker Metrics\n";
      csv += "Metric,Value\n";
      csv += `Tracked Contacts,${data.tracker.totalTracked}\n`;
      csv += `Tracker Reply Rate,${data.tracker.replyRate}%\n`;
      csv += `Needs Follow-up,${data.tracker.followUpNeeded}\n\n`;
    }

    // Sequences
    if (data.sequences && data.sequences.length > 0) {
      csv += "Sequence Performance\n";
      csv += "Sequence,Enrolled,Sent,Opened,Replied,Reply Rate\n";
      data.sequences.forEach((seq) => {
        csv += `${seq.name},${seq.enrolled},${seq.sent},${seq.opened},${seq.replied},${seq.replyRate}%\n`;
      });
      csv += "\n";
    }

    // Download
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-full-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast.success("CSV exported successfully");
  };

  const scheduleWeeklyReport = () => {
    // TODO: Implement backend scheduling
    showToast.info("Weekly report scheduling coming soon!");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export & Reports
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Data</DropdownMenuLabel>
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="mr-2 h-4 w-4" />
          Export to PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAllToCSV}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export to CSV
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Scheduled Reports</DropdownMenuLabel>
        <DropdownMenuItem onClick={scheduleWeeklyReport}>
          <Mail className="mr-2 h-4 w-4" />
          Weekly Email Summary
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
