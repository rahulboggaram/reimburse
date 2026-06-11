"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  readFailedClaimSubmit,
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
  const searchParams = useSearchParams();
  const { user, loading: meLoading } = useMe();
  const [claims, setClaims] = useState<SerializedClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<SerializedClaim | null>(null);
  const [showSubmittedBanner, setShowSubmittedBanner] = useState(
    () => searchParams.get("submitted") === "1",
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("submitted") !== "1") return;
    setShowSubmittedBanner(true);
    router.replace("/employee/claims", { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (!showSubmittedBanner) return;
    const timer = window.setTimeout(() => setShowSubmittedBanner(false), 8000);
    return () => window.clearTimeout(timer);
  }, [showSubmittedBanner]);

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
      setSubmitError(readFailedClaimSubmit(user.id)?.error ?? null);
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

      {showSubmittedBanner ? (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Claim submitted! Your receipts are finishing upload in the background.
        </div>
      ) : null}

      {submitError ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p>{submitError}</p>
          <button
            type="button"
            className="mt-2 font-medium underline"
            onClick={() => {
              if (user?.id) clearFailedClaimSubmit(user.id);
              setSubmitError(null);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

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
            onClose={() => setSelected(null)}
            variant="employee"
            onUpdated={() => loadClaims(true)}
          />
        </>
      )}
    </>
  );
}
