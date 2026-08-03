"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type SeasonTask = {
  id?: string;
  taskType: string;
  enabled: boolean;
  target: number;
  label: string;
  sortOrder: number;
};

type Season = {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "ENDED";
  giftPoolSize: number;
  approvedCount: number;
  startedAt?: string | null;
  endedAt?: string | null;
  tasks: SeasonTask[];
};

type Analytics = {
  season: Season;
  usersWithProgress: number;
  usersCompletedAllTasks: number;
  claims: {
    pending: number;
    rejected: number;
    approved: number;
    giftSent: number;
    giftReceived: number;
    total: number;
  };
  taskFunnels: Array<{
    taskType: string;
    label: string;
    target: number;
    usersStarted: number;
    usersCompleted: number;
  }>;
};

type Claim = {
  id: string;
  userId: string;
  status: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  addressLine3?: string | null;
  landmark?: string | null;
  state: string;
  city: string;
  pincode: string;
  rejectMessage?: string | null;
  courierName?: string | null;
  trackingNumber?: string | null;
  submittedAt: string;
};

type ProgressRow = {
  id: string;
  userId: string;
  uniqueStrangers: number;
  beamSeconds: number;
  beamcastSeconds: number;
  diamondsEarned: number;
  tasksCompletedAt?: string | null;
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
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

async function seasonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/seasons${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  }
  return data as T;
}

const DEFAULT_TASKS: SeasonTask[] = [
  {
    taskType: "UNIQUE_STRANGERS",
    enabled: true,
    target: 30,
    label: "Talk to unique strangers",
    sortOrder: 0,
  },
  {
    taskType: "BEAM_MINUTES",
    enabled: true,
    target: 60,
    label: "Beam minutes",
    sortOrder: 1,
  },
  {
    taskType: "BEAMCAST_MINUTES",
    enabled: true,
    target: 30,
    label: "Beamcast minutes",
    sortOrder: 2,
  },
  {
    taskType: "DIAMONDS_EARNED",
    enabled: true,
    target: 20,
    label: "Diamonds earned",
    sortOrder: 3,
  },
];

