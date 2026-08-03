"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BeamLogo } from "@/components/BeamLogo";

const navItems = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/moderation-analytics", label: "Moderation analytics" },
  { href: "/dashboard/season-ops", label: "Season ops", seasonOps: true },
  { href: "/dashboard/icebreakers", label: "Icebreakers" },
  { href: "/dashboard/dares", label: "Dares" },
  { href: "/dashboard/memes", label: "Loading Memes" },
  { href: "/dashboard/meet-rn-waiting-messages", label: "Meet RN Waiting" },
  { href: "/dashboard/zodiacs", label: "Zodiacs" },
  { href: "/dashboard/interests", label: "Interests" },
  { href: "/dashboard/intents", label: "Intent Prompts" },
  { href: "/dashboard/values", label: "Values" },
  { href: "/dashboard/discovery-cities", label: "Discovery cities" },
  { href: "/dashboard/moderator-face-card", label: "Moderator face card" },
  { href: "/dashboard/brands", label: "Brands" },
  { href: "/dashboard/gifts", label: "Gifts" },
  { href: "/dashboard/matching", label: "Matching" },
];

function getClientSeasonOpsEmails(): string[] {
  return (process.env.NEXT_PUBLIC_SEASON_OPS_ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [seasonLabel, setSeasonLabel] = useState("Season ops");

  const canSeeSeasonOps = useMemo(() => {
    const email = session?.user?.email?.trim().toLowerCase();
    const allowed = getClientSeasonOpsEmails();
    // If public list not set, show link and rely on page/server gate
    if (!allowed.length) return true;
    return !!email && allowed.includes(email);
  }, [session?.user?.email]);

  useEffect(() => {
    if (!canSeeSeasonOps) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/seasons");
        if (!res.ok) return;
        const list = await res.json();
        const active = Array.isArray(list)
          ? list.find((s: { status?: string }) => s.status === "ACTIVE")
          : null;
        if (!cancelled && active?.name) setSeasonLabel(active.name);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canSeeSeasonOps]);

  const items = navItems.filter((item) => !item.seasonOps || canSeeSeasonOps);

  return (
    <aside className="w-56 border-r bg-sidebar flex flex-col min-h-screen">
      <Link href="/dashboard" className="p-4 border-b flex flex-col items-center gap-2">
        <BeamLogo height={28} width={88} className="object-contain" />
        <span className="text-sm text-muted-foreground font-medium">Dashboard</span>
      </Link>
      <nav className="flex-1 p-2 space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            {item.seasonOps ? seasonLabel : item.label}
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </Button>
      </div>
    </aside>
  );
}
