export const LOGIN_GROUP_COOKIE = "beam_login_group";

export const ACCESS_GROUPS = [
  {
    id: "people",
    label: "People",
    description: "Accounts, moderation, and the moderator persona",
  },
  {
    id: "insights",
    label: "Insights",
    description: "Product, mining, and matching",
  },
  {
    id: "catalog",
    label: "Catalog",
    description: "Call content, profile options, brands, and gifts",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Inbox campaigns",
  },
  {
    id: "season-ops",
    label: "Season ops",
    description: "Mystery Beam Box seasons, claims, and fulfillment",
  },
] as const;

export type AccessGroupId = (typeof ACCESS_GROUPS)[number]["id"];

export type DashboardSection = {
  href: string;
  label: string;
  description: string;
  group: AccessGroupId;
};

export const DASHBOARD_SECTIONS: DashboardSection[] = [
  {
    href: "/dashboard/users",
    label: "Users",
    description: "Accounts, moderation, admin actions",
    group: "people",
  },
  {
    href: "/dashboard/moderation-analytics",
    label: "Moderation analytics",
    description: "Pending moderation work and account state",
    group: "people",
  },
  {
    href: "/dashboard/moderator-face-card",
    label: "Moderator face card",
    description: "Moderator persona for matching",
    group: "people",
  },
  {
    href: "/dashboard/product",
    label: "Product",
    description: "Signups, real meetings, return, and the investor cut",
    group: "insights",
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    description: "Coin mining success counters",
    group: "insights",
  },
  {
    href: "/dashboard/matching",
    label: "Matching",
    description: "Matchmaking pipeline, allocator, costs",
    group: "insights",
  },
  {
    href: "/dashboard/icebreakers",
    label: "Icebreakers",
    description: "Questions shown during calls",
    group: "catalog",
  },
  {
    href: "/dashboard/dares",
    label: "Dares",
    description: "Dare catalog for calls",
    group: "catalog",
  },
  {
    href: "/dashboard/memes",
    label: "Loading Memes",
    description: "Memes shown while waiting",
    group: "catalog",
  },
  {
    href: "/dashboard/meet-rn-waiting-messages",
    label: "Meet RN Waiting",
    description: "Subtext on the Meet RN waiting screen",
    group: "catalog",
  },
  {
    href: "/dashboard/zodiacs",
    label: "Zodiacs",
    description: "Zodiac images used on profiles",
    group: "catalog",
  },
  {
    href: "/dashboard/interests",
    label: "Interests",
    description: "User interests catalog",
    group: "catalog",
  },
  {
    href: "/dashboard/intents",
    label: "Intent Prompts",
    description: "Suggested profile intent prompts",
    group: "catalog",
  },
  {
    href: "/dashboard/values",
    label: "Values",
    description: "Causes / what matters to users",
    group: "catalog",
  },
  {
    href: "/dashboard/discovery-cities",
    label: "Discovery cities",
    description: "City options for discovery pool",
    group: "catalog",
  },
  {
    href: "/dashboard/brands",
    label: "Brands",
    description: "Brand catalog with logos",
    group: "catalog",
  },
  {
    href: "/dashboard/gifts",
    label: "Gifts",
    description: "Chat gifts and stickers",
    group: "catalog",
  },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    description: "BEAM & BEAM MOD Inbox campaigns",
    group: "notifications",
  },
  {
    href: "/dashboard/season-ops",
    label: "Season ops",
    description: "Mystery Beam Box seasons, claims, and fulfillment",
    group: "season-ops",
  },
];

const API_GROUP_PREFIXES: { prefix: string; group: AccessGroupId }[] = [
  { prefix: "/api/admin/matching", group: "insights" },
  { prefix: "/api/admin/mining", group: "insights" },
  { prefix: "/api/admin/product-analytics", group: "insights" },
  { prefix: "/api/admin/notification-campaigns", group: "notifications" },
  { prefix: "/api/admin/seasons", group: "season-ops" },
];

export function isAccessGroupId(value: string): value is AccessGroupId {
  return ACCESS_GROUPS.some((group) => group.id === value);
}

export function accessGroupById(id: string) {
  return ACCESS_GROUPS.find((group) => group.id === id) ?? null;
}

export function sectionsForGroup(group: AccessGroupId) {
  return DASHBOARD_SECTIONS.filter((section) => section.group === group);
}

/** `any` is the signed-in home. `null` is a dashboard or admin path with no group. */
export function groupForPath(pathname: string): AccessGroupId | "any" | null {
  if (pathname === "/dashboard") return "any";

  const section = DASHBOARD_SECTIONS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  if (section) return section.group;

  const api = API_GROUP_PREFIXES.find(
    (item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`)
  );
  if (api) return api.group;

  if (pathname.startsWith("/dashboard/") || pathname.startsWith("/api/admin/")) {
    return null;
  }

  return "any";
}
