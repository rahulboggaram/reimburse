"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readJson } from "@/lib/api";
import { getAppHomePath } from "@/lib/home-path";

export function ReimburseBrand() {
  const [homeHref, setHomeHref] = useState("/login");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) =>
        res.ok
          ? readJson<{
              user: {
                role: string;
                profileComplete: boolean;
              } | null;
            }>(res)
          : { user: null },
      )
      .then((data) => setHomeHref(getAppHomePath(data.user)))
      .catch(() => setHomeHref("/login"));
  }, []);

  return (
    <Link
      href={homeHref}
      className="inline-block space-y-0.5 rounded-lg outline-none ring-zinc-900 focus-visible:ring-2"
      aria-label="Reimburse home"
    >
      <span className="font-brand text-5xl leading-none text-emerald-950">
        Reimburse
      </span>
      <p className="font-sans text-xs font-normal text-zinc-400 tracking-wide">
        by Yellow Metal
      </p>
    </Link>
  );
}
