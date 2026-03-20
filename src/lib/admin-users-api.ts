/**
 * Base path for admin user moderation APIs (user-service behind the gateway).
 * Set NEXT_PUBLIC_ADMIN_USERS_PATH if your gateway uses a different path (must rebuild).
 */
export function getAdminUsersBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_ADMIN_USERS_PATH?.trim();
  const path = raw || "/v1/admin/users";
  return path.replace(/\/$/, "");
}

/** e.g. /v1/admin/users/:id, /v1/admin/users/:id/ban, /v1/admin/users/:id/hard */
export function adminUserPath(id: string, ...extra: string[]): string {
  const base = getAdminUsersBasePath();
  if (extra.length === 0) return `${base}/${id}`;
  return `${base}/${id}/${extra.join("/")}`;
}

export type AdminUsersPaginationMode = "offset" | "page";

/**
 * How list query params are sent. Default `offset` uses `limit` + `offset`.
 * Set `NEXT_PUBLIC_ADMIN_USERS_PAGINATION=page` for `page` (1-based) + `pageSize`.
 */
export function getAdminUsersPaginationMode(): AdminUsersPaginationMode {
  const v = process.env.NEXT_PUBLIC_ADMIN_USERS_PAGINATION?.trim().toLowerCase();
  return v === "page" ? "page" : "offset";
}

/** If set (e.g. `q` or `search`), that query key is sent with the debounced search string. */
export function getAdminUsersSearchQueryKey(): string | null {
  const v = process.env.NEXT_PUBLIC_ADMIN_USERS_SEARCH_PARAM?.trim();
  return v || null;
}

/** GET list URL with server-side pagination (and optional search). */
export function buildAdminUsersListUrl(opts: { limit: number; offset: number; search?: string }): string {
  const base = getAdminUsersBasePath();
  const params = new URLSearchParams();
  if (getAdminUsersPaginationMode() === "page") {
    const page = Math.floor(opts.offset / opts.limit) + 1;
    params.set("page", String(page));
    params.set("pageSize", String(opts.limit));
  } else {
    params.set("limit", String(opts.limit));
    params.set("offset", String(opts.offset));
  }
  const searchKey = getAdminUsersSearchQueryKey();
  const q = opts.search?.trim();
  if (searchKey && q) {
    params.set(searchKey, q);
  }
  return `${base}?${params.toString()}`;
}
