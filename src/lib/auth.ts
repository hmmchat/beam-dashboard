import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const allowedEmails = (process.env.ALLOWED_EMAILS || "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        const password = process.env.DASHBOARD_PASSWORD || "";
        if (!allowedEmails.length || !password) {
          console.error("ALLOWED_EMAILS and DASHBOARD_PASSWORD must be set");
          return null;
        }
        const email = credentials.email.trim().toLowerCase();
        if (!allowedEmails.includes(email)) {
          return null;
        }
        if (credentials.password !== password) {
          return null;
        }
        return { id: email, email };
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
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email ?? undefined;
      }
      return session;
    },
  },
};
