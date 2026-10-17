import { dashboardAccess } from "@/config/dashboard-access";
import { isAccessGroupId, type AccessGroupId } from "@/lib/access-catalog";

export function groupsForEmail(email?: string | null): AccessGroupId[] {
  if (!email) return [];
  const groups = dashboardAccess[email.trim().toLowerCase()] ?? [];
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
