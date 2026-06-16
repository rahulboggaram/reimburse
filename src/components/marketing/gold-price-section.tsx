"use client";

import { useEffect, useState } from "react";
import type { GoldPriceSnapshot } from "@/lib/gold-price";
import { formatInr } from "@/lib/gold-price";

export function GoldPriceSection() {
  const [price, setPrice] = useState<GoldPriceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/gold-price");
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as GoldPriceSnapshot;
        if (!cancelled) {
          setPrice(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="ym-section" id="rates">
      <div className="ym-container">
        <p className="ym-eyebrow">Live market rates</p>
        <h2 className="ym-section-title">Today&apos;s gold value</h2>
        <p className="ym-section-subtitle">
          22K card gold rate from international spot, with 75% loan-to-value so
          you know exactly what your ornaments can fetch.
        </p>

        <div className="ym-price-grid">
          <article className="ym-price-card ym-price-card--primary">
            <span className="ym-price-label">22K gold / gram</span>
            <p className="ym-price-value">
              {loading ? "—" : error ? "Unavailable" : formatInr(price!.rate22kPerGramInr)}
            </p>
            <span className="ym-price-hint">Based on live spot price</span>
          </article>

          <article className="ym-price-card">
            <span className="ym-price-label">You can borrow up to</span>
            <p className="ym-price-value ym-price-value--loan">
              {loading ? "—" : error ? "—" : formatInr(price!.loanPerGramInr)}
            </p>
            <span className="ym-price-hint">Per gram at 75% LTV</span>
          </article>
        </div>

        {price && !error && (
          <p className="ym-price-footnote">
            Updated {new Date(price.updatedAt).toLocaleString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              day: "numeric",
              month: "short",
            })}
            {" · "}Spot ${price.spotUsdPerOz.toLocaleString("en-IN")}/oz
          </p>
        )}
      </div>
    </section>
  );
}
