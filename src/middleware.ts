import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccessGroup } from "@/lib/access";
import { groupForPath } from "@/lib/access-catalog";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const email = typeof token?.email === "string" ? token.email : null;
  const accessGroup = typeof token?.accessGroup === "string" ? token.accessGroup : null;
  const allowed = canAccessGroup(email, accessGroup);

  if (!allowed) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("callbackUrl", "/dashboard");
    if (token) url.searchParams.set("error", "AccessDenied");
    return NextResponse.redirect(url);
  }

  const required = groupForPath(pathname);
  if (required === null || (required !== "any" && required !== accessGroup)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/admin/:path*"],
};
