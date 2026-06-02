"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readJson } from "@/lib/api";
import { getAppHomePath } from "@/lib/home-path";

const brandSubtitleClass =
  "font-sans text-base font-normal tracking-wide text-zinc-500";

function BrandMark(props: {
  wordmarkClassName: string;
  label: string;
}) {
  return (
    <div className="space-y-0.5">
      <span
        className={`text-5xl leading-none text-emerald-950 ${props.wordmarkClassName}`}
      >
        Reimburse
      </span>
      <p className={brandSubtitleClass}>by Yellow Metal</p>
      <p className={brandSubtitleClass}>{props.label}</p>
    </div>
  );
}

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
    <div className="flex flex-wrap items-start gap-6 sm:gap-8">
      <Link
        href={homeHref}
        className="rounded-lg outline-none ring-zinc-900 focus-visible:ring-2"
        aria-label="Reimburse home"
      >
        <BrandMark wordmarkClassName="font-brand" label="Bricolage Grotesque" />
      </Link>
      <div aria-label="Reimburse logo preview in Unbounded">
        <BrandMark wordmarkClassName="font-brand-alt" label="Unbounded" />
      </div>
    </div>
  );
}
