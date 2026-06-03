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
import { fetchClientCache, invalidateClientCache } from "@/lib/client-cache";

type QueueTab = "waiting" | "approved";

const QUEUE_SEGMENTS: { id: QueueTab; label: string }[] = [
  { id: "waiting", label: "Waiting" },
  { id: "approved", label: "Approved" },
];

function cacheKey(tab: QueueTab) {
  return `claims-pending-${tab}`;
}

function emptyMessage(tab: QueueTab, role: string | undefined) {
  if (tab === "waiting") {
    return role === "APPROVER"
      ? "No failed payouts to retry."
      : "No claims waiting for your approval.";
  }
  return role === "APPROVER"
    ? "No approved reimbursements in this list yet."
    : "No approved claims in this list yet.";
}

export default function ManagerPendingPage() {
  const { user } = useMe();
  const [tab, setTab] = useState<QueueTab>("waiting");
  const [claims, setClaims] = useState<SerializedClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SerializedClaim | null>(null);
  const showStatus = !(user?.role === "BRANCH_MANAGER" && tab === "approved");

  const loadClaims = useCallback(async (activeTab: QueueTab) => {
    const data = await fetchClientCache(cacheKey(activeTab), async () => {
      const response = await fetch(
        `/api/claims/pending?tab=${activeTab}`,
      );
      return readJson<SerializedClaim[]>(response);
    });
    setClaims(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadClaims(tab).finally(() => setLoading(false));
  }, [tab, loadClaims]);

  async function refreshQueue() {
    invalidateClientCache("claims-pending");
    await loadClaims(tab);
  }

  return (
    <>
      <PageHeading
        title="Approvals"
        description="Review and take action"
        className="mb-8"
      />

      <SegmentControl
        options={QUEUE_SEGMENTS}
        value={tab}
        onChange={setTab}
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
          await loadClaims("waiting");
          await loadClaims("approved");
        }}
      />
    </>
  );
}
