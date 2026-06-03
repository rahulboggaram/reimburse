"use client";

import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/me-provider";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import { ClaimListRow } from "@/components/claim-list-row";
import { RejectedClaimActions } from "@/components/rejected-claim-actions";
import { Card } from "@/components/ui/card";
import { formatDisplayDate } from "@/lib/dates";
import { readJson } from "@/lib/api";
import { claimReceiptCount } from "@/lib/claim-receipt-count";
import {
  fetchClientCache,
  invalidateClientCache,
  readClientCache,
} from "@/lib/client-cache";
import { claimsRejectedCacheKey } from "@/lib/claims-cache";
import type { SerializedClaim } from "@/lib/claim-types";
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
      if (!user || user.role !== "EMPLOYEE") {
        setClaims([]);
        return;
      }

      const key = claimsRejectedCacheKey(user.id);
      if (fresh) invalidateClientCache(key);

      const rows = await fetchClientCache(key, async () => {
        const res = await fetch("/api/claims/mine/rejected", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return [];
        return readJson<SerializedClaim[]>(res);
      });

      setClaims(rows);
    },
    [user],
  );

  useEffect(() => {
    if (meLoading) return;
    if (!user || user.role !== "EMPLOYEE") {
      setClaims([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const key = claimsRejectedCacheKey(user.id);
    const cached = readClientCache<SerializedClaim[]>(key);
    if (cached) {
      setClaims(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    loadRejected()
      .finally(() => {
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setClaims([]);
      });

    return () => {
      cancelled = true;
    };
  }, [meLoading, user?.id, user?.role, loadRejected]);

  async function handleDeleted() {
    await loadRejected(true);
    await props.onChanged?.();
  }

  const rejected = claims.filter(
    (claim) =>
      claim.status === "REJECTED" &&
      (!user?.id || claim.employeeId === user.id),
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

  if (!user || user.role !== "EMPLOYEE") return null;

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
