"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
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

type Gift = {
  id: string;
  giftId: string;
  name: string;
  imageUrl: string | null;
  emoji?: string; // legacy, may come from API
  diamonds: number;
  isActive: boolean;
};

export function GiftsSection() {
  const [items, setItems] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Gift | null>(null);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [diamonds, setDiamonds] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ ok: boolean; gifts: Gift[] }>("/v1/admin/gifts");
      setItems(Array.isArray(res.gifts) ? res.gifts : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Load when this section is shown (handles client navigations to /dashboard/gifts reliably). */
  useEffect(() => {
    if (pathname !== "/dashboard/gifts") return;
    void load();
  }, [pathname, load]);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setImageUrl("");
    setImageFile(null);
    setDiamonds("");
    setIsActive(true);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (item: Gift) => {
    setEditing(item);
    setName(item.name);
    setImageUrl(item.imageUrl ?? "");
    setImageFile(null);
    setDiamonds(String(item.diamonds));
    setIsActive(item.isActive);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    let finalImageUrl = imageUrl;
    if (imageFile) {
      const fd = new FormData();
      fd.append("file", imageFile);
      const { url } = await apiUpload("/v1/files/upload?folder=gift-images", fd);
      finalImageUrl = url;
    }
    if (!finalImageUrl.trim()) {
      toast.error("Gift image (upload or URL) is required");
      return;
    }
    const diamondsNum = parseInt(diamonds, 10);
    if (isNaN(diamondsNum) || diamondsNum < 0) {
      toast.error("Diamonds must be a non-negative number");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/v1/admin/gifts/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            imageUrl: finalImageUrl.trim(),
            diamonds: diamondsNum,
            isActive,
          }),
        });
        toast.success("Updated");
      } else {
        await apiFetch("/v1/admin/gifts", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            imageUrl: finalImageUrl.trim(),
            diamonds: diamondsNum,
          }),
        });
        toast.success("Created");
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

  const handleSoftDelete = async (id: string) => {
    setDeleteId(id);
    try {
      await apiFetch(`/v1/admin/gifts/${id}`, { method: "DELETE" });
      toast.success("Deactivated");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to deactivate");
    } finally {
      setDeleteId(null);
    }
  };

  const handleHardDelete = async (id: string) => {
    if (!confirm("Permanently delete this gift?")) return;
    setHardDeleteId(id);
    try {
      await apiFetch(`/v1/admin/gifts/${id}/hard`, { method: "DELETE" });
      toast.success("Permanently deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setHardDeleteId(null);
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading gifts…</p>;
  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error}</p>
        <p className="text-sm text-muted-foreground">Ensure the API is running and NEXT_PUBLIC_API_URL in .env.local is correct.</p>
        <Button onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              openCreate();
              setOpen(true);
            }}
          >
            Add Gift
          </Button>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Gift" : "Add Gift"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rocket"
              />
            </div>
            <div className="space-y-2">
              <Label>Gift Image</Label>
              <div className="flex gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setImageFile(f);
                      setImageUrl("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imageFile ? imageFile.name : "Upload image"}
                </Button>
                {imageFile && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImageFile(null)}>
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Or paste image URL:</p>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                disabled={!!imageFile}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="diamonds">Diamonds</Label>
              <p className="text-xs text-muted-foreground">
                Cost to send this gift in diamonds. Coin→diamond conversion applies only when users buy diamonds with coins, not here.
              </p>
              <Input
                id="diamonds"
                type="number"
                min={0}
                value={diamonds}
                onChange={(e) => setDiamonds(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gift ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Diamonds</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-48">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground py-8 px-4">
                  No gifts found. If you expect defaults, run the friend-service gift seeder (or enable{" "}
                  <code className="text-xs">SEED_DEFAULT_GIFTS_ON_START</code>) and click Refresh.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.giftId}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-10 w-10 object-contain" />
                    ) : (
                      item.emoji ?? "—"
                    )}
                  </TableCell>
                  <TableCell>{item.diamonds}</TableCell>
                  <TableCell>{item.isActive ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                      Edit
                    </Button>
                    {item.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSoftDelete(item.id)}
                        disabled={deleteId === item.id}
                      >
                        Deactivate
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleHardDelete(item.id)}
                      disabled={hardDeleteId === item.id}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
