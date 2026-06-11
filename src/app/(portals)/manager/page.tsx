"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApprovalsEmptyState } from "@/components/approvals-empty-state";
import {
  ApprovalsTableHeader,
  ApprovalsTableRow,
} from "@/components/approvals-table";
import { useMe } from "@/components/me-provider";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import { Card } from "@/components/ui/card";
import { SegmentControl } from "@/components/segment-control";
import type { SerializedClaim } from "@/lib/claim-types";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { readJson } from "@/lib/api";
import { isAdminApprovalQueueClaim } from "@/lib/claim-decide-access";
import {
  fetchClientCache,
  invalidateClientCache,
  readClientCache,
  writeClientCache,
} from "@/lib/client-cache";
import type { ClaimInstantAction } from "@/components/claim-detail-modal";
import { registerPayoutWatches } from "@/lib/payout-sync-client";
import {
  collectPayoutRefreshClaimIds,
  usePayoutWatchPolling,
} from "@/lib/use-payout-watch-polling";

type ActionCounts = {
  paymentWaiting: number;
  adminPending: number;
};

type BulkActionSummary = {
  total: number;
  succeeded: number;
  failed: number;
  results: { claimId: string; employeeName: string; ok: boolean; error?: string }[];
};

type QueueTab = "waiting" | "approved";

const TABS: QueueTab[] = ["waiting", "approved"];

const QUEUE_SEGMENTS: { id: QueueTab; label: string }[] = [
  { id: "waiting", label: "Waiting" },
  { id: "approved", label: "Approved" },
];

const PAYMENT_APPROVER_SEGMENTS: { id: QueueTab; label: string }[] = [
  { id: "waiting", label: "Awaiting payment" },
  { id: "approved", label: "Sent to Razorpay" },
];

function cacheKey(tab: QueueTab) {
  return `claims-pending-${tab}`;
}

function usesPaymentApproverTabs(role: string | undefined) {
  return role === "APPROVER" || role === "ADMIN";
}

function queueSegments(role: string | undefined) {
  return usesPaymentApproverTabs(role)
    ? PAYMENT_APPROVER_SEGMENTS
    : QUEUE_SEGMENTS;
}

type TabPayload = {
  claims: SerializedClaim[];
  counts: ActionCounts | null;
};

function readTabCache(tab: QueueTab): TabPayload | null {
  return readClientCache<TabPayload>(cacheKey(tab));
}

