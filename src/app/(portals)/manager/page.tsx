"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  fetchClientCache,
  invalidateClientCache,
  readClientCache,
} from "@/lib/client-cache";

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

function emptyMessage(tab: QueueTab, role: string | undefined) {
  if (usesPaymentApproverTabs(role)) {
    return tab === "waiting"
      ? "No reimbursements waiting for payment approval."
      : "No reimbursements sent to RazorpayX yet.";
  }
  if (tab === "waiting") {
    return "No claims waiting for your approval.";
  }
  return "No approved claims in this list yet.";
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
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const showStatus = !(user?.role === "BRANCH_MANAGER" && tab === "approved");

  const isApprover = user?.role === "APPROVER";
  const isAdmin = user?.role === "ADMIN";
  const wantsCounts = isApprover || isAdmin;

  const fetchTab = useCallback(async (activeTab: QueueTab): Promise<TabPayload> => {
    const response = await fetch(`/api/claims/pending?tab=${activeTab}`);
    const claims = await readJson<SerializedClaim[]>(response);
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

  const refreshQueue = useCallback(async () => {
    invalidateClientCache("claims-pending");
    setLoading(true);
    const data = await loadTab(tab, true);
    applyTabPayload(data);
    setLoading(false);
    if (wantsCounts) {
      void loadActionCounts().then((nextCounts) => {
        if (nextCounts) setCounts(nextCounts);
      });
    }
    void Promise.all(
      TABS.filter((t) => t !== tab).map((t) => loadTab(t, true)),
    );
  }, [loadTab, loadActionCounts, tab, applyTabPayload, wantsCounts]);

  const showApproveAll =
    isAdmin && tab === "waiting" && (counts?.adminPending ?? 0) > 0;
  const showPayAll =
    tab === "waiting" &&
    (isApprover || isAdmin) &&
    (counts?.paymentWaiting ?? 0) > 0;
  const bulkSelectable = tab === "waiting" && (showApproveAll || showPayAll);
  const selectedCount = claims.filter((c) => selectedIds.has(c.id)).length;
  const allSelected =
    claims.length > 0 && claims.every((c) => selectedIds.has(c.id));
  const someSelected = claims.some((c) => selectedIds.has(c.id));

  useEffect(() => {
    if (!bulkSelectable) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(claims.map((c) => c.id)));
  }, [claims, bulkSelectable]);

  function toggleClaimSelection(claimId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(claimId)) next.delete(claimId);
      else next.add(claimId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(claims.map((c) => c.id)));
    }
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

  async function runBulk(
    endpoint: string,
    claimIds: string[],
    confirmText: string,
    emptyText: string,
  ) {
    if (bulkBusy) return;
    if (claimIds.length === 0) {
      setBulkMessage("Select at least one reimbursement.");
      return;
    }
    if (!window.confirm(confirmText)) return;
    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimIds }),
      });
      const body = await response.json();
      if (!response.ok) {
        setBulkMessage(body.error ?? "Something went wrong. Try again.");
        return;
      }
      const summary = body as BulkActionSummary;
      if (summary.total === 0) {
        setBulkMessage(emptyText);
        return;
      }
      const partial = summary.results.filter((r) => r.ok && r.error).length;
      let msg = `Done: ${summary.succeeded} of ${summary.total} succeeded.`;
      if (summary.failed > 0) {
        msg += ` ${summary.failed} could not be completed.`;
      }
      if (partial > 0) {
        msg += ` ${partial} approved but payout needs attention.`;
      }
      setBulkMessage(msg);
      setSelectedIds(new Set());
      await refreshQueue();
    } catch {
      setBulkMessage("Something went wrong. Try again.");
    } finally {
      setBulkBusy(false);
    }
  }

  const selectedIdList = claims
    .filter((c) => selectedIds.has(c.id))
    .map((c) => c.id);

  return (
    <>
      <PageHeading
        title="Approvals"
        description="Review and take action"
        className="mb-8"
      />

      <SegmentControl
        options={queueSegments(user?.role)}
        value={tab}
        onChange={handleTabChange}
        ariaLabel="Approval queue"
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
        <Card>
          <p className="text-sm text-zinc-600">{emptyMessage(tab, user?.role)}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ApprovalsTableHeader
            showStatus={showStatus}
            showCategory={tab === "approved"}
            selectable={bulkSelectable}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleAll={toggleSelectAll}
            selectedCount={selectedCount}
            totalCount={claims.length}
          />
          <div>
            {claims.map((claim) => (
              <ApprovalsTableRow
                key={claim.id}
                claim={claim}
                showStatus={showStatus}
                showCategory={tab === "approved"}
                selectable={bulkSelectable}
                selected={selectedIds.has(claim.id)}
                onToggleSelect={() => toggleClaimSelection(claim.id)}
                onOpen={() => setSelected(claim)}
              />
            ))}
          </div>
          {bulkSelectable ? (
            <div className="space-y-2 border-t border-zinc-200 bg-zinc-50/80 px-4 py-4 sm:px-5">
              {showApproveAll ? (
                <Button
                  className="w-full"
                  disabled={bulkBusy || selectedCount === 0}
                  onClick={() =>
                    void runBulk(
                      "/api/claims/bulk-decide",
                      selectedIdList,
                      `Approve ${selectedCount} selected reimbursement${selectedCount === 1 ? "" : "s"}? Unchecked items will stay in the queue.`,
                      "Nothing selected to approve.",
                    )
                  }
                >
                  {bulkBusy
                    ? "Working…"
                    : `Approve selected (${selectedCount})`}
                </Button>
              ) : null}
              {showPayAll ? (
                <Button
                  className="w-full"
                  variant={showApproveAll ? "outline" : "default"}
                  disabled={bulkBusy || selectedCount === 0}
                  onClick={() =>
                    void runBulk(
                      "/api/claims/bulk-pay",
                      selectedIdList,
                      `Pay ${selectedCount} selected reimbursement${selectedCount === 1 ? "" : "s"} via Razorpay? Unchecked items will stay in the queue.`,
                      "Nothing selected to pay.",
                    )
                  }
                >
                  {bulkBusy ? "Working…" : `Pay selected (${selectedCount})`}
                </Button>
              ) : null}
            </div>
          ) : null}
        </Card>
      )}

      <ClaimDetailModal
        claim={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        variant="approver"
        onUpdated={async () => {
          setSelected(null);
          await refreshQueue();
        }}
      />
    </>
  );
}
