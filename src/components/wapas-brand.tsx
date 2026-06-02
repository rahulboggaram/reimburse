"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readJson } from "@/lib/api";
import { getAppHomePath } from "@/lib/home-path";

export function ReimburseBrand(props: { size?: "sm" | "lg" }) {
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
      aria-label="Reimburse home"
    >
      <span
        className={`font-brand text-emerald-950 ${
          isLarge ? "text-5xl leading-none" : "text-[1.8rem] leading-none"
        }`}
      >
        Reimburse
      </span>
      <p
        className={`font-sans font-normal text-zinc-500 ${isLarge ? "text-base" : "text-sm"} tracking-wide`}
      >
        by Yellow Metal
      </p>
    </Link>
  );
}
