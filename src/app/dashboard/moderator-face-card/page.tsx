import { ModeratorFaceCardSection } from "@/components/sections/ModeratorFaceCardSection";

export default function ModeratorFaceCardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Moderator face card</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Configure the shared discovery card for moderators on duty.
      </p>
      <ModeratorFaceCardSection />
    </div>
  );
}
