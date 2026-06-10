/**
 * Minimal RazorpayX payout relay for a VPS with a static IP.
 * Forwards only /v1/payouts* to Razorpay. Requires a shared secret from Reimburse (Vercel).
 *
 * Env on VPS (relay/.env or exported):
 *   RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET, RAZORPAYX_ACCOUNT_NUMBER
 *   RAZORPAYX_RELAY_SECRET (long random string — same as Vercel RAZORPAYX_RELAY_SECRET)
 *   PORT (default 8787)
 */

import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFromFile() {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(resolve(dir, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // no local .env
  }
}

loadEnvFromFile();

const PORT = Number(process.env.PORT ?? 8787);
const KEY_ID = (process.env.RAZORPAYX_KEY_ID ?? "").trim();
const KEY_SECRET = (process.env.RAZORPAYX_KEY_SECRET ?? "").trim();
const ACCOUNT_NUMBER = (process.env.RAZORPAYX_ACCOUNT_NUMBER ?? "").trim();
const RELAY_SECRET = (process.env.RAZORPAYX_RELAY_SECRET ?? "").trim();

const RAZORPAY_API = "https://api.razorpay.com";

function secretsMatch(given, expected) {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function readBearer(req) {
  const header = req.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? "";
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function razorpayAuth() {
  const token = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

async function forwardToRazorpay(method, path, req, res) {
  const headers = {
    Authorization: razorpayAuth(),
    "Content-Type": "application/json",
  };
  const idempotency = req.headers["x-payout-idempotency"];
  if (typeof idempotency === "string" && idempotency.length > 0) {
    headers["X-Payout-Idempotency"] = idempotency;
  }

  let body;
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks).toString("utf8");
  }

  const upstream = await fetch(`${RAZORPAY_API}${path}`, {
    method,
    headers,
    body: body && body.length > 0 ? body : undefined,
  });

  const text = await upstream.text();
  res.writeHead(upstream.status, { "Content-Type": "application/json" });
  res.end(text);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1`);

    if (req.method === "GET" && url.pathname === "/health") {
      const ok = Boolean(KEY_ID && KEY_SECRET && ACCOUNT_NUMBER && RELAY_SECRET);
      return json(res, ok ? 200 : 503, {
        ok,
        mode: KEY_ID.startsWith("rzp_live_")
          ? "live"
          : KEY_ID.startsWith("rzp_test_")
            ? "test"
            : "unconfigured",
        keyIdPrefix: KEY_ID ? `${KEY_ID.slice(0, 12)}…` : null,
        accountNumber: ACCOUNT_NUMBER || null,
      });
    }

    if (!secretsMatch(readBearer(req), RELAY_SECRET)) {
      return json(res, 401, { error: "Unauthorized" });
    }

    if (!url.pathname.startsWith("/v1/payouts")) {
      return json(res, 404, { error: "Only /v1/payouts is allowed." });
    }

    if (!KEY_ID || !KEY_SECRET || !ACCOUNT_NUMBER) {
      return json(res, 503, { error: "Razorpay keys not configured on relay." });
    }

    await forwardToRazorpay(req.method ?? "GET", `${url.pathname}${url.search}`, req, res);
  } catch (err) {
    console.error("relay error", err);
    json(res, 502, {
      error: err instanceof Error ? err.message : "Relay failed",
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Razorpay relay listening on 0.0.0.0:${PORT}`);
  if (!RELAY_SECRET || !KEY_ID) {
    console.warn("Warning: set RAZORPAYX_RELAY_SECRET and Razorpay keys in .env");
  }
});
