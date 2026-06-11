"use client";

import { useMemo, useState } from "react";
import type { AdminAnalytics } from "@/lib/admin-analytics";
import { fetchAdminAnalytics } from "@/lib/admin-fetch";
import { formatInr } from "@/lib/currency";
import { useCachedQuery } from "@/lib/use-cached-query";
import { PageHeading } from "@/components/page-heading";
import { StatCard } from "@/components/analytics/stat-card";
import { MiniBarChart } from "@/components/analytics/mini-bar-chart";
import { LabeledBarList } from "@/components/analytics/labeled-bar-list";
import { StatusBreakdown } from "@/components/analytics/status-breakdown";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-900">{props.title}</h2>
      {props.children}
    </section>
  );
}

function Panel(props: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-card-bg p-4",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const cacheKey = `admin-analytics-${days}`;

  const { data, loading, error } = useCachedQuery<AdminAnalytics>(
    cacheKey,
    () => fetchAdminAnalytics(days),
    { ttlMs: 60_000 },
  );

  const claimsChart = useMemo(
    () =>
      data?.usage.claimsPerDay.map((point) => ({
        date: point.date,
        value: point.claims,
      })) ?? [],
    [data],
  );

  const loginsChart = useMemo(
    () =>
      data?.usage.claimsPerDay.map((point) => ({
        date: point.date,
        value: point.logins,
      })) ?? [],
    [data],
  );

  return (
    <>
      <PageHeading
        title="Insights"
        info="Metrics since Razorpay payouts went live (10 Jun 2026). Pre-launch test data is excluded. Logins count WhatsApp sign-ins."
        className="mb-4"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.days}
            type="button"
            onClick={() => setDays(option.days)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              days === option.days
                ? "bg-emerald-800 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load insights. Please try again.
        </p>
      ) : loading && !data ? (
        <p className="text-sm text-zinc-500">Loading insights…</p>
      ) : data ? (
        <div className="space-y-8 pb-8">
          <Section title="People">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Active users" value={String(data.users.active)} />
              <StatCard
                label="Total accounts"
                value={String(data.users.total)}
                hint={`${data.users.newInPeriod} new in period`}
              />
            </div>
            <Panel>
              <p className="mb-3 text-xs font-medium text-zinc-500">
                Active users by role
              </p>
              <LabeledBarList
                items={data.users.byRole.map((row) => ({
                  label: row.label,
                  value: row.count,
                }))}
                emptyLabel="No active users."
              />
            </Panel>
          </Section>

          <Section title="Usage & traffic">
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Logins"
                value={String(data.usage.loginsInPeriod)}
                hint={`${data.usage.uniqueUsersLoggedIn} unique people`}
              />
              <StatCard
                label="People who submitted"
                value={String(data.usage.uniqueSubmittersInPeriod)}
                hint={`${data.claims.submittedInPeriod} claims filed`}
              />
            </div>
            <Panel>
              <p className="mb-2 text-xs font-medium text-zinc-500">
                Claims per day
              </p>
              <MiniBarChart data={claimsChart} barClassName="bg-emerald-600" />
            </Panel>
            <Panel>
              <p className="mb-2 text-xs font-medium text-zinc-500">
                Logins per day
              </p>
              <MiniBarChart
                data={loginsChart}
                barClassName="bg-amber-500"
                emptyLabel="No logins recorded in this period."
              />
            </Panel>
          </Section>

          <Section title="Reimbursements">
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Submitted (period)"
                value={formatInr(data.claims.amountSubmittedInPeriod)}
                hint={`${data.claims.submittedInPeriod} claims`}
              />
              <StatCard
                label="Paid out (period)"
                value={formatInr(data.claims.amountPaidInPeriod)}
              />
              <StatCard
                label="Pending now"
                value={String(data.claims.pendingNow)}
              />
              <StatCard
                label="Claims since live"
                value={String(data.claims.totalAllTime)}
                hint={
                  data.claims.averageClaimAmount > 0
                    ? `Avg ${formatInr(Math.round(data.claims.averageClaimAmount))}`
                    : undefined
                }
              />
            </div>
            <Panel>
              <p className="mb-3 text-xs font-medium text-zinc-500">
                Claims by status (this period)
              </p>
              <StatusBreakdown items={data.claims.byStatus} />
            </Panel>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Approval rate"
                value={
                  data.claims.approvalRatePercent != null
                    ? `${data.claims.approvalRatePercent}%`
                    : "—"
                }
                hint="Of decided claims"
              />
              <StatCard
                label="Median time to decide"
                value={
                  data.claims.medianDaysToDecision != null
                    ? `${data.claims.medianDaysToDecision.toFixed(1)}d`
                    : "—"
                }
              />
            </div>
          </Section>

          <Section title="Top spend (period)">
            <Panel>
              <p className="mb-3 text-xs font-medium text-zinc-500">
                Categories
              </p>
              <LabeledBarList
                items={data.topCategories.map((row) => ({
                  label: row.label,
                  value: row.amount,
                  sublabel: `${row.count} claims`,
                }))}
                formatValue={(v) => formatInr(v)}
                barClassName="bg-accent"
              />
            </Panel>
            <Panel>
              <p className="mb-3 text-xs font-medium text-zinc-500">Branches</p>
              <LabeledBarList
                items={data.topBranches.map((row) => ({
                  label: row.label,
                  value: row.amount,
                  sublabel: `${row.count} claims`,
                }))}
                formatValue={(v) => formatInr(v)}
                barClassName="bg-violet-500"
              />
            </Panel>
            <Panel>
              <p className="mb-3 text-xs font-medium text-zinc-500">
                Submitters
              </p>
              <LabeledBarList
                items={data.topSubmitters.map((row) => ({
                  label: row.label,
                  value: row.amount,
                  sublabel: `${row.count} claims`,
                }))}
                formatValue={(v) => formatInr(v)}
              />
            </Panel>
          </Section>
        </div>
      ) : null}
    </>
  );
}
