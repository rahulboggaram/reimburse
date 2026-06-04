"use client";

import Link from "next/link";
import { useContext, useEffect, useState } from "react";
import { readJson } from "@/lib/api";
import { getAppHomePath } from "@/lib/home-path";
import { MeContext, type MeUser } from "@/components/me-provider";

export function ReimburseBrand() {
  const me = useContext(MeContext);
  const [fallbackHref, setFallbackHref] = useState("/login");

  useEffect(() => {
    if (me) return;

    fetch("/api/auth/me")
      .then((res) =>
        res.ok
          ? readJson<{ user: Pick<MeUser, "role" | "profileComplete"> | null }>(
              res,
            )
          : { user: null },
      )
      .then((data) => setFallbackHref(getAppHomePath(data.user)))
      .catch(() => setFallbackHref("/login"));
  }, [me]);

  const homeHref = me
    ? me.user
      ? getAppHomePath(me.user)
      : "/login"
    : fallbackHref;

  return (
    <Link
      href={homeHref}
      className="flex flex-col items-center gap-0.5 rounded-lg text-center outline-none ring-zinc-900 focus-visible:ring-2"
      aria-label="Reimburse home"
    >
      <span className="font-brand text-[3.06rem] leading-none text-emerald-950">
        Reimburse
      </span>
      <p className="text-sm text-zinc-600">by Yellow Metal</p>
    </Link>
  );
}
