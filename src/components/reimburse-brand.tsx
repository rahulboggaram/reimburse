"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext, useEffect, useLayoutEffect, useState } from "react";
import { readJson } from "@/lib/api";
import { getAppHomePath } from "@/lib/home-path";
import { cn } from "@/lib/utils";
import { MeContext, type MeUser } from "@/components/me-provider";

const wordmarkClass =
  "font-brand font-brand-wordmark text-[3.06rem] leading-none";
const taglineClass = "text-lg leading-normal";
const licenseClass = "text-xs leading-normal text-zinc-500";

function isHomePath(pathname: string | null) {
  return pathname === "/login" || pathname === "/employee";
}

export function ReimburseBrand() {
  const pathname = usePathname();
  const me = useContext(MeContext);
  const [fallbackHref, setFallbackHref] = useState("/login");
  const [shineCycle, setShineCycle] = useState(0);

  useLayoutEffect(() => {
    if (!isHomePath(pathname)) {
      setShineCycle(0);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    setShineCycle((cycle) => cycle + 1);
  }, [pathname]);

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

  const showShine = shineCycle > 0;

  return (
    <Link
      href={homeHref}
      className="flex flex-col items-center gap-1 rounded-lg pt-4 text-center outline-none ring-zinc-900 focus-visible:ring-2"
      aria-label="Reimburse home"
    >
      <span
        className="relative flex flex-col items-center gap-1"
        key={shineCycle}
      >
        <span className={cn(wordmarkClass, "text-zinc-900")}>Reimburse</span>
        <span className={cn(taglineClass, "text-zinc-600")}>
          by Yellow Metal
        </span>
        <span className={licenseClass}>RBI Licensed NBFC</span>

        {showShine ? (
          <>
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-0 right-0 top-0 text-center",
                wordmarkClass,
                "brand-gold-shine-wordmark",
              )}
            >
              Reimburse
            </span>
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-0 right-0 bottom-0 text-center",
                taglineClass,
                "brand-gold-shine-tagline",
              )}
            >
              by Yellow Metal
            </span>
          </>
        ) : null}
      </span>
    </Link>
  );
}
