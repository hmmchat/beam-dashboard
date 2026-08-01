"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BroadcastRoom = {
  roomId: string;
  sessionId: string;
  status: string;
  isBroadcasting: boolean;
  participantUserIds: string[];
  viewerCount: number;
};

export function BeamTvModerationPanel() {
  const [userId, setUserId] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [room, setRoom] = useState<BroadcastRoom | null>(null);
  const [lookedUp, setLookedUp] = useState(false);
  const [stopMessage, setStopMessage] = useState("");
  const [stopBusy, setStopBusy] = useState(false);

  const lookup = async () => {
    const id = userId.trim();
    if (!id) {
      toast.error("Enter a broadcast participant user id");
      return;
    }
    setLookupBusy(true);
    setLookedUp(false);
    setRoom(null);
    try {
      const res = await apiFetch<{
        ok?: boolean;
        found?: boolean;
        room?: BroadcastRoom | null;
      }>(`/v1/streaming/admin/broadcasts/by-participant/${encodeURIComponent(id)}`);
      setLookedUp(true);
      if (res.found && res.room) {
        setRoom(res.room);
      } else {
        setRoom(null);
        toast.message("No active Beam TV broadcast for that participant");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLookupBusy(false);
    }
  };

  const stopRoom = async () => {
    if (!room?.roomId) return;
    const message = stopMessage.trim();
    if (!message) {
      toast.error("Enter the message users will see when the room ends");
      return;
    }
    setStopBusy(true);
    try {
      await apiFetch(`/v1/streaming/admin/broadcasts/${encodeURIComponent(room.roomId)}/end`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      toast.success("Beam TV room ended for everyone");
      setRoom(null);
      setLookedUp(false);
      setStopMessage("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to stop room");
    } finally {
      setStopBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="text-lg font-medium">Beam TV</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Look up an active broadcast by a participant user id (not a viewer), then end the room for
          everyone with a custom message. Moderators can also watch and post overlay notices in the
          product Beam TV feed.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="beam-tv-user-id">Participant user id</Label>
          <Input
            id="beam-tv-user-id"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="user id on the broadcast"
            onKeyDown={(e) => {
              if (e.key === "Enter") void lookup();
            }}
          />
        </div>
        <Button type="button" disabled={lookupBusy} onClick={() => void lookup()}>
          {lookupBusy ? "Looking up…" : "Find room"}
        </Button>
      </div>

      {lookedUp && !room ? (
        <p className="text-sm text-muted-foreground">
          No active Beam TV room found for that participant.
        </p>
      ) : null}

      {room ? (
        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          <div className="grid gap-1 text-sm">
            <div>
              <span className="text-muted-foreground">Room id:</span>{" "}
              <code className="text-xs">{room.roomId}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Session:</span>{" "}
              <code className="text-xs">{room.sessionId}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span> {room.status} · viewers{" "}
              {room.viewerCount}
            </div>
            <div>
              <span className="text-muted-foreground">Participants:</span>{" "}
              {room.participantUserIds.join(", ") || "—"}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="beam-tv-stop-message">Stop message (shown to everyone)</Label>
            <textarea
              id="beam-tv-stop-message"
              value={stopMessage}
              onChange={(e) => setStopMessage(e.target.value)}
              rows={3}
              placeholder="This stream was ended by a moderator for a guideline violation."
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <Button
            type="button"
            variant="destructive"
            disabled={stopBusy}
            onClick={() => void stopRoom()}
          >
            {stopBusy ? "Stopping…" : "Stop room for everyone"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
