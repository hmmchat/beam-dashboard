"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch, apiUpload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ModeratorFaceCardSettings = {
  username: string;
  intent: string;
  displayPictureUrl: string | null;
  city: string;
};

export function ModeratorFaceCardSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [username, setUsername] = useState("Moderator");
  const [intent, setIntent] = useState("Moderation");
  const [city, setCity] = useState("Beam");
  const [displayUrl, setDisplayUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewObjectUrl = useMemo(() => {
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  useEffect(() => {
    return () => {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    };
  }, [previewObjectUrl]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        ok: boolean;
        settings: ModeratorFaceCardSettings;
        updatedAt?: string;
      }>("/v1/admin/moderator-face-card");
      const s = res.settings;
      setUsername(s.username || "Moderator");
      setIntent(s.intent || "Moderation");
      setCity(s.city || "Beam");
      setDisplayUrl(s.displayPictureUrl || "");
      setUpdatedAt(res.updatedAt ?? null);
      setImageFile(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resolveDisplayPictureUrl = async (): Promise<string | null> => {
    if (imageFile) {
      const fd = new FormData();
      fd.append("file", imageFile);
      const { url } = await apiUpload("/v1/files/upload?folder=moderator-face-card", fd);
      return url;
    }
    const t = displayUrl.trim();
    return t.length > 0 ? t : null;
  };

  const handleSave = async () => {
    if (!username.trim()) {
      toast.error("Display name is required");
      return;
    }
    if (!intent.trim()) {
      toast.error("Intent is required");
      return;
    }
    setSaving(true);
    try {
      let displayPictureUrl: string | null;
      try {
        displayPictureUrl = await resolveDisplayPictureUrl();
      } catch (up) {
        toast.error(up instanceof Error ? up.message : "Image upload failed");
        setSaving(false);
        return;
      }

      const res = await apiFetch<{
        ok: boolean;
        settings: ModeratorFaceCardSettings;
        updatedAt?: string;
      }>("/v1/admin/moderator-face-card", {
        method: "PATCH",
        body: JSON.stringify({
          username: username.trim(),
          intent: intent.trim(),
          city: city.trim() || "Beam",
          displayPictureUrl,
        }),
      });
      setDisplayUrl(res.settings.displayPictureUrl || "");
      setImageFile(null);
      setUpdatedAt(res.updatedAt ?? null);
      toast.success("Moderator face card saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = previewObjectUrl || displayUrl.trim() || null;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <p className="text-sm text-muted-foreground">
        This is the shared discovery face card shown when a moderator has{" "}
        <strong>Show moderator face card</strong> enabled (Users → KYC &amp; moderation).
        Changes may take up to ~1 minute to appear in the app (discovery cache).
      </p>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1">
          <Label htmlFor="mod-username">Display name</Label>
          <Input
            id="mod-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Moderator"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="mod-intent">Intent</Label>
          <Input
            id="mod-intent"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="Moderation"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="mod-city">City label</Label>
          <Input
            id="mod-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Beam"
          />
        </div>

        <div className="space-y-2">
          <Label>Face card image</Label>
          {previewSrc ? (
            <div className="relative w-40 aspect-[3/4] rounded-lg overflow-hidden border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewSrc} alt="Moderator face card preview" className="object-cover w-full h-full" />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No image set — upload or paste a URL.</p>
          )}
          <Input
            value={displayUrl}
            onChange={(e) => {
              setDisplayUrl(e.target.value);
              setImageFile(null);
            }}
            placeholder="https://… or upload below"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setImageFile(f);
            }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Upload image
            </Button>
            {(displayUrl || imageFile) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDisplayUrl("");
                  setImageFile(null);
                }}
              >
                Clear image
              </Button>
            )}
          </div>
        </div>

        {updatedAt ? (
          <p className="text-xs text-muted-foreground">Last saved: {new Date(updatedAt).toLocaleString()}</p>
        ) : null}

        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save moderator face card"}
        </Button>
      </div>
    </div>
  );
}
