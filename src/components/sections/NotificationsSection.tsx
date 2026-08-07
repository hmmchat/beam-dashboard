"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { apiUpload } from "@/lib/api";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function LineToggle({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          size="sm"
          variant={value === opt.value ? "default" : "outline"}
          className={cn(value === opt.value && "ring-1 ring-ring")}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

type NotificationLine = "BEAM" | "BEAM_MOD";

type CtaDraft = {
  label: string;
  url: string;
  kind: "deep" | "external";
};

type Campaign = {
  id: string;
  line: NotificationLine;
  status: string;
  title: string | null;
  body: string;
  images: string[];
  ctas: CtaDraft[];
  sentAt: string | null;
  recalledAt: string | null;
  createdAt: string;
  recipientCount: number | null;
  createdBy: string | null;
};

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return data as T;
}

function parseUserIds(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

export function NotificationsSection() {
  const pathname = usePathname();
  const [line, setLine] = useState<NotificationLine>("BEAM");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [userIdsRaw, setUserIdsRaw] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaKind, setCtaKind] = useState<"deep" | "external">("external");
  const [ctas, setCtas] = useState<CtaDraft[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [recallOpen, setRecallOpen] = useState(false);
  const [recallMode, setRecallMode] = useState<"last" | "last_n" | "all">("last");
  const [recallN, setRecallN] = useState("1");
  const [recallLine, setRecallLine] = useState<NotificationLine>("BEAM");
  const [recalling, setRecalling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch<{ campaigns: Campaign[] }>(
        "/api/admin/notification-campaigns?limit=5"
      );
      setCampaigns(Array.isArray(res.campaigns) ? res.campaigns : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load campaigns";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pathname !== "/dashboard/notifications") return;
    void load();
  }, [pathname, load]);

  const addCta = () => {
    if (!ctaLabel.trim() || !ctaUrl.trim()) {
      toast.error("CTA needs a label and URL");
      return;
    }
    if (ctas.length >= 5) {
      toast.error("Max 5 CTAs");
      return;
    }
    setCtas((prev) => [
      ...prev,
      { label: ctaLabel.trim(), url: ctaUrl.trim(), kind: ctaKind },
    ]);
    setCtaLabel("");
    setCtaUrl("");
  };

  const onUploadImage = async (file: File | null) => {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload("/v1/files/upload?folder=notifications", fd);
      if (!res.url) throw new Error("Upload did not return a URL");
      setImageUrl(res.url);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const resetCompose = () => {
    setTitle("");
    setBody("");
    setImageUrl("");
    setUserIdsRaw("");
    setCtas([]);
    setConfirmText("");
  };

  const doSend = async () => {
    if (!body.trim()) {
      toast.error("Message body is required");
      return;
    }
    if (line === "BEAM_MOD") {
      const ids = parseUserIds(userIdsRaw);
      if (ids.length === 0) {
        toast.error("Paste at least one user ID for BEAM MOD");
        return;
      }
    }

    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        line,
        body: body.trim(),
        title: title.trim() || null,
        images: imageUrl.trim() ? [imageUrl.trim()] : [],
        ctas,
      };
      if (line === "BEAM_MOD") {
        payload.userIds = parseUserIds(userIdsRaw);
      }
      const res = await adminFetch<{ ok: boolean; campaign?: { id: string } }>(
        "/api/admin/notification-campaigns",
        { method: "POST", body: JSON.stringify(payload) }
      );
      toast.success(
        line === "BEAM"
          ? "BEAM campaign sent to all eligible users"
          : `BEAM MOD campaign sent${res.campaign?.id ? ` (${res.campaign.id})` : ""}`
      );
      resetCompose();
      setConfirmOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const onSendClick = () => {
    if (line === "BEAM") {
      setConfirmText("");
      setConfirmOpen(true);
      return;
    }
    void doSend();
  };

  const doRecall = async () => {
    setRecalling(true);
    try {
      const n = Math.min(100, Math.max(1, Number(recallN) || 1));
      const res = await adminFetch<{ recalledCount: number }>(
        "/api/admin/notification-campaigns/recall",
        {
          method: "POST",
          body: JSON.stringify({
            line: recallLine,
            mode: recallMode,
            n: recallMode === "last_n" ? n : undefined,
          }),
        }
      );
      toast.success(`Recalled ${res.recalledCount ?? 0} campaign(s)`);
      setRecallOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recall failed");
    } finally {
      setRecalling(false);
    }
  };

  return (
    <div className="space-y-10">
      <section className="rounded-lg border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-lg font-medium">Compose notification</h2>
          <p className="text-sm text-muted-foreground mt-1">
            BEAM reaches all users registered at send time. BEAM MOD targets pasted user IDs.
            Threads are read-only in the app Inbox.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Line</Label>
          <LineToggle
            value={line}
            onChange={(v) => {
              if (v === "BEAM" || v === "BEAM_MOD") setLine(v);
            }}
            options={[
              { value: "BEAM", label: "BEAM (all users)" },
              { value: "BEAM_MOD", label: "BEAM MOD (user IDs)" },
            ]}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notif-title">Title (optional)</Label>
            <Input
              id="notif-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short headline"
              maxLength={200}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notif-body">Body</Label>
            <textarea
              id="notif-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={10000}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Message body (supports links in the app)"
            />
          </div>

          {line === "BEAM_MOD" && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notif-ids">User IDs (paste list)</Label>
              <textarea
                id="notif-ids"
                value={userIdsRaw}
                onChange={(e) => setUserIdsRaw(e.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={"user_abc\nuser_def\n…"}
              />
              <p className="text-xs text-muted-foreground">
                {parseUserIds(userIdsRaw).length} unique ID(s)
              </p>
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label>Image (optional)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL or upload"
              />
              <Input
                type="file"
                accept="image/*"
                className="max-w-xs"
                onChange={(e) => void onUploadImage(e.target.files?.[0] || null)}
              />
            </div>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="mt-2 h-24 rounded border object-cover" />
            ) : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>CTA buttons (optional)</Label>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="Label"
              />
              <Input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="URL or /deep/path"
                className="sm:col-span-2"
              />
              <LineToggle
                value={ctaKind}
                onChange={(v) => {
                  if (v === "deep" || v === "external") setCtaKind(v);
                }}
                options={[
                  { value: "external", label: "External" },
                  { value: "deep", label: "Deep" },
                ]}
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCta}>
              Add CTA
            </Button>
            {ctas.length > 0 && (
              <ul className="text-sm space-y-1 mt-2">
                {ctas.map((c, i) => (
                  <li key={`${c.label}-${i}`} className="flex items-center gap-2">
                    <Badge variant="secondary">{c.kind}</Badge>
                    <span className="font-medium">{c.label}</span>
                    <span className="text-muted-foreground truncate">{c.url}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCtas((prev) => prev.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Button type="button" onClick={onSendClick} disabled={sending}>
          {sending ? "Sending…" : line === "BEAM" ? "Send to all users…" : "Send to user IDs"}
        </Button>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-medium">Campaign history</h2>
            <p className="text-sm text-muted-foreground">
              Recall last / last N / all on a line (no in-place edit).
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setRecallLine(line);
                setRecallMode("last");
                setRecallOpen(true);
              }}
            >
              Recall…
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Badge variant={c.line === "BEAM" ? "default" : "secondary"}>
                        {c.line}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.status}</TableCell>
                    <TableCell className="max-w-[16rem] truncate">
                      {c.title || c.body}
                    </TableCell>
                    <TableCell>
                      {c.line === "BEAM" ? "All (at send)" : c.recipientCount ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {c.sentAt ? new Date(c.sentAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{c.createdBy || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm BEAM broadcast</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This sends to <strong>all users registered at this moment</strong>. Type{" "}
            <code className="text-xs">SEND</code> to confirm.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="SEND"
            autoComplete="off"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={sending || confirmText.trim() !== "SEND"}
              onClick={() => void doSend()}
            >
              {sending ? "Sending…" : "Confirm send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recallOpen} onOpenChange={setRecallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recall campaigns</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Line</Label>
              <LineToggle
                value={recallLine}
                onChange={(v) => {
                  if (v === "BEAM" || v === "BEAM_MOD") setRecallLine(v);
                }}
                options={[
                  { value: "BEAM", label: "BEAM" },
                  { value: "BEAM_MOD", label: "BEAM MOD" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <LineToggle
                value={recallMode}
                onChange={(v) => {
                  if (v === "last" || v === "last_n" || v === "all") setRecallMode(v);
                }}
                options={[
                  { value: "last", label: "Last" },
                  { value: "last_n", label: "Last N" },
                  { value: "all", label: "All" },
                ]}
              />
            </div>
            {recallMode === "last_n" && (
              <div className="space-y-2">
                <Label htmlFor="recall-n">N</Label>
                <Input
                  id="recall-n"
                  type="number"
                  min={1}
                  max={100}
                  value={recallN}
                  onChange={(e) => setRecallN(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRecallOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={recalling}
              onClick={() => void doRecall()}
            >
              {recalling ? "Recalling…" : "Recall"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
