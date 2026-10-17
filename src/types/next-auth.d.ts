import "next-auth";
import "next-auth/jwt";
import type { AccessGroupId } from "@/lib/access-catalog";

declare module "next-auth" {
  interface Session {
    user?: {
      email?: string | null;
      name?: string | null;
      image?: string | null;
      accessGroup?: AccessGroupId | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    email?: string | null;
    accessGroup?: AccessGroupId | null;
  }
}
