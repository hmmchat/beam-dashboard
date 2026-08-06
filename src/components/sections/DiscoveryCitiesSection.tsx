"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch, apiUpload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Must match user-service / @hmm/common sentinel for the global discovery promo. */
const ANYWHERE_IN_INDIA = "ANYWHERE_IN_INDIA";
const MAX_CITY_BRANDS = 5;

type BrandOption = {
  id: string;
  name: string;
  logoUrl: string | null;
  domain?: string | null;
};

type CityMusic = {
  id?: string;
  name: string;
  artist: string;
  albumArtUrl?: string | null;
  spotifyId?: string | null;
};

type SpotifyHit = {
  name: string;
  artist: string;
  albumArtUrl?: string | null;
  spotifyId?: string;
};

export type DiscoveryCityOption = {
  id: string;
  value: string;
  label: string;
  intent: string | null;
  order: number | null;
  isActive: boolean;
  faceCardImageUrl: string | null;
  brandIds?: string[];
  brands?: BrandOption[];
  musicPreference?: CityMusic | null;
  createdAt?: string;
  updatedAt?: string;
};

function toCityMusic(song: SpotifyHit | CityMusic): CityMusic {
  return {
    name: song.name,
    artist: song.artist,
    albumArtUrl: song.albumArtUrl ?? null,
    spotifyId: "spotifyId" in song ? song.spotifyId ?? null : null,
  };
}

