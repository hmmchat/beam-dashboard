import { dashboardAccess } from "@/config/dashboard-access";
import { isAccessGroupId, type AccessGroupId } from "@/lib/access-catalog";

/** Gmail ignores dots and +tags, and googlemail.com is the same inbox. */
export function normalizeEmail(email?: string | null): string {
  if (!email) return "";
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return trimmed;
  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") {
    local = local.split("+")[0].replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

export function groupsForEmail(email?: string | null): AccessGroupId[] {
  if (!email) return [];
  const raw = email.trim().toLowerCase();
  const groups = dashboardAccess[raw] ?? dashboardAccess[normalizeEmail(raw)] ?? [];
  return groups.filter((group) => isAccessGroupId(group));
}

export function canAccessGroup(
  email: string | null | undefined,
  group: string | null | undefined
): group is AccessGroupId {
  if (!email || !group || !isAccessGroupId(group)) return false;
  return groupsForEmail(email).includes(group);
}

export function sessionAllowsGroup(
  session: {
    user?: { email?: string | null; accessGroup?: string | null };
  } | null,
  group: AccessGroupId
): boolean {
  return (
    session?.user?.accessGroup === group &&
    canAccessGroup(session.user.email, group)
  );
}
