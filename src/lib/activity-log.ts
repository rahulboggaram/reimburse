import type { PlatformActivityType } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function logPlatformActivity(input: {
  type: PlatformActivityType;
  summary: string;
  actorId?: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.platformActivity.create({
    data: {
      type: input.type,
      summary: input.summary,
      actorId: input.actorId,
      targetUserId: input.targetUserId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export function displayName(name: string | null | undefined, phone: string) {
  return name?.trim() || phone;
}