export function DiscoveryCitiesSection() {
  const [items, setItems] = useState<DiscoveryCityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiscoveryCityOption | null>(null);
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [intent, setIntent] = useState("");
  const [order, setOrder] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [faceUrl, setFaceUrl] = useState("");
  const [faceFile, setFaceFile] = useState<File | null>(null);

  /** Selected brands (real DB ids from Brandfetch persist / suggestions). */
  const [selectedBrands, setSelectedBrands] = useState<BrandOption[]>([]);
  const [brandQuery, setBrandQuery] = useState("");
  const [brandResults, setBrandResults] = useState<BrandOption[]>([]);
  const [searchingBrands, setSearchingBrands] = useState(false);
  const [brandSearchError, setBrandSearchError] = useState<string | null>(null);

  const [selectedSong, setSelectedSong] = useState<CityMusic | null>(null);
  const [songQuery, setSongQuery] = useState("");
  const [songResults, setSongResults] = useState<SpotifyHit[]>([]);
  const [searchingSongs, setSearchingSongs] = useState(false);
  const [songSearchError, setSongSearchError] = useState<string | null>(null);
  /** Manual fallback when Spotify is unavailable. */
  const [manualSongName, setManualSongName] = useState("");
  const [manualArtistName, setManualArtistName] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const songSearchSeq = useRef(0);
  const brandSearchSeq = useRef(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const cityRes = await apiFetch<{ ok: boolean; options: DiscoveryCityOption[] }>(
        "/v1/admin/discovery-city-options"
      );
      const list = cityRes.options || [];
      list.sort((a, b) => {
        const ao = a.order ?? 9999;
        const bo = b.order ?? 9999;
        if (ao !== bo) return ao - bo;
        return a.label.localeCompare(b.label);
      });
      setItems(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadBrandSuggestions = useCallback(async () => {
    setSearchingBrands(true);
    setBrandSearchError(null);
    try {
      // Same public endpoint the app uses (Brandfetch + custom catalog).
      const res = await apiFetch<{ brands: BrandOption[] }>("/v1/brands?limit=24");
      setBrandResults(res.brands || []);
    } catch (e) {
      setBrandResults([]);
      setBrandSearchError(e instanceof Error ? e.message : "Failed to load brands");
    } finally {
      setSearchingBrands(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  // Brand search — same Brandfetch path as the consumer app (`GET /brands/search`).
  useEffect(() => {
    if (!open) return;
    const q = brandQuery.trim();
    if (q.length < 2) {
      if (q.length === 0) {
        void loadBrandSuggestions();
      } else {
        setBrandResults([]);
      }
      return;
    }
    const seq = ++brandSearchSeq.current;
    setSearchingBrands(true);
    setBrandSearchError(null);
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<{ brands: BrandOption[] }>(
          `/v1/brands/search?q=${encodeURIComponent(q)}&limit=20`
        );
        if (seq !== brandSearchSeq.current) return;
        setBrandResults(res.brands || []);
      } catch (e) {
        if (seq !== brandSearchSeq.current) return;
        setBrandResults([]);
        const msg = e instanceof Error ? e.message : "Brand search failed";
        setBrandSearchError(msg);
        toast.error(msg);
      } finally {
        if (seq === brandSearchSeq.current) setSearchingBrands(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [brandQuery, open, loadBrandSuggestions]);

  // Spotify search — same public endpoint as the app (`GET /music/search`).
  useEffect(() => {
    if (!open) return;
    const q = songQuery.trim();
    if (q.length < 2) {
      setSongResults([]);
      setSearchingSongs(false);
      setSongSearchError(null);
      return;
    }
    const seq = ++songSearchSeq.current;
    setSearchingSongs(true);
    setSongSearchError(null);
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<{ songs: SpotifyHit[] }>(
          `/v1/music/search?q=${encodeURIComponent(q)}&limit=8`
        );
        if (seq !== songSearchSeq.current) return;
        setSongResults(res.songs || []);
        if ((res.songs || []).length === 0) {
          setSongSearchError("No Spotify matches. Pick a result, or use manual song + artist below.");
        }
      } catch (e) {
        if (seq !== songSearchSeq.current) return;
        setSongResults([]);
        const msg = e instanceof Error ? e.message : "Song search failed";
        setSongSearchError(msg);
        toast.error(msg);
      } finally {
        if (seq === songSearchSeq.current) setSearchingSongs(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [songQuery, open]);

  const resetForm = () => {
    setEditing(null);
    setValue("");
    setLabel("");
    setIntent("");
    setOrder("");
    setIsActive(true);
    setFaceUrl("");
    setFaceFile(null);
    setSelectedBrands([]);
    setBrandQuery("");
    setBrandResults([]);
    setBrandSearchError(null);
    setSelectedSong(null);
    setSongQuery("");
    setSongResults([]);
    setSongSearchError(null);
    setManualSongName("");
    setManualArtistName("");
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (item: DiscoveryCityOption) => {
    setEditing(item);
    setValue(item.value);
    setLabel(item.label);
    setIntent(item.intent || "");
    setOrder(item.order != null ? String(item.order) : "");
    setIsActive(item.isActive);
    setFaceUrl(item.faceCardImageUrl || "");
    setFaceFile(null);
    setSelectedBrands(
      (item.brands || []).map((b) => ({
        id: b.id,
        name: b.name,
        logoUrl: b.logoUrl ?? null,
        domain: b.domain ?? null,
      }))
    );
    setBrandQuery("");
    setSelectedSong(item.musicPreference || null);
    setSongQuery("");
    setSongResults([]);
    setSongSearchError(null);
    setManualSongName("");
    setManualArtistName("");
    setOpen(true);
  };

  const facePreviewObjectUrl = useMemo(() => {
    if (!faceFile) return null;
    return URL.createObjectURL(faceFile);
  }, [faceFile]);

  useEffect(() => {
    return () => {
      if (facePreviewObjectUrl) URL.revokeObjectURL(facePreviewObjectUrl);
    };
  }, [facePreviewObjectUrl]);

  const resolveFaceImageUrl = async (): Promise<string | null> => {
    if (faceFile) {
      const fd = new FormData();
      fd.append("file", faceFile);
      const { url } = await apiUpload("/v1/files/upload?folder=discovery-city-faces", fd);
      return url;
    }
    const t = faceUrl.trim();
    return t.length > 0 ? t : null;
  };

  const toggleBrand = (brand: BrandOption) => {
    setSelectedBrands((prev) => {
      if (prev.some((b) => b.id === brand.id)) {
        return prev.filter((b) => b.id !== brand.id);
      }
      if (prev.length >= MAX_CITY_BRANDS) {
        toast.error(`Pick up to ${MAX_CITY_BRANDS} brands`);
        return prev;
      }
      return [...prev, brand];
    });
  };

  const pickSong = (song: SpotifyHit | CityMusic) => {
    setSelectedSong(toCityMusic(song));
    setSongQuery("");
    setSongResults([]);
    setSongSearchError(null);
    setManualSongName("");
    setManualArtistName("");
  };

  const resolveMusicPreferenceForSave = async (): Promise<
    | { songName: string; artistName: string; albumArtUrl: string | null; spotifyId: string | null }
    | null
  > => {
    if (selectedSong?.name && selectedSong?.artist) {
      return {
        songName: selectedSong.name,
        artistName: selectedSong.artist,
        albumArtUrl: selectedSong.albumArtUrl ?? null,
        spotifyId: selectedSong.spotifyId ?? null,
      };
    }

    // Typed a Spotify query but never clicked a result — take the top hit.
    const q = songQuery.trim();
    if (q.length >= 2) {
      if (songResults.length > 0) {
        const top = songResults[0];
        pickSong(top);
        return {
          songName: top.name,
          artistName: top.artist,
          albumArtUrl: top.albumArtUrl ?? null,
          spotifyId: top.spotifyId ?? null,
        };
      }
      try {
        const res = await apiFetch<{ songs: SpotifyHit[] }>(
          `/v1/music/search?q=${encodeURIComponent(q)}&limit=1`
        );
        const top = res.songs?.[0];
        if (top) {
          pickSong(top);
          return {
            songName: top.name,
            artistName: top.artist,
            albumArtUrl: top.albumArtUrl ?? null,
            spotifyId: top.spotifyId ?? null,
          };
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Spotify search failed on save");
        throw e;
      }
      toast.error("No Spotify match for that search. Click a result, or fill manual song + artist.");
      throw new Error("No Spotify match");
    }

    // Manual fallback (no Spotify).
    const name = manualSongName.trim();
    const artist = manualArtistName.trim();
    if (name && artist) {
      return {
        songName: name,
        artistName: artist,
        albumArtUrl: null,
        spotifyId: null,
      };
    }
    if (name || artist) {
      toast.error("Manual song needs both song name and artist.");
      throw new Error("Incomplete manual song");
    }

    return null;
  };

  const handleSave = async () => {
    if (!label.trim()) {
      toast.error("Label is required");
      return;
    }
    if (!intent.trim()) {
      toast.error("Intent is required");
      return;
    }
    const isReserved = editing?.value === ANYWHERE_IN_INDIA;
    if (!editing) {
      const v = value.trim();
      if (!v) {
        toast.error("Value is required (stored on users as preferredCity; must match live city names)");
        return;
      }
      if (v === ANYWHERE_IN_INDIA) {
        toast.error(`Reserved value "${ANYWHERE_IN_INDIA}" already exists. Edit that row to set its face card.`);
        return;
      }
    }

    setSaving(true);
    try {
      let finalFace: string | null | undefined = undefined;
      try {
        finalFace = await resolveFaceImageUrl();
      } catch (up) {
        toast.error(up instanceof Error ? up.message : "Image upload failed");
        setSaving(false);
        return;
      }

      const orderNum = order.trim() === "" ? undefined : parseInt(order.trim(), 10);
      if (order.trim() !== "" && Number.isNaN(orderNum)) {
        toast.error("Order must be a number");
        setSaving(false);
        return;
      }

      let musicPreference: Awaited<ReturnType<typeof resolveMusicPreferenceForSave>>;
      try {
        musicPreference = await resolveMusicPreferenceForSave();
      } catch {
        setSaving(false);
        return;
      }

      const brandIds = selectedBrands.map((b) => b.id);

      if (editing) {
        const body: Record<string, unknown> = {
          label: label.trim(),
          intent: intent.trim(),
          isActive,
          brandIds,
          musicPreference,
        };
        if (!isReserved) {
          body.value = value.trim();
        }
        if (orderNum !== undefined) body.order = orderNum;
        if (finalFace !== undefined) body.faceCardImageUrl = finalFace;

        await apiFetch(`/v1/admin/discovery-city-options/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast.success(
          musicPreference
            ? `Updated — song: ${musicPreference.songName}`
            : "Updated (no song on this city card)"
        );
      } else {
        await apiFetch("/v1/admin/discovery-city-options", {
          method: "POST",
          body: JSON.stringify({
            value: value.trim(),
            label: label.trim(),
            intent: intent.trim(),
            order: orderNum,
            isActive,
            faceCardImageUrl: finalFace ?? null,
            brandIds,
            musicPreference,
          }),
        });
        toast.success(
          musicPreference
            ? `Created — song: ${musicPreference.songName}`
            : "Created (no song on this city card)"
        );
      }
      setOpen(false);
      resetForm();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: DiscoveryCityOption) => {
    if (item.value === ANYWHERE_IN_INDIA) {
      toast.error("Cannot delete the built-in Anywhere in India option.");
      return;
    }
    if (!confirm(`Delete "${item.label}"? This fails if users still use this city value.`)) return;
    setDeleteId(item.id);
    try {
      await apiFetch(`/v1/admin/discovery-city-options/${item.id}`, { method: "DELETE" });
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error}</p>
        <p className="text-sm text-muted-foreground">
          Ensure the API gateway exposes <code className="text-xs bg-muted px-1 rounded">GET /v1/admin/discovery-city-options</code> and{" "}
          <code className="text-xs bg-muted px-1 rounded">NEXT_PUBLIC_API_URL</code> is correct.
        </p>
        <Button onClick={load}>Retry</Button>
      </div>
    );
  }

  const editingAnywhere = editing?.value === ANYWHERE_IN_INDIA;
  const selectedBrandIds = new Set(selectedBrands.map((b) => b.id));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-3xl">
        These options power the website <strong>preferred city</strong> dropdown and which cities appear as{" "}
        <strong>LOCATION</strong> discovery handoffs. Brands use the same <strong>Brandfetch</strong> search as the
        app. Songs use the same <strong>Spotify</strong> search — click a result (or Save will take the top match).
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <Button onClick={openCreate}>Add city</Button>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit discovery city" : "Add discovery city"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="dc-value">Stored value (preferredCity)</Label>
              <Input
                id="dc-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. Bengaluru"
                disabled={!!editing}
              />
              {editing && (
                <p className="text-xs text-muted-foreground">Value cannot be changed after create.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dc-label">Display label</Label>
              <Input
                id="dc-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Bengaluru"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dc-intent">Intent (city vibe)</Label>
              <Input
                id="dc-intent"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="e.g. Chaotic chai breaks and midnight metro stories"
                maxLength={255}
              />
              <p className="text-xs text-muted-foreground">
                Shown on the city face card intent strip. Required to publish.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dc-order">Sort order (optional)</Label>
              <Input
                id="dc-order"
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="Lower appears first"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="dc-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border"
              />
              <Label htmlFor="dc-active" className="font-normal cursor-pointer">
                Active (shown in dropdown / promos)
              </Label>
            </div>
            <div className="space-y-2">
              <Label>Face card image (discovery LOCATION promo)</Label>
              {editingAnywhere && (
                <p className="text-xs text-muted-foreground">
                  This image is used when the <strong>Anywhere in India</strong> option appears as a LOCATION card in
                  discovery.
                </p>
              )}
              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFaceFile(f);
                      setFaceUrl("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose image…
                </Button>
                {faceFile && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">{faceFile.name}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Or paste an HTTPS URL:</p>
              <Input
                value={faceUrl}
                onChange={(e) => {
                  setFaceUrl(e.target.value);
                  if (e.target.value) setFaceFile(null);
                }}
                placeholder="https://…"
                disabled={!!faceFile}
              />
              {facePreviewObjectUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- admin-upload preview
                <img src={facePreviewObjectUrl} alt="" className="mt-2 max-h-32 rounded border object-contain" />
              )}
              {!faceFile && (faceUrl.trim() || editing?.faceCardImageUrl) && (
                // eslint-disable-next-line @next/next/no-img-element -- admin catalog image
                <img
                  src={faceUrl.trim() || editing?.faceCardImageUrl || ""}
                  alt=""
                  className="mt-2 max-h-32 rounded border object-contain"
                />
              )}
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label>
                Brands on city face card ({selectedBrands.length}/{MAX_CITY_BRANDS})
              </Label>
              <p className="text-xs text-muted-foreground">
                Same Brandfetch search as the app (<code className="text-[10px] bg-muted px-1 rounded">/v1/brands/search</code>
                ). Type to search; click to add.
              </p>
              {selectedBrands.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedBrands.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBrand(b)}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-1 text-xs"
                      title="Click to remove"
                    >
                      {b.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logoUrl} alt="" className="h-4 w-4 rounded object-contain" />
                      ) : null}
                      {b.name}
                      <span className="text-muted-foreground">×</span>
                    </button>
                  ))}
                </div>
              )}
              <Input
                value={brandQuery}
                onChange={(e) => setBrandQuery(e.target.value)}
                placeholder="Search brands (Brandfetch)…"
              />
              {searchingBrands && (
                <p className="text-xs text-muted-foreground">Searching brands…</p>
              )}
              {brandSearchError && (
                <p className="text-xs text-destructive">{brandSearchError}</p>
              )}
              <div className="max-h-36 overflow-y-auto rounded border p-2 space-y-1">
                {brandResults.length === 0 && !searchingBrands ? (
                  <p className="text-xs text-muted-foreground px-1 py-2">
                    {brandQuery.trim().length >= 2
                      ? "No brands found for that search."
                      : "Suggestions load here, or type to search Brandfetch."}
                  </p>
                ) : (
                  brandResults.map((b) => {
                    const selected = selectedBrandIds.has(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBrand(b)}
                        className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                          selected ? "bg-muted" : ""
                        }`}
                      >
                        <span
                          className={`h-4 w-4 shrink-0 rounded border ${
                            selected ? "bg-primary border-primary" : "border-muted-foreground/40"
                          }`}
                        />
                        {b.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.logoUrl} alt="" className="h-5 w-5 rounded object-contain" />
                        ) : (
                          <span className="h-5 w-5 rounded bg-muted" />
                        )}
                        <span className="truncate">{b.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label>Song on city face card</Label>
              <p className="text-xs text-muted-foreground">
                Search Spotify, then <strong>click a result</strong> (or Save will use the top match). Typing alone
                without a match does nothing.
              </p>
              {selectedSong && (
                <div className="flex items-center gap-3 rounded border p-2 bg-muted/30">
                  {selectedSong.albumArtUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedSong.albumArtUrl}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Selected</p>
                    <p className="text-sm font-medium truncate">{selectedSong.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedSong.artist}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSong(null)}
                  >
                    Clear
                  </Button>
                </div>
              )}
              <Input
                value={songQuery}
                onChange={(e) => setSongQuery(e.target.value)}
                placeholder="Search Spotify — song or artist…"
              />
              {searchingSongs && (
                <p className="text-xs text-muted-foreground">Searching Spotify…</p>
              )}
              {songSearchError && (
                <p className="text-xs text-destructive">{songSearchError}</p>
              )}
              {songResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded border divide-y">
                  {songResults.map((song) => (
                    <button
                      key={`${song.spotifyId || song.name}-${song.artist}`}
                      type="button"
                      className="w-full flex items-center gap-2 px-2 py-2 text-left hover:bg-muted"
                      onClick={() => pickSong(song)}
                    >
                      {song.albumArtUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={song.albumArtUrl}
                          alt=""
                          className="h-9 w-9 rounded object-cover"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded bg-muted" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm truncate">{song.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-2 rounded border p-2">
                <p className="text-xs text-muted-foreground">
                  Manual fallback (if Spotify search is down). Needs both fields.
                </p>
                <Input
                  value={manualSongName}
                  onChange={(e) => setManualSongName(e.target.value)}
                  placeholder="Song name"
                  disabled={!!selectedSong}
                />
                <Input
                  value={manualArtistName}
                  onChange={(e) => setManualArtistName(e.target.value)}
                  placeholder="Artist"
                  disabled={!!selectedSong}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Value</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Intent</TableHead>
              <TableHead className="w-20">Order</TableHead>
              <TableHead className="w-24">Active</TableHead>
              <TableHead className="w-28">Face card</TableHead>
              <TableHead className="w-24">Brands</TableHead>
              <TableHead className="w-28">Song</TableHead>
              <TableHead className="w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.value}</TableCell>
                <TableCell>{item.label}</TableCell>
                <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                  {item.intent || "—"}
                </TableCell>
                <TableCell>{item.order ?? "—"}</TableCell>
                <TableCell>{item.isActive ? "Yes" : "No"}</TableCell>
                <TableCell>
                  {item.faceCardImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.faceCardImageUrl}
                      alt=""
                      className="h-10 w-14 object-cover rounded border"
                    />
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.brands?.length ? `${item.brands.length}` : "—"}
                </TableCell>
                <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">
                  {item.musicPreference?.name || "—"}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(item)}
                    disabled={item.value === ANYWHERE_IN_INDIA || deleteId === item.id}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
