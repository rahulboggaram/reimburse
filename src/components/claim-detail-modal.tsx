"use client";

import { useEffect, useMemo, useState } from "react";
import { useMe } from "@/components/me-provider";
import { ClaimTimeline } from "@/components/claim-timeline";
import { ReceiptGallery } from "@/components/receipt-gallery";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SerializedClaim } from "@/lib/claim-types";
import { claimReceiptCount } from "@/lib/claim-receipt-count";
import { formatRole } from "@/lib/access-roles";
import { toTitleCase } from "@/lib/user-profile";
import { readJson } from "@/lib/api";
import {
  canInitiateClaimPayment,
  payoutInProgress,
} from "@/lib/claim-display-status";
import {
  claimNeedsPayoutStatusRefresh,
  readPayoutWatchIds,
  refreshClaimPayoutFromServer,
  registerPayoutWatch,
} from "@/lib/payout-sync-client";
import { RejectedClaimActions } from "@/components/rejected-claim-actions";
import { canDecideReimbursement } from "@/lib/claim-decide-access";
import { readLocalReceiptPreviews } from "@/lib/local-receipt-previews";

function payoutFailed(status: string | null) {
  return (
    status === "failed" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "reversed"
  );
}

function claimDetailReady(claim: SerializedClaim) {
  return Boolean(claim.branch?.name?.trim());
}

function claimReceiptsReady(claim: SerializedClaim) {
  const expected = claimReceiptCount(claim);
  if (expected === 0) return true;
  return (
    claim.receipts.length >= expected &&
    claim.receipts.every((receipt) => Boolean(receipt.url))
  );
}

function claimNeedsFullLoad(claim: SerializedClaim) {
  if (claim.submitError || claim.id.startsWith("pending-")) return false;
  if (!claimReceiptsReady(claim)) return true;
  if (claim.queueList) return true;
  if (!claimDetailReady(claim)) return true;
  return false;
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
    branch: stub.branch?.name?.trim() ? stub.branch : cached.branch,
    employee:
      stub.employee.phone || stub.employee.name
        ? stub.employee
        : cached.employee,
    approver: stub.approver.name?.trim() ? stub.approver : cached.approver,
    paymentApprover: stub.paymentApprover.name?.trim()
      ? stub.paymentApprover
      : cached.paymentApprover,
    receipts:
      cached.receipts.length >= (stub.receiptCount ?? cached.receiptCount ?? 0) &&
      cached.receipts.length > 0
        ? cached.receipts
        : stub.receipts.length > 0
          ? stub.receipts
          : cached.receipts,
    receiptCount: Math.max(
      stub.receiptCount ?? 0,
      cached.receiptCount ?? 0,
      cached.receipts.length,
      stub.receipts.length,
    ),
  };
}

function claimFromCache(stub: SerializedClaim): SerializedClaim | null {
  const cached = claimDetailCache.get(stub.id);
  if (!cached) return null;
  return mergeClaimDetail(cached, stub);
}

export type ClaimInstantAction = "approve" | "reject" | "pay";

