"use client";

import { useEffect, useState } from "react";
import { useMe } from "@/components/me-provider";
import { ClaimTimeline } from "@/components/claim-timeline";
import { ReceiptGallery } from "@/components/receipt-gallery";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import type { SerializedClaim } from "@/lib/claim-types";
import { claimReceiptCount } from "@/lib/claim-receipt-count";
import { formatRole } from "@/lib/access-roles";
import { toTitleCase } from "@/lib/user-profile";
import { readJson } from "@/lib/api";
import {
  canInitiateClaimPayment,
  payoutInProgress,
} from "@/lib/claim-display-status";
import { RejectedClaimActions } from "@/components/rejected-claim-actions";
import { canDecideReimbursement } from "@/lib/claim-decide-access";

function payoutFailed(status: string | null) {
  return (
    status === "failed" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "reversed"
  );
}

function claimNeedsFullLoad(claim: SerializedClaim) {
  if (claim.receipts.length === 0 && (claim.receiptCount ?? 0) === 0) {
    return false;
  }
  return claim.receipts.length === 0 || !claim.receipts[0]?.url;
}

const claimDetailCache = new Map<string, SerializedClaim>();

function cacheClaimDetail(claim: SerializedClaim) {
  claimDetailCache.set(claim.id, claim);
}

function claimFromCache(stub: SerializedClaim): SerializedClaim | null {
  const cached = claimDetailCache.get(stub.id);
  if (!cached) return null;
  return {
    ...cached,
    ...stub,
    receipts: cached.receipts,
    receiptCount: cached.receipts.length,
  };
}