export default function ManagerPendingPage() {
  const { user } = useMe();
  const [tab, setTab] = useState<QueueTab>("waiting");
  const [claims, setClaims] = useState<SerializedClaim[]>(
    () => readTabCache("waiting")?.claims ?? [],
  );
  const [loading, setLoading] = useState(() => !readTabCache("waiting"));
  const [selected, setSelected] = useState<SerializedClaim | null>(null);
  const [counts, setCounts] = useState<ActionCounts | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const showStatus = !(user?.role === "BRANCH_MANAGER" && tab === "approved");

  const isApprover = user?.role === "APPROVER";
  const isAdmin = user?.role === "ADMIN";
  const wantsCounts = isApprover || isAdmin;

  const fetchTab = useCallback(async (activeTab: QueueTab): Promise<TabPayload> => {
    const response = await fetch(`/api/claims/pending?tab=${activeTab}`);
    const data = await readJson<
      SerializedClaim[] | { claims: SerializedClaim[] }
    >(response);
    const claims = Array.isArray(data) ? data : data.claims;
    return { claims, counts: null };
  }, []);

  const applyTabPayload = useCallback((payload: TabPayload) => {
    setClaims(payload.claims);
    if (payload.counts) setCounts(payload.counts);
  }, []);

  const loadTab = useCallback(
    async (activeTab: QueueTab, fresh = false) => {
      if (fresh) invalidateClientCache(cacheKey(activeTab));
      return fetchClientCache(
        cacheKey(activeTab),
        () => fetchTab(activeTab),
        90_000,
      );
    },
    [fetchTab],
  );

  const loadActionCounts = useCallback(async (): Promise<ActionCounts | null> => {
    if (!wantsCounts) return null;
    const response = await fetch("/api/claims/action-counts");
    return readJson<ActionCounts>(response);
  }, [wantsCounts]);

  const patchTabCache = useCallback(
    (activeTab: QueueTab, nextClaims: SerializedClaim[]) => {
      const cached = readTabCache(activeTab);
      writeClientCache(
        cacheKey(activeTab),
        { claims: nextClaims, counts: cached?.counts ?? null },
        90_000,
      );
    },
    [],
  );

  const removeClaimsFromQueue = useCallback(
    (claimIds: string[]) => {
      if (claimIds.length === 0) return;
      const idSet = new Set(claimIds);
      setClaims((current) => {
        const next = current.filter((claim) => !idSet.has(claim.id));
        patchTabCache(tab, next);
        return next;
      });
      setSelected(null);
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of claimIds) next.delete(id);
        return next;
      });
    },
    [patchTabCache, tab],
  );

  const refreshQueue = useCallback(
    async (options?: { silent?: boolean }) => {
      invalidateClientCache("claims-pending");
      if (!options?.silent) setLoading(true);
      const data = await loadTab(tab, true);
      applyTabPayload(data);
      if (!options?.silent) setLoading(false);
      if (wantsCounts) {
        void loadActionCounts().then((nextCounts) => {
          if (nextCounts) setCounts(nextCounts);
        });
      }
      void Promise.all(
        TABS.filter((t) => t !== tab).map((t) => loadTab(t, true)),
      );
    },
    [loadTab, loadActionCounts, tab, applyTabPayload, wantsCounts],
  );

  function handleInstantAction(input: {
    claimId: string;
    action: ClaimInstantAction;
  }) {
    removeClaimsFromQueue([input.claimId]);
    if (input.action === "pay") {
      registerPayoutWatches(
        [input.claimId],
        isAdmin ? "admin" : "approver",
      );
    }
    if (input.action === "approve") {
      setBulkMessage("Approved. Payment continues in the background.");
    } else if (input.action === "pay") {
      setBulkMessage("Sent to Razorpay. Status will update shortly.");
    } else {
      setBulkMessage("Claim rejected.");
    }
  }

  const payoutRefreshIds = useMemo(
    () => collectPayoutRefreshClaimIds(claims),
    [claims],
  );

  const lastQueueRefreshAt = useRef(0);
  const refreshQueueForPayout = useCallback(() => {
    const now = Date.now();
    if (now - lastQueueRefreshAt.current < 20_000) return;
    lastQueueRefreshAt.current = now;
    void refreshQueue({ silent: true });
  }, [refreshQueue]);

  usePayoutWatchPolling({
    claimIds: payoutRefreshIds,
    onTick: refreshQueueForPayout,
  });

  const hasApprovableInQueue = claims.some((claim) =>
    isAdminApprovalQueueClaim({
      status: claim.status,
      approverId: claim.approverId,
      employee: claim.employee,
      approver: claim.approver,
      branch: claim.branch,
    }),
  );
  const hasPayableInQueue = claims.some((claim) => claim.status === "APPROVED");
  const showSelectable =
    tab === "waiting" && (isApprover || isAdmin) && claims.length > 0;
  const showApproveSelected =
    isAdmin && tab === "waiting" && hasApprovableInQueue;
  const showPaySelected =
    tab === "waiting" && (isApprover || isAdmin) && hasPayableInQueue;
  const bulkActionsVisible =
    tab === "waiting" && (showApproveSelected || showPaySelected);

  const selectedClaims = claims.filter((claim) => selectedIds.has(claim.id));
  const selectedApproveIds = selectedClaims
    .filter((claim) =>
      isAdminApprovalQueueClaim({
        status: claim.status,
        approverId: claim.approverId,
        employee: claim.employee,
        approver: claim.approver,
        branch: claim.branch,
      }),
    )
    .map((claim) => claim.id);
  const selectedPayIds = selectedClaims
    .filter((claim) => claim.status === "APPROVED")
    .map((claim) => claim.id);

  const allSelected =
    claims.length > 0 && selectedIds.size === claims.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const showCategory = tab === "approved" && user?.role === "BRANCH_MANAGER";

  function toggleClaimSelection(claimId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(claimId)) next.delete(claimId);
      else next.add(claimId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      current.size === claims.length
        ? new Set()
        : new Set(claims.map((claim) => claim.id)),
    );
  }

  function handleTabChange(next: QueueTab) {
    if (next === tab) return;
    setTab(next);
    setSelected(null);
    setSelectedIds(new Set());
    const cached = readTabCache(next);
    if (cached) {
      setClaims(cached.claims);
      if (cached.counts) setCounts(cached.counts);
    } else {
      setClaims([]);
    }
    setLoading(!cached);
    if (wantsCounts) {
      void loadActionCounts().then((nextCounts) => {
        if (nextCounts) setCounts(nextCounts);
      });
    }
  }

  useEffect(() => {
    let cancelled = false;
    setFetchError(null);

    const cached = readTabCache(tab);
    if (cached) {
      applyTabPayload(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    void loadTab(tab)
      .then((data) => {
        if (!cancelled) {
          applyTabPayload(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(
            err instanceof Error
              ? err.message
              : "Could not load approvals. Try again.",
          );
          setLoading(false);
        }
      });

    if (wantsCounts) {
      void loadActionCounts().then((nextCounts) => {
        if (!cancelled && nextCounts) setCounts(nextCounts);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [tab, loadTab, loadActionCounts, applyTabPayload, wantsCounts]);

  useEffect(() => {
    if (!wantsCounts) return;
    const other = TABS.find((t) => t !== tab);
    if (!other || readTabCache(other)) return;
    const timer = window.setTimeout(() => {
      void fetchClientCache(cacheKey(other), () => fetchTab(other));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [fetchTab, tab, wantsCounts]);

  function runBulk(
    endpoint: string,
    claimIds: string[],
    confirmText: string,
    emptyText: string,
  ) {
    if (claimIds.length === 0) {
      setBulkMessage("Nothing in the queue to process.");
      return;
    }
    if (!window.confirm(confirmText)) return;

    const processingIds = [...claimIds];
    removeClaimsFromQueue(processingIds);
    if (endpoint.includes("bulk-pay")) {
      registerPayoutWatches(
        processingIds,
        isAdmin ? "admin" : "approver",
      );
    }

    const isPay = endpoint.includes("bulk-pay");
    setBulkMessage(
      isPay
        ? `Sending ${processingIds.length} payment${processingIds.length === 1 ? "" : "s"} to Razorpay in the background…`
        : `Approved ${processingIds.length} claim${processingIds.length === 1 ? "" : "s"}. Payment continues in the background.`,
    );

    void (async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimIds: processingIds }),
        });
        const body = await response.json();
        if (!response.ok) {
          setBulkMessage(body.error ?? "Something went wrong. Try again.");
          void refreshQueue({ silent: true });
          return;
        }
        const summary = body as BulkActionSummary;
        if (summary.total === 0) {
          setBulkMessage(emptyText);
          void refreshQueue({ silent: true });
          return;
        }
        let msg = `Done: ${summary.succeeded} of ${summary.total} succeeded.`;
        if (summary.failed > 0) {
          msg += ` ${summary.failed} could not be completed.`;
        }
        setBulkMessage(msg);
        void refreshQueue({ silent: true });
      } catch {
        setBulkMessage("Something went wrong. Try again.");
        void refreshQueue({ silent: true });
      }
    })();
  }

  return (
    <>
      <PageHeading title="Approvals" className="mb-8" />

      <SegmentControl
        options={queueSegments(user?.role)}
        value={tab}
        onChange={handleTabChange}
        ariaLabel="Approval queue"
        outlined={false}
        className="mb-5"
      />

      {bulkMessage && (
        <p className="mb-4 text-sm text-zinc-600" role="status">
          {bulkMessage}
        </p>
      )}

      {fetchError ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {fetchError}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : claims.length === 0 ? (
        <ApprovalsEmptyState tab={tab} role={user?.role} />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <ApprovalsTableHeader
              showStatus={showStatus}
              showCategory={showCategory}
              selectable={showSelectable}
              allSelected={allSelected}
              someSelected={someSelected}
              onToggleAll={toggleSelectAll}
            />
          <div>
            {claims.map((claim) => (
              <ApprovalsTableRow
                key={claim.id}
                claim={claim}
                showStatus={showStatus}
                showCategory={showCategory}
                selectable={showSelectable}
                selected={selectedIds.has(claim.id)}
                onToggleSelect={() => toggleClaimSelection(claim.id)}
                onOpen={() => setSelected(claim)}
              />
            ))}
          </div>
          {bulkActionsVisible ? (
            <div className="space-y-2 border-t border-zinc-200 bg-zinc-50/80 px-4 py-4 sm:px-5">
              {showApproveSelected ? (
                <Button
                  className="w-full"
                  size="sm"
                  disabled={selectedApproveIds.length === 0}
                  onClick={() =>
                    void runBulk(
                      "/api/claims/bulk-decide",
                      selectedApproveIds,
                      `Approve ${selectedApproveIds.length} selected reimbursement${selectedApproveIds.length === 1 ? "" : "s"}?`,
                      "Nothing selected to approve.",
                    )
                  }
                >
                  {`Approve selected (${selectedApproveIds.length})`}
                </Button>
              ) : null}
              {showPaySelected ? (
                <Button
                  className="w-full"
                  size="sm"
                  variant={showApproveSelected ? "outline" : "default"}
                  disabled={selectedPayIds.length === 0}
                  onClick={() =>
                    void runBulk(
                      "/api/claims/bulk-pay",
                      selectedPayIds,
                      `Pay ${selectedPayIds.length} selected reimbursement${selectedPayIds.length === 1 ? "" : "s"} via Razorpay?`,
                      "Nothing selected to pay.",
                    )
                  }
                >
                  {`Pay selected (${selectedPayIds.length})`}
                </Button>
              ) : null}
            </div>
          ) : null}
          </Card>
        </>
      )}

      <ClaimDetailModal
        claim={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        variant="approver"
        onInstantAction={handleInstantAction}
        onActionFeedback={setBulkMessage}
        onUpdated={() => refreshQueue({ silent: true })}
      />
    </>
  );
}
