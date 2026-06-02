import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import {
  activityIncludeQuery,
  serializeActivity,
} from "@/lib/activities";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const activities = await prisma.platformActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: activityIncludeQuery,
  });

  return Response.json(activities.map(serializeActivity));
}
