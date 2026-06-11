/** RazorpayX relay went live ~2026-06-10 11:00 AM IST (05:30 UTC). */
export const PRODUCTION_GO_LIVE_AT = new Date("2026-06-10T05:30:00.000Z");

export function productionDataSince(since?: Date) {
  if (!since || since < PRODUCTION_GO_LIVE_AT) return PRODUCTION_GO_LIVE_AT;
  return since;
}

export function claimCreatedSinceFilter(since?: Date) {
  return { createdAt: { gte: productionDataSince(since) } };
}

export function activityCreatedSinceFilter(since?: Date) {
  return { createdAt: { gte: productionDataSince(since) } };
}
