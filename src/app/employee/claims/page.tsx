"use client";

import { useEffect, useState } from "react";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import {
  MyClaimsTableHeader,
  MyClaimsTableRow,
} from "@/components/my-claims-table";
import { EmployeeEmptyState } from "@/components/employee-empty-state";
import { Card } from "@/components/ui/card";
import type { SerializedClaim } from "@/lib/claim-types";
import { PageHeading } from "@/components/page-heading";
import { readJson } from "@/lib/api";
import { fetchClientCache } from "@/lib/client-cache";

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<SerializedClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SerializedClaim | null>(null);

  useEffect(() => {
    fetchClientCache("claims-mine", async () => {
      const res = await fetch("/api/claims/mine");
      return readJson<SerializedClaim[]>(res);
    })
      .then(setClaims)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeading title="My claims" />
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

  return (
    <>
      <PageHeading title="My claims" className="mb-4" />
      <Card className="overflow-hidden p-0">
        <MyClaimsTableHeader />
        <div>
          {claims.map((claim) => (
            <MyClaimsTableRow
              key={claim.id}
              claim={claim}
              onOpen={() => setSelected(claim)}
            />
          ))}
        </div>
      </Card>

      <ClaimDetailModal
        claim={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        variant="employee"
      />
    </>
  );
}
