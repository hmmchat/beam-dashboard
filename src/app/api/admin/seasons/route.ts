import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { canAccessSeasonOps } from "@/lib/season-ops-auth";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://api.beam.place").replace(
  /\/$/,
  ""
);
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || "";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessSeasonOps(session.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ADMIN_TOKEN) {
    return NextResponse.json(
      { error: "ADMIN_API_TOKEN is not configured on the dashboard" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${API_BASE}/v1/admin/seasons`, {
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": ADMIN_TOKEN,
      },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Season list proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessSeasonOps(session.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ADMIN_TOKEN) {
    return NextResponse.json(
      { error: "ADMIN_API_TOKEN is not configured on the dashboard" },
      { status: 503 }
    );
  }

  try {
    const body = await request.text();
    const res = await fetch(`${API_BASE}/v1/admin/seasons`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": ADMIN_TOKEN,
      },
      body: body || "{}",
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Season create proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}
