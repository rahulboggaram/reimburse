"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FloatingInput } from "@/components/ui/floating-field";
import { PageHeading } from "@/components/page-heading";
import {
  defaultReportDates,
  REPORT_CATALOG,
  type ReportType,
} from "@/lib/reports";

export default function AdminReportsPage() {
  const defaults = useMemo(() => defaultReportDates(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [downloading, setDownloading] = useState<ReportType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function downloadReport(type: ReportType) {
    setError(null);
    setDownloading(type);

    try {
      const params = new URLSearchParams({ type });
      if (from.trim()) params.set("from", from.trim());
      if (to.trim()) params.set("to", to.trim());

      const response = await fetch(
        `/api/admin/reports/download?${params.toString()}`,
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Download failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] ?? `reimburse-${type}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download report.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <>
      <PageHeading
        title="Reports"
        description="Download CSV reports for a date range."
        className="mb-5"
      />

      <Card className="mb-5 space-y-4">
        <p className="text-sm font-semibold text-zinc-800">Filter By Date</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FloatingInput
            id="report-from"
            label="From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <FloatingInput
            id="report-to"
            label="To"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <p className="text-xs text-zinc-500">
          Defaults to the last 30 days. Clear both dates to include all records.
        </p>
      </Card>

      {error ? (
        <p className="mb-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {REPORT_CATALOG.map((report) => (
          <li key={report.id}>
            <Card className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-zinc-900">{report.title}</p>
                <p className="text-sm text-zinc-600">{report.description}</p>
              </div>
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                disabled={downloading !== null}
                onClick={() => downloadReport(report.id)}
              >
                {downloading === report.id ? "Downloading…" : "Download"}
              </Button>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
