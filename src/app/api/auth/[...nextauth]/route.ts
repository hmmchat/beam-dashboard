import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAccessGroupId, LOGIN_GROUP_COOKIE, type AccessGroupId } from "@/lib/access-catalog";
import { runWithLoginGroup } from "@/lib/login-group";

const handler = NextAuth(authOptions);

function decodeCookie(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function groupFromValue(value: string): AccessGroupId | null {
  const decoded = decodeCookie(value);
  return isAccessGroupId(decoded) ? decoded : null;
}

function groupFromCallbackUrl(value: string): AccessGroupId | null {
  const decoded = decodeCookie(value);
  try {
    const group = new URL(decoded, "https://dashboard.beam.place").searchParams.get("group") ?? "";
    return isAccessGroupId(group) ? group : null;
  } catch {
    return null;
  }
}

type RouteContext = { params: { nextauth: string[] } };

async function auth(req: NextRequest, context: RouteContext) {
  const fromLoginCookie = groupFromValue(req.cookies.get(LOGIN_GROUP_COOKIE)?.value ?? "");
  const fromCallback =
    groupFromCallbackUrl(req.cookies.get("__Secure-next-auth.callback-url")?.value ?? "") ??
    groupFromCallbackUrl(req.cookies.get("next-auth.callback-url")?.value ?? "");
  return runWithLoginGroup(fromLoginCookie ?? fromCallback, () => handler(req, context));
}

export { auth as GET, auth as POST };
