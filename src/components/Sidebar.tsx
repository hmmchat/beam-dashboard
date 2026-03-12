"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BeamLogo } from "@/components/BeamLogo";

const navItems = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/icebreakers", label: "Icebreakers" },
  { href: "/dashboard/dares", label: "Dares" },
  { href: "/dashboard/memes", label: "Loading Memes" },
  { href: "/dashboard/interests", label: "Interests" },
  { href: "/dashboard/intents", label: "Intent Prompts" },
  { href: "/dashboard/values", label: "Values" },
  { href: "/dashboard/brands", label: "Brands" },
  { href: "/dashboard/gifts", label: "Gifts" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r bg-sidebar flex flex-col min-h-screen">
      <Link href="/dashboard" className="p-4 border-b flex flex-col items-center gap-2">
        <BeamLogo height={28} width={88} className="object-contain" />
        <span className="text-sm text-muted-foreground font-medium">Dashboard</span>
      </Link>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
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
            {item.label}
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
