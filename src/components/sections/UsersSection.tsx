"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
  adminUserPath,
  buildAdminUsersListUrl,
  getAdminUsersBasePath,
  getAdminUsersPaginationMode,
  getAdminUsersSearchQueryKey,
} from "@/lib/admin-users-api";
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
  /** Prisma User.status (ONLINE, MATCHED, …) — not account status */
  discoveryStatus?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  reportCount?: number | null;
  /** user-service: discovery limited to moderator cards after report auto-ban lockout */
  reportModeratorCardsOnly?: boolean | null;
  badgeMember?: boolean | null;
  isModerator?: boolean | null;
  kycStatus?: "UNVERIFIED" | "VERIFIED" | "PENDING_REVIEW" | "REVOKED" | "EXPIRED" | string | null;
  kycRiskScore?: number | null;
  kycExpiresAt?: string | null;
  preferredCity?: string | null;
  profileCompleted?: boolean | null;
  activeBadgeId?: string | null;
  musicPreferenceId?: string | null;
  musicPreference?: {
    id: string;
    name: string;
    artist: string;
    albumArtUrl?: string | null;
    spotifyId?: string | null;
  } | null;
  photos?: { id: string; url: string; order: number }[];
  brandPreferences?: {
    order: number;
    brand: { id: string; name: string; domain?: string | null; logoUrl?: string | null };
  }[];
  interests?: {
    order: number;
    interest: { id: string; name: string; genre?: string | null };
  }[];
  values?: { order: number; value: { id: string; name: string } }[];
  badges?: {
    id: string;
    giftId: string;
    giftName: string;
    giftEmoji?: string | null;
    receivedAt?: string | null;
  }[];
};

/** Mirrors backend `REPORT_THRESHOLD` default; override with `NEXT_PUBLIC_REPORT_THRESHOLD` if needed. */
function getPublicReportThresholdDefault(): number {
  const raw = parseInt(process.env.NEXT_PUBLIC_REPORT_THRESHOLD ?? "5", 10);
  if (Number.isNaN(raw) || raw < 1) {
    return 5;
  }
  return raw;
}

/**
 * user-service `User.status` (Prisma) — aligns with app `UserStatusEnum` for MVP testing in the dashboard.
 */
export const USER_APP_STATUS_VALUES = [
  "AVAILABLE",
  "ONLINE",
  "OFFLINE",
  "MATCHED",
  "IN_SQUAD",
  "IN_SQUAD_AVAILABLE",
  "IN_BROADCAST",
  "IN_BROADCAST_AVAILABLE",
  "VIEWER",
] as const;

/** Array (not Set) so `for..of` typechecks when CI uses a lower TS `target` than local dev. */
const PROFILE_MEDIA_SUBTREE_KEYS = [
  "profiles",
  "profile",
  "photos",
  "userPhotos",
  "images",
  "profilePhotos",
  "pictures",
  "gallery",
  "media",
  "files",
  "attachments",
  "uploads",
] as const;

const MEDIA_URL_OBJECT_KEYS = [
  "url",
  "imageUrl",
  "thumbnailUrl",
  "src",
  "uri",
  "publicUrl",
  "avatarUrl",
  "cdnUrl",
  "signedUrl",
  "fileUrl",
  "href",
  "path",
] as const;

const PROFILE_COMPLETION_API_KEYS = [
  "profileCompletionPercent",
  "profileCompletion",
  "completionPercent",
  "onboardingCompletion",
  "profilePercentComplete",
  "profileComplete",
  "profileCompleteness",
] as const;

const SENSITIVE_USER_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "refreshToken",
  "accessToken",
  "secret",
  "credentials",
]);

/** Omitted from profile "User record" table (still visible in raw JSON if present). */
const PROFILE_USER_RECORD_EXCLUDED_KEYS = new Set([
  "genderChanged",
  "latitude",
  "longitude",
  "locationUpdatedAt",
  "videoEnabled",
  "updatedAt",
]);

/** Maps user-table-style columns to common API key spellings (camelCase + snake_case). */
type UserProfileFacetDef = {
  id: string;
  title: string;
  description: string;
  keys: readonly string[];
};

const USER_PROFILE_FACETS: UserProfileFacetDef[] = [
  {
    id: "prompts",
    title: "Prompts & intents",
    description: "Intent prompts, profile questions, selections, and answers.",
    keys: [
      "intentPrompts",
      "intent_prompts",
      "intents",
      "prompts",
      "profilePrompts",
      "userPrompts",
      "promptAnswers",
      "profileIntentAnswers",
      "intentAnswers",
      "onboardingPrompts",
      "profileQuestionAnswers",
      "promptSelections",
      "selectedPrompts",
      "intentPromptIds",
      "intent_prompt_ids",
    ],
  },
  {
    id: "location",
    title: "Location",
    description: "City, region, address, and coordinates.",
    keys: [
      "location",
      "userLocation",
      "geo",
      "address",
      "homeLocation",
      "currentLocation",
      "coordinates",
      "mapLocation",
      "place",
      "city",
      "region",
      "state",
      "province",
      "country",
      "countryCode",
      "postalCode",
      "zipCode",
      "zip",
      "latitude",
      "longitude",
      "lat",
      "lng",
      "lon",
      "latLng",
    ],
  },
  {
    id: "brands",
    title: "Brands",
    description: "Selected or favorite brands (catalog-style rows or ids).",
    keys: [
      "brands",
      "userBrands",
      "selectedBrands",
      "brandIds",
      "brand_ids",
      "favoriteBrands",
      "user_brands",
    ],
  },
  {
    id: "interests",
    title: "Interests",
    description: "Interests from the interests catalog (or ids).",
    keys: [
      "interests",
      "userInterests",
      "selectedInterests",
      "interestIds",
      "interest_ids",
      "user_interests",
      "interestSlugs",
    ],
  },
  {
    id: "values",
    title: "Values",
    description: "Values / causes from the values catalog (or ids).",
    keys: [
      "values",
      "userValues",
      "selectedValues",
      "valueIds",
      "value_ids",
      "user_values",
      "causes",
      "selectedCauses",
    ],
  },
];

const KYC_STATUS_VALUES = [
  "UNVERIFIED",
  "VERIFIED",
  "PENDING_REVIEW",
  "REVOKED",
  "EXPIRED",
] as const;

