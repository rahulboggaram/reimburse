"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { readJson } from "@/lib/api";

export type MeUser = {
  id: string;
  name: string | null;
  phone: string;
  role: string;
  profileComplete: boolean;
};

type MeContextValue = {
  user: MeUser | null;
  loading: boolean;
};

export const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then((res) =>
        res.ok ? readJson<{ user: MeUser | null }>(res) : { user: null },
      )
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return (
    <MeContext.Provider value={value}>{props.children}</MeContext.Provider>
  );
}

export function useMe(): MeContextValue {
  const context = useContext(MeContext);
  if (!context) {
    throw new Error("useMe must be used within MeProvider");
  }
  return context;
}
