/**
 * Remove today's test claims; keep the latest one with working Supabase receipt photos.
 *
 * Usage:
 *   npx tsx scripts/cleanup-today-test-claims.ts
 *   npx tsx scripts/cleanup-today-test-claims.ts --execute
 *
 * Requires DATABASE_URL or DIRECT_URL pointing at production Supabase.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  executeTodayTestClaimCleanup,
  previewTodayTestClaimCleanup,
} from "../src/lib/cleanup-today-test-claims";

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

async function main() {
  const execute = process.argv.includes("--execute");
  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("Set DATABASE_URL or DIRECT_URL in .env");
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    if (!execute) {
      const preview = await previewTodayTestClaimCleanup(prisma);
      console.log(JSON.stringify(preview, null, 2));
      console.log("\nDry run only. Re-run with --execute to delete.");
      return;
    }

    const result = await executeTodayTestClaimCleanup(prisma);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
