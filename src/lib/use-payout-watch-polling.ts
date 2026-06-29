"use client";

import { useEffect } from "react";
import {
  claimNeedsPayoutStatusRefresh,
  hasActivePayoutWatches,
  refreshActivePayoutWatches,
  subscribePayoutWatches,
} from "@/lib/payout-sync-client";

const DEFAULT_INTERVAL_MS = 20_000;

export function usePayoutWatchPolling(options: {
  enabled?: boolean;
  claimIds?: string[];
  onTick: () => void | Promise<void>;
  intervalMs?: number;
}) {
  const { enabled = true, claimIds = [], onTick, intervalMs } = options;

  useEffect(() => {
    if (!enabled) return;

    const hasUnsettledClaims = claimIds.length > 0;
    let cancelled = false;
    const tick = onTick;

    async function runTick() {
      if (cancelled) return;
      if (!hasActivePayoutWatches() && !hasUnsettledClaims) return;
      await refreshActivePayoutWatches();
      if (!cancelled) await tick();
    }

    void runTick();
    const interval = window.setInterval(
      () => void runTick(),
      intervalMs ?? DEFAULT_INTERVAL_MS,
    );
    const unsubscribe = subscribePayoutWatches(() => void runTick());

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [enabled, onTick, intervalMs, claimIds.join(",")]);
}

export function collectPayoutRefreshClaimIds(
  claims: {
    id: string;
    status: string;
    paidAt?: string | null;
    razorpayPayoutId?: string | null;
    payoutStatus?: string | null;
  }[],
): string[] {
  return claims.filter(claimNeedsPayoutStatusRefresh).map((c) => c.id);
}
