import { ZodiacsSection } from "@/components/sections/ZodiacsSection";

export default function ZodiacsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Zodiacs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage zodiac images used on profiles and facecards.
        </p>
      </div>
      <ZodiacsSection />
    </div>
  );
}

