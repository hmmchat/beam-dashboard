import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://api.beam.place").replace(
  /\/$/,
  ""
);
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || "";

function upstreamUrl(pathParts: string[], search: string): string {
  const suffix = pathParts.length ? `/${pathParts.join("/")}` : "";
  return `${API_BASE}/v1/admin/notification-campaigns${suffix}${search}`;
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

  if (!ADMIN_TOKEN) {
    return NextResponse.json(
      { error: "ADMIN_API_TOKEN is not configured on the dashboard" },
      { status: 503 }
    );
  }

  const search = request.nextUrl.search || "";
  const url = upstreamUrl(pathParts, search);
  const headers: Record<string, string> = {
    "X-Admin-Token": ADMIN_TOKEN,
  };
  if (session.user?.email) {
    headers["X-Admin-Actor"] = session.user.email;
  }

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
    const json = await request.json().catch(() => ({}));
    body = JSON.stringify(json);
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || res.statusText };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Notification campaigns proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path || [], "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path || [], "POST");
}
