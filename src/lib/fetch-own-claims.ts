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

async function fetchJsonOwn(
  url: string,
  ownerId: string,
): Promise<SerializedClaim[]> {
  const res = await fetch(url, {
    cache: "default",
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = await readJson<SerializedClaim[]>(res);
  return ownClaimsOnly(data, ownerId);
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

  const rows = await fetchJsonOwn("/api/claims/mine", ownerId);
  writeClientCache(key, rows, CACHE_TTL_MS);
  writeClientCache(
    claimsRejectedCacheKey(ownerId),
    rows.filter((c) => c.status === "REJECTED"),
    CACHE_TTL_MS,
  );
  return rows;
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

  const rows = await fetchJsonOwn("/api/claims/mine/rejected", ownerId);
  writeClientCache(key, rows, CACHE_TTL_MS);
  return rows;
}
