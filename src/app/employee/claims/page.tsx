"use client";

import { useEffect, useState } from "react";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import { ClaimListRow } from "@/components/claim-list-row";
import { EmployeeEmptyState } from "@/components/employee-empty-state";
import { formatDisplayDate } from "@/lib/dates";
import type { SerializedClaim } from "@/lib/claim-types";
import { PageHeading } from "@/components/page-heading";
import { readJson } from "@/lib/api";

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<SerializedClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SerializedClaim | null>(null);

  useEffect(() => {
    fetch("/api/claims/mine")
      .then((res) => readJson<SerializedClaim[]>(res))
      .then(setClaims)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeading title="My claims" />
        <div className="space-y-3">
          <div className="h-[4.5rem] animate-pulse rounded-2xl bg-white/60 ring-1 ring-zinc-200/80" />
          <div className="h-[4.5rem] animate-pulse rounded-2xl bg-white/60 ring-1 ring-zinc-200/80" />
          <div className="h-[4.5rem] animate-pulse rounded-2xl bg-white/60 ring-1 ring-zinc-200/80" />
        </div>
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <>
        <PageHeading title="My claims" className="mb-5" />
        <EmployeeEmptyState
          title="No claims yet"
          description="Submit your first reimbursement and track approval and payment here."
          actionLabel="New reimbursement"
          actionHref="/employee"
        />
      </>
    );
  }

  const total = claims.reduce((sum, claim) => sum + claim.amount, 0);

  return (
    <>
      <PageHeading title="My claims" className="mb-4" />
      <p className="mb-4 rounded-2xl border border-emerald-100/80 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
        <span className="font-medium">{claims.length}</span> claim
        {claims.length === 1 ? "" : "s"} ·{" "}
        <span className="font-semibold font-tabular-nums">
          ₹{total.toLocaleString("en-IN")}
        </span>{" "}
        total
      </p>
      <ul className="space-y-3">
        {claims.map((claim) => (
          <li key={claim.id}>
            <ClaimListRow
              title={claim.category}
              subtitle={`${formatDisplayDate(claim.expenseDate)} · ${claim.receipts.length} receipt${claim.receipts.length === 1 ? "" : "s"}`}
              amount={claim.amount}
              approvalStatus={claim.status}
              paymentStatus={claim.payoutStatus}
              onOpen={() => setSelected(claim)}
            />
          </li>
        ))}
      </ul>

      <ClaimDetailModal
        claim={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        variant="employee"
      />
    </>
  );
}
