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
  const showStatus = !(user?.role === "BRANCH_MANAGER" && tab === "approved");

  const wantsCounts =
    user?.role === "ADMIN" || user?.role === "APPROVER";

  const fetchTab = useCallback(
    async (activeTab: QueueTab): Promise<TabPayload> => {
      const countsQuery = wantsCounts ? "&counts=1" : "";
      const response = await fetch(
        `/api/claims/pending?tab=${activeTab}${countsQuery}`,
      );
      const data = await readJson<
        SerializedClaim[] | { claims: SerializedClaim[]; counts: ActionCounts }
      >(response);
      if (Array.isArray(data)) {
        return { claims: data, counts: null };
      }
      return { claims: data.claims, counts: data.counts };
    },
    [wantsCounts],
  );

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

  const refreshQueue = useCallback(async () => {
    invalidateClientCache("claims-pending");
    setLoading(true);
    const data = await loadTab(tab, true);
    applyTabPayload(data);
    setLoading(false);
    void Promise.all(
      TABS.filter((t) => t !== tab).map((t) => loadTab(t, true)),
    );
  }, [loadTab, tab, applyTabPayload]);

  function handleTabChange(next: QueueTab) {
    if (next === tab) return;
    setTab(next);
    setSelected(null);
    const cached = readTabCache(next);
    if (cached) {
      setClaims(cached.claims);
      if (cached.counts) setCounts(cached.counts);
    } else {
      setClaims([]);
    }
    setLoading(!cached);
  }

  useEffect(() => {
    let cancelled = false;

    const cached = readTabCache(tab);
    if (cached) {
      applyTabPayload(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    void loadTab(tab).then((data) => {
      if (!cancelled) {
        applyTabPayload(data);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tab, loadTab, applyTabPayload]);

  useEffect(() => {
    if (!wantsCounts) return;
    const other = TABS.find((t) => t !== tab);
    if (!other || readTabCache(other)) return;
    void fetchClientCache(cacheKey(other), () => fetchTab(other));
  }, [fetchTab, tab, wantsCounts]);

  async function runBulk(
    endpoint: string,
    confirmText: string,
    emptyText: string,
  ) {
    if (bulkBusy) return;
    if (!window.confirm(confirmText)) return;
    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const response = await fetch(endpoint, { method: "POST" });
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
      await refreshQueue();
    } catch {
      setBulkMessage("Something went wrong. Try again.");
    } finally {
      setBulkBusy(false);
    }
  }

  const showApproveAll =
    user?.role === "ADMIN" && tab === "waiting" && (counts?.adminPending ?? 0) > 0;
  const showPayAll =
    (user?.role === "APPROVER" && tab === "waiting") ||
    (user?.role === "ADMIN" && (counts?.paymentWaiting ?? 0) > 0);
  const payAllCount = counts?.paymentWaiting ?? 0;
  const approveAllCount = counts?.adminPending ?? 0;

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

      {(showApproveAll || showPayAll) && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {showApproveAll && (
            <Button
              disabled={bulkBusy}
              onClick={() =>
                void runBulk(
                  "/api/claims/bulk-decide",
                  `Approve all ${approveAllCount} reimbursement${approveAllCount === 1 ? "" : "s"} waiting in your queue? Payment approver claims will be sent to Razorpay when bank details are ready.`,
                  "Nothing waiting for your approval right now.",
                )
              }
            >
              {bulkBusy ? "Working…" : `Approve all (${approveAllCount})`}
            </Button>
          )}
          {showPayAll && payAllCount > 0 && (
            <Button
              variant={showApproveAll ? "outline" : "default"}
              disabled={bulkBusy}
              onClick={() =>
                void runBulk(
                  "/api/claims/bulk-pay",
                  user?.role === "ADMIN"
                    ? `Send ${payAllCount} approved reimbursement${payAllCount === 1 ? "" : "s"} to Razorpay now?`
                    : `Pay all ${payAllCount} reimbursement${payAllCount === 1 ? "" : "s"} in your queue via Razorpay?`,
                  "No reimbursements are waiting for payout.",
                )
              }
            >
              {bulkBusy ? "Working…" : `Pay all (${payAllCount})`}
            </Button>
          )}
        </div>
      )}

      {bulkMessage && (
        <p className="mb-4 text-sm text-zinc-600" role="status">
          {bulkMessage}
        </p>
      )}

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
          />
          <div>
            {claims.map((claim) => (
              <ApprovalsTableRow
                key={claim.id}
                claim={claim}
                showStatus={showStatus}
                showCategory={tab === "approved"}
                onOpen={() => setSelected(claim)}
              />
            ))}
          </div>
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
