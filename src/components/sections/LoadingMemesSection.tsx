"use client";

import { useEffect, useState, useRef } from "react";
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

type Meme = {
  id: string;
  text: string;
  imageUrl: string;
  category: string | null;
  isActive: boolean;
  order: number | null;
  createdAt: string;
  updatedAt: string;
};

export function LoadingMemesSection() {
  const [items, setItems] = useState<Meme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Meme | null>(null);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [order, setOrder] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ ok: boolean; memes: Meme[] }>(
        "/v1/streaming/admin/loading-memes"
      );
      setItems(res.memes || []);
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

  const resetForm = () => {
    setEditing(null);
    setText("");
    setImageUrl("");
    setImageFile(null);
    setCategory("");
    setOrder("");
    setIsActive(true);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (item: Meme) => {
    setEditing(item);
    setText(item.text);
    setImageUrl(item.imageUrl);
    setImageFile(null);
    setCategory(item.category || "");
    setOrder(item.order != null ? String(item.order) : "");
    setIsActive(item.isActive);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!text.trim()) {
      toast.error("Text is required");
      return;
    }
    let finalImageUrl = imageUrl;
    if (imageFile) {
      const fd = new FormData();
      fd.append("file", imageFile);
      const { url } = await apiUpload("/v1/files/upload?folder=loading-memes", fd);
      finalImageUrl = url;
    }
    if (!finalImageUrl) {
      toast.error("Image URL or file upload is required");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        text: text.trim(),
        imageUrl: finalImageUrl,
        category: category.trim() || undefined,
        isActive: editing ? isActive : true,
      };
      if (order !== "") payload.order = parseInt(order, 10);

      if (editing) {
        await apiFetch(`/v1/streaming/admin/loading-memes/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Updated");
      } else {
        await apiFetch("/v1/streaming/admin/loading-memes", {
          method: "POST",
          body: JSON.stringify(payload),
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
      await apiFetch(`/v1/streaming/admin/loading-memes/${id}`, { method: "DELETE" });
      toast.success("Deactivated");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to deactivate");
    } finally {
      setDeleteId(null);
    }
  };

  const handleHardDelete = async (id: string) => {
    if (!confirm("Permanently delete this meme?")) return;
    setHardDeleteId(id);
    try {
      await apiFetch(`/v1/streaming/admin/loading-memes/${id}/hard`, { method: "DELETE" });
      toast.success("Permanently deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setHardDeleteId(null);
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error}</p>
        <p className="text-sm text-muted-foreground">Ensure the API is running and NEXT_PUBLIC_API_URL in .env.local is correct.</p>
        <Button onClick={load}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <Button onClick={() => { openCreate(); setOpen(true); }}>Add Meme</Button>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Meme" : "Add Meme"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="text">Text</Label>
              <Input
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="You can be an asshole. But what's the reason?"
              />
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
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
              {!editing && (
                <p className="text-xs text-muted-foreground">Image is required for new memes.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. funny"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order">Order</Label>
              <Input
                id="order"
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="1"
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
              <TableHead>Text</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-48">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-xs truncate">{item.text}</TableCell>
                <TableCell>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="h-12 w-12 object-cover rounded" />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{item.category || "—"}</TableCell>
                <TableCell>{item.order ?? "—"}</TableCell>
                <TableCell>{item.isActive ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>Edit</Button>
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
