"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { adminUserPath, getAdminUsersBasePath } from "@/lib/admin-users-api";
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
};

const PROFILE_MEDIA_SUBTREE_KEYS = new Set([
  "profiles",
  "profile",
  "photos",
  "images",
  "profilePhotos",
  "pictures",
  "gallery",
  "media",
  "files",
  "attachments",
  "uploads",
]);

function normalizeSingleUserResponse(raw: unknown): AdminUser | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id === "string") return o as AdminUser;
  const user = o.user;
  if (user && typeof user === "object" && typeof (user as AdminUser).id === "string") {
    return user as AdminUser;
  }
  const data = o.data;
  if (data && typeof data === "object") return normalizeSingleUserResponse(data);
  return null;
}

function collectUrlsFromMediaSubtree(value: unknown, out: Set<string>, depth: number): void {
  if (depth > 12) return;
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return;
    if (/^https?:\/\//i.test(t) || (t.startsWith("/") && t.length > 1)) out.add(t);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrlsFromMediaSubtree(item, out, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  for (const k of ["url", "imageUrl", "thumbnailUrl", "src", "uri", "publicUrl", "avatarUrl"]) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) {
      const t = v.trim();
      if (/^https?:\/\//i.test(t) || (t.startsWith("/") && t.length > 1)) out.add(t);
    }
  }
  for (const v of Object.values(obj)) {
    if (v !== null && typeof v === "object") collectUrlsFromMediaSubtree(v, out, depth + 1);
  }
}

