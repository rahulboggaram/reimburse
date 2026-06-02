"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readJson } from "@/lib/api";
import { getAppHomePath } from "@/lib/home-path";

export function WapasBrand(props: { size?: "sm" | "lg" }) {
  const isLarge = props.size !== "sm";
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
      aria-label="Wapas home"
    >
      <span
        className={`font-brand uppercase text-emerald-950 ${
          isLarge ? "text-3xl leading-none" : "text-xl leading-none"
        }`}
      >
        WAPAS
      </span>
      <p
        className={`text-zinc-500 ${isLarge ? "text-sm" : "text-xs"} tracking-wide`}
      >
        by Yellow Metal
      </p>
    </Link>
  );
}
