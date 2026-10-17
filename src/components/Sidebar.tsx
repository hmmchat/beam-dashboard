"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BeamLogo } from "@/components/BeamLogo";
import { accessGroupById, sectionsForGroup } from "@/lib/access-catalog";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const group = session?.user?.accessGroup
    ? accessGroupById(session.user.accessGroup)
    : null;
  const [seasonLabel, setSeasonLabel] = useState("Season ops");

  useEffect(() => {
    if (group?.id !== "season-ops") return;
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
  }, [group?.id]);

  const items = group ? sectionsForGroup(group.id) : [];

  return (
    <aside className="w-56 border-r bg-sidebar flex flex-col min-h-screen">
      <Link href="/dashboard" className="p-4 border-b flex flex-col items-center gap-2">
        <BeamLogo height={28} width={88} className="object-contain" />
        <span className="text-sm text-muted-foreground font-medium">Dashboard</span>
        {group ? (
          <span className="text-xs font-medium text-sidebar-foreground">{group.label}</span>
        ) : null}
      </Link>
      <nav className="flex-1 p-2 space-y-1">
        <Link
          href="/dashboard"
          className={cn(
            "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
            pathname === "/dashboard"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          Home
        </Link>
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
            {item.href === "/dashboard/season-ops" ? seasonLabel : item.label}
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t space-y-2">
        {group ? (
          <p className="px-3 text-xs text-muted-foreground">
            Signed in to {group.label}
          </p>
        ) : null}
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
