"use client";

import Link from "next/link";
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
import { formatDisplayDateTime } from "@/lib/dates";
import { formatPhoneDisplay } from "@/lib/phone";
import { readJson } from "@/lib/api";
import {
  canInitiateClaimPayment,
  payoutInProgress,
} from "@/lib/claim-display-status";

function payoutFailed(status: string | null) {
  return (
    status === "failed" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "reversed"
  );
}

function DetailRow(props: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-zinc-500">{props.label}</p>
      <p className="text-base text-zinc-900">{props.value}</p>
    </div>
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
  employeePhone?: string | null;
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

    fetch(`/api/claims/${stub.id}`)
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
      const response = await fetch(`/api/admin/claims/${claim.id}/payout/sync`, {
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
    claim.status === "APPROVED" && payoutFailed(claim.payoutStatus) && props.variant === "admin";

  const canSyncPayout =
    props.variant === "admin" &&
    claim.status === "APPROVED" &&
    Boolean(claim.razorpayPayoutId);

  const showPayoutInfo =
    claim.razorpayPayoutId ||
    claim.payoutStatus ||
    claim.paidAt ||
    claim.payoutError;

  const receiptsTotal = claimReceiptCount(claim);

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
      await readJson(response);
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

  const modalSubtitle =
    (props.variant === "admin" || props.variant === "approver") &&
    props.employeePhone
      ? formatPhoneDisplay(props.employeePhone)
      : undefined;

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      subtitle={modalSubtitle}
    >
      <div className="space-y-8">
        <div>
          <div>
            <p className="text-lg font-bold font-tabular-nums text-zinc-900">
              ₹{claim.amount.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              by {toTitleCase(claim.employeeName)}
            </p>
          </div>

          <div className="mt-8 space-y-1">
            <p className="text-xs font-medium text-zinc-500">{claim.category}</p>
            <p className="text-sm leading-relaxed text-zinc-600">
              {claim.description}
            </p>
          </div>
        </div>

        {showPayoutInfo ? (
          <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Payment
            </p>
            {claim.paidAt ? (
              <DetailRow
                label="Paid on"
                value={formatDisplayDateTime(claim.paidAt)}
              />
            ) : null}
            {claim.payoutStatus ? (
              <DetailRow
                label="Payout status"
                value={claim.payoutStatus}
              />
            ) : null}
            {claim.payoutUtr ? (
              <DetailRow label="UTR" value={claim.payoutUtr} />
            ) : null}
            {claim.razorpayPayoutId ? (
              <>
                <DetailRow label="Payout ID" value={claim.razorpayPayoutId} />
                {claim.razorpayPayoutId.startsWith("pout_mock_") ? (
                  <p className="text-sm text-amber-800">
                    This was a demo payout only. It will not appear in RazorpayX.
                    Set <span className="font-medium">RAZORPAYX_MOCK=false</span>{" "}
                    on Vercel and use real test keys.
                  </p>
                ) : (
                  <p className="text-sm text-zinc-600">
                    Search this payout ID in RazorpayX under{" "}
                    <span className="font-medium">Payouts</span>.
                  </p>
                )}
              </>
            ) : null}
            {claim.payoutError ? (
              <p className="text-sm text-red-700">{claim.payoutError}</p>
            ) : null}
          </div>
        ) : null}

        <ReceiptGallery
          receipts={claim.receipts}
          receiptCount={receiptsTotal}
          title="Receipts"
          compact
          hideCount
          loading={loadingDetail}
        />

        <ClaimTimeline claim={claim} />

        {claim.rejectionReason ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs font-medium text-zinc-500">Rejection reason</p>
            <p className="mt-1 text-sm text-red-800">{claim.rejectionReason}</p>
          </div>
        ) : null}

        {props.variant === "employee" && claim.status === "REJECTED" ? (
          <Link
            href={`/employee/refile/${claim.id}`}
            className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            onClick={props.onClose}
          >
            Edit & refile
          </Link>
        ) : null}

        {(props.variant === "approver" || props.variant === "admin") &&
        claim.status === "PENDING" ? (
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

        {props.variant === "admin" &&
        claim.status === "APPROVED" &&
        payoutInProgress(claim.payoutStatus) ? (
          <p className="border-t border-zinc-100 pt-8 text-sm text-blue-700">
            Payout is in progress. This usually completes within a few minutes.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
