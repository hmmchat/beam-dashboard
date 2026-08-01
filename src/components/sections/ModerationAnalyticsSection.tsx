"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { getAdminUsersBasePath } from "@/lib/admin-users-api";

type ModerationAnalytics = {
  ok?: boolean;
  generatedAt?: string;
  openCritical: number;
  t1: number;
  t2: number;
  t3: number;
  needsKyc: number;
  kycVerified: number;
  kycByStatus?: Record<string, number>;
  showAsModWorkQueue: number;
  disguisedWorkQueue: number;
  postBanShowAsModPool: number;
  moderatorsShowAsMod: number;
  moderatorsDisguised: number;
  tempBanned: number;
  permaBanned: number;
  bannedTotal: number;
  reportLayerThresholds?: {
    layer1: number;
    layer2: number;
    layer3: number;
    ban: number;
  };
};

function StatCard({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: number | string;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        emphasize ? "border-destructive/40 bg-destructive/5" : "bg-card"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ModerationAnalyticsSection() {
  const [data, setData] = useState<ModerationAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const base = getAdminUsersBasePath();
      const res = await apiFetch<ModerationAnalytics>(`${base}/moderation-analytics`);
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load moderation analytics");
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
    return <p className="text-sm text-muted-foreground">Loading moderation analytics…</p>;
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

  const thresholds = data.reportLayerThresholds;
  const kycByStatus = data.kycByStatus || {};

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Live counts of pending moderation work and account state.
            {data.generatedAt ? (
              <>
                {" "}
                Updated {new Date(data.generatedAt).toLocaleString()}.
              </>
            ) : null}
          </p>
          {thresholds ? (
            <p className="mt-1 text-xs text-muted-foreground">
              T1 ≥ {thresholds.layer1}, T2 ≥ {thresholds.layer2}, T3 ≥ {thresholds.layer3}, ban ≥{" "}
              {thresholds.ban}
            </p>
          ) : null}
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
        <h2 className="text-lg font-medium">Pending work</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Open critical"
            value={data.openCritical}
            hint="Disguised-mod queue"
            emphasize={data.openCritical > 0}
          />
          <StatCard label="T1" value={data.t1} hint="Non-critical report layer" />
          <StatCard label="T2" value={data.t2} hint="Non-critical report layer" />
          <StatCard label="T3" value={data.t3} hint="Non-critical report layer" />
          <StatCard label="Needs KYC" value={data.needsKyc} hint="Non-verified statuses" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Work queues</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Show-as-mod queue"
            value={data.showAsModWorkQueue}
            hint="Needs KYC ∪ T1–T3 (excl. critical)"
          />
          <StatCard
            label="Disguised queue"
            value={data.disguisedWorkQueue}
            hint="Active critical review"
            emphasize={data.disguisedWorkQueue > 0}
          />
          <StatCard
            label="Post-ban pool"
            value={data.postBanShowAsModPool}
            hint="Awaiting staff unban path"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">KYC</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="KYC verified" value={data.kycVerified} />
          <StatCard label="Needs KYC" value={data.needsKyc} />
          <StatCard label="Unverified" value={kycByStatus.UNVERIFIED ?? 0} />
          <StatCard label="Pending review" value={kycByStatus.PENDING_REVIEW ?? 0} />
          <StatCard label="Revoked" value={kycByStatus.REVOKED ?? 0} />
          <StatCard label="Expired" value={kycByStatus.EXPIRED ?? 0} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Bans</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Temp banned" value={data.tempBanned} />
          <StatCard label="Perma banned" value={data.permaBanned} />
          <StatCard label="Banned total" value={data.bannedTotal} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Moderators online mode</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            label="Show as moderator"
            value={data.moderatorsShowAsMod}
            hint="Face-card active accounts"
          />
          <StatCard
            label="Disguised"
            value={data.moderatorsDisguised}
            hint="Show as user accounts"
          />
        </div>
      </section>
    </div>
  );
}
