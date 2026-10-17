"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CountWindow, ProductAnalytics, RateWindow } from "@/lib/product-analytics";

function pct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || value > 1) return "—";
  return `${Math.round(value * 100)}%`;
}

function lifetimeCoverage(data: ProductAnalytics): string {
  const coverage = data.coverage;
  if (!coverage || coverage.lifetime == null || coverage.lifetimePeople == null || coverage.lifetimeSignups == null) {
    return "—";
  }
  return `${count(coverage.lifetimePeople)} of ${count(coverage.lifetimeSignups)}`;
}

function count(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("en-IN");
}

function duration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes <= 0) return `${rest}s`;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function inr(paise: number | null | undefined): string {
  if (paise == null) return "—";
  return (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function wow(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "flat vs prior 7 days";
  if (previous === 0) return "new vs prior 7 days";
  const change = Math.round(((current - previous) / previous) * 100);
  const sign = change > 0 ? "+" : "";
  return `${sign}${change}% vs prior 7 days`;
}

function Metric({
  label,
  today,
  last7,
  lifetime,
  hint,
}: {
  label: string;
  today: string;
  last7: string;
  lifetime: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <dt className="text-[11px] text-muted-foreground">Today</dt>
          <dd className="text-xl font-semibold tabular-nums">{today}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Last 7 days</dt>
          <dd className="text-xl font-semibold tabular-nums">{last7}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Lifetime</dt>
          <dd className="text-xl font-semibold tabular-nums">{lifetime}</dd>
        </div>
      </dl>
    </div>
  );
}

function windowCount(value: CountWindow | null, pick: (row: CountWindow) => number): string {
  if (!value) return "—";
  return count(pick(value));
}

function windowRate(value: RateWindow | null, pick: (row: RateWindow) => number | null): string {
  if (!value) return "—";
  return pct(pick(value));
}

export function ProductAnalyticsSection() {
  const [data, setData] = useState<ProductAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/product-analytics", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || body.message || `Failed (${res.status})`);
      }
      setData(body as ProductAnalytics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load product analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Loading product analytics…</p>;
  }

  if (error && !data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const failed = Object.entries(data.sources).filter(([, source]) => !source.ok);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Read the top row to see if the week is moving. Read the funnel to see where people
          drop. The investor block is the same data, cut as a story: did new people get a real
          meeting, and did they come back.
        </p>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {failed.length > 0 ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {failed.map(([name, source]) => (
            <p key={name}>
              {name}: {"error" in source ? source.error : "unavailable"}
            </p>
          ))}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Is the week moving?</h2>
        <p className="text-sm text-muted-foreground">
          Compare the last 7 days with the 7 days before that. A rise in signups with a fall in
          real meetings means people are arriving and the meeting is the bottleneck.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Momentum
            label="Signups"
            value={data.signups ? count(data.signups.last7) : "—"}
            change={data.signups ? wow(data.signups.last7, data.signups.prior7) : "—"}
          />
          <Momentum
            label="People with a real meeting"
            value={data.realMeetingPeople ? count(data.realMeetingPeople.last7) : "—"}
            change={
              data.realMeetingPeople
                ? wow(data.realMeetingPeople.last7, data.realMeetingPeople.prior7)
                : "—"
            }
          />
          <Momentum
            label="Coverage"
            value={pct(data.coverage?.last7)}
            change="Share of people active in the last 7 days who had a real meeting"
          />
          <Momentum
            label="Came back the next day"
            value={data.d1 ? pct(data.d1.rate) : "—"}
            change={
              data.d1
                ? `${count(data.d1.returned)} of ${count(data.d1.signups)} who joined ${data.d1.day}`
                : "Needs yesterday's signups"
            }
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Did the product work?</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <Metric
            label="Real meeting, people"
            hint="Distinct people. This is the outcome, not the number of calls."
            today={windowCount(data.realMeetingPeople, (row) => row.today)}
            last7={windowCount(data.realMeetingPeople, (row) => row.last7)}
            lifetime={windowCount(data.realMeetingPeople, (row) => row.lifetime)}
          />
          <Metric
            label="Coverage"
            hint="Today and last 7 days are a share of active people. Lifetime is how many current signups have had a real meeting."
            today={pct(data.coverage?.today)}
            last7={pct(data.coverage?.last7)}
            lifetime={lifetimeCoverage(data)}
          />
          <Metric
            label="Median call length"
            hint="Two-person calls. Short medians mean people are skipping."
            today={data.medianCallSeconds ? duration(data.medianCallSeconds.today) : "—"}
            last7={data.medianCallSeconds ? duration(data.medianCallSeconds.last7) : "—"}
            lifetime={data.medianCallSeconds ? duration(data.medianCallSeconds.lifetime) : "—"}
          />
          <Metric
            label="Bail rate"
            hint="Calls where someone left in under 15 seconds."
            today={windowRate(data.bailRate, (row) => row.today)}
            last7={windowRate(data.bailRate, (row) => row.last7)}
            lifetime={windowRate(data.bailRate, (row) => row.lifetime)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Where people drop</h2>
        <p className="text-sm text-muted-foreground">
          Each step is people. FaceCard is the share of signups in that window who finished one.
          Activation is the share of the last 7 days of signups who already had a real meeting
          within 7 days of joining.
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          <Metric
            label="Signed up"
            today={windowCount(data.signups, (row) => row.today)}
            last7={windowCount(data.signups, (row) => row.last7)}
            lifetime={windowCount(data.signups, (row) => row.lifetime)}
          />
          <Metric
            label="Finished a FaceCard"
            today={windowRate(data.facecardRate, (row) => row.today)}
            last7={windowRate(data.facecardRate, (row) => row.last7)}
            lifetime={windowRate(data.facecardRate, (row) => row.lifetime)}
          />
          <Metric
            label="Entered a call"
            today={windowCount(data.callsJoinedPeople, (row) => row.today)}
            last7={windowCount(data.callsJoinedPeople, (row) => row.last7)}
            lifetime={windowCount(data.callsJoinedPeople, (row) => row.lifetime)}
          />
          <Metric
            label="Sent a message"
            today={windowCount(data.messagePeople, (row) => row.today)}
            last7={windowCount(data.messagePeople, (row) => row.last7)}
            lifetime={windowCount(data.messagePeople, (row) => row.lifetime)}
          />
        </div>
        <p className="text-sm">
          Activation, last 7 days of signups:{" "}
          <span className="font-semibold">{pct(data.activationLast7)}</span>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">What you show an investor</h2>
        <p className="text-sm text-muted-foreground">
          Yesterday&apos;s joiners, split by whether they had a real meeting before today. If the
          first group comes back and the second does not, the meeting is what keeps people.
        </p>
        {data.retentionSplit ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Had a real meeting on day one
              </div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">
                {pct(data.retentionSplit.withMeeting.rate)}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {count(data.retentionSplit.withMeeting.returned)} of{" "}
                {count(data.retentionSplit.withMeeting.people)} came back the next day
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                No real meeting on day one
              </div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">
                {pct(data.retentionSplit.withoutMeeting.rate)}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {count(data.retentionSplit.withoutMeeting.returned)} of{" "}
                {count(data.retentionSplit.withoutMeeting.people)} came back the next day
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This split appears once there is a full previous day of signups and call data.
          </p>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          <Metric
            label="Joined from someone's invite"
            hint="Share of new accounts that carried a referral code."
            today={windowRate(data.referredRate, (row) => row.today)}
            last7={windowRate(data.referredRate, (row) => row.last7)}
            lifetime={windowRate(data.referredRate, (row) => row.lifetime)}
          />
          <Metric
            label="Paid"
            hint="Completed coin purchases. A footnote until activation and next-day return are steady."
            today={
              data.payers
                ? `${count(data.payers.today)} · ${inr(data.revenuePaise?.today)}`
                : "—"
            }
            last7={
              data.payers
                ? `${count(data.payers.last7)} · ${inr(data.revenuePaise?.last7)}`
                : "—"
            }
            lifetime={
              data.payers
                ? `${count(data.payers.lifetime)} · ${inr(data.revenuePaise?.lifetime)}`
                : "—"
            }
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Where it is dense</h2>
        <p className="text-sm text-muted-foreground">
          Last 7 days, by the city on the profile. Gender is people active in that city. A small
          city where coverage is high is a better story than a thin national total.
          {data.genderActive7
            ? ` Overall active mix: ${count(data.genderActive7.female)} women, ${count(data.genderActive7.male)} men, ${count(data.genderActive7.other)} other or unset.`
            : ""}
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>City</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Signups</TableHead>
              <TableHead>Women</TableHead>
              <TableHead>Men</TableHead>
              <TableHead>Real meetings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.cities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No city activity yet.
                </TableCell>
              </TableRow>
            ) : (
              data.cities.map((city) => (
                <TableRow key={city.city}>
                  <TableCell>{city.city}</TableCell>
                  <TableCell>{count(city.active7)}</TableCell>
                  <TableCell>{count(city.signups7)}</TableCell>
                  <TableCell>{count(city.femaleActive7)}</TableCell>
                  <TableCell>{count(city.maleActive7)}</TableCell>
                  <TableCell>{count(city.realMeetings7)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Signup days</h2>
        <p className="text-sm text-muted-foreground">
          Each row is a day people joined. FaceCard and real meeting can still rise for the
          recent rows. Next-day return for older days fills in after the daily activity recorder
          has been running; yesterday also uses the latest heartbeat.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Joined</TableHead>
              <TableHead>People</TableHead>
              <TableHead>FaceCard</TableHead>
              <TableHead>Real meeting within 7 days</TableHead>
              <TableHead>Back the next day</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.cohorts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No signups in the last 14 days.
                </TableCell>
              </TableRow>
            ) : (
              data.cohorts.map((row) => (
                <TableRow key={row.day}>
                  <TableCell>{row.day}</TableCell>
                  <TableCell>{count(row.signups)}</TableCell>
                  <TableCell>{pct(row.facecardRate)}</TableCell>
                  <TableCell>{pct(row.realMeetingRate)}</TableCell>
                  <TableCell>{row.d1Known ? pct(row.d1Rate) : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Beam TV</h2>
        <p className="text-sm text-muted-foreground">
          A qualified viewer stayed at least 2 minutes. Hours are time watched, including people
          who came back to the same broadcast.
        </p>
        <div className="grid gap-3 lg:grid-cols-3">
          <Metric
            label="Hosts"
            today={windowCount(data.beamTv?.hosts ?? null, (row) => row.today)}
            last7={windowCount(data.beamTv?.hosts ?? null, (row) => row.last7)}
            lifetime={windowCount(data.beamTv?.hosts ?? null, (row) => row.lifetime)}
          />
          <Metric
            label="Qualified viewers"
            today={windowCount(data.beamTv?.qualifiedViewers ?? null, (row) => row.today)}
            last7={windowCount(data.beamTv?.qualifiedViewers ?? null, (row) => row.last7)}
            lifetime={windowCount(data.beamTv?.qualifiedViewers ?? null, (row) => row.lifetime)}
          />
          <Metric
            label="Watch hours"
            today={data.beamTv ? data.beamTv.watchHours.today.toFixed(1) : "—"}
            last7={data.beamTv ? data.beamTv.watchHours.last7.toFixed(1) : "—"}
            lifetime={data.beamTv ? data.beamTv.watchHours.lifetime.toFixed(1) : "—"}
          />
        </div>
      </section>

      <section className="space-y-1 text-xs text-muted-foreground">
        <p>Updated {new Date(data.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST.</p>
        {data.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </section>
    </div>
  );
}

function Momentum({ label, value, change }: { label: string; value: string; change: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{change}</p>
    </div>
  );
}
