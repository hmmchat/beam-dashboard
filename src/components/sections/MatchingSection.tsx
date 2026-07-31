"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";

interface ScoreWeights {
  intent: number;
  song: number;
  brands: number;
  interests: number;
  values: number;
  location: number;
}

interface StatusResponse {
  paused: boolean;
  mode?: string;
  semanticEnabled: boolean;
  canaryCities?: string[];
  scoreWeights?: ScoreWeights;
  embeddingsPaused?: boolean;
  totalCostInr: number;
  dailyBreakdown: Record<string, number>;
  budget: {
    total: number;
    daily?: number;
    budget: number;
    dailyBudget?: number;
    percent: number;
    remaining: number;
    dailyRemaining?: number;
    overBudget?: boolean;
  };
  poolSize: number;
  lastAllocationAt: string | null;
  lastShadowPairCount?: number;
  usersWithFeatures: number;
  usersWithoutFeatures: number;
  hostedFeatures?: number;
  fallbackFeatures?: number;
  jobs?: {
    pending: number;
    processing: number;
    failed: number;
  };
}

function toNum(n: unknown, fallback = 0): number {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string" && n.trim() !== "") {
    const parsed = Number(n);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function fmtInr(n: unknown, digits = 2): string {
  const v = toNum(n, NaN);
  if (!Number.isFinite(v)) return "—";
  return `₹${v.toFixed(digits)}`;
}

function ProgressBar({ percent }: { percent: number }) {
  const width = Math.min(Math.max(percent, 0), 100);
  const tone =
    percent > 80 ? "bg-destructive" : percent > 60 ? "bg-amber-500" : "bg-foreground/70";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

export function MatchingSection() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/admin/matching/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch matching status:", err);
      setError(err instanceof Error ? err.message : "Failed to load");
      toast.error("Failed to load matchmaking status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => void fetchStatus(), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: "pause" | "resume" | "generate-all") => {
    if (action === "generate-all") {
      const ok = window.confirm(
        "Enqueue embedding generation for all users with active discovery sessions?\n\nThis can spend embedding budget. Over budget, new vectors fall back to lexical matching."
      );
      if (!ok) return;
    }

    setActionLoading(action);
    try {
      const res = await fetch(`/api/admin/matching/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Failed to ${action}`);
      const data = await res.json();
      toast.success(data.message || `${action} completed`);
      await fetchStatus();
    } catch (err) {
      console.error(`${action} failed:`, err);
      toast.error(`Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error || !status) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error || "Failed to load status"}</p>
        <p className="text-sm text-muted-foreground">
          Ensure discovery-service is running and{" "}
          <code className="text-xs bg-muted px-1 rounded">ADMIN_API_TOKEN</code> matches on
          dashboard and discovery.
        </p>
        <Button type="button" variant="outline" onClick={() => void fetchStatus()}>
          Retry
        </Button>
      </div>
    );
  }

  const overBudget = Boolean(status.budget?.overBudget);
  const monthlyBudget = toNum(status.budget?.budget);
  const monthlySpent = toNum(status.budget?.total);
  const monthlyRemaining = toNum(
    status.budget?.remaining,
    Math.max(0, monthlyBudget - monthlySpent)
  );
  const monthlyPercent = toNum(
    status.budget?.percent,
    monthlyBudget > 0 ? (monthlySpent / monthlyBudget) * 100 : 0
  );
  const dailyBudget = toNum(status.budget?.dailyBudget, NaN);
  const dailySpent = toNum(status.budget?.daily);
  const dailyRemaining = toNum(
    status.budget?.dailyRemaining,
    Number.isFinite(dailyBudget) ? Math.max(0, dailyBudget - dailySpent) : NaN
  );
  const dailyPercent =
    Number.isFinite(dailyBudget) && dailyBudget > 0 ? (dailySpent / dailyBudget) * 100 : 0;

  const weights = status.scoreWeights;
  const dailyRows = Object.entries(status.dailyBreakdown || {})
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 14);

  const canary =
    status.canaryCities && status.canaryCities.length > 0
      ? status.canaryCities.join(", ")
      : status.mode === "batch_primary"
        ? "All cities"
        : "—";

  return (
    <div className="max-w-3xl space-y-8">
      <p className="text-sm text-muted-foreground">
        Batch allocator and semantic embedding pipeline. When the embedding budget is exhausted,
        new vectors fall back to lexical matching — pairing still continues.
      </p>

      {overBudget && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Embedding budget exhausted. New embeddings use non-semantic fallback until budget resets
          or is raised.
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void handleAction("resume")}
          disabled={!status.paused || actionLoading !== null}
        >
          {actionLoading === "resume" ? "Resuming…" : "Run allocator"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleAction("pause")}
          disabled={status.paused || actionLoading !== null}
        >
          {actionLoading === "pause" ? "Pausing…" : "Pause allocator"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleAction("generate-all")}
          disabled={actionLoading !== null}
        >
          {actionLoading === "generate-all" ? "Enqueueing…" : "Backfill features"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void fetchStatus()}
          disabled={actionLoading !== null}
        >
          Refresh
        </Button>
      </div>

      {/* Status */}
      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-medium mb-2">Status</h2>
        <StatRow label="Allocator" value={status.paused ? "Paused" : "Running"} />
        <StatRow
          label="Embeddings"
          value={status.embeddingsPaused ? "Paused" : "Active"}
        />
        <StatRow label="Mode" value={status.mode || "—"} />
        <StatRow
          label="Semantic scoring"
          value={status.semanticEnabled ? "Enabled" : "Disabled"}
        />
        <StatRow label="Cities" value={canary} />
        <StatRow label="Active pool" value={status.poolSize} />
        <StatRow
          label="Last cycle pairs"
          value={status.lastShadowPairCount ?? "—"}
        />
        <StatRow
          label="Last allocation"
          value={
            status.lastAllocationAt
              ? format(new Date(status.lastAllocationAt), "HH:mm:ss")
              : "—"
          }
        />
      </div>

      {/* Budget */}
      <div className="rounded-lg border p-4 space-y-4">
        <h2 className="text-sm font-medium">Embedding cost (₹)</h2>
        <p className="text-sm text-muted-foreground">
          Hard caps stop paid embedding calls only. Matching does not stop.
        </p>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Monthly</span>
            <span className="font-medium">{monthlyPercent.toFixed(1)}%</span>
          </div>
          <ProgressBar percent={monthlyPercent} />
          <p className="text-sm text-muted-foreground">
            {fmtInr(monthlySpent)} spent · {fmtInr(monthlyRemaining)} remaining of{" "}
            {fmtInr(monthlyBudget, 0)}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Daily</span>
            <span className="font-medium">
              {Number.isFinite(dailyBudget) ? `${dailyPercent.toFixed(1)}%` : "—"}
            </span>
          </div>
          <ProgressBar percent={Number.isFinite(dailyBudget) ? dailyPercent : 0} />
          <p className="text-sm text-muted-foreground">
            {fmtInr(dailySpent)} spent today
            {Number.isFinite(dailyBudget)
              ? ` · ${fmtInr(dailyRemaining)} remaining of ${fmtInr(dailyBudget, 0)}`
              : ""}
          </p>
        </div>
      </div>

      {/* Coverage + jobs */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium mb-2">Feature coverage</h2>
          <StatRow label="Total stored" value={status.usersWithFeatures} />
          <StatRow label="Hosted (semantic)" value={status.hostedFeatures ?? "—"} />
          <StatRow label="Fallback" value={status.fallbackFeatures ?? "—"} />
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium mb-2">Job queue</h2>
          <StatRow label="Pending" value={status.jobs?.pending ?? "—"} />
          <StatRow label="Processing" value={status.jobs?.processing ?? "—"} />
          <StatRow label="Failed" value={status.jobs?.failed ?? "—"} />
        </div>
      </div>

      {/* Weights */}
      {weights && (
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium mb-1">Score weights</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Read-only from discovery env (<code className="text-xs bg-muted px-1 rounded">MATCHING_SCORE_WEIGHT_*</code>).
          </p>
          <StatRow label="Intent" value={toNum(weights.intent).toFixed(1)} />
          <StatRow label="Song" value={toNum(weights.song).toFixed(1)} />
          <StatRow label="Brands" value={toNum(weights.brands).toFixed(1)} />
          <StatRow label="Interests" value={toNum(weights.interests).toFixed(1)} />
          <StatRow label="Values" value={toNum(weights.values).toFixed(1)} />
          <StatRow label="Location" value={toNum(weights.location).toFixed(1)} />
        </div>
      )}

      {/* Daily spend table */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Daily spend (last 14 days)</h2>
        {dailyRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cost data yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Spend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyRows.map(([date, cost]) => (
                <TableRow key={date}>
                  <TableCell>{format(new Date(date), "MMM dd, yyyy")}</TableCell>
                  <TableCell className="text-right">{fmtInr(cost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
