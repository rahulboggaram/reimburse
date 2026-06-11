import { readJson } from "@/lib/api";
import { ownClaimsOnly } from "@/lib/claim-access";
import { claimsMineCacheKey, claimsRejectedCacheKey } from "@/lib/claims-cache";
import type { SerializedClaim } from "@/lib/claim-types";
import {
  invalidateClientCache,
  readClientCache,
  writeClientCache,
} from "@/lib/client-cache";

const CACHE_TTL_MS = 5 * 60 * 1000;

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
  const cached = readClientCache<SerializedClaim[]>(key);
  if (!cached) return null;
  const owned = ownClaimsOnly(cached, ownerId);
  if (owned.length !== cached.length) {
    invalidateClientCache(key);
    return null;
  }
  return owned;
}

export function readMyClaimsCache(ownerId: string): SerializedClaim[] | null {
  return readValidatedCache(claimsMineCacheKey(ownerId), ownerId);
}

export function readMyRejectedClaimsCache(ownerId: string): SerializedClaim[] | null {
  return readValidatedCache(claimsRejectedCacheKey(ownerId), ownerId);
}

export async function fetchMyClaims(
  ownerId: string,
  options?: { fresh?: boolean },
): Promise<SerializedClaim[]> {
  const key = claimsMineCacheKey(ownerId);
  if (options?.fresh) invalidateClientCache(key);

  if (!options?.fresh) {
    const cached = readValidatedCache(key, ownerId);
    if (cached) return cached;
  }

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

  writeClientCache(key, result.rows, CACHE_TTL_MS);
  return result.rows;
}

export async function fetchMyRejectedClaims(
  ownerId: string,
  options?: { fresh?: boolean },
): Promise<SerializedClaim[]> {
  const key = claimsRejectedCacheKey(ownerId);
  if (options?.fresh) invalidateClientCache(key);

  if (!options?.fresh) {
    const cached = readValidatedCache(key, ownerId);
    if (cached) return cached;

    const mineKey = claimsMineCacheKey(ownerId);
    const mineCached = readValidatedCache(mineKey, ownerId);
    if (mineCached) {
      const rejected = mineCached.filter((c) => c.status === "REJECTED");
      writeClientCache(key, rejected, CACHE_TTL_MS);
      return rejected;
    }
  }

  const result = await fetchJsonOwn("/api/claims/mine/rejected", ownerId);
  if (!result.ok) {
    const stale = readValidatedCache(key, ownerId);
    if (stale) return stale;
    throw new Error("Could not load rejected claims. Please try again.");
  }

  writeClientCache(key, result.rows, CACHE_TTL_MS);
  return result.rows;
}
