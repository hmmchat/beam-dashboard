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

/**
 * Query key sent with the debounced search string. Defaults to `q`.
 * user-service searches the full account table before it cuts a page.
 */
export function getAdminUsersSearchQueryKey(): string {
  const v = process.env.NEXT_PUBLIC_ADMIN_USERS_SEARCH_PARAM?.trim();
  if (!v || v === "off" || v === "false" || v === "0") return "q";
  return v;
}

/** GET list URL. Search, account, app status, joined window, and sort are applied on the full table. */
export function buildAdminUsersListUrl(opts: {
  limit: number;
  offset: number;
  search?: string;
  account?: string;
  appStatus?: string;
  joined?: string;
  sort?: string;
}): string {
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
  const q = opts.search?.trim();
  if (q) params.set(getAdminUsersSearchQueryKey(), q);
  if (opts.account && opts.account !== "all") params.set("account", opts.account);
  if (opts.appStatus && opts.appStatus !== "all") params.set("appStatus", opts.appStatus);
  if (opts.joined && opts.joined !== "all") params.set("joined", opts.joined);
  if (opts.sort) params.set("sort", opts.sort);
  return `${base}?${params.toString()}`;
}
