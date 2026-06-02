import type { Prisma } from "@prisma/client";

const activityInclude = {
  actor: { select: { id: true, name: true, phone: true } },
  targetUser: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.PlatformActivityInclude;

export type ActivityWithRelations = Prisma.PlatformActivityGetPayload<{
  include: typeof activityInclude;
}>;

export function serializeActivity(activity: ActivityWithRelations) {
  return {
    id: activity.id,
    type: activity.type,
    summary: activity.summary,
    createdAt: activity.createdAt.toISOString(),
    actor: activity.actor
      ? {
          id: activity.actor.id,
          name: activity.actor.name,
          phone: activity.actor.phone,
        }
      : null,
    targetUser: activity.targetUser
      ? {
          id: activity.targetUser.id,
          name: activity.targetUser.name,
          phone: activity.targetUser.phone,
        }
      : null,
  };
}

export const activityIncludeQuery = activityInclude;
