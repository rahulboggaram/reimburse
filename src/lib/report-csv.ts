function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvCell).join(",");
}

export function buildReimbursementsReportCsv(input: {
  generatedAt: string;
  from?: string;
  to?: string;
  claims: Array<{
    employeeName: string;
    employeePhone: string;
    category: string;
    amount: number;
    expenseDate: string;
    status: string;
    description: string;
    approverName: string;
    rejectionReason: string | null;
    receiptCount: number;
    submittedAt: string;
    decidedAt: string;
    paidAt: string;
    payoutUtr: string;
  }>;
}) {
  const lines: string[] = [
    "Wapas — All reimbursements",
    csvRow(["Generated", input.generatedAt]),
    csvRow(["From", input.from ?? "Any"]),
    csvRow(["To", input.to ?? "Any"]),
    "",
    csvRow([
      "Employee",
      "Phone",
      "Category",
      "Amount (INR)",
      "Expense date",
      "Status",
      "Description",
      "Branch approver",
      "Rejection reason",
      "Receipts",
      "Submitted at",
      "Decided at",
      "Paid at",
      "UTR",
    ]),
  ];

  for (const claim of input.claims) {
    lines.push(
      csvRow([
        claim.employeeName,
        claim.employeePhone,
        claim.category,
        claim.amount,
        claim.expenseDate,
        claim.status,
        claim.description,
        claim.approverName,
        claim.rejectionReason ?? "",
        claim.receiptCount,
        claim.submittedAt,
        claim.decidedAt,
        claim.paidAt,
        claim.payoutUtr,
      ]),
    );
  }

  return `${lines.join("\n")}\n`;
}

export function buildActivityReportCsv(input: {
  generatedAt: string;
  from?: string;
  to?: string;
  activities: Array<{
    summary: string;
    type: string;
    createdAt: string;
    actorName: string;
    targetName: string;
  }>;
}) {
  const lines: string[] = [
    "Wapas — Full activity",
    csvRow(["Generated", input.generatedAt]),
    csvRow(["From", input.from ?? "Any"]),
    csvRow(["To", input.to ?? "Any"]),
    "",
    csvRow(["When", "Type", "Summary", "By", "About"]),
  ];

  for (const activity of input.activities) {
    lines.push(
      csvRow([
        activity.createdAt,
        activity.type,
        activity.summary,
        activity.actorName,
        activity.targetName,
      ]),
    );
  }

  return `${lines.join("\n")}\n`;
}

export function buildPermissionsReportCsv(input: {
  generatedAt: string;
  from?: string;
  to?: string;
  activities: Array<{
    summary: string;
    type: string;
    createdAt: string;
    actorName: string;
    targetName: string;
  }>;
}) {
  const lines: string[] = [
    "Wapas — Permission changes",
    csvRow(["Generated", input.generatedAt]),
    csvRow(["From", input.from ?? "Any"]),
    csvRow(["To", input.to ?? "Any"]),
    "",
    csvRow(["When", "Type", "Summary", "By", "About"]),
  ];

  for (const activity of input.activities) {
    lines.push(
      csvRow([
        activity.createdAt,
        activity.type,
        activity.summary,
        activity.actorName,
        activity.targetName,
      ]),
    );
  }

  return `${lines.join("\n")}\n`;
}

export function buildTransactionsReportCsv(input: {
  generatedAt: string;
  from?: string;
  to?: string;
  rows: Array<{
    when: string;
    event: string;
    employeeName: string;
    amount: string;
    status: string;
    reference: string;
    detail: string;
  }>;
}) {
  const lines: string[] = [
    "Wapas — Transactions",
    csvRow(["Generated", input.generatedAt]),
    csvRow(["From", input.from ?? "Any"]),
    csvRow(["To", input.to ?? "Any"]),
    "",
    csvRow([
      "When",
      "Event",
      "Employee",
      "Amount (INR)",
      "Status",
      "Reference",
      "Detail",
    ]),
  ];

  for (const row of input.rows) {
    lines.push(
      csvRow([
        row.when,
        row.event,
        row.employeeName,
        row.amount,
        row.status,
        row.reference,
        row.detail,
      ]),
    );
  }

  return `${lines.join("\n")}\n`;
}

/** @deprecated Use type-specific builders via /api/admin/reports/download?type= */
export function buildAdminReportCsv(input: {
  claims: Array<{
    employeeName: string;
    employeePhone: string;
    category: string;
    amount: number;
    expenseDate: string;
    status: string;
    description: string;
    approverName: string;
    rejectionReason: string | null;
    receiptCount: number;
    submittedAt: string;
  }>;
  activities: Array<{
    summary: string;
    type: string;
    createdAt: string;
    actorName: string;
  }>;
}) {
  const lines: string[] = [];

  lines.push("Wapas — Reimbursements report");
  lines.push(
    csvRow([
      "Employee",
      "Phone",
      "Category",
      "Amount (INR)",
      "Expense date",
      "Status",
      "Description",
      "Branch approver",
      "Rejection reason",
      "Receipts",
      "Submitted at",
    ]),
  );

  for (const claim of input.claims) {
    lines.push(
      csvRow([
        claim.employeeName,
        claim.employeePhone,
        claim.category,
        claim.amount,
        claim.expenseDate,
        claim.status,
        claim.description,
        claim.approverName,
        claim.rejectionReason ?? "",
        claim.receiptCount,
        claim.submittedAt,
      ]),
    );
  }

  lines.push("");
  lines.push("Wapas — Activity log");
  lines.push(csvRow(["When", "Type", "Summary", "By"]));

  for (const activity of input.activities) {
    lines.push(
      csvRow([
        activity.createdAt,
        activity.type,
        activity.summary,
        activity.actorName,
      ]),
    );
  }

  return `${lines.join("\n")}\n`;
}
