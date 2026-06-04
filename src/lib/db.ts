import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Supabase transaction pooler (port 6543) needs these params on serverless. */
function pooledDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgres")) return url;
  if (url.includes("pgbouncer=true")) return url;
  const usesPooler =
    url.includes(":6543") || url.includes(".pooler.supabase.com");
  if (!usesPooler) return url;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}pgbouncer=true&connection_limit=1`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: pooledDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