export function SeasonOpsSection() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [claimStatus, setClaimStatus] = useState<string>("PENDING");
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("Season 1");
  const [newPool, setNewPool] = useState(1000);
  const [editTasks, setEditTasks] = useState<SeasonTask[]>(DEFAULT_TASKS);
  const [rejectMsg, setRejectMsg] = useState("");
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [activeClaimId, setActiveClaimId] = useState<string>("");

  const selected = useMemo(
    () => seasons.find((s) => s.id === selectedId) || null,
    [seasons, selectedId]
  );

  const loadSeasons = useCallback(async () => {
    const list = await seasonFetch<Season[]>("");
    setSeasons(Array.isArray(list) ? list : []);
    if (!selectedId && list?.length) {
      const active = list.find((s) => s.status === "ACTIVE") || list[0];
      setSelectedId(active.id);
      setEditTasks(active.tasks?.length ? active.tasks : DEFAULT_TASKS);
    }
  }, [selectedId]);

  const loadDetails = useCallback(async (seasonId: string) => {
    if (!seasonId) return;
    const [a, c, p] = await Promise.all([
      seasonFetch<Analytics>(`/${seasonId}/analytics`),
      seasonFetch<{ items: Claim[] }>(
        `/${seasonId}/claims?status=${encodeURIComponent(claimStatus)}&limit=100`
      ),
      seasonFetch<{ items: ProgressRow[] }>(`/${seasonId}/progress?limit=100`),
    ]);
    setAnalytics(a);
    setClaims(c.items || []);
    setProgress(p.items || []);
    if (a?.season?.tasks?.length) setEditTasks(a.season.tasks);
  }, [claimStatus]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadSeasons();
      if (selectedId) await loadDetails(selectedId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load seasons");
    } finally {
      setLoading(false);
    }
  }, [loadSeasons, loadDetails, selectedId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetails(selectedId).catch((e) =>
      toast.error(e instanceof Error ? e.message : "Failed to load season details")
    );
  }, [selectedId, claimStatus, loadDetails]);

  const createSeason = async () => {
    try {
      const created = await seasonFetch<Season>("", {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          giftPoolSize: newPool,
          tasks: editTasks,
        }),
      });
      toast.success(`Created ${created.name}`);
      setSelectedId(created.id);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    }
  };

  const saveTasks = async () => {
    if (!selectedId) return;
    try {
      await seasonFetch(`/${selectedId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: selected?.name,
          giftPoolSize: selected?.giftPoolSize,
          tasks: editTasks,
        }),
      });
      toast.success("Season updated");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const runAction = async (path: string, body?: unknown, okMsg?: string) => {
    try {
      await seasonFetch(path, {
        method: "POST",
        body: body !== undefined ? JSON.stringify(body) : "{}",
      });
      toast.success(okMsg || "Done");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  const navLabel = selected?.status === "ACTIVE" ? selected.name : "Season ops";

  if (loading && !seasons.length) {
    return <p className="text-sm text-muted-foreground">Loading {navLabel}…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Season</Label>
          <select
            className="mt-1 flex h-9 w-64 rounded-md border bg-background px-3 text-sm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Select…</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Create season</h2>
        <div className="flex flex-wrap gap-3">
          <div>
            <Label>Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div>
            <Label>Gift pool (Y)</Label>
            <Input
              type="number"
              value={newPool}
              onChange={(e) => setNewPool(Number(e.target.value) || 1)}
            />
          </div>
          <Button className="self-end" onClick={() => void createSeason()}>
            Create draft
          </Button>
        </div>
      </section>

      {selected && analytics && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Approved / Pool"
              value={`${analytics.season.approvedCount}/${analytics.season.giftPoolSize}`}
            />
            <StatCard label="Users with progress" value={analytics.usersWithProgress} />
            <StatCard
              label="Completed all tasks"
              value={analytics.usersCompletedAllTasks}
            />
            <StatCard
              label="Claims pending"
              value={analytics.claims.pending}
              hint={`Sent ${analytics.claims.giftSent} · Received ${analytics.claims.giftReceived}`}
            />
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Task funnels</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.taskFunnels.map((t) => (
                  <TableRow key={t.taskType}>
                    <TableCell>{t.label}</TableCell>
                    <TableCell>{t.target}</TableCell>
                    <TableCell>{t.usersStarted}</TableCell>
                    <TableCell>{t.usersCompleted}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Configure tasks / pool</h2>
            <div className="flex flex-wrap gap-3 mb-3">
              <div>
                <Label>Gift pool</Label>
                <Input
                  type="number"
                  value={selected.giftPoolSize}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 1;
                    setSeasons((prev) =>
                      prev.map((s) =>
                        s.id === selected.id ? { ...s, giftPoolSize: v } : s
                      )
                    );
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              {editTasks.map((t, idx) => (
                <div key={t.taskType} className="grid gap-2 sm:grid-cols-4 items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={t.enabled}
                      onChange={(e) => {
                        const next = [...editTasks];
                        next[idx] = { ...t, enabled: e.target.checked };
                        setEditTasks(next);
                      }}
                    />
                    {t.taskType}
                  </label>
                  <Input
                    value={t.label}
                    onChange={(e) => {
                      const next = [...editTasks];
                      next[idx] = { ...t, label: e.target.value };
                      setEditTasks(next);
                    }}
                  />
                  <Input
                    type="number"
                    value={t.target}
                    onChange={(e) => {
                      const next = [...editTasks];
                      next[idx] = { ...t, target: Number(e.target.value) || 1 };
                      setEditTasks(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void saveTasks()}>
                Save config
              </Button>
              {selected.status === "DRAFT" && (
                <Button
                  size="sm"
                  onClick={() =>
                    void runAction(`/${selected.id}/start`, {}, "Season started")
                  }
                >
                  Start season
                </Button>
              )}
              {selected.status === "ACTIVE" && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void runAction(`/${selected.id}/end`, {}, "Season ended")
                  }
                >
                  End season
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (
                    confirm(
                      "Wipe this season completely (progress + claims)? This cannot be undone."
                    )
                  ) {
                    void runAction(`/${selected.id}/wipe`, {}, "Season wiped").then(
                      () => {
                        setSelectedId("");
                        setAnalytics(null);
                      }
                    );
                  }
                }}
              >
                Wipe (test reset)
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold">Claims</h2>
              <select
                className="h-8 rounded-md border bg-background px-2 text-sm"
                value={claimStatus}
                onChange={(e) => setClaimStatus(e.target.value)}
              >
                {["PENDING", "REJECTED", "APPROVED", "GIFT_SENT", "GIFT_RECEIVED"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  )
                )}
              </select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Name / Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.userId}</TableCell>
                    <TableCell>
                      <div className="text-sm">{c.recipientName}</div>
                      <div className="text-xs text-muted-foreground">+91 {c.phone}</div>
                    </TableCell>
                    <TableCell className="text-xs max-w-xs">
                      {[c.addressLine1, c.addressLine2, c.city, c.state, c.pincode]
                        .filter(Boolean)
                        .join(", ")}
                    </TableCell>
                    <TableCell>{c.status}</TableCell>
                    <TableCell className="space-y-2 min-w-[200px]">
                      {c.status === "PENDING" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              void runAction(
                                `/claims/${c.id}/approve`,
                                {},
                                "Approved"
                              )
                            }
                          >
                            Approve
                          </Button>
                          <Input
                            placeholder="Reject message"
                            value={activeClaimId === c.id ? rejectMsg : ""}
                            onFocus={() => setActiveClaimId(c.id)}
                            onChange={(e) => {
                              setActiveClaimId(c.id);
                              setRejectMsg(e.target.value);
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void runAction(
                                `/claims/${c.id}/reject`,
                                { rejectMessage: rejectMsg },
                                "Rejected"
                              )
                            }
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {(c.status === "APPROVED" || c.status === "GIFT_SENT") && (
                        <>
                          <Input
                            placeholder="Courier"
                            value={activeClaimId === c.id ? courierName : ""}
                            onFocus={() => setActiveClaimId(c.id)}
                            onChange={(e) => {
                              setActiveClaimId(c.id);
                              setCourierName(e.target.value);
                            }}
                          />
                          <Input
                            placeholder="Tracking #"
                            value={activeClaimId === c.id ? trackingNumber : ""}
                            onFocus={() => setActiveClaimId(c.id)}
                            onChange={(e) => {
                              setActiveClaimId(c.id);
                              setTrackingNumber(e.target.value);
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() =>
                              void runAction(
                                `/claims/${c.id}/gift-sent`,
                                { courierName, trackingNumber },
                                "Marked sent"
                              )
                            }
                          >
                            Mark sent
                          </Button>
                        </>
                      )}
                      {c.status === "GIFT_SENT" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void runAction(
                              `/claims/${c.id}/gift-received`,
                              {},
                              "Marked received"
                            )
                          }
                        >
                          Mark received
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!claims.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-sm">
                      No claims for this filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">User progress (latest 100)</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Strangers</TableHead>
                  <TableHead>Beam min</TableHead>
                  <TableHead>Beamcast min</TableHead>
                  <TableHead>Diamonds</TableHead>
                  <TableHead>Done</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progress.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.userId}</TableCell>
                    <TableCell>{p.uniqueStrangers}</TableCell>
                    <TableCell>{Math.floor(p.beamSeconds / 60)}</TableCell>
                    <TableCell>{Math.floor(p.beamcastSeconds / 60)}</TableCell>
                    <TableCell>{p.diamondsEarned}</TableCell>
                    <TableCell>{p.tasksCompletedAt ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </>
      )}
    </div>
  );
}
