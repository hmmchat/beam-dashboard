"use client";

import { useEffect, useRef, useState } from "react";
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

type Zodiac = {
  id: string;
  name: string;
  imageUrl: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
};

const MAX_UPLOAD_SIZE_MB = 50;
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export function ZodiacsSection() {
  const [items, setItems] = useState<Zodiac[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Zodiac | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [order, setOrder] = useState("");
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ ok: boolean; zodiacs: Zodiac[] }>("/v1/admin/zodiacs");
      setItems(res.zodiacs || []);
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

  const openEdit = (z: Zodiac) => {
    setEditing(z);
    setImageUrl(z.imageUrl || "");
    setImageFile(null);
    setOrder(String(z.order ?? 0));
    setOpen(true);
  };

  const resetForm = () => {
    setEditing(null);
    setImageUrl("");
    setImageFile(null);
    setOrder("");
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFile) {
        const fd = new FormData();
        fd.append("file", imageFile);
        const { url } = await apiUpload("/v1/files/upload?folder=zodiacs", fd);
        finalImageUrl = url;
      }

      const payload: Record<string, unknown> = {};
      if (finalImageUrl !== "") payload.imageUrl = finalImageUrl;
      if (order !== "") payload.order = parseInt(order, 10);

      await apiFetch(`/v1/admin/zodiacs/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      toast.success("Updated");
      setOpen(false);
      resetForm();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error}</p>
        <p className="text-sm text-muted-foreground">
          Ensure the API is running and NEXT_PUBLIC_API_URL in .env.local is correct.
        </p>
        <Button onClick={load}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.name}` : "Edit Zodiac"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Image</Label>
              <div className="flex gap-2 items-center">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > MAX_UPLOAD_SIZE_BYTES) {
                        toast.error(
                          `Image is too large. Please keep it under ${MAX_UPLOAD_SIZE_MB}MB.`
                        );
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        return;
                      }
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setImageFile(null)}
                  >
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
              {!!editing?.imageUrl && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={imageFile ? URL.createObjectURL(imageFile) : (imageUrl || editing.imageUrl)}
                    alt={editing.name}
                    className="h-12 w-12 rounded bg-muted object-contain p-1"
                  />
                  <p className="text-xs text-muted-foreground break-all">
                    {imageFile ? "Preview (upload)" : (imageUrl || editing.imageUrl)}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="order">Order</Label>
              <Input
                id="order"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="1"
                inputMode="numeric"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[120px]">Order</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((z) => (
              <TableRow key={z.id}>
                <TableCell>
                  {z.imageUrl ? (
                    <img
                      src={z.imageUrl}
                      alt={z.name}
                      className="h-10 w-10 rounded bg-muted object-contain p-1"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{z.name}</TableCell>
                <TableCell>{z.order ?? 0}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => openEdit(z)}>
                    Edit
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

