import type { NextAuthOptions } from "next-auth";
import type { GoogleProfile } from "next-auth/providers/google";
import GoogleProvider from "next-auth/providers/google";
import { canAccessGroup } from "@/lib/access";
import { isAccessGroupId } from "@/lib/access-catalog";
import { getLoginGroup } from "@/lib/login-group";

function emailFromGoogle(
  user?: { email?: string | null },
  profile?: Partial<GoogleProfile> | null
) {
  return profile?.email || user?.email || null;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "select_account",
          scope: "openid email profile",
        },
      },
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
    async signIn({ user, profile }) {
      const email = emailFromGoogle(user, profile as Partial<GoogleProfile>);
      const group = getLoginGroup();
      if (!canAccessGroup(email, group)) {
        return false;
      }
      return true;
    },
    async jwt({ token, user, profile }) {
      if (user) {
        const email = emailFromGoogle(user, profile as Partial<GoogleProfile>);
        token.email = email;
        const group = getLoginGroup();
        token.accessGroup = canAccessGroup(email, group) ? group : null;
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
