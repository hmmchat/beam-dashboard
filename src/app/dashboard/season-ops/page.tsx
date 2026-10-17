import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sessionAllowsGroup } from "@/lib/access";
import { SeasonOpsSection } from "@/components/sections/SeasonOpsSection";

export default async function SeasonOpsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!sessionAllowsGroup(session, "season-ops")) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Season ops</h1>
        <p className="text-sm text-muted-foreground">
          Mystery Beam Box — configure seasons, review claims, track fulfillment.
        </p>
      </div>
      <SeasonOpsSection />
    </div>
  );
}
