"use client";

import { useEffect, useState } from "react";
import {
  ApprovalsTableHeader,
  ApprovalsTableRow,
} from "@/components/approvals-table";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import { Card } from "@/components/ui/card";
import type { SerializedClaim } from "@/lib/claim-types";
import { PageHeading } from "@/components/page-heading";
import { readJson } from "@/lib/api";
import { fetchClientCache, invalidateClientCache } from "@/lib/client-cache";

export default function ManagerPendingPage() {
  const [claims, setClaims] = useState<SerializedClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SerializedClaim | null>(null);

  async function loadClaims() {
    const data = await fetchClientCache("claims-pending", async () => {
      const response = await fetch("/api/claims/pending");
      return readJson<SerializedClaim[]>(response);
    });
    setClaims(data);
  }

  useEffect(() => {
    loadClaims().finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeading
        title="Your queue"
        description="Tap a row to review and take action"
        className="mb-4"
      />

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : claims.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600">
            No claims waiting for your approval.
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <div className="min-w-[520px]">
            <ApprovalsTableHeader />
            <div>
              {claims.map((claim) => (
                <ApprovalsTableRow
                  key={claim.id}
                  claim={claim}
                  onOpen={() => setSelected(claim)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <ClaimDetailModal
        claim={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        variant="approver"
        onUpdated={async () => {
          invalidateClientCache("claims-pending");
          setSelected(null);
          await loadClaims();
        }}
      />
    </>
  );
}
