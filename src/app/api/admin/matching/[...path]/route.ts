import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Other dashboard sections use NEXT_PUBLIC_API_URL = https://api.beam.place
 * and paths like /v1/discovery/admin/.... Matching must do the same.
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://api.beam.place").replace(/\/$/, "");
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || "";

function matchingUpstreamUrl(targetPath: string): string {
  return `${API_BASE}/v1/discovery/admin/matching/${targetPath}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
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

  const { path } = await params;
  const targetPath = path.join("/");

  try {
    const res = await fetch(matchingUpstreamUrl(targetPath), {
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": ADMIN_TOKEN,
      },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Matching admin proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
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

  const { path } = await params;
  const targetPath = path.join("/");

  try {
    const body = await request.json().catch(() => ({}));
    const res = await fetch(matchingUpstreamUrl(targetPath), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": ADMIN_TOKEN,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Matching admin proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}