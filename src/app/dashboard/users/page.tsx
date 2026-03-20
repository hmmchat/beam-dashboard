import { UsersSection } from "@/components/sections/UsersSection";

export default function UsersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Users</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Search and filter the user list, sort for triage, then open <strong className="font-medium text-foreground">Profile</strong>{" "}
        to see account fields, nested profile rows (<code className="text-xs bg-muted px-1 rounded">profiles</code> /{" "}
        <code className="text-xs bg-muted px-1 rounded">profile</code>), and uploaded photos when the API returns them.
        Edit and moderation (ban, report, deactivate, delete) use the same admin API. The list is fetched in pages (
        <code className="text-xs bg-muted px-1 rounded">limit</code> / <code className="text-xs bg-muted px-1 rounded">offset</code> by default). Requires{" "}
        <code className="text-xs bg-muted px-1 rounded">/v1/admin/users</code> on the gateway; optional{" "}
        <code className="text-xs bg-muted px-1 rounded">GET …/users/:id</code> loads richer detail in the profile panel.
      </p>
      <UsersSection />
    </div>
  );
}
