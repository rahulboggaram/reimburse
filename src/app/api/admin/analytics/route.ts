import { requireAdminAccess } from "@/lib/auth-api";
import { getAdminAnalytics } from "@/lib/admin-analytics";

export const maxDuration = 60;

export async function GET(request: Request) {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const daysParam = new URL(request.url).searchParams.get("days");
  const days = daysParam ? Number.parseInt(daysParam, 10) : 30;

  try {
    const data = await getAdminAnalytics(Number.isFinite(days) ? days : 30);
    return Response.json(data, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    console.error("admin/analytics failed", err);
    return Response.json(
      { error: "Could not load analytics. Please try again." },
      { status: 500 },
    );
  }
}
