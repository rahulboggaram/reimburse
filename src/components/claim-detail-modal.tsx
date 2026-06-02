"use client";

import Link from "next/link";
import { useState } from "react";
import { ReceiptGallery } from "@/components/receipt-gallery";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import type { SerializedClaim } from "@/lib/claim-types";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/dates";
import { formatPhoneDisplay } from "@/lib/phone";
import { readJson } from "@/lib/api";

function payoutInProgress(status: string | null) {
  return status === "queued" || status === "pending" || status === "processing";
}

function payoutFailed(status: string | null) {
  return (
    status === "failed" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "reversed"
  );
}

function claimStatusLabel(claim: SerializedClaim) {
  if (claim.status === "APPROVED" && payoutInProgress(claim.payoutStatus)) {
    return "paying";
  }
  return claim.status;
}

function DetailRow(props: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500">{props.label}</p>
      <p className="text-sm text-zinc-900">{props.value}</p>
    </div>
  );
}

export function ClaimDetailModal(props: {
  claim: SerializedClaim | null;
  open: boolean;
  onClose: () => void;
  variant: "employee" | "admin" | "approver";
  employeePhone?: string | null;
  onUpdated?: () => void;
}) {
  const [deciding, setDeciding] = useState(false);
  const [paying, setPaying] = useState(false);
  const [syncingPayout, setSyncingPayout] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const claim = props.claim;
  if (!claim) return null;

  async function payClaim() {
    setError(null);
    setPaying(true);
    try {
      const url =
        props.variant === "admin"
          ? `/api/admin/claims/${claim!.id}/pay`
          : `/api/claims/${claim!.id}/pay`;
      const response = await fetch(url, { method: "POST" });
      await readJson(response);
      props.onClose();
      props.onUpdated?.();
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
      const response = await fetch(`/api/admin/claims/${claim!.id}/payout/sync`, {
        method: "POST",
      });
      await readJson(response);
      props.onUpdated?.();
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

  const expenseDate = formatDisplayDate(claim.expenseDate);

  async function decide(status: "APPROVED" | "REJECTED") {
    setError(null);
    setDeciding(true);
    try {
      const response = await fetch(`/api/claims/${claim!.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          rejectionReason: status === "REJECTED" ? rejectionReason : undefined,
        }),
      });
      await readJson(response);
      props.onClose();
      props.onUpdated?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update this claim.",
      );
      props.onUpdated?.();
    } finally {
      setDeciding(false);
    }
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={claim.category}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-semibold font-tabular-nums text-zinc-900">
              ₹{claim.amount.toLocaleString("en-IN")}
            </p>
            {props.variant === "admin" || props.variant === "approver" ? (
              <p className="mt-1 text-sm font-medium text-zinc-700">
                {claim.employeeName}
                {props.employeePhone ? (
                  <span className="font-normal text-zinc-500">
                    {" "}
                    · {formatPhoneDisplay(props.employeePhone)}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <StatusBadge status={claimStatusLabel(claim)} />
        </div>

        {showPayoutInfo ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 space-y-2">
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
              <DetailRow label="Payout ID" value={claim.razorpayPayoutId} />
            ) : null}
            {claim.payoutError ? (
              <p className="text-sm text-red-700">{claim.payoutError}</p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <DetailRow label="Expense date" value={expenseDate} />
          <DetailRow label="Submitted" value={formatDisplayDateTime(claim.createdAt)} />
          <DetailRow
            label={
              claim.status === "PENDING" && props.variant === "admin"
                ? "Awaiting approval from"
                : "Branch approver"
            }
            value={claim.approver.name ?? "—"}
          />
          <DetailRow
            label="Receipts"
            value={`${claim.receipts.length} attached`}
          />
        </div>

        <div>
          <p className="text-xs font-medium text-zinc-500">Description</p>
          <p className="mt-1 text-sm text-zinc-900">{claim.description}</p>
        </div>

        {claim.rejectionReason ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs font-medium text-red-800">Rejection reason</p>
            <p className="mt-1 text-sm text-red-800">{claim.rejectionReason}</p>
          </div>
        ) : null}

        <ReceiptGallery receipts={claim.receipts} title="Receipt Photos" />

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
          <div className="space-y-3 border-t border-zinc-100 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="rejection-reason">Rejection reason (if rejecting)</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Missing receipt"
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

        {(props.variant === "approver" || props.variant === "admin") &&
        claim.status === "APPROVED" &&
        !claim.paidAt &&
        !payoutInProgress(claim.payoutStatus) ? (
          <div className="space-y-3 border-t border-zinc-100 pt-4">
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
              {paying ? "Approving…" : "Approve payment"}
            </Button>
          </div>
        ) : null}

        {canRetryPay ? (
          <div className="space-y-2 border-t border-zinc-100 pt-4">
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
            <p className="text-xs text-zinc-500 text-center">
              Payment failed after approval. Retry sends money to the employee’s
              bank account.
            </p>
          </div>
        ) : null}

        {canSyncPayout ? (
          <div className="space-y-2 border-t border-zinc-100 pt-4">
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
            <p className="text-xs text-zinc-500 text-center">
              Use this if Razorpay shows “processed” but the app hasn’t updated yet.
            </p>
          </div>
        ) : null}

        {props.variant === "admin" &&
        claim.status === "APPROVED" &&
        payoutInProgress(claim.payoutStatus) ? (
          <p className="text-sm text-blue-700 border-t border-zinc-100 pt-4">
            Payout is in progress. This usually completes within a few minutes.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
