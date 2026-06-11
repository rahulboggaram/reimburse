import { readJson } from "@/lib/api";
import type { SerializedClaim } from "@/lib/claim-types";

const WATCH_KEY = "reimburse-payout-watches";
const WATCH_TTL_MS = 5 * 60 * 1000;
const WATCH_EVENT = "payout-watches-changed";

type PayoutWatchRow = {
  startedAt: number;
  variant: "employee" | "admin" | "approver";
};

function payoutFailed(status: string | null | undefined) {
  return (
    status === "failed" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "reversed"
  );
}

export function claimNeedsPayoutStatusRefresh(claim: {
  status: string;
  paidAt?: string | null;
  razorpayPayoutId?: string | null;
  payoutStatus?: string | null;
}): boolean {
  if (claim.status === "PAID" || claim.paidAt) return false;
  if (!claim.razorpayPayoutId) return false;
  if (claim.payoutStatus === "processed") {
    return claim.status !== "PAID" || !claim.paidAt;
  }
  if (!claim.payoutStatus) return true;
  return !payoutFailed(claim.payoutStatus);
}

function readWatches(): Record<string, PayoutWatchRow> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(WATCH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PayoutWatchRow>;
    const now = Date.now();
    const pruned: Record<string, PayoutWatchRow> = {};
    for (const [id, row] of Object.entries(parsed)) {
      if (now - row.startedAt < WATCH_TTL_MS) pruned[id] = row;
    }
    if (Object.keys(pruned).length !== Object.keys(parsed).length) {
      sessionStorage.setItem(WATCH_KEY, JSON.stringify(pruned));
    }
    return pruned;
  } catch {
    return {};
  }
}

function writeWatches(watches: Record<string, PayoutWatchRow>) {
  if (typeof window === "undefined") return;
  try {
    if (Object.keys(watches).length === 0) {
      sessionStorage.removeItem(WATCH_KEY);
    } else {
      sessionStorage.setItem(WATCH_KEY, JSON.stringify(watches));
    }
    window.dispatchEvent(new Event(WATCH_EVENT));
  } catch {
    // ignore storage errors
  }
}

export function registerPayoutWatch(
  claimId: string,
  variant: "employee" | "admin" | "approver" = "employee",
) {
  const watches = readWatches();
  watches[claimId] = { startedAt: Date.now(), variant };
  writeWatches(watches);
}

export function registerPayoutWatches(
  claimIds: string[],
  variant: "employee" | "admin" | "approver" = "employee",
) {
  if (claimIds.length === 0) return;
  const watches = readWatches();
  const now = Date.now();
  for (const id of claimIds) {
    watches[id] = { startedAt: now, variant };
  }
  writeWatches(watches);
}

export function clearPayoutWatch(claimId: string) {
  const watches = readWatches();
  if (!watches[claimId]) return;
  delete watches[claimId];
  writeWatches(watches);
}

export function readPayoutWatchIds(): string[] {
  return Object.keys(readWatches());
}

export function hasActivePayoutWatches(): boolean {
  return readPayoutWatchIds().length > 0;
}

export function subscribePayoutWatches(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  window.addEventListener(WATCH_EVENT, handler);
  return () => window.removeEventListener(WATCH_EVENT, handler);
}

function shouldStopWatching(
  claim: SerializedClaim,
  watch: PayoutWatchRow,
): boolean {
  if (claim.status === "PAID" || claim.paidAt) return true;
  if (payoutFailed(claim.payoutStatus)) return true;
  if (
    !claim.razorpayPayoutId &&
    !claim.payoutInitiatedAt &&
    Date.now() - watch.startedAt > 45_000
  ) {
    return true;
  }
  return false;
}

export async function refreshClaimPayoutFromServer(
  claimId: string,
  variant: "employee" | "admin" | "approver" = "employee",
): Promise<SerializedClaim | null> {
  try {
    const claimRes = await fetch(`/api/claims/${claimId}`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!claimRes.ok) return null;
    let claim = await readJson<SerializedClaim>(claimRes);

    const watch = readWatches()[claimId];
    if (watch && shouldStopWatching(claim, watch)) {
      clearPayoutWatch(claimId);
      return claim;
    }

    if (claimNeedsPayoutStatusRefresh(claim)) {
      const syncUrl =
        variant === "admin"
          ? `/api/admin/claims/${claimId}/payout/sync`
          : `/api/claims/${claimId}/payout/sync`;
      const syncRes = await fetch(syncUrl, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (syncRes.ok) {
        claim = await readJson<SerializedClaim>(syncRes);
      }
    }

    if (watch && shouldStopWatching(claim, watch)) {
      clearPayoutWatch(claimId);
    }
    return claim;
  } catch {
    return null;
  }
}

export async function refreshActivePayoutWatches(): Promise<void> {
  const watches = readWatches();
  await Promise.allSettled(
    Object.entries(watches).map(([claimId, row]) =>
      refreshClaimPayoutFromServer(claimId, row.variant),
    ),
  );
}
