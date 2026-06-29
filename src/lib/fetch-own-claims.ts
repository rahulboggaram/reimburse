import { readJson } from "@/lib/api";
import { ownClaimsOnly } from "@/lib/claim-access";
import { claimsMineCacheKey, claimsRejectedCacheKey } from "@/lib/claims-cache";
import {
  readPersistedClientCache,
  writePersistedClientCache,
} from "@/lib/claims-persist-cache";
import type { SerializedClaim } from "@/lib/claim-types";
import { fetchClientCache } from "@/lib/client-cache";
import {
  mergeClaimsWithPending,
  readPendingClaimSubmits,
} from "@/lib/pending-claim-submit";

const CACHE_TTL_MS = 10 * 60 * 1000;

type FetchOwnResult =
  | { ok: true; rows: SerializedClaim[] }
  | { ok: false; status: number | null };

async function fetchJsonOwn(
  url: string,
  ownerId: string,
): Promise<FetchOwnResult> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    const data = await readJson<SerializedClaim[]>(res);
    return { ok: true, rows: ownClaimsOnly(data, ownerId) };
  } catch {
    return { ok: false, status: null };
  }
}

function readValidatedCache(
  key: string,
  ownerId: string,
): SerializedClaim[] | null {
  const cached = readPersistedClientCache<SerializedClaim[]>(key);
  if (!cached) return null;
  const owned = ownClaimsOnly(cached, ownerId);
  if (owned.length !== cached.length) {
    return null;
  }
  return owned;
}

function persistClaimsCache(key: string, rows: SerializedClaim[]) {
  writePersistedClientCache(key, rows, CACHE_TTL_MS);
}

async function fetchMyClaimsFromNetwork(ownerId: string): Promise<SerializedClaim[]> {
  const result = await fetchJsonOwn("/api/claims/mine", ownerId);
  if (!result.ok) {
    throw new Error(
      result.status === 401
        ? "Please sign in again."
        : "Could not load your claims. Please try again.",
    );
  }
  return result.rows;
}

export function readMyClaimsCache(ownerId: string): SerializedClaim[] | null {
  return readValidatedCache(claimsMineCacheKey(ownerId), ownerId);
}

export function readMyRejectedClaimsCache(ownerId: string): SerializedClaim[] | null {
  return readValidatedCache(claimsRejectedCacheKey(ownerId), ownerId);
}

/** Cached claims plus any in-flight submits — use for instant list paint. */
export function readClaimsViewForUser(ownerId: string): SerializedClaim[] {
  return mergeClaimsWithPending(
    readMyClaimsCache(ownerId) ?? [],
    readPendingClaimSubmits(ownerId),
  );
}

export async function fetchMyClaims(
  ownerId: string,
  options?: { fresh?: boolean },
): Promise<SerializedClaim[]> {
  const key = claimsMineCacheKey(ownerId);

  if (!options?.fresh) {
    const cached = readValidatedCache(key, ownerId);
    if (cached) return cached;
  }

  const fetcher = async () => {
    const result = await fetchJsonOwn("/api/claims/mine", ownerId);
    if (!result.ok) {
      const stale = readValidatedCache(key, ownerId);
      if (stale) return stale;
      throw new Error(
        result.status === 401
          ? "Please sign in again."
          : "Could not load your claims. Please try again.",
      );
    }
    persistClaimsCache(key, result.rows);
    return result.rows;
  };

  if (options?.fresh) {
    return fetcher();
  }

  return fetchClientCache(key, fetcher, CACHE_TTL_MS);
}

export async function fetchMyRejectedClaims(
  ownerId: string,
  options?: { fresh?: boolean },
): Promise<SerializedClaim[]> {
  const key = claimsRejectedCacheKey(ownerId);
  if (!options?.fresh) {
    const cached = readValidatedCache(key, ownerId);
    if (cached) return cached;

    const mineKey = claimsMineCacheKey(ownerId);
    const mineCached = readValidatedCache(mineKey, ownerId);
    if (mineCached) {
      const rejected = mineCached.filter((c) => c.status === "REJECTED");
      persistClaimsCache(key, rejected);
      return rejected;
    }
  }

  const fetcher = async () => {
    const result = await fetchJsonOwn("/api/claims/mine/rejected", ownerId);
    if (!result.ok) {
      const stale = readValidatedCache(key, ownerId);
      if (stale) return stale;
      throw new Error("Could not load rejected claims. Please try again.");
    }
    persistClaimsCache(key, result.rows);
    return result.rows;
  };

  if (options?.fresh) {
    return fetcher();
  }

  return fetchClientCache(key, fetcher, CACHE_TTL_MS);
}

/** Warm the My Claims cache as soon as the user is known (menu, home, shell). */
export function warmMyClaimsCache(ownerId: string) {
  if (!ownerId) return;
  if (readMyClaimsCache(ownerId)) return;
  void fetchMyClaims(ownerId).catch(() => {});
}
