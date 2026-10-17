import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { cookies } from "next/headers";
import { canAccessGroup } from "@/lib/access";
import { isAccessGroupId, LOGIN_GROUP_COOKIE } from "@/lib/access-catalog";

function readPendingGroup() {
  const raw = cookies().get(LOGIN_GROUP_COOKIE)?.value ?? "";
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    value = raw;
  }
  return isAccessGroupId(value) ? value : null;
}

function clearPendingGroup() {
  try {
    cookies().set(LOGIN_GROUP_COOKIE, "", { path: "/", maxAge: 0 });
  } catch {
    // The login cookie expires on its own if this request cannot write it.
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const group = readPendingGroup();
      if (!canAccessGroup(user.email, group)) {
        return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        const group = readPendingGroup();
        token.accessGroup = canAccessGroup(user.email, group) ? group : null;
        clearPendingGroup();
      } else if (!canAccessGroup(token.email, token.accessGroup)) {
        token.accessGroup = null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email ?? undefined;
        session.user.accessGroup = isAccessGroupId(token.accessGroup ?? "")
          ? token.accessGroup
          : null;
      }
      return session;
    },
  },
};
