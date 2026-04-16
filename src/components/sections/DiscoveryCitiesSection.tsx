"use client";

import { useEffect, useState, useRef, useMemo } from "react";
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

export type DiscoveryCityOption = {
  id: string;
  value: string;
  label: string;
  order: number | null;
  isActive: boolean;
  faceCardImageUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export function DiscoveryCitiesSection() {
  const [items, setItems] = useState<DiscoveryCityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiscoveryCityOption | null>(null);
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [order, setOrder] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [faceUrl, setFaceUrl] = useState("");
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ ok: boolean; options: DiscoveryCityOption[] }>(
        "/v1/admin/discovery-city-options"
      );
      const list = res.options || [];
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

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setValue("");
    setLabel("");
    setOrder("");
    setIsActive(true);
    setFaceUrl("");
    setFaceFile(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (item: DiscoveryCityOption) => {
    setEditing(item);
    setValue(item.value);
    setLabel(item.label);
    setOrder(item.order != null ? String(item.order) : "");
    setIsActive(item.isActive);
    setFaceUrl(item.faceCardImageUrl || "");
    setFaceFile(null);
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

  const handleSave = async () => {
    if (!label.trim()) {
      toast.error("Label is required");
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

      if (editing) {
        const body: Record<string, unknown> = {
          label: label.trim(),
          isActive,
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
        toast.success("Updated");
      } else {
        await apiFetch("/v1/admin/discovery-city-options", {
          method: "POST",
          body: JSON.stringify({
            value: value.trim(),
            label: label.trim(),
            order: orderNum,
            isActive,
            faceCardImageUrl: finalFace ?? null,
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-3xl">
        These options power the website <strong>preferred city</strong> dropdown and which cities appear as{" "}
        <strong>LOCATION</strong> discovery promos. <code className="text-xs bg-muted px-1 rounded">value</code> must
        match <code className="text-xs bg-muted px-1 rounded">users.preferredCity</code> and your live metrics city
        strings (e.g. Bengaluru vs Bangalore). Upload a <strong>face card image</strong> for each city; for{" "}
        <strong>Anywhere in India</strong>, edit the built-in row and set the image — it is shown when the global
        &quot;anywhere&quot; LOCATION card appears in discovery.
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
              <TableHead className="w-20">Order</TableHead>
              <TableHead className="w-24">Active</TableHead>
              <TableHead className="w-28">Face card</TableHead>
              <TableHead className="w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.value}</TableCell>
                <TableCell>{item.label}</TableCell>
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