export function ClaimDetailModal(props: {
  claim: SerializedClaim | null;
  open: boolean;
  onClose: () => void;
  variant: "employee" | "admin" | "approver";
  onUpdated?: () => void | Promise<void>;
}) {
  const [detailClaim, setDetailClaim] = useState<SerializedClaim | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [paying, setPaying] = useState(false);
  const [syncingPayout, setSyncingPayout] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { user } = useMe();
  const canPay = canInitiateClaimPayment(user?.role, props.variant);

  useEffect(() => {
    if (!props.open || !props.claim) {
      setLoadingDetail(false);
      return;
    }

    const stub = props.claim;

    if (!claimNeedsFullLoad(stub)) {
      setDetailClaim(stub);
      setLoadingDetail(false);
      cacheClaimDetail(stub);
      return;
    }

    const cached = claimFromCache(stub);
    if (cached) {
      setDetailClaim(cached);
      setLoadingDetail(false);
      return;
    }

    let cancelled = false;
    setDetailClaim(stub);
    setLoadingDetail(true);

    fetch(`/api/claims/${stub.id}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then((res) => readJson<SerializedClaim>(res))
      .then((data) => {
        if (!cancelled) {
          cacheClaimDetail(data);
          setDetailClaim(data);
        }
      })
      .catch(() => {
        if (!cancelled) setDetailClaim(stub);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [props.open, props.claim]);

  useEffect(() => {
    if (!props.open || !props.claim) return;

    const current = detailClaim ?? props.claim;
    const payoutUnsettled =
      Boolean(current.razorpayPayoutId) &&
      current.status !== "PAID" &&
      !current.paidAt;
    if (!payoutUnsettled) return;

    function pollPayoutStatus() {
      fetch(`/api/claims/${current.id}`, { cache: "no-store" })
        .then((res) => readJson<SerializedClaim>(res))
        .then((data) => {
          cacheClaimDetail(data);
          setDetailClaim(data);
        })
        .catch(() => {});
    }

    const interval = window.setInterval(pollPayoutStatus, 8000);
    return () => window.clearInterval(interval);
  }, [
    props.open,
    props.claim,
    detailClaim?.id,
    detailClaim?.paidAt,
    detailClaim?.status,
    detailClaim?.razorpayPayoutId,
  ]);

  if (!props.claim) return null;

  const claim = detailClaim ?? props.claim;

  async function payClaim() {
    setError(null);
    setPaying(true);
    try {
      const url =
        props.variant === "admin"
          ? `/api/admin/claims/${claim.id}/pay`
          : `/api/claims/${claim.id}/pay`;
      const response = await fetch(url, { method: "POST" });
      const updated = await readJson<SerializedClaim>(response);
      cacheClaimDetail(updated);
      setDetailClaim(updated);
      await props.onUpdated?.();
      if (props.variant !== "admin") {
        props.onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not initiate payout.");
    } finally {
      setPaying(false);
    }
  }

  async function syncPayout() {
    setError(null);
    setSyncingPayout(true);
    try {
      const syncUrl =
        props.variant === "admin"
          ? `/api/admin/claims/${claim.id}/payout/sync`
          : `/api/claims/${claim.id}/payout/sync`;
      const response = await fetch(syncUrl, {
        method: "POST",
      });
      const updated = await readJson<SerializedClaim>(response);
      cacheClaimDetail(updated);
      setDetailClaim(updated);
      await props.onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh payout status.");
    } finally {
      setSyncingPayout(false);
    }
  }

  const canRetryPay =
    canPay &&
    claim.status === "APPROVED" &&
    payoutFailed(claim.payoutStatus);

  const payoutUnsettled =
    Boolean(claim.razorpayPayoutId) &&
    claim.status !== "PAID" &&
    !claim.paidAt;

  const canSyncPayout = payoutUnsettled;

  const receiptsTotal = claimReceiptCount(claim);
  const showSubmitterRole =
    props.variant === "admin" || props.variant === "approver";

  function summarySecondLine() {
    const branch = claim.branch.name;
    if (!showSubmitterRole) return branch;
    const role = claim.employee?.role
      ? formatRole(claim.employee.role)
      : null;
    return role ? `${branch} · ${role}` : branch;
  }

  async function decide(status: "APPROVED" | "REJECTED") {
    setError(null);
    setDeciding(true);
    try {
      const response = await fetch(`/api/claims/${claim.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          rejectionReason: status === "REJECTED" ? rejectionReason : undefined,
        }),
      });
      const updated = await readJson<
        SerializedClaim & { payoutWarning?: string }
      >(response);
      if (updated.payoutWarning) {
        setError(updated.payoutWarning);
        await props.onUpdated?.();
        return;
      }
      props.onClose();
      await props.onUpdated?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update this claim.",
      );
      await props.onUpdated?.();
    } finally {
      setDeciding(false);
    }
  }

  const modalSubtitle = showSubmitterRole
    ? toTitleCase(claim.employeeName)
    : undefined;

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      subtitle={modalSubtitle}
      headerLeading={
        <p className="text-3xl font-bold leading-tight font-tabular-nums tracking-tight text-zinc-900">
          ₹{claim.amount.toLocaleString("en-IN")}
        </p>
      }
    >
      <div className="space-y-8">
        <div>
          <div className="space-y-1">
            <p className="text-sm leading-relaxed text-zinc-900">
              {claim.category}: {claim.description}
            </p>
            <p className="text-sm text-zinc-600">{summarySecondLine()}</p>
          </div>
        </div>

        <ClaimTimeline claim={claim} />

        <ReceiptGallery
          receipts={claim.receipts}
          receiptCount={receiptsTotal}
          title="Receipts"
          compact
          hideCount
          loading={loadingDetail}
        />

        {claim.rejectionReason ? (
          <div className="rounded-xl border border-red-200 bg-red-50 py-3">
            <p className="text-xs font-medium text-zinc-500">Rejection reason</p>
            <p className="mt-1 text-sm text-red-800">{claim.rejectionReason}</p>
          </div>
        ) : null}

        {props.variant === "employee" &&
        claim.status === "REJECTED" &&
        user?.id &&
        claim.employeeId === user.id ? (
          <RejectedClaimActions
            claim={claim}
            userId={user.id}
            layout="stacked"
            onRefileClick={props.onClose}
            onDeleted={async () => {
              props.onClose();
              await props.onUpdated?.();
            }}
          />
        ) : null}

        {user && canDecideReimbursement(user, claim) ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rejection-reason">Rejection reason</Label>
              <Textarea
                id="rejection-reason"
                rows={1}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Missing receipt"
                className="min-h-11 resize-none"
              />
            </div>
            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              className="w-full"
              size="lg"
              disabled={deciding}
              onClick={() => decide("APPROVED")}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              className="w-full border-red-200 text-red-700 hover:bg-red-50"
              size="lg"
              disabled={deciding}
              onClick={() => decide("REJECTED")}
            >
              Reject
            </Button>
          </div>
        ) : null}

        {canPay &&
        claim.status === "APPROVED" &&
        !claim.paidAt &&
        !payoutInProgress(claim.payoutStatus) ? (
          <div className="space-y-4 border-t border-zinc-100 pt-8">
            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              className="w-full"
              size="lg"
              disabled={paying}
              onClick={payClaim}
            >
              {paying
                ? "Sending to RazorpayX…"
                : props.variant === "admin"
                  ? "Pay via RazorpayX"
                  : "Approve payment"}
            </Button>
          </div>
        ) : null}

        {canRetryPay ? (
          <div className="space-y-4 border-t border-zinc-100 pt-8">
            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              className="w-full"
              size="lg"
              disabled={paying}
              onClick={() => payClaim()}
            >
              {paying ? "Retrying payment…" : "Retry payment"}
            </Button>
            <p className="text-center text-xs text-zinc-500">
              Payment failed after approval. Retry sends money to the employee’s
              bank account.
            </p>
          </div>
        ) : null}

        {canSyncPayout ? (
          <div className="space-y-4 border-t border-zinc-100 pt-8">
            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              size="lg"
              disabled={syncingPayout}
              onClick={syncPayout}
            >
              {syncingPayout ? "Refreshing Payment Status…" : "Refresh Payment Status"}
            </Button>
            <p className="text-center text-xs text-zinc-500">
              Use this if Razorpay shows “processed” but the app hasn’t updated yet.
            </p>
          </div>
        ) : null}

        {payoutUnsettled && payoutInProgress(claim.payoutStatus) ? (
          <p className="border-t border-zinc-100 pt-8 text-sm text-blue-700">
            Payment is processing in RazorpayX. Status updates automatically every
            few seconds, or tap Refresh Payment Status.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
