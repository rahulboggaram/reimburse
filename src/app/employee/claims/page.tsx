"use client";

import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/me-provider";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import {
  MyClaimsTableHeader,
  MyClaimsTableRow,
} from "@/components/my-claims-table";
import { EmployeeEmptyState } from "@/components/employee-empty-state";
import { RejectedClaimsSection } from "@/components/rejected-claims-section";
import { Card } from "@/components/ui/card";
import type { SerializedClaim } from "@/lib/claim-types";
import { PageHeading } from "@/components/page-heading";
import { readJson } from "@/lib/api";
import {
  fetchClientCache,
  invalidateClientCache,
} from "@/lib/client-cache";
import { claimsMineCacheKey } from "@/lib/claims-cache";

export default function MyClaimsPage() {
  const { user, loading: meLoading } = useMe();
  const [claims, setClaims] = useState<SerializedClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SerializedClaim | null>(null);

  const loadClaims = useCallback(async () => {
    if (!user) return;

    invalidateClientCache(claimsMineCacheKey(user.id));
    const res = await fetch("/api/claims/mine", { cache: "no-store" });
    const rows = await readJson<SerializedClaim[]>(res);
    setClaims(rows.filter((claim) => claim.employeeId === user.id));
  }, [user]);

  useEffect(() => {
    if (meLoading || !user) return;

    setLoading(true);
    loadClaims().finally(() => setLoading(false));
  }, [meLoading, user, loadClaims]);

  const activeClaims = claims.filter((claim) => claim.status !== "REJECTED");

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeading title="My Reimbursements" />
        <Card className="overflow-hidden p-0">
          <div className="h-10 animate-pulse bg-zinc-50" />
          <div className="h-14 animate-pulse border-t border-zinc-100" />
          <div className="h-14 animate-pulse border-t border-zinc-100" />
          <div className="h-14 animate-pulse border-t border-zinc-100" />
        </Card>
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <>
        <PageHeading title="My Reimbursements" className="mb-5" />
        <RejectedClaimsSection onChanged={loadClaims} />
        <EmployeeEmptyState
          title="No reimbursements yet"
          description="Submit your first reimbursement and track approval and payment here."
          actionLabel="New reimbursement"
          actionHref="/employee"
        />
      </>
    );
  }

  return (
    <>
      <PageHeading title="My Reimbursements" className="mb-4" />
      <RejectedClaimsSection onChanged={loadClaims} />

      {activeClaims.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <MyClaimsTableHeader />
          <div>
            {activeClaims.map((claim) => (
              <MyClaimsTableRow
                key={claim.id}
                claim={claim}
                onOpen={() => setSelected(claim)}
              />
            ))}
          </div>
        </Card>
      ) : (
        <p className="text-sm text-zinc-600">
          Approved and paid claims will appear in this list below.
        </p>
      )}

      <ClaimDetailModal
        claim={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        variant="employee"
        onUpdated={loadClaims}
      />
    </>
  );
}
