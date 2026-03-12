"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BeamLogo } from "@/components/BeamLogo";

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");

  const errorMessage =
    errorParam === "AccessDenied"
      ? "Your email is not allowed to access this dashboard."
      : errorParam
      ? "Sign-in failed. Please try again."
      : "";

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <BeamLogo height={40} width={125} className="object-contain mb-4" priority />
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sign in with your company Google account
          </p>
        </div>
        {errorMessage && (
          <p className="text-sm text-center text-destructive">{errorMessage}</p>
        )}
        <Button
          type="button"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? "Redirecting to Google..." : "Continue with Google"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Only emails in the allowed list can access this dashboard.
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