/** Image URLs from avatar + common nested shapes (photos, profiles, gallery, etc.). */
function extractProfileImageUrls(u: AdminUser): string[] {
  const out = new Set<string>();
  if (u.avatarUrl?.trim()) {
    const t = u.avatarUrl.trim();
    if (/^https?:\/\//i.test(t) || t.startsWith("/")) out.add(t);
  }
  const raw = u as unknown as Record<string, unknown>;
  for (const key of PROFILE_MEDIA_SUBTREE_KEYS) {
    if (raw[key] != null) collectUrlsFromMediaSubtree(raw[key], out, 0);
  }
  for (const key of Object.keys(raw)) {
    if (key.endsWith("Photos") || key.endsWith("Images")) {
      collectUrlsFromMediaSubtree(raw[key], out, 0);
    }
  }
  return Array.from(out);
}

function getProfileRows(u: AdminUser): Record<string, unknown>[] {
  const raw = u as unknown as Record<string, unknown>;
  const profiles = raw.profiles;
  if (Array.isArray(profiles)) {
    return profiles.filter((p): p is Record<string, unknown> => p !== null && typeof p === "object");
  }
  const single = raw.profile;
  if (single && typeof single === "object" && !Array.isArray(single)) {
    return [single as Record<string, unknown>];
  }
  return [];
}

function formatProfileFieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\s+/, "")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function profileRowEntries(row: Record<string, unknown>): { key: string; value: string }[] {
  const skip = new Set([
    "password",
    "passwordHash",
    "token",
    "refreshToken",
    "accessToken",
    "secret",
  ]);
  const out: { key: string; value: string }[] = [];
  for (const [key, val] of Object.entries(row)) {
    if (skip.has(key)) continue;
    if (val === null || val === undefined) continue;
    if (typeof val === "object") continue;
    const s = String(val).trim();
    if (!s) continue;
    out.push({ key, value: s });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

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

  const [profileUser, setProfileUser] = useState<AdminUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<unknown>(getAdminUsersBasePath());
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

  const filteredSorted = useMemo(() => {
    let list = items.filter((u) => matchesSearchTokens(u, debouncedSearch));

    if (statusFilter !== "all") {
      list = list.filter((u) => moderationStatus(u) === statusFilter);
    }

    if (joinedFilter !== "all") {
      list = list.filter((u) => withinJoinedWindow(u, joinedFilter));
    }

    return sortUsers(list, sortKey);
  }, [items, debouncedSearch, statusFilter, joinedFilter, sortKey]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    joinedFilter !== "all" ||
    sortKey !== "moderation";

  const resetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setStatusFilter("all");
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
      await apiFetch(adminUserPath(editing.id), {
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
      await apiFetch(adminUserPath(banTarget.id, "ban"), {
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
      await apiFetch(adminUserPath(u.id, "unban"), { method: "POST" });
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
      await apiFetch(adminUserPath(reportTarget.id, "report"), {
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
      await apiFetch(adminUserPath(id), { method: "DELETE" });
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
      await apiFetch(adminUserPath(id, "hard"), { method: "DELETE" });
      toast.success("User permanently deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setHardDeleteId(null);
    }
  };

  const openProfile = useCallback(async (u: AdminUser) => {
    setProfileUser(u);
    setProfileLoading(true);
    try {
      const raw = await apiFetch<unknown>(adminUserPath(u.id));
      const one = normalizeSingleUserResponse(raw);
      if (one) {
        setProfileUser({ ...u, ...one });
      }
    } catch {
      /* list row is enough if GET :id is not implemented */
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const profileRows = profileUser ? getProfileRows(profileUser) : [];
  const profileImages = profileUser ? extractProfileImageUrls(profileUser) : [];

  if (loading) return <p className="text-muted-foreground">Loading users…</p>;
  if (error) {
    const listPath = getAdminUsersBasePath();
    const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
    const apiPointsToDashboard =
      typeof window !== "undefined" &&
      apiBase.length > 0 &&
      apiBase === window.location.origin.replace(/\/$/, "");
    const looksLikeMissingRoute = /no route found/i.test(error);

    return (
      <div className="space-y-4 max-w-2xl">
        <p className="text-destructive font-medium">{error}</p>
        <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-3">
          <p className="font-medium text-foreground">How to fix</p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            {looksLikeMissingRoute ? (
              <li>
                Your <strong className="text-foreground">API gateway</strong> has no route for{" "}
                <code className="text-xs">GET {listPath}</code>. Add that handler in user-service and register it on the
                gateway (see README). If your path differs, set{" "}
                <code className="text-xs">NEXT_PUBLIC_ADMIN_USERS_PATH</code> and rebuild.
              </li>
            ) : null}
            <li>
              <code className="text-xs">NEXT_PUBLIC_API_URL</code> must be the <strong className="text-foreground">API gateway origin</strong> (e.g.{" "}
              <code className="text-xs">https://api.yourdomain.com</code>), not the dashboard. It is embedded at{" "}
              <strong className="text-foreground">build time</strong> (GitHub Actions secret for Docker).
            </li>
            {apiPointsToDashboard ? (
              <li className="text-destructive">
                <strong>Detected:</strong> API URL matches this site’s origin—browser calls are going to the dashboard
                instead of the API. Update the <code className="text-xs">NEXT_PUBLIC_API_URL</code> build secret and
                redeploy.
              </li>
            ) : null}
          </ul>
        </div>
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
              Search matches id, email, phone, names, username, bio, ban reason, and status. All words must match.
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              Updates are sent to <code className="text-xs">PATCH {getAdminUsersBasePath()}/:id</code>. Your API may
              ignore or restrict some fields.
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
                  This will call{" "}
                  <code className="text-xs break-all">POST {adminUserPath(banTarget.id, "ban")}</code>.
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
              <code className="text-xs">POST {getAdminUsersBasePath()}/:id/report</code>.
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

      <Dialog open={!!profileUser} onOpenChange={(o) => !o && setProfileUser(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" showCloseButton>
          <DialogHeader>
            <DialogTitle>User profile</DialogTitle>
            <DialogDescription>
              Fields from the user payload and any nested <code className="text-xs">profiles</code> /{" "}
              <code className="text-xs">profile</code> objects. Photos are collected from{" "}
              <code className="text-xs">avatarUrl</code>, <code className="text-xs">photos</code>,{" "}
              <code className="text-xs">gallery</code>, and similar keys. A{" "}
              <code className="text-xs">GET {getAdminUsersBasePath()}/:id</code> request is tried to load full detail
              when you open this panel.
            </DialogDescription>
          </DialogHeader>
          {profileUser ? (
            <div className="space-y-6 py-1">
              {profileLoading ? (
                <p className="text-sm text-muted-foreground">Loading full profile from the API…</p>
              ) : null}

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="shrink-0">
                  {profileUser.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profileUser.avatarUrl}
                      alt=""
                      className="h-24 w-24 rounded-xl object-cover border bg-muted"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-xl border bg-muted flex items-center justify-center text-2xl font-semibold text-muted-foreground">
                      {displayName(profileUser).slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="text-lg font-semibold leading-tight">{displayName(profileUser)}</h3>
                  <p className="text-xs font-mono text-muted-foreground break-all">{profileUser.id}</p>
                  {profileUser.username?.trim() ? (
                    <p className="text-sm text-muted-foreground">@{profileUser.username.trim()}</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border bg-card/40 p-4 space-y-3">
                <h4 className="text-sm font-medium">Account</h4>
                <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2 text-sm">
                  {(
                    [
                      ["Email", profileUser.email],
                      ["Phone", profileUser.phone],
                      ["First name", profileUser.firstName],
                      ["Last name", profileUser.lastName],
                      ["Status", profileUser.status],
                      ["Joined", formatWhen(profileUser.createdAt)],
                      ["Updated", formatWhen(profileUser.updatedAt)],
                    ] as const
                  ).map(([label, val]) =>
                    val != null && String(val).trim() ? (
                      <div key={label} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="font-medium truncate">{String(val)}</dd>
                      </div>
                    ) : null
                  )}
                </dl>
                {profileUser.bio?.trim() ? (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Bio</p>
                    <p className="text-sm whitespace-pre-wrap">{profileUser.bio.trim()}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3 pt-2 border-t text-sm">
                  {bannedFlag(profileUser) ? (
                    <span className="text-destructive font-medium">Banned</span>
                  ) : activeFlag(profileUser) ? (
                    <span className="text-muted-foreground">Active</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-500">Inactive</span>
                  )}
                  {profileUser.bannedAt ? (
                    <span className="text-muted-foreground text-xs">Banned at {formatWhen(profileUser.bannedAt)}</span>
                  ) : null}
                  {profileUser.banReason?.trim() ? (
                    <span className="text-xs text-muted-foreground">Reason: {profileUser.banReason.trim()}</span>
                  ) : null}
                </div>
              </div>

              {profileRows.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">
                    Profile records ({profileRows.length})
                  </h4>
                  <div className="space-y-3">
                    {profileRows.map((row, idx) => {
                      const entries = profileRowEntries(row);
                      const rowImages = extractProfileImageUrls(row as unknown as AdminUser);
                      return (
                        <div
                          key={
                            typeof row.id === "string" || typeof row.id === "number"
                              ? String(row.id)
                              : `profile-${idx}`
                          }
                          className="rounded-lg border bg-muted/20 p-3 space-y-2"
                        >
                          <p className="text-xs font-medium text-muted-foreground">
                            Profile {idx + 1}
                            {typeof row.id === "string" ? (
                              <span className="ml-2 font-mono text-[11px]">{row.id}</span>
                            ) : null}
                          </p>
                          {entries.length > 0 ? (
                            <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-2 text-xs">
                              {entries.slice(0, 24).map(({ key, value }) => (
                                <div key={key} className="min-w-0">
                                  <dt className="text-muted-foreground">{formatProfileFieldLabel(key)}</dt>
                                  <dd className="font-medium truncate" title={value}>
                                    {value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <p className="text-xs text-muted-foreground">No scalar fields on this row.</p>
                          )}
                          {entries.length > 24 ? (
                            <p className="text-[11px] text-muted-foreground">
                              Showing first 24 fields. Use JSON for the full object.
                            </p>
                          ) : null}
                          {rowImages.length > 0 ? (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
                              {rowImages.map((src) => (
                                <a
                                  key={src}
                                  href={src}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block shrink-0 rounded-md border overflow-hidden hover:opacity-90"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={src} alt="" className="h-16 w-16 object-cover" />
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <h4 className="text-sm font-medium">Uploaded photos</h4>
                {profileImages.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {profileImages.map((src) => (
                      <a
                        key={src}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square rounded-lg border bg-muted overflow-hidden hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No image URLs found on this user. Ensure the API includes{" "}
                    <code className="text-xs">avatarUrl</code>, <code className="text-xs">photos</code>, or nested
                    gallery fields—or extend the admin user response in user-service.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDetailsUser(profileUser);
                    setProfileUser(null);
                  }}
                >
                  View raw JSON
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => openProfile(profileUser)}>
                  Refresh profile
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileUser(null)}>
              Close
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
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="min-w-[260px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10 px-4">
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
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => openProfile(u)}>
                        Profile
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
