export function getSeasonOpsAllowedEmails(): string[] {
  return (process.env.SEASON_OPS_ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function canAccessSeasonOps(email?: string | null): boolean {
  const allowed = getSeasonOpsAllowedEmails();
  if (!allowed.length) return false;
  return !!email && allowed.includes(email.trim().toLowerCase());
}
