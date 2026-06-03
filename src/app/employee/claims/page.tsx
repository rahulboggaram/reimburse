"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  readClientCache,
} from "@/lib/client-cache";
import { claimsMineCacheKey } from "@/lib/claims-cache";

function MyClaimsLoadingSkeleton() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="h-10 animate-pulse bg-zinc-50" />
      <div className="h-14 animate-pulse border-t border-zinc-100" />
      <div className="h-14 animate-pulse border-t border-zinc-100" />
    </Card>
  );
}

export default function MyClaimsPage() {
  const router = useRouter();
  const { user, loading: meLoading } = useMe();
  const [claims, setClaims] = useState<SerializedClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SerializedClaim | null>(null);

  useEffect(() => {
    if (meLoading) return;
    if (!user) return;

    if (user.role !== "EMPLOYEE") {
      router.replace(user.role === "ADMIN" ? "/admin/claims" : "/manager");
    }
  }, [meLoading, user, router]);

  const loadClaims = useCallback(
    async (fresh = false) => {
      if (!user || user.role !== "EMPLOYEE") return;

      const key = claimsMineCacheKey(user.id);
      if (fresh) invalidateClientCache(key);

      const rows = await fetchClientCache(key, async () => {
        const res = await fetch("/api/claims/mine", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return [];
        const data = await readJson<SerializedClaim[]>(res);
        return data.filter((claim) => claim.employeeId === user.id);
      });

      setClaims(rows);
    },
    [user],
  );

  useEffect(() => {
    if (meLoading || !user || user.role !== "EMPLOYEE") return;

    let cancelled = false;
    const key = claimsMineCacheKey(user.id);
    const cached = readClientCache<SerializedClaim[]>(key);
    if (cached) {
      setClaims(cached.filter((claim) => claim.employeeId === user.id));
      setLoading(false);
    } else {
      setLoading(true);
    }

    loadClaims()
      .finally(() => {
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setClaims([]);
      });

    return () => {
      cancelled = true;
    };
  }, [meLoading, user?.id, user?.role, loadClaims]);

  useEffect(() => {
    setSelected(null);
  }, [user?.id]);

  if (meLoading || !user || user.role !== "EMPLOYEE") {
    return (
      <div className="space-y-4">
        <PageHeading title="My Reimbursements" />
        <MyClaimsLoadingSkeleton />
      </div>
    );
  }

  const activeClaims = claims.filter((claim) => claim.status !== "REJECTED");
  const waitingForClaims = loading && claims.length === 0;

  return (
    <>
      <PageHeading
        title="My Reimbursements"
        className={waitingForClaims || claims.length === 0 ? "mb-5" : "mb-4"}
      />
      <RejectedClaimsSection onChanged={() => loadClaims(true)} />

      {waitingForClaims ? (
        <MyClaimsLoadingSkeleton />
      ) : claims.length === 0 ? (
        <EmployeeEmptyState
          title="No reimbursements yet"
          description="Submit your first reimbursement and track approval and payment here."
          actionLabel="New reimbursement"
          actionHref="/employee"
        />
      ) : (
        <>
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
            onUpdated={() => loadClaims(true)}
          />
        </>
      )}
    </>
  );
}
