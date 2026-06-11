import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function appendDbParam(url: string, key: string, value: string) {
  if (url.includes(`${key}=`)) return url;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}${key}=${encodeURIComponent(value)}`;
}

/** Supabase transaction pooler (port 6543) needs these params on serverless. */
function pooledDatabaseUrl() {
  let url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgres")) return url;

  const usesPooler =
    url.includes(":6543") || url.includes(".pooler.supabase.com");
  if (!usesPooler) return url;

  url = appendDbParam(url, "pgbouncer", "true");
  url = appendDbParam(url, "connection_limit", "1");
  url = appendDbParam(url, "connect_timeout", "15");
  url = appendDbParam(url, "pool_timeout", "15");
  return url;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: pooledDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
