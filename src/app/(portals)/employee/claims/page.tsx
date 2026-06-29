"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
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
import { fetchMyClaims, readClaimsViewForUser, readMyClaimsCache } from "@/lib/fetch-own-claims";
import {
  clearFailedClaimSubmit,
  mergeClaimsWithPending,
  readPendingClaimSubmits,
  subscribePendingClaims,
} from "@/lib/pending-claim-submit";
import {
  collectPayoutRefreshClaimIds,
  usePayoutWatchPolling,
} from "@/lib/use-payout-watch-polling";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SerializedClaim | null>(null);

  useEffect(() => {
    if (meLoading) return;
    if (!user) {
      router.replace("/login?from=/employee/claims");
      return;
    }

    if (!user.profileComplete) {
      router.replace("/employee/onboarding");
      return;
    }
    if (!canViewOwnReimbursements(user)) {
      router.replace("/login?from=/employee/claims");
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
      try {
        const rows = await fetchMyClaims(ownerId, { fresh });
        if (user.id !== ownerId) return;
        syncClaimsView(rows);
        setLoadError(null);
      } catch (err) {
        if (user.id !== ownerId) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Could not load your claims. Please try again.",
        );
      }
    },
    [user, syncClaimsView],
  );

  useLayoutEffect(() => {
    if (meLoading || !user?.id || !canViewOwnReimbursements(user)) return;

    const view = readClaimsViewForUser(user.id);
    setClaims(view);
    setLoading(view.length === 0 && !readMyClaimsCache(user.id));
    setHydrated(true);
  }, [meLoading, user?.id, user?.role, user?.profileComplete]);

  useEffect(() => {
    if (meLoading || !user || !canViewOwnReimbursements(user)) return;

    const ownerId = user.id;
    let cancelled = false;

    fetchMyClaims(ownerId)
      .then((rows) => {
        if (!cancelled) {
          syncClaimsView(rows);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const cached = readMyClaimsCache(ownerId);
          if (!cached) setClaims(readClaimsViewForUser(ownerId));
          setLoadError(
            err instanceof Error
              ? err.message
              : "Could not load your claims. Please try again.",
          );
        }
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
      syncClaimsView(readMyClaimsCache(user.id) ?? []);
    });
  }, [user?.id, syncClaimsView]);

  const payoutRefreshIds = useMemo(
    () => collectPayoutRefreshClaimIds(claims),
    [claims],
  );

  usePayoutWatchPolling({
    claimIds: payoutRefreshIds,
    onTick: () => loadClaims(true),
    intervalMs: 20_000,
  });

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
  const showClaimsLoading = !hydrated || (loading && claims.length === 0);
  const showEmptyState = hydrated && !loading && claims.length === 0;

  return (
    <>
      <PageHeading
        title="My Claims"
        className={showClaimsLoading || showEmptyState ? "mb-5" : "mb-4"}
      />
      <RejectedClaimsSection onChanged={() => loadClaims(true)} />

      {loadError ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
          {loadError}
        </p>
      ) : null}

      {showClaimsLoading ? (
        <MyClaimsLoadingSkeleton />
      ) : showEmptyState ? (
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
