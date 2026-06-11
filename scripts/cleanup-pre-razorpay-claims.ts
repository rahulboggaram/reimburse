/**
 * Remove pre–RazorpayX test reimbursements; keep live claims (droplet relay era).
 *
 * Usage:
 *   npx tsx scripts/cleanup-pre-razorpay-claims.ts              # preview (default)
 *   npx tsx scripts/cleanup-pre-razorpay-claims.ts --execute    # delete
 *   npx tsx scripts/cleanup-pre-razorpay-claims.ts --since 2026-06-10T05:30:00Z
 *
 * Requires DATABASE_URL or DIRECT_URL pointing at production Supabase.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
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

/** Relay went live ~2026-06-10 11:00 IST (commit e785260). Override with --since. */
const DEFAULT_GO_LIVE_ISO = "2026-06-10T05:30:00.000Z";

function parseArgs() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const sinceIdx = args.indexOf("--since");
  const since =
    sinceIdx >= 0 && args[sinceIdx + 1]
      ? new Date(args[sinceIdx + 1])
      : new Date(DEFAULT_GO_LIVE_ISO);
  if (Number.isNaN(since.getTime())) {
    throw new Error("Invalid --since date. Use ISO format, e.g. 2026-06-10T05:30:00Z");
  }
  return { execute, goLiveAt: since };
}

function hasRazorpayTrail(claim: {
  razorpayPayoutId: string | null;
  payoutInitiatedAt: Date | null;
  payoutStatus: string | null;
  payoutError: string | null;
}) {
  return Boolean(
    claim.razorpayPayoutId?.trim() ||
      claim.payoutInitiatedAt ||
      claim.payoutStatus?.trim() ||
      claim.payoutError?.trim(),
  );
}

function shouldKeep(
  claim: {
    createdAt: Date;
    razorpayPayoutId: string | null;
    payoutInitiatedAt: Date | null;
    payoutStatus: string | null;
    payoutError: string | null;
  },
  goLiveAt: Date,
) {
  if (hasRazorpayTrail(claim)) return true;
  return claim.createdAt >= goLiveAt;
}

async function main() {
  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("Set DATABASE_URL or DIRECT_URL in .env");
  }

  const { execute, goLiveAt } = parseArgs();
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  try {
    const claims = await prisma.reimbursement.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        status: true,
        amount: true,
        category: true,
        employeeName: true,
        razorpayPayoutId: true,
        payoutInitiatedAt: true,
        payoutStatus: true,
        payoutError: true,
      },
    });

    const toKeep = claims.filter((c) => shouldKeep(c, goLiveAt));
    const toDelete = claims.filter((c) => !shouldKeep(c, goLiveAt));

    console.log(`Go-live cutoff: ${goLiveAt.toISOString()}`);
    console.log(`Total claims: ${claims.length}`);
    console.log(`Keep: ${toKeep.length}  |  Delete: ${toDelete.length}`);
    console.log("");

    if (toKeep.length > 0) {
      console.log("── Keeping ──");
      for (const c of toKeep) {
        const tag = hasRazorpayTrail(c) ? "razorpay" : "post-live";
        console.log(
          `  [${tag}] ${c.createdAt.toISOString().slice(0, 16)} | ${c.status} | ₹${c.amount} | ${c.category} | ${c.employeeName}`,
        );
      }
      console.log("");
    }

    if (toDelete.length === 0) {
      console.log("Nothing to delete.");
      return;
    }

    console.log("── Deleting (test / pre-live) ──");
    for (const c of toDelete) {
      console.log(
        `  ${c.createdAt.toISOString().slice(0, 16)} | ${c.status} | ₹${c.amount} | ${c.category} | ${c.employeeName} | ${c.id}`,
      );
    }
    console.log("");

    if (!execute) {
      console.log("Dry run only. Re-run with --execute to delete these claims.");
      console.log("(Receipts cascade automatically.)");
      return;
    }

    const deleteIds = toDelete.map((c) => c.id);
    const deleted = await prisma.reimbursement.deleteMany({
      where: { id: { in: deleteIds } },
    });

    const payoutActivities = await prisma.platformActivity.findMany({
      where: {
        type: { in: ["PAYOUT_INITIATED", "PAYOUT_COMPLETED", "PAYOUT_FAILED"] },
      },
      select: { id: true, metadata: true },
    });

    const orphanActivityIds = payoutActivities
      .filter((row) => {
        if (!row.metadata) return false;
        try {
          const meta = JSON.parse(row.metadata) as { claimId?: string };
          return meta.claimId && deleteIds.includes(meta.claimId);
        } catch {
          return false;
        }
      })
      .map((row) => row.id);

    if (orphanActivityIds.length > 0) {
      await prisma.platformActivity.deleteMany({
        where: { id: { in: orphanActivityIds } },
      });
    }

    console.log(`Deleted ${deleted.count} reimbursement(s).`);
    console.log(`Removed ${orphanActivityIds.length} orphaned payout activity row(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
