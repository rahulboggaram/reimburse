"use client";

import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/me-provider";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import { ClaimListRow } from "@/components/claim-list-row";
import { RejectedClaimActions } from "@/components/rejected-claim-actions";
import { Card } from "@/components/ui/card";
import { formatDisplayDate } from "@/lib/dates";
import { claimReceiptCount } from "@/lib/claim-receipt-count";
import { fetchMyRejectedClaims, readMyRejectedClaimsCache } from "@/lib/fetch-own-claims";
import type { SerializedClaim } from "@/lib/claim-types";
import { canViewOwnReimbursements } from "@/lib/access-roles";
import { toTitleCase } from "@/lib/user-profile";

function rejectorLabel(claim: SerializedClaim) {
  const name = claim.approver?.name?.trim();
  if (name) return toTitleCase(name);
  return "Your approver";
}

export function RejectedClaimsSection(props: { onChanged?: () => void }) {
  const { user, loading: meLoading } = useMe();
  const [claims, setClaims] = useState<SerializedClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SerializedClaim | null>(null);

  const loadRejected = useCallback(
    async (fresh = false) => {
      if (!user || !canViewOwnReimbursements(user)) {
        setClaims([]);
        return;
      }

      const ownerId = user.id;
      const rows = await fetchMyRejectedClaims(ownerId, { fresh });
      if (user.id !== ownerId) return;
      setClaims(rows);
    },
    [user],
  );

  useEffect(() => {
    if (meLoading) return;
    if (!user || !canViewOwnReimbursements(user)) {
      setClaims([]);
      setLoading(false);
      return;
    }

    const ownerId = user.id;
    const cached = readMyRejectedClaimsCache(ownerId);
    let cancelled = false;

    if (cached) {
      setClaims(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setHydrated(true);

    fetchMyRejectedClaims(ownerId)
      .then((rows) => {
        if (!cancelled) setClaims(rows);
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
  }, [meLoading, user?.id, user?.role, user?.profileComplete]);

  async function handleDeleted() {
    await loadRejected(true);
    await props.onChanged?.();
  }

  const rejected = claims.filter(
    (claim) =>
      claim.status === "REJECTED" &&
      claim.employeeId === user?.id,
  );

  if (loading) {
    return (
      <div className="mb-6 space-y-3">
        <div className="h-5 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="h-[4.5rem] animate-pulse rounded-2xl bg-white/60 ring-1 ring-zinc-200/80" />
      </div>
    );
  }

  if (rejected.length === 0) return null;

  if (!user || !canViewOwnReimbursements(user)) return null;

  return (
    <section className="mb-6 space-y-3" aria-labelledby="rejected-claims-heading">
      <div>
        <h2
          id="rejected-claims-heading"
          className="text-lg font-semibold text-zinc-900"
        >
          Needs your attention
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          {rejected.length === 1
            ? "One claim was rejected. Review the reason and resubmit or delete it."
            : `${rejected.length} claims were rejected. Review, resubmit, or delete each one.`}
        </p>
      </div>

      <ul className="space-y-3">
        {rejected.map((claim) => {
          const reason = claim.rejectionReason?.trim();
          const subtitleParts = [
            `Rejected by ${rejectorLabel(claim)}`,
            formatDisplayDate(claim.expenseDate),
            `${claimReceiptCount(claim)} receipt${claimReceiptCount(claim) === 1 ? "" : "s"}`,
          ];
          return (
            <li key={claim.id} className="space-y-2">
              <ClaimListRow
                title={claim.category}
                subtitle={subtitleParts.join(" · ")}
                amount={claim.amount}
                approvalStatus={claim.status}
                paymentStatus={claim.payoutStatus}
                onOpen={() => setSelected(claim)}
              />
              {reason ? (
                <Card className="border-red-200 bg-red-50/80 px-3 py-3 ring-0">
                  <p className="text-sm text-red-900">
                    <span className="font-medium">Reason: </span>
                    {reason}
                  </p>
                </Card>
              ) : null}
              <RejectedClaimActions
                claim={claim}
                userId={user.id}
                onDeleted={handleDeleted}
              />
            </li>
          );
        })}
      </ul>

      <ClaimDetailModal
        claim={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        variant="employee"
        onUpdated={handleDeleted}
      />
    </section>
  );
}
