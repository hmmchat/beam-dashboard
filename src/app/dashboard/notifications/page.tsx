import { NotificationsSection } from "@/components/sections/NotificationsSection";

export default function NotificationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Notifications</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Push BEAM (broadcast) and BEAM MOD (targeted) messages into the user Inbox.
      </p>
      <NotificationsSection />
    </div>
  );
}
