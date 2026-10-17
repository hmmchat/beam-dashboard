import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  buildProductAnalytics,
  meetingUserIdsSince,
  type CallAnalytics,
  type MessageAnalytics,
  type PaymentAnalytics,
  type ReferralAnalytics,
  type UserAnalytics,
} from "@/lib/product-analytics";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://api.beam.place").replace(/\/$/, "");
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || "";

async function pull<T>(path: string, init?: RequestInit): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": ADMIN_TOKEN,
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { message: text };
    }
    if (!res.ok) {
      const message =
        (body as { message?: string; error?: string })?.message ||
        (body as { error?: string })?.error ||
        `Request failed (${res.status})`;
      return { data: null, error: message };
    }
    return { data: body as T, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ADMIN_TOKEN) {
    return NextResponse.json(
      { error: "ADMIN_API_TOKEN is not configured on the dashboard" },
      { status: 503 }
    );
  }

  const [users, calls, messages, payments, referrals] = await Promise.all([
    pull<UserAnalytics>("/v1/admin/users/product-analytics"),
    pull<CallAnalytics>("/v1/streaming/admin/product-analytics"),
    pull<MessageAnalytics>("/v1/admin/product-messages"),
    pull<PaymentAnalytics>("/v1/admin/payments/product-analytics"),
    pull<ReferralAnalytics>("/v1/auth/admin/users/product-referrals"),
  ]);

  const knownCoverage = await knownSignupCoverage(calls.data);

  let meetingCities: Array<{ city: string; people: number }> | null = null;
  let citiesError: string | null = null;
  if (users.data && calls.data) {
    const ids = meetingUserIdsSince(calls.data, users.data.bounds.last7Start);
    if (ids.length === 0) {
      meetingCities = [];
    } else {
      const cityRes = await pull<{ cities: Array<{ city: string; people: number }> }>(
        "/v1/admin/users/product-analytics/cities",
        { method: "POST", body: JSON.stringify({ userIds: ids.slice(0, 5000) }) }
      );
      meetingCities = cityRes.data?.cities ?? null;
      citiesError = cityRes.error;
    }
  }

  return NextResponse.json(
    buildProductAnalytics({
      users: users.data,
      usersError: users.error,
      calls: calls.data,
      callsError: calls.error,
      messages: messages.data,
      messagesError: messages.error,
      payments: payments.data,
      paymentsError: payments.error,
      referrals: referrals.data,
      referralsError: referrals.error,
      meetingCities,
      citiesError,
      knownCoverage: knownCoverage.data,
    })
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Count call accounts that are still current signups, so coverage cannot exceed 100%. */
async function knownSignupCoverage(
  calls: CallAnalytics | null
): Promise<{ data: { today: number; last7: number; lifetime: number } | null }> {
  const people = calls?.qualifiedPeople;
  if (!people || calls?.qualifiedPeopleTruncated) return { data: null };

  const windows = {
    today: people.filter((person) => person.today).map((person) => person.userId),
    last7: people.filter((person) => person.last7).map((person) => person.userId),
    lifetime: people.map((person) => person.userId),
  } as const;

  const totals = { today: 0, last7: 0, lifetime: 0 };
  for (const window of ["today", "last7", "lifetime"] as const) {
    const groups = chunk(windows[window], 1500);
    if (groups.length === 0) continue;
    for (const userIds of groups) {
      const res = await pull<{ matched: number }>(
        "/v1/admin/users/product-analytics/coverage",
        { method: "POST", body: JSON.stringify({ window, userIds }) }
      );
      if (res.error || res.data == null) return { data: null };
      totals[window] += res.data.matched;
    }
  }
  return { data: totals };
}
