import { PrismaClient } from "@prisma/client";

const globalForReceiptPrisma = globalThis as unknown as {
  receiptPrisma: PrismaClient | undefined;
};

/** Supabase direct connection (port 5432) — required for reliable BYTEA read/write. */
function receiptDatabaseUrl() {
  const direct = process.env.DIRECT_URL?.trim();
  if (direct?.startsWith("postgres")) {
    return direct;
  }

  const pooled = process.env.DATABASE_URL?.trim();
  if (!pooled?.startsWith("postgres")) {
    return pooled;
  }

  try {
    const normalized = pooled.replace(/^postgres:/, "postgresql:");
    const url = new URL(normalized);
    const projectRef = url.username.includes(".")
      ? url.username.split(".")[1]
      : null;

    if (projectRef && url.hostname.includes("pooler.supabase.com")) {
      url.hostname = `db.${projectRef}.supabase.co`;
      url.port = "5432";
      url.searchParams.delete("pgbouncer");
      url.searchParams.delete("connection_limit");
      url.searchParams.delete("connect_timeout");
      url.searchParams.delete("pool_timeout");
      return url.toString().replace(/^postgresql:/, "postgres:");
    }
  } catch {
    // fall through
  }

  return pooled;
}

/** Use for receipt BYTEA writes/reads (not the transaction pooler). */
export const receiptPrisma =
  globalForReceiptPrisma.receiptPrisma ??
  new PrismaClient({
    datasources: { db: { url: receiptDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForReceiptPrisma.receiptPrisma = receiptPrisma;

export function receiptFileDataInput(buffer: Buffer | undefined) {
  if (!buffer || buffer.length === 0) return undefined;
  return Buffer.from(buffer);
}