function mergeFacetLayer(
  base: Record<string, unknown>,
  layer: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!layer) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(layer)) {
    if (out[k] === undefined || out[k] === null) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Prefer top-level user columns; fill gaps from nested `profile`, then first `profiles[]` row (common user+profile
 * table shape).
 */
function rawForUserProfileFacets(raw: Record<string, unknown>): Record<string, unknown> {
  let merged: Record<string, unknown> = { ...raw };
  const profile = raw.profile;
  if (profile && typeof profile === "object" && !Array.isArray(profile)) {
    merged = mergeFacetLayer(merged, profile as Record<string, unknown>);
  }
  const profiles = raw.profiles;
  if (Array.isArray(profiles) && profiles.length > 0) {
    const first = profiles[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      merged = mergeFacetLayer(merged, first as Record<string, unknown>);
    }
  }
  return merged;
}

function collectFacetEntries(
  raw: Record<string, unknown>,
  keys: readonly string[]
): { sourceKey: string; value: unknown }[] {
  const out: { sourceKey: string; value: unknown }[] = [];
  for (const key of keys) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    out.push({ sourceKey: key, value: v });
  }
  return out;
}

function summarizeProfileListItem(item: unknown): string {
  if (item === null || item === undefined) return "—";
  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    return String(item);
  }
  if (typeof item === "object" && !Array.isArray(item)) {
    const o = item as Record<string, unknown>;
    const label =
      (typeof o.name === "string" && o.name.trim()) ||
      (typeof o.title === "string" && o.title.trim()) ||
      (typeof o.text === "string" && o.text.trim()) ||
      (typeof o.label === "string" && o.label.trim()) ||
      (typeof o.displayName === "string" && o.displayName.trim()) ||
      (typeof o.slug === "string" && o.slug.trim());
    if (label) {
      const id = o.id;
      return typeof id === "string" && id ? `${label} (${id})` : label;
    }
    if (typeof o.id === "string" && o.id) return o.id;
  }
  try {
    return JSON.stringify(item);
  } catch {
    return String(item);
  }
}

