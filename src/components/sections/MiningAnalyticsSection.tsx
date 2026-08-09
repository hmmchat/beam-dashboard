"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type MiningAnalytics = {
  ok?: boolean;
  generatedAt?: string;
  broadcastMines: number;
  videoCallMines: number;
  viewerMines: number;
  faceCardMines: number;
  referralMines: number;
  totalMines: number;
};

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border p-4 bg-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function MiningAnalyticsSection() {
  const [data, setData] = useState<MiningAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/admin/mining/analytics", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string; message?: string }).error ||
            (err as { message?: string }).message ||
            `Failed (${res.status})`
        );
      }
      const json = (await res.json()) as MiningAnalytics;
      setData(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load mining analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Loading analytics…</p>;
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Could not load analytics.</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Lifetime successful coin-mine counts by activity.
            {data.generatedAt ? (
              <> Updated {new Date(data.generatedAt).toLocaleString()}.</>
            ) : null}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => void load(true)}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Coin mining</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total mines"
            value={data.totalMines ?? 0}
            hint="All successful mine events"
          />
          <StatCard
            label="Broadcast"
            value={data.broadcastMines ?? 0}
            hint="Threshold chunks while broadcasting"
          />
          <StatCard
            label="Video call"
            value={data.videoCallMines ?? 0}
            hint="Threshold chunks on calls"
          />
          <StatCard
            label="Viewer"
            value={data.viewerMines ?? 0}
            hint="Threshold chunks watching Beam TV"
          />
          <StatCard
            label="FaceCard 100%"
            value={data.faceCardMines ?? 0}
            hint="First-time FaceCard completions"
          />
          <StatCard
            label="Referral"
            value={data.referralMines ?? 0}
            hint="Successful referrer payouts"
          />
        </div>
      </section>
    </div>
  );
}
