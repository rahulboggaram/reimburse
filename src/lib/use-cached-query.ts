"use client";

import { useEffect, useState } from "react";
import { fetchClientCache, readClientCache } from "@/lib/client-cache";

/**
 * Show cached data instantly on menu navigation, refresh in the background.
 */
export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttlMs?: number; enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<T | null>(() =>
    enabled ? readClientCache<T>(key) : null,
  );
  const [loading, setLoading] = useState(
    () => enabled && readClientCache<T>(key) === null,
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const cached = readClientCache<T>(key);

    if (cached) {
      setData(cached);
      setLoading(false);
      setError(false);
    } else {
      setLoading(true);
    }

    void fetchClientCache(key, fetcher, options?.ttlMs)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (!cached) setData(null);
          setLoading(false);
          setError(true);
        }
      });

    return () => {
      cancelled = true;
    };
    // fetcher is stable when using admin-fetch / fetch-own-claims helpers
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by cache key only
  }, [key, enabled, options?.ttlMs]);

  return { data, loading, error, setData };
}
