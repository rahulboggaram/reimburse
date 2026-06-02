"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import { ClaimListRow } from "@/components/claim-list-row";
import { formatDisplayDate } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import type { SerializedClaim } from "@/lib/claim-types";
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

  return (
    <main className="min-h-dvh bg-zinc-100">
      <AppShell>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading your claims…</p>
        ) : claims.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-600">No claims yet.</p>
            <Link
              href="/employee"
              className="mt-3 inline-block text-sm font-medium underline"
            >
              Submit your first claim
            </Link>
          </Card>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
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
        )}

        <ClaimDetailModal
          claim={selected}
          open={selected !== null}
          onClose={() => setSelected(null)}
          variant="employee"
        />
      </AppShell>
    </main>
  );
}
