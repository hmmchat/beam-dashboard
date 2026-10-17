import type { AccessGroupId } from "@/lib/access-catalog";

/**
 * Who may sign in, and which area they may choose on the login screen.
 * Add an email in lowercase. An email missing from this file is rejected.
 * To switch areas, sign out and pick another group this email is listed for.
 */
const allGroups: AccessGroupId[] = [
  "people",
  "insights",
  "catalog",
  "notifications",
  "season-ops",
];

export const dashboardAccess: Record<string, AccessGroupId[]> = {
  "aria02196@gmail.com": allGroups,
  "aryaprakash.sutar@antiscroll.in": allGroups,
  "ayush756@gmail.com": allGroups,
  "vivek1999ojha@gmail.com": allGroups,
};
