import { UsersSection } from "@/components/sections/UsersSection";

export default function UsersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Users</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Search and filter the user list, sort for triage, then edit profiles or take moderation actions (ban, report,
        deactivate, delete). Requires{" "}
        <code className="text-xs bg-muted px-1 rounded">/v1/admin/users</code> on the API gateway (user-service).
      </p>
      <UsersSection />
    </div>
  );
}
