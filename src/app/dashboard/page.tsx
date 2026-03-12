import Link from "next/link";

const sections = [
  { href: "/dashboard/icebreakers", label: "Icebreakers", desc: "Questions shown during calls" },
  { href: "/dashboard/dares", label: "Dares", desc: "Dare catalog for calls" },
  { href: "/dashboard/memes", label: "Loading Memes", desc: "Memes shown while waiting" },
  { href: "/dashboard/interests", label: "Interests", desc: "User interests catalog" },
  { href: "/dashboard/intents", label: "Intent Prompts", desc: "Suggested profile intent prompts" },
  { href: "/dashboard/values", label: "Values", desc: "Causes / what matters to users" },
  { href: "/dashboard/brands", label: "Brands", desc: "Brand catalog with logos" },
  { href: "/dashboard/gifts", label: "Gifts", desc: "Chat gifts and stickers" },
];

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Content Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Select a section to manage content.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <h2 className="font-medium">{s.label}</h2>
            <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
