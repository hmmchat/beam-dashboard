"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { apiFetch, apiUpload, IMAGE_UPLOAD_ACCEPT } from "@/lib/api";
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

type Brand = {
  id: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  category: string | null;
};

type CategoryOption = { name: string };

const FALLBACK_CATEGORIES: CategoryOption[] = [
  "Technology",
  "Arts and Entertainment",
  "Finance",
  "Food and Drink",
  "Vehicles",
  "Travel and tourism",
  "Shopping",
  "Fashion",
  "Sports",
  "Beauty",
  "Media",
  "Healthcare",
  "Gaming",
  "Education",
  "Music",
  "Telecom",
].map((name) => ({ name }));

export function BrandsSection() {
  const [items, setItems] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [domain, setDomain] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const brandsRes = await apiFetch<{ ok: boolean; brands: Brand[] }>("/v1/admin/brands");
      setItems(brandsRes.brands || []);
      try {
        const categoriesRes = await apiFetch<{ ok: boolean; categories: CategoryOption[] }>(
          "/v1/admin/brands/categories"
        );
        setCategories(categoriesRes.categories?.length ? categoriesRes.categories : FALLBACK_CATEGORIES);
      } catch {
        setCategories(FALLBACK_CATEGORIES);
      }
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
    setName("");
    setCategory("");
    setDomain("");
    setLogoUrl("");
    setLogoFile(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (item: Brand) => {
    setEditing(item);
    setName(item.name);
    setCategory(item.category || "");
    setDomain(item.domain || "");
    setLogoUrl(item.logoUrl || "");
    setLogoFile(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!category.trim()) {
      toast.error("Category is required");
      return;
    }
    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;
      if (logoFile) {
        const fd = new FormData();
        fd.append("file", logoFile);
        const { url } = await apiUpload("/v1/files/upload?folder=brand-logos", fd);
        finalLogoUrl = url;
      }
      const payload: Record<string, unknown> = {
        name: name.trim(),
        category: category.trim(),
        domain: domain.trim() || undefined,
      };
      if (finalLogoUrl) payload.logoUrl = finalLogoUrl;

      if (editing) {
        await apiFetch(`/v1/admin/brands/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Updated");
      } else {
        const res = await apiFetch<{ ok: boolean; updatedExisting?: boolean }>(
          "/v1/admin/brands",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );
        toast.success(
          res.updatedExisting
            ? "Name already existed (e.g. from Brandfetch) — updated logo/details instead"
            : "Created"
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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this brand? This will fail if users have it selected.")) return;
    setDeleteId(id);
    try {
      await apiFetch(`/v1/admin/brands/${id}`, { method: "DELETE" });
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
        <p className="text-sm text-muted-foreground">Ensure the API is running and NEXT_PUBLIC_API_URL in .env.local is correct.</p>
        <Button onClick={load}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Content-managed brands appear in category suggestions alongside Brandfetch results.
        Category is required so they can show under the right set in the app.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button onClick={() => { openCreate(); setOpen(true); }}>Add Brand</Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Brand" : "Add Brand"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spotify"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category (required)</Label>
              <select
                id="category"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a category…</option>
                {categories.map((opt) => (
                  <option key={opt.name} value={opt.name}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. spotify.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept={IMAGE_UPLOAD_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setLogoFile(f);
                      setLogoUrl("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoFile ? logoFile.name : "Upload image"}
                </Button>
                {logoFile && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLogoFile(null)}>
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Or paste URL:</p>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                disabled={!!logoFile}
              />
            </div>
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
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Logo</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.category || "—"}</TableCell>
                <TableCell>{item.domain || "—"}</TableCell>
                <TableCell>
                  {item.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.logoUrl} alt="" className="h-8 w-8 object-contain" />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>Edit</Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(item.id)}
                    disabled={deleteId === item.id}
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
