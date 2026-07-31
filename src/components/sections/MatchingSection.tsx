"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Loader2,
  AlertCircle,
  RefreshCw,
  DollarSign,
  Pause,
  Play,
  Database,
  Settings2,
  ListTodo,
} from "lucide-react";
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

function fmtWeight(n: unknown): string {
  const v = toNum(n, NaN);
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(1);
}

export function MatchingSection() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/admin/matching/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      console.error("Failed to fetch matching status:", error);
      toast.error("Failed to load matchmaking status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: "pause" | "resume" | "generate-all") => {
    if (action === "generate-all") {
      const ok = window.confirm(
        "Enqueue embedding generation for all users with active discovery sessions?\n\nThis can spend embedding budget. Over budget, new vectors fall back to lexical (non-semantic) matching — matching itself does not stop."
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
    } catch (error) {
      console.error(`${action} failed:`, error);
      toast.error(`Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Matchmaking Pipeline
          </CardTitle>
          <CardDescription>Loading status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className="w-full border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Matchmaking Pipeline
          </CardTitle>
          <CardDescription>Failed to load status</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const overBudget = Boolean(status.budget?.overBudget);
  const monthlyBudget = toNum(status.budget?.budget);
  const monthlySpent = toNum(status.budget?.total);
  const monthlyRemaining = toNum(status.budget?.remaining, Math.max(0, monthlyBudget - monthlySpent));
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

  const statusColor = status.paused ? "text-amber-600" : "text-green-600";
  const statusBg = status.paused ? "bg-amber-100" : "bg-green-100";
  const statusText = status.paused ? "Paused" : "Running";

  const weights = status.scoreWeights;
  const weightRows: Array<[string, number | undefined]> = weights
    ? [
        ["Intent", weights.intent],
        ["Song", weights.song],
        ["Brands", weights.brands],
        ["Interests", weights.interests],
        ["Values", weights.values],
        ["Location", weights.location],
      ]
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6" />
            Matchmaking Pipeline
          </CardTitle>
          <CardDescription>
            Monitor and control the batch allocator and semantic embedding pipeline.
            Budget exhaustion switches new embeddings to lexical fallback — matching continues.
          </CardDescription>
        </CardHeader>
      </Card>

      {overBudget && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-900">Embedding budget exhausted</p>
              <p className="text-sm text-amber-800 mt-1">
                New embeddings will use non-semantic fallback until budget resets or is raised.
                The allocator keeps running; intent matching degrades to token overlap.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Allocator Status</p>
            <div className="mt-2">
              <Badge className={`${statusBg} ${statusColor} text-base px-3 py-1`}>
                {statusText}
              </Badge>
            </div>
            {status.embeddingsPaused !== undefined && (
              <p className="text-xs text-muted-foreground mt-2">
                Embeddings: {status.embeddingsPaused ? "paused" : "active"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Mode / Semantic</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">{status.mode || "unknown"}</Badge>
              <Badge
                className={
                  status.semanticEnabled
                    ? "bg-green-100 text-green-600"
                    : "bg-red-100 text-red-600"
                }
              >
                {status.semanticEnabled ? "Semantic on" : "Semantic off"}
              </Badge>
            </div>
            {status.canaryCities && status.canaryCities.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Canary cities: {status.canaryCities.join(", ")}
              </p>
            )}
            {(!status.canaryCities || status.canaryCities.length === 0) &&
              status.mode === "batch_primary" && (
                <p className="text-xs text-muted-foreground mt-2">Full rollout (all cities)</p>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Active Pool Size</p>
            <p className="text-2xl font-bold text-primary mt-1">{status.poolSize}</p>
            {typeof status.lastShadowPairCount === "number" && (
              <p className="text-xs text-muted-foreground mt-2">
                Last cycle pairs: {status.lastShadowPairCount}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Last Allocation</p>
            <p className="text-2xl font-bold mt-1">
              {status.lastAllocationAt
                ? format(new Date(status.lastAllocationAt), "HH:mm:ss")
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget & Cost */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Embedding Cost Tracking (₹)
          </CardTitle>
          <CardDescription>
            Hard caps stop paid embedding calls. Matching does not stop when budget is hit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Monthly budget</span>
                  <span className="font-medium">{monthlyPercent.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      monthlyPercent > 80
                        ? "bg-red-500"
                        : monthlyPercent > 60
                          ? "bg-amber-500"
                          : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(monthlyPercent, 100)}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {fmtInr(monthlySpent)} spent · {fmtInr(monthlyRemaining)} remaining of{" "}
                  {fmtInr(monthlyBudget, 0)}
                </p>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Daily budget</span>
                  <span className="font-medium">
                    {Number.isFinite(dailyBudget) ? `${dailyPercent.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      dailyPercent > 80
                        ? "bg-red-500"
                        : dailyPercent > 60
                          ? "bg-amber-500"
                          : "bg-green-500"
                    }`}
                    style={{
                      width: `${Math.min(Number.isFinite(dailyBudget) ? dailyPercent : 0, 100)}%`,
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {fmtInr(dailySpent)} spent today ·{" "}
                  {Number.isFinite(dailyBudget)
                    ? `${fmtInr(dailyRemaining)} remaining of ${fmtInr(dailyBudget, 0)}`
                    : "daily limit not reported"}
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Daily Spend (Last 30 Days)</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 max-h-48 overflow-y-auto">
                {Object.entries(status.dailyBreakdown || {})
                  .sort(([a], [b]) => b.localeCompare(a))
                  .slice(0, 30)
                  .map(([date, cost]) => (
                    <div
                      key={date}
                      className="flex justify-between text-sm p-2 bg-muted/50 rounded"
                    >
                      <span>{format(new Date(date), "MMM dd")}</span>
                      <span className="font-medium">{fmtInr(cost)}</span>
                    </div>
                  ))}
                {Object.keys(status.dailyBreakdown || {}).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4 col-span-full">
                    No cost data yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Coverage + Jobs */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Semantic Feature Coverage
            </CardTitle>
            <CardDescription>
              Hosted = real embeddings (cosine intent). Fallback = hash/lexical only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="p-4 bg-muted/50 rounded-lg border">
                <p className="text-sm text-muted-foreground">Total stored</p>
                <p className="text-3xl font-bold">{status.usersWithFeatures}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="text-sm text-green-700">Hosted (semantic)</p>
                <p className="text-3xl font-bold text-green-600">
                  {status.hostedFeatures ?? "—"}
                </p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-sm text-amber-700">Fallback (non-semantic)</p>
                <p className="text-3xl font-bold text-amber-600">
                  {status.fallbackFeatures ?? "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Feature Job Queue
            </CardTitle>
            <CardDescription>
              Background embedding worker. Stuck &quot;processing&quot; jobs are reclaimed by lease.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="p-4 bg-muted/50 rounded-lg border">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold">{status.jobs?.pending ?? "—"}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-700">Processing</p>
                <p className="text-3xl font-bold text-blue-600">
                  {status.jobs?.processing ?? "—"}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <p className="text-sm text-red-700">Failed</p>
                <p className="text-3xl font-bold text-red-600">
                  {status.jobs?.failed ?? "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score weights (read-only deployment config) */}
      {weights && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Score Weights (read-only)
            </CardTitle>
            <CardDescription>
              From discovery-service env (<code>MATCHING_SCORE_WEIGHT_*</code>). Normalized to 100.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {weightRows.map(([label, value]) => (
                <div key={label} className="p-3 bg-muted/50 rounded-lg border">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-semibold">{fmtWeight(value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Pipeline Controls
          </CardTitle>
          <CardDescription>
            Pause stops allocation and paid embeddings. Backfill enqueues feature jobs for active sessions only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant={!status.paused ? "default" : "outline"}
                onClick={() => void handleAction("resume")}
                disabled={!status.paused || actionLoading === "pause" || actionLoading === "resume"}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Run Allocator
              </Button>
              <Button
                variant={status.paused ? "default" : "outline"}
                onClick={() => void handleAction("pause")}
                disabled={status.paused || actionLoading === "pause" || actionLoading === "resume"}
                className="gap-2"
              >
                <Pause className="h-4 w-4" />
                Pause Allocator
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={() => void handleAction("generate-all")}
              disabled={actionLoading === "generate-all"}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${actionLoading === "generate-all" ? "animate-spin" : ""}`}
              />
              Backfill Features
            </Button>

            <Button
              variant="outline"
              onClick={() => void fetchStatus()}
              disabled={loading || actionLoading !== null}
              className="gap-2"
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
              Refresh Status
            </Button>
          </div>

          {actionLoading && (
            <p className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {actionLoading}...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
