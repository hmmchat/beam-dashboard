import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessGroup } from "@/lib/access";
import { accessGroupById, sectionsForGroup } from "@/lib/access-catalog";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { group?: string };
}) {
  if (searchParams?.group) {
    redirect("/dashboard");
  }

  const session = await getServerSession(authOptions);
  const groupId = session?.user?.accessGroup;
  if (!canAccessGroup(session?.user?.email, groupId) || !groupId) {
    redirect("/login?error=AccessDenied");
  }

  const group = accessGroupById(groupId);
  const sections = sectionsForGroup(groupId);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">{group?.label ?? "Dashboard"}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {group?.description}. Select a section.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="block p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <h2 className="font-medium">{section.label}</h2>
            <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
