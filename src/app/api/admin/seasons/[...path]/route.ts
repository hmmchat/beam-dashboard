import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { canAccessSeasonOps } from "@/lib/season-ops-auth";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://api.beam.place").replace(
  /\/$/,
  ""
);
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || "";

function upstreamUrl(targetPath: string, search: string): string {
  const base = `${API_BASE}/v1/admin/seasons/${targetPath}`;
  return search ? `${base}?${search}` : base;
}

async function proxy(
  request: NextRequest,
  pathParts: string[],
  method: string
) {
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

  const targetPath = pathParts.join("/");
  const search = request.nextUrl.searchParams.toString();

  try {
    const init: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": ADMIN_TOKEN,
      },
      cache: "no-store",
    };
    if (method !== "GET" && method !== "HEAD") {
      const body = await request.text();
      init.body = body || "{}";
    }
    const res = await fetch(upstreamUrl(targetPath, search), init);
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Season admin proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path, "POST");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path, "PATCH");
}
