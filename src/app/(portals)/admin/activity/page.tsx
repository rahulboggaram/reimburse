"use client";

import { useEffect, useState } from "react";
import { formatDisplayDateTime } from "@/lib/dates";
import { formatPhoneDisplay } from "@/lib/phone";
import { PageHeading } from "@/components/page-heading";
import { readJson } from "@/lib/api";

type Activity = {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
  actor: { name: string | null; phone: string } | null;
  targetUser: { name: string | null; phone: string } | null;
};

export default function AdminActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/activity")
      .then((res) => readJson<Activity[]>(res))
      .then(setActivities)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeading
        title="Activity log"
        description="Logins, profile changes, and admin actions — not reimbursements."
        className="mb-4"
      />

      {loading ? (
        <p className="text-sm text-zinc-500">Loading activity…</p>
      ) : activities.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
          No activity recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
          {activities.map((activity) => (
            <li key={activity.id} className="px-4 py-3">
              <p className="text-sm text-zinc-900">{activity.summary}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {formatDisplayDateTime(activity.createdAt)}
                {activity.actor ? (
                  <>
                    {" "}
                    ·{" "}
                    {activity.actor.name ??
                      formatPhoneDisplay(activity.actor.phone)}
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
