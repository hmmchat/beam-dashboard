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
