"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/components/me-provider";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import { ClaimListRow } from "@/components/claim-list-row";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { formatDisplayDate } from "@/lib/dates";
import { readJson } from "@/lib/api";
import { claimReceiptCount } from "@/lib/claim-receipt-count";
import {
  fetchClientCache,
  invalidateClientCache,
  writeClientCache,
} from "@/lib/client-cache";
import { claimsMineCacheKey, claimsRejectedCacheKey } from "@/lib/claims-cache";
import type { SerializedClaim } from "@/lib/claim-types";
import { toTitleCase } from "@/lib/user-profile";

function rejectorLabel(claim: SerializedClaim) {
  const name = claim.approver?.name?.trim();
  if (name) return toTitleCase(name);
  return "Your approver";
}

export function RejectedClaimsSection() {
  const { user, loading: meLoading } = useMe();
  const [claims, setClaims] = useState<SerializedClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SerializedClaim | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedClaim | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadRejected = useCallback(async () => {
    if (!user) {
      setClaims([]);
      return;
    }

    const rows = await fetchClientCache(claimsRejectedCacheKey(user.id), async () => {
      const res = await fetch("/api/claims/mine/rejected");
      return readJson<SerializedClaim[]>(res);
    });
    setClaims(rows);
  }, [user]);

  useEffect(() => {
    if (meLoading) return;
    if (!user) {
      setClaims([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    loadRejected().finally(() => setLoading(false));
  }, [meLoading, user, loadRejected]);

  async function confirmDelete() {
    if (!deleteTarget || !user) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/claims/${deleteTarget.id}`, {
        method: "DELETE",
      });
      await readJson<{ ok: boolean }>(response);

      const nextClaims = claims.filter((c) => c.id !== deleteTarget.id);
      setClaims(nextClaims);
      writeClientCache(claimsRejectedCacheKey(user.id), nextClaims, 5 * 60 * 1000);
      invalidateClientCache(claimsMineCacheKey(user.id));

      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete this reimbursement.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const rejected = claims.filter(
    (claim) => claim.status === "REJECTED" && claim.employeeId === user?.id,
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
            ? "One claim was rejected. Review the reason and resubmit."
            : `${rejected.length} claims were rejected. Review the reasons and resubmit.`}
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
                <Card className="border-red-200 bg-red-50/80 py-3 ring-0">
                  <p className="text-sm text-red-900">
                    <span className="font-medium">Reason: </span>
                    {reason}
                  </p>
                </Card>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Link
                  href={`/employee/refile/${claim.id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Edit and resubmit
                </Link>
                <button
                  type="button"
                  className="text-sm font-medium text-red-600 hover:text-red-800"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(claim);
                  }}
                >
                  Delete permanently
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <ClaimDetailModal
        claim={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        variant="employee"
      />

      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        title="Delete reimbursement?"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-700">
            This will permanently remove{" "}
            <span className="font-medium">{deleteTarget?.category}</span> (₹
            {deleteTarget?.amount.toLocaleString("en-IN")}) and its receipts. You
            cannot undo this.
          </p>
          {deleteError ? (
            <p className="text-sm text-red-700" role="alert">
              {deleteError}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="button"
              size="lg"
              className="w-full bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? "Deleting…" : "Yes, delete permanently"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
