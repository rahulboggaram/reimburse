/** 22K purity factor (22/24). */
const K22_FACTOR = 22 / 24;

/** Loan-to-value for gold loans. */
export const GOLD_LTV = 0.75;

const TROY_OZ_GRAMS = 31.1034768;

export type GoldPriceSnapshot = {
  spotUsdPerOz: number;
  usdInr: number;
  rate24kPerGramInr: number;
  rate22kPerGramInr: number;
  loanPerGramInr: number;
  updatedAt: string;
  source: string;
};

async function fetchSpotGoldUsd(): Promise<number> {
  const res = await fetch("https://api.metals.live/v1/spot/gold", {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error("Spot gold fetch failed");
  const data = (await res.json()) as number[][];
  const latest = data[data.length - 1];
  if (!latest?.[1]) throw new Error("Invalid spot gold payload");
  return latest[1];
}

async function fetchUsdInr(): Promise<number> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("FX fetch failed");
  const data = (await res.json()) as { rates?: { INR?: number } };
  const inr = data.rates?.INR;
  if (!inr) throw new Error("INR rate missing");
  return inr;
}

export async function getGoldPriceSnapshot(): Promise<GoldPriceSnapshot> {
  const [spotUsdPerOz, usdInr] = await Promise.all([
    fetchSpotGoldUsd(),
    fetchUsdInr(),
  ]);

  const rate24kPerGramInr = (spotUsdPerOz / TROY_OZ_GRAMS) * usdInr;
  const rate22kPerGramInr = rate24kPerGramInr * K22_FACTOR;
  const loanPerGramInr = rate22kPerGramInr * GOLD_LTV;

  return {
    spotUsdPerOz,
    usdInr,
    rate24kPerGramInr,
    rate22kPerGramInr,
    loanPerGramInr,
    updatedAt: new Date().toISOString(),
    source: "metals.live + open.er-api.com",
  };
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}