function renderProfileFacetValue(value: unknown, facetId: string): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="whitespace-pre-wrap">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">Empty list</span>;
    }
    const primitiveOnly = value.every(
      (x) => x === null || ["string", "number", "boolean"].includes(typeof x)
    );
    if (primitiveOnly) {
      return (
        <ul className="list-disc space-y-1 pl-5">
          {value.map((x, i) => (
            <li key={i} className="whitespace-pre-wrap">
              {x === null ? "null" : String(x)}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ul className="list-disc space-y-2 pl-5">
        {value.map((item, i) => (
          <li key={i} className="whitespace-pre-wrap text-sm">
            {summarizeProfileListItem(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (facetId === "location") {
      const rowKeys = Object.keys(o).sort((a, b) => a.localeCompare(b));
      return (
        <table className="w-full border-collapse text-xs">
          <tbody>
            {rowKeys.map((k) => {
              const v = o[k];
              const cell =
                v !== null && typeof v === "object" ? JSON.stringify(v) : v === null ? "null" : String(v);
              return (
                <tr key={k} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5 pr-3 align-top font-mono text-muted-foreground">{k}</td>
                  <td className="py-1.5 whitespace-pre-wrap break-all">{cell}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }
    return (
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/40 p-2 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span>{String(value)}</span>;
}

function isLikelyImageUrlString(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (t.startsWith("/") && t.length > 1) return true;
  return false;
}

function makeOrderedUrlCollector(): {
  ordered: string[];
  pushOrdered: (s: string | null | undefined) => void;
} {
  const seen = new Set<string>();
  const ordered: string[] = [];
  return {
    ordered,
    pushOrdered(s) {
      const t = s?.trim();
      if (!t || !isLikelyImageUrlString(t)) return;
      if (seen.has(t)) return;
      seen.add(t);
      ordered.push(t);
    },
  };
}

function collectUrlsFromMediaSubtree(
  value: unknown,
  pushOrdered: (s: string | null | undefined) => void,
  depth: number
): void {
  if (depth > 14) return;
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    pushOrdered(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrlsFromMediaSubtree(item, pushOrdered, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  for (const k of MEDIA_URL_OBJECT_KEYS) {
    const v = obj[k];
    if (typeof v === "string") pushOrdered(v);
  }
  for (const v of Object.values(obj)) {
    if (v !== null && typeof v === "object") collectUrlsFromMediaSubtree(v, pushOrdered, depth + 1);
  }
}

/** Top-level string fields often used for 2nd/3rd profile photos (photo1, coverImageUrl, …). */
function collectTopLevelImageStringFields(raw: Record<string, unknown>, pushOrdered: (s: string | null | undefined) => void): void {
  const skip = new Set<string>([...PROFILE_MEDIA_SUBTREE_KEYS]);
  for (const [key, val] of Object.entries(raw)) {
    if (skip.has(key)) continue;
    if (typeof val !== "string") continue;
    const k = key.toLowerCase();
    const looksImageKey =
      k.includes("photo") ||
      k.includes("image") ||
      k.includes("picture") ||
      k.includes("avatar") ||
      k.includes("thumb") ||
      (k.includes("url") && (k.includes("profile") || k.includes("cover") || k.includes("gallery")));
    if (looksImageKey) pushOrdered(val);
  }
}

/**
 * Profile photos in stable order (avatar first, nested media trees, then top-level photo or image string fields).
 * Ordered dedupe keeps every distinct URL; identical URLs appear once.
 */
function extractProfileImageUrlsOrdered(u: AdminUser): string[] {
  const { ordered, pushOrdered } = makeOrderedUrlCollector();
  pushOrdered(u.avatarUrl);
  const raw = u as unknown as Record<string, unknown>;
  for (const key of PROFILE_MEDIA_SUBTREE_KEYS) {
    if (raw[key] != null) collectUrlsFromMediaSubtree(raw[key], pushOrdered, 0);
  }
  for (const key of Object.keys(raw).sort()) {
    if (key.endsWith("Photos") || key.endsWith("Images")) {
      collectUrlsFromMediaSubtree(raw[key], pushOrdered, 0);
    }
  }
  collectTopLevelImageStringFields(raw, pushOrdered);
  return ordered;
}

function resolveProfileCompletionPercent(
  u: AdminUser,
  imageCount: number
): { percent: number; source: "api" | "estimated"; apiKey?: string } {
  const raw = u as unknown as Record<string, unknown>;
  for (const key of PROFILE_COMPLETION_API_KEYS) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      const p = v <= 1 && v >= 0 ? Math.round(v * 100) : Math.round(Math.min(100, Math.max(0, v)));
      return { percent: p, source: "api", apiKey: key };
    }
    if (typeof v === "string" && /^\s*\d+(\.\d+)?\s*$/.test(v)) {
      const n = parseFloat(v);
      if (Number.isFinite(n)) {
        const p = n <= 1 && n >= 0 ? Math.round(n * 100) : Math.round(Math.min(100, Math.max(0, n)));
        return { percent: p, source: "api", apiKey: key };
      }
    }
  }
  const steps = [
    !!(u.displayName?.trim() || u.username?.trim()),
    !!u.avatarUrl?.trim(),
    imageCount >= 2,
    imageCount >= 3,
    !!u.bio?.trim(),
    !!u.email?.trim(),
    !!u.phone?.trim(),
  ];
  const done = steps.filter(Boolean).length;
  return { percent: Math.round((done / steps.length) * 100), source: "estimated" };
}

function allRecordFieldRows(
  record: Record<string, unknown>,
  options?: { excludeKeys?: Set<string> }
): { key: string; value: string }[] {
  const excludeKeys = options?.excludeKeys;
  const rows: { key: string; value: string }[] = [];
  for (const key of Object.keys(record).sort((a, b) => a.localeCompare(b))) {
    if (excludeKeys?.has(key)) continue;
    if (SENSITIVE_USER_KEYS.has(key)) continue;
    const val = record[key];
    if (val === undefined) continue;
    if (val === null) {
      rows.push({ key, value: "null" });
      continue;
    }
    const t = typeof val;
    if (t === "string" || t === "number" || t === "boolean") {
      rows.push({ key, value: String(val) });
      continue;
    }
    if (Array.isArray(val)) {
      const s = JSON.stringify(val);
      rows.push({ key, value: s.length > 4000 ? `${s.slice(0, 4000)}…` : s });
      continue;
    }
    if (t === "object") {
      const s = JSON.stringify(val);
      rows.push({ key, value: s.length > 4000 ? `${s.slice(0, 4000)}…` : s });
    }
  }
  return rows;
}

function allUserRecordFieldRows(
  u: AdminUser,
  excludeKeys?: Set<string>
): { key: string; value: string }[] {
  return allRecordFieldRows(u as unknown as Record<string, unknown>, { excludeKeys });
}

function formatMusicPreferenceLine(u: AdminUser): string {
  const m = u.musicPreference;
  if (m && (m.name?.trim() || m.artist?.trim())) {
    const t = [m.name?.trim(), m.artist?.trim()].filter(Boolean).join(" — ");
    return m.spotifyId?.trim() ? `${t} (Spotify: ${m.spotifyId.trim()})` : t;
  }
  if (u.musicPreferenceId?.trim()) return `Preference id: ${u.musicPreferenceId.trim()}`;
  return "—";
}

function structuredProfileDiscoveryRows(u: AdminUser): { label: string; value: ReactNode }[] {
  const text = (s: string | null | undefined) =>
    s !== null && s !== undefined && String(s).trim() !== "" ? String(s).trim() : "—";
  const boolText = (b: boolean | null | undefined) =>
    b === true ? "Yes" : b === false ? "No" : "—";

  const rows: { label: string; value: ReactNode }[] = [
    { label: "Email", value: text(u.email) },
    { label: "Phone", value: text(u.phone) },
    { label: "Account status", value: text(u.status) },
    { label: "Account active", value: boolText(u.isActive) },
    {
      label: "Banned",
      value:
        u.banned === true || u.isBanned === true ? "Yes" : u.banned === false ? "No" : "—",
    },
    { label: "Banned at", value: u.bannedAt ? formatWhen(u.bannedAt) : "—" },
    { label: "Ban reason", value: text(u.banReason) },
    { label: "Joined", value: u.createdAt ? formatWhen(u.createdAt) : "—" },
    { label: "Username", value: text(u.username) },
    { label: "Display name", value: text(u.displayName) },
    { label: "Date of birth", value: u.dateOfBirth ? formatWhen(u.dateOfBirth) : "—" },
    { label: "Gender", value: text(u.gender) },
    { label: "Bio / intent", value: text(u.bio) },
    { label: "Profile complete", value: boolText(u.profileCompleted) },
    { label: "Preferred city", value: text(u.preferredCity) },
    { label: "Discovery status", value: text(u.discoveryStatus) },
    {
      label: "Report score",
      value: u.reportCount !== null && u.reportCount !== undefined ? String(u.reportCount) : "—",
    },
    {
      label: "Moderator",
      value: u.isModerator === true ? "Yes" : u.isModerator === false ? "No" : "—",
    },
    {
      label: "KYC status",
      value: u.kycStatus ? String(u.kycStatus) : "—",
    },
    {
      label: "KYC risk score",
      value:
        u.kycRiskScore !== null && u.kycRiskScore !== undefined ? String(u.kycRiskScore) : "—",
    },
    {
      label: "KYC expires at",
      value: u.kycExpiresAt ? formatWhen(u.kycExpiresAt) : "—",
    },
    { label: "Badge member", value: boolText(u.badgeMember) },
    { label: "Active badge ID", value: text(u.activeBadgeId) },
    { label: "Music", value: formatMusicPreferenceLine(u) },
  ];

  const photos = u.photos;
  if (Array.isArray(photos) && photos.length > 0) {
    rows.push({
      label: "Extra photos",
      value: (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {photos.map((p) => (
            <li key={p.id}>
              <a
                href={p.url}
                className="text-primary hover:underline break-all"
                target="_blank"
                rel="noopener noreferrer"
              >
                {p.url}
              </a>
              <span className="text-muted-foreground"> (order {p.order})</span>
            </li>
          ))}
        </ul>
      ),
    });
  } else {
    rows.push({ label: "Extra photos", value: "—" });
  }

  const brands = u.brandPreferences;
  if (Array.isArray(brands) && brands.length > 0) {
    rows.push({
      label: "Brands",
      value: (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {brands.map((b, i) => (
            <li key={`${b.brand?.id ?? "b"}-${b.order}-${i}`}>{text(b.brand?.name)}</li>
          ))}
        </ul>
      ),
    });
  } else {
    rows.push({ label: "Brands", value: "—" });
  }

  const interests = u.interests;
  if (Array.isArray(interests) && interests.length > 0) {
    rows.push({
      label: "Interests",
      value: (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {interests.map((it, i) => (
            <li key={`${it.interest?.id ?? "i"}-${it.order}-${i}`}>
              {text(it.interest?.name)}
              {it.interest?.genre?.trim() ? (
                <span className="text-muted-foreground"> ({it.interest.genre.trim()})</span>
              ) : null}
            </li>
          ))}
        </ul>
      ),
    });
  } else {
    rows.push({ label: "Interests", value: "—" });
  }

  const values = u.values;
  if (Array.isArray(values) && values.length > 0) {
    rows.push({
      label: "Values",
      value: (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {values.map((v, i) => (
            <li key={`${v.value?.id ?? "v"}-${v.order}-${i}`}>{text(v.value?.name)}</li>
          ))}
        </ul>
      ),
    });
  } else {
    rows.push({ label: "Values", value: "—" });
  }

  const badges = u.badges;
  if (Array.isArray(badges) && badges.length > 0) {
    rows.push({
      label: "Gift badges",
      value: (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {badges.map((b) => (
            <li key={b.id}>
              {b.giftEmoji ? `${b.giftEmoji} ` : null}
              {text(b.giftName)}
              {b.receivedAt ? (
                <span className="text-muted-foreground"> · {formatWhen(b.receivedAt)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ),
    });
  } else {
    rows.push({ label: "Gift badges", value: "—" });
  }

  return rows;
}

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

function extractTotalFromObject(o: Record<string, unknown>, depth: number): number | null {
  if (depth > 5) return null;
  const keys = ["total", "totalCount", "count", "totalElements", "total_items"] as const;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.floor(v);
  }
  for (const nest of ["meta", "pagination", "page"] as const) {
    const sub = o[nest];
    if (sub && typeof sub === "object" && !Array.isArray(sub)) {
      const t = extractTotalFromObject(sub as Record<string, unknown>, depth + 1);
      if (t !== null) return t;
    }
  }
  return null;
}

/** Parses list payload and optional total count for pagination UI. */
function parseUsersListResponse(raw: unknown): { users: AdminUser[]; total: number | null } {
  let body: unknown = raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const data = o.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const d = data as Record<string, unknown>;
      if (Array.isArray(d.users) || Array.isArray(d.items) || Array.isArray(d.data)) {
        body = d;
      }
    }
  }
  const users = parseUsersResponse(body);
  let total: number | null = null;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    total = extractTotalFromObject(raw as Record<string, unknown>, 0);
  }
  if (total === null && body && typeof body === "object" && !Array.isArray(body)) {
    total = extractTotalFromObject(body as Record<string, unknown>, 0);
  }
  return { users, total };
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

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

/** Prisma `User.status` from user-service (`discoveryStatus` on admin payload). */
function appDiscoveryStatusLabel(u: AdminUser): string | null {
  const s = u.discoveryStatus?.trim();
  return s && s.length > 0 ? s : null;
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
    u.discoveryStatus,
    u.preferredCity,
    u.gender,
    u.musicPreference?.name,
    u.musicPreference?.artist,
    u.brandPreferences?.map((b) => b.brand?.name).filter(Boolean),
    u.interests?.map((i) => i.interest?.name).filter(Boolean),
    u.values?.map((v) => v.value?.name).filter(Boolean),
  ]
    .flat()
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
/** Filter by user-service `User.status` (app presence / discovery). */
type AppStatusFilter = "all" | (typeof USER_APP_STATUS_VALUES)[number];
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
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [appStatusFilter, setAppStatusFilter] = useState<AppStatusFilter>("all");
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
  const [reportDialogScore, setReportDialogScore] = useState("");
  const [reportAuditUpdatedBy, setReportAuditUpdatedBy] = useState("");
  const [reportAuditReason, setReportAuditReason] = useState("");
  const [reportAuditNotes, setReportAuditNotes] = useState("");
  const [reportScoreSaving, setReportScoreSaving] = useState(false);
  const [reportThresholdHint, setReportThresholdHint] = useState<number | null>(null);

  const [kycOpen, setKycOpen] = useState(false);
  const [kycTarget, setKycTarget] = useState<AdminUser | null>(null);
  const [kycSaving, setKycSaving] = useState(false);

  const [auditUpdatedBy, setAuditUpdatedBy] = useState("");
  const [auditReason, setAuditReason] = useState("");
  const [auditNotes, setAuditNotes] = useState("");

  const [reportScoreField, setReportScoreField] = useState<string>("");
  const [isModeratorField, setIsModeratorField] = useState(false);
  const [kycStatusField, setKycStatusField] = useState<(typeof KYC_STATUS_VALUES)[number]>("UNVERIFIED");
  const [kycRiskScoreField, setKycRiskScoreField] = useState<string>("");
  const [kycExpiresAtField, setKycExpiresAtField] = useState<string>(""); // ISO string, optional

  const [kycModeratorId, setKycModeratorId] = useState("");
  const [kycSessionId, setKycSessionId] = useState("");
  const [kycDecision, setKycDecision] = useState<"VERIFIED" | "REJECTED" | "REVIEW" | "REVOKED">("VERIFIED");
  const [kycDecisionReason, setKycDecisionReason] = useState("");
  const [kycSubmittingDecision, setKycSubmittingDecision] = useState(false);
  const [kycStartingSession, setKycStartingSession] = useState(false);
  const [kycRevoking, setKycRevoking] = useState(false);

  const [detailsUser, setDetailsUser] = useState<AdminUser | null>(null);

  const [profileUser, setProfileUser] = useState<AdminUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);

  const serverSearchQueryKey = getAdminUsersSearchQueryKey();
  const hasServerSearch = serverSearchQueryKey !== null;
  const searchForListRequest = hasServerSearch ? debouncedSearch : "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = pageIndex * pageSize;
      const path = buildAdminUsersListUrl({
        limit: pageSize,
        offset,
        search: searchForListRequest,
      });
      const res = await apiFetch<unknown>(path);
      const { users, total } = parseUsersListResponse(res);
      setItems(users);
      setTotalCount(total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [pageIndex, pageSize, searchForListRequest]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPageIndex(0);
  }, [pageSize]);

  useEffect(() => {
    if (!hasServerSearch) return;
    setPageIndex(0);
  }, [debouncedSearch, hasServerSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 320);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filteredSorted = useMemo(() => {
    let list = items.filter((u) => matchesSearchTokens(u, debouncedSearch));

    if (statusFilter !== "all") {
      list = list.filter((u) => moderationStatus(u) === statusFilter);
    }

    if (appStatusFilter !== "all") {
      list = list.filter((u) => appDiscoveryStatusLabel(u) === appStatusFilter);
    }

    if (joinedFilter !== "all") {
      list = list.filter((u) => withinJoinedWindow(u, joinedFilter));
    }

    return sortUsers(list, sortKey);
  }, [items, debouncedSearch, statusFilter, appStatusFilter, joinedFilter, sortKey]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    appStatusFilter !== "all" ||
    joinedFilter !== "all" ||
    sortKey !== "moderation";

  const resetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setAppStatusFilter("all");
    setJoinedFilter("all");
    setSortKey("moderation");
    setPageIndex(0);
  };

  const totalPages =
    totalCount !== null ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  const canGoPrev = pageIndex > 0;
  const canGoNext =
    totalPages !== null ? pageIndex + 1 < totalPages : items.length >= pageSize;
  const listOffset = pageIndex * pageSize;
  const rangeLo = items.length === 0 ? 0 : listOffset + 1;
  const rangeHi = listOffset + items.length;

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
      await apiFetch(adminUserPath(u.id, "unban"), {
        method: "POST",
        body: JSON.stringify({}),
      });
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
    setReportDialogScore(u.reportCount !== null && u.reportCount !== undefined ? String(u.reportCount) : "0");
    setReportAuditUpdatedBy("");
    setReportAuditReason("");
    setReportAuditNotes("");
    setReportThresholdHint(null);
    setReportOpen(true);
  };

  const openKyc = (u: AdminUser) => {
    setKycTarget(u);
    setAuditUpdatedBy("");
    setAuditReason("");
    setAuditNotes("");

    setReportScoreField(u.reportCount !== null && u.reportCount !== undefined ? String(u.reportCount) : "");
    setIsModeratorField(Boolean(u.isModerator));
    const normalizedStatus = (u.kycStatus || "UNVERIFIED").toString().toUpperCase();
    setKycStatusField(
      (KYC_STATUS_VALUES as readonly string[]).includes(normalizedStatus)
        ? (normalizedStatus as (typeof KYC_STATUS_VALUES)[number])
        : "UNVERIFIED"
    );
    setKycRiskScoreField(u.kycRiskScore !== null && u.kycRiskScore !== undefined ? String(u.kycRiskScore) : "");
    setKycExpiresAtField(u.kycExpiresAt ?? "");

    setKycModeratorId("");
    setKycSessionId("");
    setKycDecision("VERIFIED");
    setKycDecisionReason("");
    setKycOpen(true);
  };

  const requireAudit = (): boolean => {
    if (!auditUpdatedBy.trim()) {
      toast.error("updatedBy is required");
      return false;
    }
    if (!auditReason.trim()) {
      toast.error("reason is required");
      return false;
    }
    return true;
  };

  const saveKycAndReportScore = async () => {
    if (!kycTarget) return;
    if (!requireAudit()) return;
    setKycSaving(true);
    try {
      const moderationMeta = {
        updatedBy: auditUpdatedBy.trim(),
        reason: auditReason.trim(),
        notes: auditNotes.trim() || undefined,
      };

      const reportCountNum =
        reportScoreField.trim() === "" ? null : Math.max(0, Math.floor(Number(reportScoreField)));
      if (reportCountNum !== null && Number.isNaN(reportCountNum)) {
        throw new Error("Invalid report score");
      }

      const kycRiskNum =
        kycRiskScoreField.trim() === "" ? undefined : Math.max(0, Math.min(100, Math.floor(Number(kycRiskScoreField))));
      if (kycRiskScoreField.trim() !== "" && (kycRiskNum === undefined || Number.isNaN(kycRiskNum))) {
        throw new Error("Invalid KYC risk score");
      }

      if (reportCountNum !== null) {
        await apiFetch(adminUserPath(kycTarget.id, "report-score"), {
          method: "POST",
          body: JSON.stringify({
            reportCount: reportCountNum,
            moderationMeta,
          }),
        });
      }

      await apiFetch(adminUserPath(kycTarget.id, "kyc"), {
        method: "POST",
        body: JSON.stringify({
          isModerator: isModeratorField,
          kycStatus: kycStatusField,
          kycRiskScore: kycRiskNum,
          kycExpiresAt: kycExpiresAtField.trim() ? kycExpiresAtField.trim() : null,
          moderationMeta,
        }),
      });

      toast.success("KYC/report updated");
      setKycOpen(false);
      setKycTarget(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update KYC/report");
    } finally {
      setKycSaving(false);
    }
  };

  const startKycSession = async () => {
    if (!kycTarget) return;
    if (!kycModeratorId.trim()) {
      toast.error("moderatorId is required to start session");
      return;
    }
    setKycStartingSession(true);
    try {
      const res = await apiFetch<{ sessionId?: string }>(`/v1/kyc/session/start`, {
        method: "POST",
        body: JSON.stringify({ userId: kycTarget.id, moderatorId: kycModeratorId.trim() }),
      });
      const sid = res?.sessionId;
      if (!sid) {
        throw new Error("Session started but no sessionId returned");
      }
      setKycSessionId(sid);
      toast.success("KYC session started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start KYC session");
    } finally {
      setKycStartingSession(false);
    }
  };

  const submitKycDecision = async () => {
    if (!kycTarget) return;
    if (!kycModeratorId.trim()) {
      toast.error("moderatorId is required");
      return;
    }
    if (!kycSessionId.trim()) {
      toast.error("sessionId is required");
      return;
    }
    setKycSubmittingDecision(true);
    try {
      await apiFetch(`/v1/kyc/session/decision`, {
        method: "POST",
        body: JSON.stringify({
          sessionId: kycSessionId.trim(),
          moderatorId: kycModeratorId.trim(),
          decision: kycDecision,
          reason: kycDecisionReason.trim() || undefined,
        }),
      });
      toast.success("KYC decision submitted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit decision");
    } finally {
      setKycSubmittingDecision(false);
    }
  };

  const revokeKyc = async () => {
    if (!kycTarget) return;
    if (!kycModeratorId.trim()) {
      toast.error("moderatorId is required");
      return;
    }
    setKycRevoking(true);
    try {
      await apiFetch(`/v1/admin/users/${encodeURIComponent(kycTarget.id)}/kyc/revoke`, {
        method: "POST",
        body: JSON.stringify({
          moderatorId: kycModeratorId.trim(),
          reason: kycDecisionReason.trim() || "Manual revoke",
        }),
      });
      toast.success("KYC revoked");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke KYC");
    } finally {
      setKycRevoking(false);
    }
  };

  const handleReport = async () => {
    if (!reportTarget) return;
    if (!reportReason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setReportLoading(true);
    try {
      const res = await apiFetch<{ reportThreshold?: number; reportCount?: number }>(
        adminUserPath(reportTarget.id, "report"),
        {
          method: "POST",
          body: JSON.stringify({
            reason: reportReason.trim(),
            notes: reportNotes.trim() || undefined,
          }),
        }
      );
      if (typeof res?.reportThreshold === "number" && !Number.isNaN(res.reportThreshold)) {
        setReportThresholdHint(res.reportThreshold);
      }
      if (typeof res?.reportCount === "number") {
        setReportDialogScore(String(res.reportCount));
      }
      toast.success("Admin report weight applied");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit report");
    } finally {
      setReportLoading(false);
    }
  };

  const saveReportScoreFromDialog = async () => {
    if (!reportTarget) return;
    if (!reportAuditUpdatedBy.trim()) {
      toast.error("updatedBy is required to change report score");
      return;
    }
    if (!reportAuditReason.trim()) {
      toast.error("reason is required to change report score");
      return;
    }
    const n = Math.max(0, Math.floor(Number(reportDialogScore)));
    if (Number.isNaN(n)) {
      toast.error("Invalid report score");
      return;
    }
    setReportScoreSaving(true);
    try {
      const res = await apiFetch<{ reportThreshold?: number; reportCount?: number }>(
        adminUserPath(reportTarget.id, "report-score"),
        {
          method: "POST",
          body: JSON.stringify({
            reportCount: n,
            moderationMeta: {
              updatedBy: reportAuditUpdatedBy.trim(),
              reason: reportAuditReason.trim(),
              notes: reportAuditNotes.trim() || undefined,
            },
          }),
        }
      );
      if (typeof res?.reportThreshold === "number" && !Number.isNaN(res.reportThreshold)) {
        setReportThresholdHint(res.reportThreshold);
      }
      if (typeof res?.reportCount === "number") {
        setReportDialogScore(String(res.reportCount));
      }
      toast.success("Report score updated");
      setReportOpen(false);
      setReportTarget(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update report score");
    } finally {
      setReportScoreSaving(false);
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
  const profileImages = profileUser ? extractProfileImageUrlsOrdered(profileUser) : [];
  const profileCompletion = profileUser
    ? resolveProfileCompletionPercent(profileUser, profileImages.length)
    : null;
  const profileDiscoveryRows = useMemo(
    () => (profileUser ? structuredProfileDiscoveryRows(profileUser) : []),
    [profileUser]
  );
  const userRecordRows = profileUser
    ? allUserRecordFieldRows(profileUser, PROFILE_USER_RECORD_EXCLUDED_KEYS)
    : [];
  const userProfileFacetSections = useMemo(() => {
    if (!profileUser) return [];
    const raw = rawForUserProfileFacets(profileUser as unknown as Record<string, unknown>);
    return USER_PROFILE_FACETS.map((facet) => ({
      ...facet,
      entries: collectFacetEntries(raw, facet.keys),
    })).filter((f) => f.entries.length > 0);
  }, [profileUser]);

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
              The list is loaded in pages from the API (
              <code className="text-[10px]">
                {getAdminUsersPaginationMode() === "page" ? "page & pageSize" : "limit & offset"}
              </code>
              ).{" "}
              {hasServerSearch ? (
                <>
                  Search is sent as query <code className="text-[10px]">{serverSearchQueryKey}</code> (server-side).
                </>
              ) : (
                <>
                  Search and account / app status / joined filters apply only to the{" "}
                  <strong className="font-medium text-foreground">current page</strong> unless you set{" "}
                  <code className="text-[10px]">NEXT_PUBLIC_ADMIN_USERS_SEARCH_PARAM</code> for server search.
                </>
              )}{" "}
              Client search matches id, email, phone, names, username, bio, ban reason, account status, app status
              (discovery), and related fields (all words must match).
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {(searchInput || hasActiveFilters || pageIndex > 0) && (
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
            <Label htmlFor="filter-app-status" className="text-xs text-muted-foreground">
              App status
            </Label>
            <select
              id="filter-app-status"
              className={selectClass}
              value={appStatusFilter}
              onChange={(e) => setAppStatusFilter(e.target.value as AppStatusFilter)}
            >
              <option value="all">Any</option>
              {USER_APP_STATUS_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
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

        <div className="space-y-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{filteredSorted.length}</span> rows match filters on this
            page · API rows <span className="font-medium text-foreground">{rangeLo}</span>
            {items.length > 0 ? (
              <>
                –
                <span className="font-medium text-foreground">{rangeHi}</span>
              </>
            ) : null}
            {totalCount !== null ? (
              <>
                {" "}
                of <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> total
              </>
            ) : (
              <span className="text-muted-foreground"> (total not reported by API)</span>
            )}
            {searchInput !== debouncedSearch ? (
              <span className="text-amber-600 dark:text-amber-400 ml-2">Updating search…</span>
            ) : null}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="page-size" className="text-xs text-muted-foreground whitespace-nowrap">
                Rows per page
              </Label>
              <select
                id="page-size"
                className={cn(selectClass, "w-auto min-w-[4.5rem]")}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={!canGoPrev || loading}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums px-1">
                Page <span className="font-medium text-foreground">{pageIndex + 1}</span>
                {totalPages !== null ? (
                  <>
                    {" "}
                    of <span className="font-medium text-foreground">{totalPages.toLocaleString()}</span>
                  </>
                ) : null}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={!canGoNext || loading}
                onClick={() => setPageIndex((p) => p + 1)}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
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
            <DialogTitle>Report & score (admin)</DialogTitle>
            <DialogDescription>
              Current weighted report total and the ban threshold (same <code className="text-xs">REPORT_THRESHOLD</code> as
              discovery). Set an absolute score (audit required) or add one admin dashboard weight via{" "}
              <code className="text-xs">POST …/report</code>.
            </DialogDescription>
          </DialogHeader>
          {reportTarget ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">User</span>{" "}
                  <span className="font-medium text-foreground">{reportTarget.displayName ?? reportTarget.username ?? "—"}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Current report score</span>{" "}
                  <span className="font-mono tabular-nums font-medium">{reportDialogScore || "0"}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Score at/above which auto-ban runs</span>{" "}
                  <span className="font-mono tabular-nums font-medium">
                    {reportThresholdHint ?? getPublicReportThresholdDefault()}
                  </span>
                  {reportThresholdHint !== null ? (
                    <span className="text-muted-foreground text-xs"> (from last API response)</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      {" "}
                      (dashboard default; set <code className="text-[10px]">NEXT_PUBLIC_REPORT_THRESHOLD</code> to match API)
                    </span>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Set absolute report score</p>
                <div className="space-y-1">
                  <Label htmlFor="rep-score">New report score</Label>
                  <Input
                    id="rep-score"
                    inputMode="numeric"
                    value={reportDialogScore}
                    onChange={(e) => setReportDialogScore(e.target.value)}
                    placeholder="e.g. 0"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="rep-audit-by">updatedBy</Label>
                    <Input
                      id="rep-audit-by"
                      value={reportAuditUpdatedBy}
                      onChange={(e) => setReportAuditUpdatedBy(e.target.value)}
                      placeholder="moderator / admin id"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rep-audit-reason">reason</Label>
                    <Input
                      id="rep-audit-reason"
                      value={reportAuditReason}
                      onChange={(e) => setReportAuditReason(e.target.value)}
                      placeholder="why change score?"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rep-audit-notes">notes (optional)</Label>
                  <Input
                    id="rep-audit-notes"
                    value={reportAuditNotes}
                    onChange={(e) => setReportAuditNotes(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={saveReportScoreFromDialog} disabled={reportScoreSaving} className="w-full sm:w-auto">
                  {reportScoreSaving ? "Saving…" : "Save absolute score"}
                </Button>
              </div>

              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium">Add admin report weight</p>
                <p className="text-xs text-muted-foreground">
                  Increments score by the configured admin weight (user-service). Use a short internal reason.
                </p>
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
                    rows={3}
                    placeholder="Additional context for moderators"
                  />
                </div>
                <Button type="button" variant="secondary" onClick={handleReport} disabled={reportLoading} className="w-full sm:w-auto">
                  {reportLoading ? "Applying…" : "Add admin report weight"}
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={kycOpen} onOpenChange={setKycOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>KYC & moderation</DialogTitle>
            <DialogDescription>
              Update report score / KYC state (user-service) and run KYC session actions (moderation-service).
            </DialogDescription>
          </DialogHeader>
          {kycTarget ? (
            <div className="space-y-4 py-1 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1">
                <Label>User id</Label>
                <Input value={kycTarget.id} readOnly className="opacity-80 font-mono" />
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-sm font-medium">Audit metadata (required)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>updatedBy</Label>
                    <Input value={auditUpdatedBy} onChange={(e) => setAuditUpdatedBy(e.target.value)} placeholder="moderator/admin id" />
                  </div>
                  <div className="space-y-1">
                    <Label>reason</Label>
                    <Input value={auditReason} onChange={(e) => setAuditReason(e.target.value)} placeholder="why this change?" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>notes (optional)</Label>
                  <textarea className={textareaClass} value={auditNotes} onChange={(e) => setAuditNotes(e.target.value)} rows={3} />
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-sm font-medium">User-service fields</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Report score</Label>
                    <Input value={reportScoreField} onChange={(e) => setReportScoreField(e.target.value)} placeholder="e.g. 12" />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="isModerator"
                      checked={isModeratorField}
                      onChange={(e) => setIsModeratorField(e.target.checked)}
                    />
                    <Label htmlFor="isModerator">isModerator</Label>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>KYC status</Label>
                    <select
                      className={selectClass}
                      value={kycStatusField}
                      onChange={(e) => setKycStatusField(e.target.value as (typeof KYC_STATUS_VALUES)[number])}
                    >
                      {KYC_STATUS_VALUES.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>KYC risk score (0-100)</Label>
                    <Input value={kycRiskScoreField} onChange={(e) => setKycRiskScoreField(e.target.value)} placeholder="optional override" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>KYC expiresAt (ISO or blank)</Label>
                  <Input
                    value={kycExpiresAtField}
                    onChange={(e) => setKycExpiresAtField(e.target.value)}
                    placeholder="2026-01-01T00:00:00.000Z"
                    className="font-mono"
                  />
                </div>

                <Button onClick={saveKycAndReportScore} disabled={kycSaving}>
                  {kycSaving ? "Saving…" : "Save KYC + report"}
                </Button>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-sm font-medium">Moderation-service actions</p>
                <div className="space-y-1">
                  <Label>moderatorId (for session actions)</Label>
                  <Input value={kycModeratorId} onChange={(e) => setKycModeratorId(e.target.value)} placeholder="moderator userId" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={startKycSession} disabled={kycStartingSession}>
                    {kycStartingSession ? "Starting…" : "Start session"}
                  </Button>
                  <Button variant="destructive" onClick={revokeKyc} disabled={kycRevoking}>
                    {kycRevoking ? "Revoking…" : "Revoke KYC"}
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>sessionId</Label>
                    <Input value={kycSessionId} onChange={(e) => setKycSessionId(e.target.value)} placeholder="from start" className="font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label>decision</Label>
                    <select
                      className={selectClass}
                      value={kycDecision}
                      onChange={(e) =>
                        setKycDecision(e.target.value as "VERIFIED" | "REJECTED" | "REVIEW" | "REVOKED")
                      }
                    >
                      <option value="VERIFIED">VERIFIED</option>
                      <option value="REJECTED">REJECTED</option>
                      <option value="REVIEW">REVIEW</option>
                      <option value="REVOKED">REVOKED</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>decision reason (optional)</Label>
                  <Input value={kycDecisionReason} onChange={(e) => setKycDecisionReason(e.target.value)} placeholder="notes for audit" />
                </div>

                <Button onClick={submitKycDecision} disabled={kycSubmittingDecision}>
                  {kycSubmittingDecision ? "Submitting…" : "Submit decision"}
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKycOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!profileUser} onOpenChange={(o) => !o && setProfileUser(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" showCloseButton>
          <DialogHeader>
            <DialogTitle>User profile</DialogTitle>
            <DialogDescription>
              <strong className="font-medium text-foreground">Profile &amp; discovery</strong> summarizes account fields
              plus user-service profile data (discovery status, preferences, catalogs). Heuristic sections below match
              alternate API shapes. <code className="text-xs">GET {getAdminUsersBasePath()}/:id</code> loads the full merged
              row; raw JSON keeps every key.
            </DialogDescription>
          </DialogHeader>
          {profileUser ? (
            <div className="space-y-6 py-1">
              {profileLoading ? (
                <p className="text-sm text-muted-foreground">Loading full profile from the API…</p>
              ) : null}

              {profileCompletion ? (
                <div className="rounded-lg border bg-card/50 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Profile completion</span>
                    <span className="text-sm tabular-nums font-semibold">{profileCompletion.percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-[width]"
                      style={{ width: `${Math.min(100, Math.max(0, profileCompletion.percent))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {profileCompletion.source === "api" ? (
                      <>
                        From API field <code className="text-[10px]">{profileCompletion.apiKey ?? "—"}</code>.
                      </>
                    ) : (
                      <>
                        Estimated here from display name/username, avatar, 2nd &amp; 3rd photos, bio, email, and phone
                        when the API does not send a completion field.
                      </>
                    )}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="space-y-2 shrink-0">
                  <p className="text-xs font-medium text-muted-foreground">Profile photos (up to 3)</p>
                  <div className="flex gap-2">
                    {[0, 1, 2].map((slot) => {
                      const src = profileImages[slot] ?? null;
                      return (
                        <div
                          key={slot}
                          className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl border bg-muted sm:h-32 sm:w-28"
                        >
                          {src ? (
                            <a
                              href={src}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block h-full w-full hover:opacity-95"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt="" className="h-full w-full object-cover" />
                            </a>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">
                              No photo {slot + 1}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <h3 className="text-lg font-semibold leading-tight">{displayName(profileUser)}</h3>
                  <p className="text-xs font-mono text-muted-foreground break-all">{profileUser.id}</p>
                  {profileUser.username?.trim() ? (
                    <p className="text-sm text-muted-foreground">@{profileUser.username.trim()}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 text-sm">
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
                  <p className="text-[11px] text-muted-foreground">
                    {profileImages.length} image URL{profileImages.length === 1 ? "" : "s"} detected in this payload
                    (deduped, order preserved: avatar and nested media first, then top-level photo/image fields).
                  </p>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 text-sm font-medium border-b">Profile &amp; discovery</div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {profileDiscoveryRows.map(({ label, value }) => (
                        <tr key={label} className="border-b border-border/50 align-top last:border-0">
                          <td className="w-[36%] max-w-[220px] py-2 pl-3 pr-2 text-muted-foreground">{label}</td>
                          <td className="py-2 pr-3 break-words">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium">User profile data (heuristic)</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Prompts, location, brands, interests, and values — matched from typical user-table / API field
                    names. If your gateway uses different keys, they still appear in &quot;User record&quot; below.
                  </p>
                </div>
                {userProfileFacetSections.length === 0 ? (
                  <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                    No prompts, location, brands, interests, or values fields were found under expected names on this
                    user. Expand <strong className="text-foreground">User record (all fields)</strong> or ask backend to
                    include these columns on <code className="text-xs">GET {getAdminUsersBasePath()}/:id</code>.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {userProfileFacetSections.map((facet) => (
                      <div key={facet.id} className="rounded-lg border bg-card/40 overflow-hidden">
                        <div className="border-b bg-muted/30 px-3 py-2">
                          <p className="text-sm font-medium">{facet.title}</p>
                          <p className="text-[11px] text-muted-foreground leading-snug">{facet.description}</p>
                        </div>
                        <div className="space-y-3 p-3">
                          {facet.entries.map(({ sourceKey, value }) => (
                            <div key={sourceKey}>
                              <p className="mb-1 font-mono text-[10px] text-muted-foreground">{sourceKey}</p>
                              <div className="text-sm">{renderProfileFacetValue(value, facet.id)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 text-sm font-medium border-b">
                  User record (remaining fields)
                </div>
                <p className="px-3 py-2 text-[11px] text-muted-foreground border-b border-border/40">
                  Hides{" "}
                  <code className="text-[10px]">
                    {Array.from(PROFILE_USER_RECORD_EXCLUDED_KEYS).join(", ")}
                  </code>{" "}
                  here; raw JSON still includes them if the API sends them.
                </p>
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {userRecordRows.map(({ key, value }) => (
                        <tr key={key} className="border-b border-border/50 align-top last:border-0">
                          <td className="w-[30%] max-w-[200px] break-all py-2 pl-3 pr-2 font-mono text-muted-foreground">
                            {key}
                          </td>
                          <td className="break-all whitespace-pre-wrap py-2 pr-3">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {profileRows.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Related profile rows ({profileRows.length})</h4>
                  <div className="space-y-3">
                    {profileRows.map((row, idx) => {
                      const rowFields = allRecordFieldRows(row);
                      const rowImages = extractProfileImageUrlsOrdered(row as unknown as AdminUser);
                      return (
                        <div
                          key={
                            typeof row.id === "string" || typeof row.id === "number"
                              ? String(row.id)
                              : `profile-${idx}`
                          }
                          className="rounded-lg border bg-muted/20 overflow-hidden"
                        >
                          <p className="border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                            Row {idx + 1}
                            {typeof row.id === "string" || typeof row.id === "number" ? (
                              <span className="ml-2 font-mono text-[11px]">{String(row.id)}</span>
                            ) : null}
                          </p>
                          <div className="max-h-56 overflow-y-auto">
                            <table className="w-full text-xs">
                              <tbody>
                                {rowFields.map(({ key, value }) => (
                                  <tr key={key} className="border-b border-border/40 align-top last:border-0">
                                    <td className="w-[32%] max-w-[180px] break-all py-1.5 pl-3 pr-2 font-mono text-muted-foreground">
                                      {key}
                                    </td>
                                    <td className="break-all whitespace-pre-wrap py-1.5 pr-3">{value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {rowImages.length > 0 ? (
                            <div className="flex flex-wrap gap-2 border-t border-border/60 p-2">
                              {rowImages.map((src) => (
                                <a
                                  key={src}
                                  href={src}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block shrink-0 overflow-hidden rounded-md border hover:opacity-90"
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
                <h4 className="text-sm font-medium">All photos</h4>
                {profileImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {profileImages.map((src, i) => (
                      <a
                        key={`${src}-${i}`}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square overflow-hidden rounded-lg border bg-muted hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
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
              <TableHead>Account</TableHead>
              <TableHead title="user-service User.status (matches app UserStatusEnum)">App status</TableHead>
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
              filteredSorted.map((u) => {
                const appSt = appDiscoveryStatusLabel(u);
                return (
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
                  <TableCell className="max-w-[200px]">
                    {appSt ? (
                      <span
                        className="inline-flex font-mono text-[11px] leading-tight rounded-md border bg-muted/50 px-1.5 py-0.5 text-foreground"
                        title="user-service User.status (app UserStatusEnum)"
                      >
                        {appSt}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
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
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => openKyc(u)}>
                        KYC
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
