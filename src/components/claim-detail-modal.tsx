"use client";

import { useEffect, useState } from "react";
import { useMe } from "@/components/me-provider";
import { ClaimTimeline } from "@/components/claim-timeline";
import { ReceiptGallery } from "@/components/receipt-gallery";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FloatingTextarea } from "@/components/ui/floating-field";
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
  if (claim.queueList) return true;
  if (!claim.branch?.name?.trim()) return true;
  if (claim.receipts.length === 0 && (claim.receiptCount ?? 0) === 0) {
    return false;
  }
  return claim.receipts.length === 0 || !claim.receipts[0]?.url;
}

const claimDetailCache = new Map<string, SerializedClaim>();

function cacheClaimDetail(claim: SerializedClaim) {
  claimDetailCache.set(claim.id, claim);
}

function mergeClaimDetail(
  cached: SerializedClaim,
  stub: SerializedClaim,
): SerializedClaim {
  return {
    ...cached,
    ...stub,
    branch: stub.branch.name.trim() ? stub.branch : cached.branch,
    employee:
      stub.employee.phone || stub.employee.name
        ? stub.employee
        : cached.employee,
    approver: stub.approver.name?.trim() ? stub.approver : cached.approver,
    paymentApprover: stub.paymentApprover.name?.trim()
      ? stub.paymentApprover
      : cached.paymentApprover,
    receipts: cached.receipts.length > 0 ? cached.receipts : stub.receipts,
    receiptCount:
      cached.receipts.length > 0
        ? cached.receipts.length
        : (stub.receiptCount ?? cached.receiptCount),
  };
}

function claimFromCache(stub: SerializedClaim): SerializedClaim | null {
  const cached = claimDetailCache.get(stub.id);
  if (!cached) return null;
  return mergeClaimDetail(cached, stub);
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

    const interval = window.setInterval(pollPayoutStatus, 20_000);
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

  const canRetryPay =
    canPay &&
    claim.status === "APPROVED" &&
    payoutFailed(claim.payoutStatus);

  const receiptsTotal = claimReceiptCount(claim);
  const employeeRole = claim.employee?.role
    ? formatRole(claim.employee.role)
    : null;

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

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      headerLeading={
        <p className="text-3xl font-bold leading-tight font-tabular-nums tracking-tight text-zinc-900">
          ₹{claim.amount.toLocaleString("en-IN")}
        </p>
      }
    >
      <div className="space-y-8">
        <div>
          <div className="space-y-1 pt-4">
            <p className="text-sm font-medium leading-snug text-zinc-900">
              {toTitleCase(claim.employeeName)}
            </p>
            <p className="text-sm text-zinc-600">
              {employeeRole
                ? `${claim.branch.name} · ${employeeRole}`
                : claim.branch.name}
            </p>
          </div>

          <div className="mt-8">
            <p className="text-sm leading-relaxed text-zinc-600">
              {claim.description.trim()
                ? `${claim.category} · ${claim.description}`
                : claim.category}
            </p>
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
            <FloatingTextarea
              id="rejection-reason"
              label="Reason for rejection"
              rows={2}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="resize-none"
            />
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

      </div>
    </Modal>
  );
}
