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
import { readJson } from "@/lib/api";
import {
  fetchClientCache,
  invalidateClientCache,
  readClientCache,
} from "@/lib/client-cache";

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

function readTabCache(tab: QueueTab) {
  return readClientCache<SerializedClaim[]>(cacheKey(tab));
}

export default function ManagerPendingPage() {
  const { user } = useMe();
  const [tab, setTab] = useState<QueueTab>("waiting");
  const [claims, setClaims] = useState<SerializedClaim[]>(
    () => readTabCache("waiting") ?? [],
  );
  const [loading, setLoading] = useState(() => !readTabCache("waiting"));
  const [selected, setSelected] = useState<SerializedClaim | null>(null);
  const showStatus = !(user?.role === "BRANCH_MANAGER" && tab === "approved");

  const fetchTab = useCallback(async (activeTab: QueueTab) => {
    const response = await fetch(`/api/claims/pending?tab=${activeTab}`);
    return readJson<SerializedClaim[]>(response);
  }, []);

  const loadTab = useCallback(
    async (activeTab: QueueTab, fresh = false) => {
      if (fresh) invalidateClientCache(cacheKey(activeTab));
      const data = await fetchClientCache(cacheKey(activeTab), () =>
        fetchTab(activeTab),
      );
      return data;
    },
    [fetchTab],
  );

  function handleTabChange(next: QueueTab) {
    if (next === tab) return;
    setTab(next);
    setSelected(null);
    const cached = readTabCache(next);
    setClaims(cached ?? []);
    setLoading(!cached);
  }

  useEffect(() => {
    let cancelled = false;

    const cached = readTabCache(tab);
    if (cached) {
      setClaims(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    void loadTab(tab).then((data) => {
      if (!cancelled) {
        setClaims(data);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tab, loadTab]);

  useEffect(() => {
    void Promise.all(
      TABS.filter((t) => t !== tab).map((t) =>
        fetchClientCache(cacheKey(t), () => fetchTab(t)),
      ),
    );
  }, [fetchTab, tab]);

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
          invalidateClientCache("claims-pending");
          setSelected(null);
          setLoading(true);
          const data = await loadTab(tab, true);
          setClaims(data);
          setLoading(false);
          void Promise.all(
            TABS.filter((t) => t !== tab).map((t) => loadTab(t, true)),
          );
        }}
      />
    </>
  );
}