export function ClaimDetailModal(props: {
  claim: SerializedClaim | null;
  open: boolean;
  onClose: () => void;
  variant: "employee" | "admin" | "approver";
  onUpdated?: () => void | Promise<void>;
  /** Remove the claim from the queue immediately while the server catches up. */
  onInstantAction?: (input: {
    claimId: string;
    action: ClaimInstantAction;
  }) => void;
  onActionFeedback?: (message: string) => void;
}) {
  const [detailClaim, setDetailClaim] = useState<SerializedClaim | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { user } = useMe();
  const canPay = canInitiateClaimPayment(user?.role, props.variant);

  useEffect(() => {
    if (!props.open) {
      setDetailClaim(null);
      setLoadingDetail(false);
      return;
    }
    if (!props.claim) {
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
    if (cached && claimDetailReady(cached) && claimReceiptsReady(cached)) {
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
    const watchActive = readPayoutWatchIds().includes(current.id);
    const payoutUnsettled =
      watchActive ||
      claimNeedsPayoutStatusRefresh(current) ||
      (current.status === "APPROVED" &&
        !current.paidAt &&
        Boolean(current.payoutInitiatedAt) &&
        !payoutFailed(current.payoutStatus));
    if (!payoutUnsettled) return;

    let cancelled = false;

    function pollPayoutStatus() {
      void refreshClaimPayoutFromServer(current.id, props.variant).then(
        (data) => {
          if (cancelled || !data) return;
          cacheClaimDetail(data);
          setDetailClaim(data);
          if (data.status === "PAID" || data.paidAt) {
            void props.onUpdated?.();
          }
        },
      );
    }

    pollPayoutStatus();
    const interval = window.setInterval(pollPayoutStatus, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    props.open,
    props.claim,
    props.variant,
    detailClaim?.id,
    detailClaim?.paidAt,
    detailClaim?.status,
    detailClaim?.razorpayPayoutId,
    detailClaim?.payoutStatus,
    detailClaim?.payoutInitiatedAt,
    props.onUpdated,
  ]);

  useEffect(() => {
    if (!props.open || !props.claim) return;

    const current = detailClaim ?? props.claim;
    const expected = claimReceiptCount(current);
    const loaded = current.receipts.length;
    if (expected === 0 || loaded >= expected) return;

    let cancelled = false;

    function refreshClaimDetail() {
      fetch(`/api/claims/${current.id}`, {
        cache: "no-store",
        credentials: "include",
      })
        .then((res) => readJson<SerializedClaim>(res))
        .then((data) => {
          if (cancelled) return;
          cacheClaimDetail(data);
          setDetailClaim(data);
        })
        .catch(() => {});
    }

    refreshClaimDetail();
    const interval = window.setInterval(refreshClaimDetail, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    props.open,
    props.claim,
    detailClaim?.id,
    detailClaim?.receipts.length,
    detailClaim?.receiptCount,
  ]);

  const resolvedClaim = detailClaim ?? props.claim;

  const localReceiptPreviews = useMemo(
    () =>
      resolvedClaim && props.open
        ? readLocalReceiptPreviews(resolvedClaim.id) ?? []
        : [],
    [resolvedClaim?.id, props.open],
  );

  const galleryReceipts = useMemo(() => {
    if (!resolvedClaim) return [];

    const expected = claimReceiptCount(resolvedClaim);
    const loaded = resolvedClaim.receipts;
    const count = Math.max(expected, loaded.length, localReceiptPreviews.length);

    if (count === 0) return [];

    return Array.from({ length: count }, (_, index) => {
      const loadedReceipt = loaded[index];
      const local = localReceiptPreviews[index];

      if (loadedReceipt?.url) {
        return {
          ...loadedReceipt,
          previewFallbackUrl: local?.url,
        };
      }

      if (local) {
        return {
          id: `local-${resolvedClaim.id}-${index}`,
          url: local.url,
          fileName: local.fileName,
          mimeType: local.mimeType,
          previewFallbackUrl: local.url,
        };
      }

      return {
        id: `placeholder-${resolvedClaim.id}-${index}`,
        url: "",
        fileName: `Receipt ${index + 1}`,
        mimeType: "image/jpeg",
      };
    });
  }, [resolvedClaim, localReceiptPreviews]);

  if (!props.claim) return null;

  const claim = resolvedClaim ?? props.claim;

  function payClaim() {
    setError(null);
    const claimId = claim.id;
    registerPayoutWatch(claimId, props.variant);
    props.onInstantAction?.({ claimId, action: "pay" });
    props.onClose();

    void (async () => {
      try {
        const url =
          props.variant === "admin"
            ? `/api/admin/claims/${claim.id}/pay`
            : `/api/claims/${claim.id}/pay`;
        const response = await fetch(url, { method: "POST" });
        const updated = await readJson<SerializedClaim>(response);
        cacheClaimDetail(updated);
        void props.onUpdated?.();
      } catch (err) {
        props.onActionFeedback?.(
          err instanceof Error ? err.message : "Could not initiate payout.",
        );
        void props.onUpdated?.();
      }
    })();
  }

  const paymentFailed = payoutFailed(claim.payoutStatus);
  const showPayAction =
    canPay &&
    claim.status === "APPROVED" &&
    !claim.paidAt &&
    !payoutInProgress(claim.payoutStatus);

  const receiptsTotal = claimReceiptCount(claim);
  const receiptsStillLoading =
    loadingDetail ||
    (receiptsTotal > 0 &&
      galleryReceipts.some(
        (receipt) =>
          receipt.id.startsWith("placeholder-") || !receipt.url,
      ));
  const employeeRole = claim.employee?.role
    ? formatRole(claim.employee.role)
    : null;

  function decide(status: "APPROVED" | "REJECTED") {
    setError(null);
    if (status === "REJECTED" && !rejectionReason.trim()) {
      setError("Please add a reason for rejection.");
      return;
    }

    const claimId = claim.id;
    const action = status === "APPROVED" ? "approve" : "reject";
    if (status === "APPROVED" && props.variant === "admin") {
      registerPayoutWatch(claimId, props.variant);
    }
    props.onInstantAction?.({ claimId, action });
    props.onClose();

    void (async () => {
      try {
        const response = await fetch(`/api/claims/${claim.id}/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            rejectionReason: status === "REJECTED" ? rejectionReason : undefined,
          }),
        });
        await readJson<SerializedClaim>(response);
        void props.onUpdated?.();
      } catch (err) {
        props.onActionFeedback?.(
          err instanceof Error ? err.message : "Could not update this claim.",
        );
        void props.onUpdated?.();
      }
    })();
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
              {employeeRole && claim.branch?.name?.trim()
                ? `${claim.branch.name} · ${employeeRole}`
                : claim.branch?.name?.trim() || employeeRole || ""}
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
          receipts={galleryReceipts}
          receiptCount={receiptsTotal}
          title="Receipts"
          compact
          hideCount
          loading={receiptsStillLoading}
        />

        {props.variant === "employee" && claim.submitError ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"
          >
            <p className="text-xs font-medium text-zinc-500">Could not submit</p>
            <p className="mt-1 text-sm text-red-800">{claim.submitError}</p>
            <p className="mt-2 text-sm text-red-800">
              Go to New Claim and try again with your receipt photos.
            </p>
          </div>
        ) : null}

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
            <Input
              id="rejection-reason"
              type="text"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="If claim is rejected, add reason for rejection here"
              aria-label="Reason for rejection"
              className={cn(
                "border-[1.5px] border-zinc-300 placeholder:text-zinc-400",
                "focus-visible:border-accent focus-visible:ring-accent/20",
              )}
            />
            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              className="w-full"
              size="sm"
              onClick={() => decide("APPROVED")}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              className="w-full border-red-200 text-red-700 hover:bg-red-50"
              size="sm"
              onClick={() => decide("REJECTED")}
            >
              Reject
            </Button>
          </div>
        ) : null}

        {showPayAction ? (
          <div className="space-y-4 border-t border-zinc-100 pt-8">
            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="w-full" size="sm" onClick={payClaim}>
              {paymentFailed
                ? "Retry payment"
                : props.variant === "admin"
                  ? "Pay via RazorpayX"
                  : "Approve payment"}
            </Button>
            {paymentFailed ? (
              <p className="text-center text-xs text-zinc-500">
                Payment failed after approval. Retry sends money to the
                employee’s bank account.
              </p>
            ) : null}
          </div>
        ) : null}

      </div>
    </Modal>
  );
}
