import { requireAdminAccess } from "@/lib/auth-api";
import {
  executeTodayTestClaimCleanup,
  previewTodayTestClaimCleanup,
} from "@/lib/cleanup-today-test-claims";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const preview = await previewTodayTestClaimCleanup(prisma);
  return Response.json(preview);
}

export async function POST(request: Request) {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const execute = url.searchParams.get("execute") === "1";

  if (!execute) {
    const preview = await previewTodayTestClaimCleanup(prisma);
    return Response.json({
      ...preview,
      message: "Dry run only. POST again with ?execute=1 to delete.",
    });
  }

  const result = await executeTodayTestClaimCleanup(prisma);
  return Response.json(result);
}
