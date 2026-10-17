"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BeamLogo } from "@/components/BeamLogo";
import { ACCESS_GROUPS, LOGIN_GROUP_COOKIE, type AccessGroupId } from "@/lib/access-catalog";
import { cn } from "@/lib/utils";

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<AccessGroupId | "">("");
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");

  const errorMessage =
    errorParam === "AccessDenied"
      ? "That account cannot enter the area you selected."
      : errorParam
      ? "Sign-in failed. Please try again."
      : "";

  async function handleGoogleSignIn() {
    if (!group) return;
    setLoading(true);
    try {
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${LOGIN_GROUP_COOKIE}=${encodeURIComponent(group)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
      await signIn("google", { callbackUrl });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <BeamLogo height={40} width={125} className="object-contain mb-4" priority />
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Choose an area, then sign in with your company Google account
          </p>
        </div>
        {errorMessage && (
          <p className="text-sm text-center text-destructive">{errorMessage}</p>
        )}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium mb-2">Area</legend>
          {ACCESS_GROUPS.map((item) => {
            const selected = group === item.id;
            return (
              <label
                key={item.id}
                className={cn(
                  "flex cursor-pointer flex-col rounded-md border px-3 py-2",
                  selected ? "border-foreground bg-accent" : "hover:bg-accent/50"
                )}
              >
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
                <input
                  type="radio"
                  name="access-group"
                  value={item.id}
                  checked={selected}
                  className="sr-only"
                  onChange={() => setGroup(item.id)}
                />
              </label>
            );
          })}
        </fieldset>
        <Button
          type="button"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={loading || !group}
        >
          {loading ? "Redirecting to Google..." : "Continue with Google"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Sign-in is allowed only when your account is listed for the area you selected.
          Sign out to enter a different area.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
