"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Matches common user-service admin payloads; extra keys are preserved for display. */
export type AdminUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  displayName?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  isActive?: boolean;
  banned?: boolean;
  isBanned?: boolean;
  /** Some APIs use a string status instead of booleans */
  status?: string | null;
  bannedAt?: string | null;
  banReason?: string | null;
  role?: string | null;
};

function parseUsersResponse(raw: unknown): AdminUser[] {
  if (Array.isArray(raw)) {
    return raw as AdminUser[];
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.users)) return o.users as AdminUser[];
    if (Array.isArray(o.data)) return o.data as AdminUser[];
    if (Array.isArray(o.items)) return o.items as AdminUser[];
  }
  return [];
}

function displayName(u: AdminUser): string {
  if (u.displayName?.trim()) return u.displayName.trim();
  if (u.username?.trim()) return `@${u.username.trim()}`;
  const parts = [u.firstName, u.lastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (u.email?.trim()) return u.email.trim();
  return u.id;
}

function bannedFlag(u: AdminUser): boolean {
  if (u.banned === true || u.isBanned === true) return true;
  const s = u.status?.toLowerCase();
  if (s === "banned" || s === "suspended") return true;
  return false;
}

function activeFlag(u: AdminUser): boolean {
  if (u.isActive === false) return false;
  const s = u.status?.toLowerCase();
  if (s === "inactive" || s === "deleted" || s === "disabled") return false;
  return true;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

type ModerationStatus = "banned" | "inactive" | "active";

function moderationStatus(u: AdminUser): ModerationStatus {
  if (bannedFlag(u)) return "banned";
  if (!activeFlag(u)) return "inactive";
  return "active";
}

function searchableText(u: AdminUser): string {
  return [
    u.id,
    u.email,
    u.phone,
    u.displayName,
    u.username,
    u.firstName,
    u.lastName,
    u.bio,
    u.banReason,
    u.role,
    u.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Every whitespace-separated token must appear somewhere in the searchable text. */
function matchesSearchTokens(u: AdminUser, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const blob = searchableText(u);
  return tokens.every((t) => blob.includes(t));
}

type StatusFilter = "all" | ModerationStatus;
type JoinedFilter = "all" | "24h" | "7d" | "30d";
type SortKey =
  | "moderation"
  | "name_asc"
  | "name_desc"
  | "email_asc"
  | "email_desc"
  | "created_desc"
  | "created_asc";

function parseCreatedMs(u: AdminUser): number {
  if (!u.createdAt) return 0;
  const t = new Date(u.createdAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function withinJoinedWindow(u: AdminUser, window: Exclude<JoinedFilter, "all">): boolean {
  const ms = parseCreatedMs(u);
  if (!ms) return false;
  const now = Date.now();
  const limits: Record<Exclude<JoinedFilter, "all">, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  return now - ms <= limits[window];
}

function sortUsers(list: AdminUser[], sortKey: SortKey): AdminUser[] {
  const out = [...list];
  const modRank = (u: AdminUser) => {
    const m = moderationStatus(u);
    if (m === "banned") return 0;
    if (m === "inactive") return 1;
    return 2;
  };
  out.sort((a, b) => {
    switch (sortKey) {
      case "moderation": {
        const mr = modRank(a) - modRank(b);
        if (mr !== 0) return mr;
        return parseCreatedMs(b) - parseCreatedMs(a);
      }
      case "name_asc":
        return displayName(a).localeCompare(displayName(b), undefined, { sensitivity: "base" });
      case "name_desc":
        return displayName(b).localeCompare(displayName(a), undefined, { sensitivity: "base" });
      case "email_asc": {
        const ea = (a.email ?? "").toLowerCase();
        const eb = (b.email ?? "").toLowerCase();
        return ea.localeCompare(eb);
      }
      case "email_desc": {
        const ea = (a.email ?? "").toLowerCase();
        const eb = (b.email ?? "").toLowerCase();
        return eb.localeCompare(ea);
      }
      case "created_desc":
        return parseCreatedMs(b) - parseCreatedMs(a);
      case "created_asc":
        return parseCreatedMs(a) - parseCreatedMs(b);
      default:
        return 0;
    }
  });
  return out;
}

const textareaClass = cn(
  "min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm",
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "outline-none disabled:opacity-50 dark:bg-input/30"
);

const selectClass = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-1 text-sm",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none",
  "dark:bg-input/30"
);

export function UsersSection() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [joinedFilter, setJoinedFilter] = useState<JoinedFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("moderation");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [displayNameField, setDisplayNameField] = useState("");
  const [usernameField, setUsernameField] = useState("");
  const [emailField, setEmailField] = useState("");
  const [phoneField, setPhoneField] = useState("");
  const [bioField, setBioField] = useState("");
  const [isActiveField, setIsActiveField] = useState(true);
  const [saving, setSaving] = useState(false);

  const [banOpen, setBanOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banSubmitting, setBanSubmitting] = useState(false);
  const [unbanBusy, setUnbanBusy] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<AdminUser | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  const [detailsUser, setDetailsUser] = useState<AdminUser | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<unknown>("/v1/admin/users");
      setItems(parseUsersResponse(res));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 320);
    return () => clearTimeout(t);
  }, [searchInput]);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const u of items) {
      const r = u.role?.trim();
      if (r) set.add(r);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredSorted = useMemo(() => {
    let list = items.filter((u) => matchesSearchTokens(u, debouncedSearch));

    if (statusFilter !== "all") {
      list = list.filter((u) => moderationStatus(u) === statusFilter);
    }

    if (roleFilter !== "all") {
      list = list.filter((u) => (u.role ?? "").trim() === roleFilter);
    }

    if (joinedFilter !== "all") {
      list = list.filter((u) => withinJoinedWindow(u, joinedFilter));
    }

    return sortUsers(list, sortKey);
  }, [items, debouncedSearch, statusFilter, roleFilter, joinedFilter, sortKey]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    roleFilter !== "all" ||
    joinedFilter !== "all" ||
    sortKey !== "moderation";

  const resetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setRoleFilter("all");
    setJoinedFilter("all");
    setSortKey("moderation");
  };

  const openEdit = (u: AdminUser) => {
    setEditing(u);
    setDisplayNameField(u.displayName ?? "");
    setUsernameField(u.username ?? "");
    setEmailField(u.email ?? "");
    setPhoneField(u.phone ?? "");
    setBioField(u.bio ?? "");
    setIsActiveField(activeFlag(u));
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        displayName: displayNameField.trim() || null,
        username: usernameField.trim() || null,
        email: emailField.trim() || null,
        phone: phoneField.trim() || null,
        bio: bioField.trim() || null,
        isActive: isActiveField,
      };
      await apiFetch(`/v1/admin/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success("User updated");
      setEditOpen(false);
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const openBan = (u: AdminUser) => {
    setBanTarget(u);
    setBanReason("");
    setBanOpen(true);
  };

  const handleBan = async () => {
    if (!banTarget) return;
    setBanSubmitting(true);
    try {
      await apiFetch(`/v1/admin/users/${banTarget.id}/ban`, {
        method: "POST",
        body: JSON.stringify({ reason: banReason.trim() || undefined }),
      });
      toast.success("User banned");
      setBanOpen(false);
      setBanTarget(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to ban");
    } finally {
      setBanSubmitting(false);
    }
  };

  const handleUnban = async (u: AdminUser) => {
    setUnbanBusy(true);
    try {
      await apiFetch(`/v1/admin/users/${u.id}/unban`, { method: "POST" });
      toast.success("Ban lifted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to unban");
    } finally {
      setUnbanBusy(false);
    }
  };

  const openReport = (u: AdminUser) => {
    setReportTarget(u);
    setReportReason("");
    setReportNotes("");
    setReportOpen(true);
  };

  const handleReport = async () => {
    if (!reportTarget) return;
    if (!reportReason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setReportLoading(true);
    try {
      await apiFetch(`/v1/admin/users/${reportTarget.id}/report`, {
        method: "POST",
        body: JSON.stringify({
          reason: reportReason.trim(),
          notes: reportNotes.trim() || undefined,
        }),
      });
      toast.success("Report recorded");
      setReportOpen(false);
      setReportTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit report");
    } finally {
      setReportLoading(false);
    }
  };

  const handleSoftDelete = async (id: string) => {
    setDeleteId(id);
    try {
      await apiFetch(`/v1/admin/users/${id}`, { method: "DELETE" });
      toast.success("User deactivated");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to deactivate");
    } finally {
      setDeleteId(null);
    }
  };

  const handleHardDelete = async (id: string) => {
    if (!confirm("Permanently delete this user? This cannot be undone.")) return;
    setHardDeleteId(id);
    try {
      await apiFetch(`/v1/admin/users/${id}/hard`, { method: "DELETE" });
      toast.success("User permanently deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setHardDeleteId(null);
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading users…</p>;
  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error}</p>
        <p className="text-sm text-muted-foreground">
          Ensure the API is running, <code className="text-xs">NEXT_PUBLIC_API_URL</code> is correct, and the gateway
          exposes <code className="text-xs">GET /v1/admin/users</code> (see README).
        </p>
        <Button onClick={load}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card/50 p-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between gap-y-3">
          <div>
            <h2 className="text-sm font-medium">Find & filter</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Search matches id, email, phone, names, username, bio, ban reason, role, and status. All words must match.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {(searchInput || hasActiveFilters) && (
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                Reset all
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => load()}>
              Refresh data
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden
          />
          <Input
            placeholder="Search users… (e.g. email fragment, user id, @handle)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-9 max-w-xl"
            aria-label="Search users"
          />
          {searchInput ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => setSearchInput("")}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="filter-status" className="text-xs text-muted-foreground">
              Account status
            </Label>
            <select
              id="filter-status"
              className={selectClass}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All</option>
              <option value="active">Active only</option>
              <option value="banned">Banned</option>
              <option value="inactive">Inactive / disabled</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-joined" className="text-xs text-muted-foreground">
              Joined
            </Label>
            <select
              id="filter-joined"
              className={selectClass}
              value={joinedFilter}
              onChange={(e) => setJoinedFilter(e.target.value as JoinedFilter)}
            >
              <option value="all">Any time</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-role" className="text-xs text-muted-foreground">
              Role
            </Label>
            <select
              id="filter-role"
              className={selectClass}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              disabled={roleOptions.length === 0}
            >
              <option value="all">All roles</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {roleOptions.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No role field on loaded users.</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-sort" className="text-xs text-muted-foreground">
              Sort by
            </Label>
            <select
              id="filter-sort"
              className={selectClass}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="moderation">Moderation priority (banned → inactive → new)</option>
              <option value="created_desc">Newest joined first</option>
              <option value="created_asc">Oldest joined first</option>
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="email_asc">Email A–Z</option>
              <option value="email_desc">Email Z–A</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground border-t pt-3">
          <span className="font-medium text-foreground">{filteredSorted.length}</span> shown
          {filteredSorted.length !== items.length ? (
            <>
              {" "}
              of <span className="font-medium text-foreground">{items.length}</span> loaded
            </>
          ) : null}
          {searchInput !== debouncedSearch ? (
            <span className="text-amber-600 dark:text-amber-400 ml-2">Updating search…</span>
          ) : null}
        </p>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Updates are sent to <code className="text-xs">PATCH /v1/admin/users/:id</code>. Your API may ignore or
              restrict some fields.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
              <div className="space-y-1">
                <Label htmlFor="u-id">User id</Label>
                <Input id="u-id" value={editing.id} readOnly className="opacity-80" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-display">Display name</Label>
                <Input
                  id="u-display"
                  value={displayNameField}
                  onChange={(e) => setDisplayNameField(e.target.value)}
                  placeholder="Display name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-username">Username</Label>
                <Input
                  id="u-username"
                  value={usernameField}
                  onChange={(e) => setUsernameField(e.target.value)}
                  placeholder="username"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-email">Email</Label>
                <Input
                  id="u-email"
                  type="email"
                  value={emailField}
                  onChange={(e) => setEmailField(e.target.value)}
                  placeholder="email"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-phone">Phone</Label>
                <Input
                  id="u-phone"
                  value={phoneField}
                  onChange={(e) => setPhoneField(e.target.value)}
                  placeholder="Phone"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-bio">Bio</Label>
                <textarea
                  id="u-bio"
                  className={textareaClass}
                  value={bioField}
                  onChange={(e) => setBioField(e.target.value)}
                  placeholder="Short bio"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="u-active"
                  checked={isActiveField}
                  onChange={(e) => setIsActiveField(e.target.checked)}
                />
                <Label htmlFor="u-active">Account active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Ban user</DialogTitle>
            <DialogDescription>
              {banTarget ? (
                <>
                  This will call <code className="text-xs">POST /v1/admin/users/{banTarget.id}/ban</code>.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ban-reason">Reason (optional)</Label>
            <textarea
              id="ban-reason"
              className={textareaClass}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Shown in admin logs if supported"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBan} disabled={banSubmitting}>
              {banSubmitting ? "Banning…" : "Ban user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Report user (admin)</DialogTitle>
            <DialogDescription>
              File an internal moderation report via{" "}
              <code className="text-xs">POST /v1/admin/users/:id/report</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="rep-reason">Reason</Label>
              <Input
                id="rep-reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="e.g. harassment, spam, impersonation"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rep-notes">Notes (optional)</Label>
              <textarea
                id="rep-notes"
                className={textareaClass}
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                rows={4}
                placeholder="Additional context for moderators"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReport} disabled={reportLoading}>
              {reportLoading ? "Submitting…" : "Submit report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsUser} onOpenChange={(o) => !o && setDetailsUser(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col" showCloseButton>
          <DialogHeader>
            <DialogTitle>User details</DialogTitle>
            <DialogDescription>Full JSON payload from the API (including extra fields).</DialogDescription>
          </DialogHeader>
          <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-auto flex-1 min-h-0 border">
            {detailsUser ? JSON.stringify(detailsUser, null, 2) : ""}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsUser(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="min-w-[260px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10 px-4">
                  {items.length === 0 ? (
                    "No users returned from the API."
                  ) : (
                    <span>
                      No users match your search or filters. Try{" "}
                      <button type="button" className="underline font-medium text-foreground" onClick={resetFilters}>
                        clearing filters
                      </button>
                      .
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredSorted.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                          {displayName(u).slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{displayName(u)}</div>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline truncate text-left font-mono"
                          onClick={() => setDetailsUser(u)}
                        >
                          {u.id}
                        </button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">{u.email ?? "—"}</TableCell>
                  <TableCell>{u.phone ?? "—"}</TableCell>
                  <TableCell className="max-w-[120px] truncate text-sm text-muted-foreground">
                    {u.role?.trim() || "—"}
                  </TableCell>
                  <TableCell>
                    {bannedFlag(u) ? (
                      <span className="text-destructive font-medium">Banned</span>
                    ) : activeFlag(u) ? (
                      <span className="text-muted-foreground">Active</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-500">Inactive</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                    {formatWhen(u.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => openEdit(u)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setDetailsUser(u)}>
                        JSON
                      </Button>
                      {bannedFlag(u) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => handleUnban(u)}
                          disabled={unbanBusy}
                        >
                          Unban
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-destructive"
                          onClick={() => openBan(u)}
                        >
                          Ban
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => openReport(u)}>
                        Report
                      </Button>
                      {activeFlag(u) && !bannedFlag(u) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => handleSoftDelete(u.id)}
                          disabled={deleteId === u.id}
                        >
                          Deactivate
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive"
                        onClick={() => handleHardDelete(u.id)}
                        disabled={hardDeleteId === u.id}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
