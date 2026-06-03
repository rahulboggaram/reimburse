export function claimsMineCacheKey(userId: string) {
  return `claims-mine:${userId}`;
}

export function claimsRejectedCacheKey(userId: string) {
  return `claims-rejected:${userId}`;
}
