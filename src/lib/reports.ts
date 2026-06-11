import { PRODUCTION_GO_LIVE_AT } from "@/lib/production-go-live";

export type ReportType =
  | "reimbursements"
  | "activity"
  | "permissions"
  | "transactions";

export const REPORT_CATALOG: Array<{
  id: ReportType;
  title: string;
  description: string;
}> = [
  {
    id: "reimbursements",
    title: "All Reimbursements",
    description: "Every claim submitted in the date range, with amount and status.",
  },
  {
    id: "activity",
    title: "Full Activity",
    description: "Logins, profile updates, admin actions, and payouts in the date range.",
  },
  {
    id: "permissions",
    title: "Permission Changes",
    description: "Payment approver role changes and people added or removed.",
  },
  {
    id: "transactions",
    title: "Transactions",
    description: "Claims submitted, decided, or paid, plus payout events in the date range.",
  },
];

export const PERMISSION_ACTIVITY_TYPES = [
  "USER_ADDED",
  "USER_REMOVED",
  "APPROVER_ENABLED",
  "APPROVER_DISABLED",
  "ADMIN_ENABLED",
  "ADMIN_DISABLED",
] as const;

export const TRANSACTION_ACTIVITY_TYPES = [
  "PAYOUT_INITIATED",
  "PAYOUT_COMPLETED",
  "PAYOUT_FAILED",
] as const;

export type DateRangeFilter = {
  from?: Date;
  to?: Date;
};

export function parseReportDateRange(input: {
  from?: string | null;
  to?: string | null;
}): DateRangeFilter | Response {
  const range: DateRangeFilter = {};

  if (input.from) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from)) {
      return Response.json({ error: "Invalid from date." }, { status: 400 });
    }
    range.from = new Date(`${input.from}T00:00:00`);
  }

  if (input.to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.to)) {
      return Response.json({ error: "Invalid to date." }, { status: 400 });
    }
    range.to = new Date(`${input.to}T23:59:59.999`);
  }

  if (range.from && range.to && range.from > range.to) {
    return Response.json(
      { error: "From date must be before to date." },
      { status: 400 },
    );
  }

  return range;
}

export function createdAtFilter(range: DateRangeFilter) {
  const from =
    range.from && range.from > PRODUCTION_GO_LIVE_AT
      ? range.from
      : PRODUCTION_GO_LIVE_AT;

  if (!range.from && !range.to) {
    return { gte: from };
  }

  return {
    gte: from,
    ...(range.to ? { lte: range.to } : {}),
  };
}

export function defaultReportDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  if (from < PRODUCTION_GO_LIVE_AT) {
    from.setTime(PRODUCTION_GO_LIVE_AT.getTime());
  }
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function reportFilename(type: ReportType, from?: string, to?: string) {
  const suffix =
    from && to ? `${from}-to-${to}` : from ? `from-${from}` : to ? `to-${to}` : "all";
  return `reimburse-${type}-${suffix}.csv`;
}
