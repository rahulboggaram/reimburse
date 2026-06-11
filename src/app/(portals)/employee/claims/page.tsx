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
import { canViewOwnReimbursements } from "@/lib/access-roles";
import { fetchMyClaims, readMyClaimsCache } from "@/lib/fetch-own-claims";
import {
  clearFailedClaimSubmit,
  mergeClaimsWithPending,
  readPendingClaimSubmits,
  subscribePendingClaims,
} from "@/lib/pending-claim-submit";

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
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<SerializedClaim | null>(null);

  useEffect(() => {
    if (meLoading) return;
    if (!user) return;

    if (!user.profileComplete) {
      router.replace("/employee/onboarding");
      return;
    }
    if (!canViewOwnReimbursements(user)) {
      router.replace("/login");
    }
  }, [meLoading, user, router]);

  const syncClaimsView = useCallback(
    (rows: SerializedClaim[]) => {
      if (!user) return;
      const pending = readPendingClaimSubmits(user.id);
      setClaims(mergeClaimsWithPending(rows, pending));
    },
    [user],
  );

  const loadClaims = useCallback(
    async (fresh = false) => {
      if (!user || !canViewOwnReimbursements(user)) return;

      const ownerId = user.id;
      const rows = await fetchMyClaims(ownerId, { fresh });
      if (user.id !== ownerId) return;
      syncClaimsView(rows);
    },
    [user, syncClaimsView],
  );

  useEffect(() => {
    if (meLoading || !user || !canViewOwnReimbursements(user)) return;

    const ownerId = user.id;
    const cached = readMyClaimsCache(ownerId);
    let cancelled = false;

    if (cached) {
      syncClaimsView(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setHydrated(true);

    fetchMyClaims(ownerId)
      .then((rows) => {
        if (!cancelled) syncClaimsView(rows);
      })
      .catch(() => {
        if (!cancelled && !cached) setClaims([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [meLoading, user?.id, user?.role, user?.profileComplete, syncClaimsView]);

  useEffect(() => {
    if (!user?.id) return;
    return subscribePendingClaims(() => {
      const cached = readMyClaimsCache(user.id) ?? [];
      syncClaimsView(cached);
      void loadClaims(true);
    });
  }, [user?.id, syncClaimsView, loadClaims]);

  function handleCloseDetail() {
    if (
      selected?.submitError &&
      selected.id.startsWith("pending-") &&
      user?.id
    ) {
      clearFailedClaimSubmit(user.id, selected.id);
      syncClaimsView(readMyClaimsCache(user.id) ?? []);
    }
    setSelected(null);
  }

  if (meLoading || !user || !canViewOwnReimbursements(user)) {
    return (
      <div className="space-y-4">
        <PageHeading title="My Claims" />
        <MyClaimsLoadingSkeleton />
      </div>
    );
  }

  const activeClaims = claims.filter((claim) => claim.status !== "REJECTED");
  const waitingForClaims = hydrated && loading && claims.length === 0;

  return (
    <>
      <PageHeading
        title="My Claims"
        className={waitingForClaims || claims.length === 0 ? "mb-5" : "mb-4"}
      />
      <RejectedClaimsSection onChanged={() => loadClaims(true)} />

      {waitingForClaims ? (
        <MyClaimsLoadingSkeleton />
      ) : claims.length === 0 ? (
        <EmployeeEmptyState
          title="No reimbursements yet"
          description="Submit your first reimbursement and track approval and payment here."
          actionLabel="New Claim"
          actionHref="/employee"
          actionClassName="font-bold"
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
                    onOpen={() => {
                      if (claim.submitting) return;
                      setSelected(claim);
                    }}
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
            onClose={handleCloseDetail}
            variant="employee"
            onUpdated={() => loadClaims(true)}
          />
        </>
      )}
    </>
  );
}
