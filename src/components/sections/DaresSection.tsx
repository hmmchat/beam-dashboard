"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
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

type Dare = {
  id: string;
  dareId: string;
  text: string;
  category: string | null;
  isActive: boolean;
  order: number | null;
  createdAt: string;
  updatedAt: string;
};

export function DaresSection() {
  const [items, setItems] = useState<Dare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dare | null>(null);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [order, setOrder] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ ok: boolean; dares: Dare[] }>(
        "/v1/streaming/admin/dares"
      );
      setItems(res.dares || []);
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
    setCategory("");
    setOrder("");
    setIsActive(true);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (item: Dare) => {
    setEditing(item);
    setText(item.text);
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
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        text: text.trim(),
        category: category.trim() || undefined,
        isActive: editing ? isActive : true,
      };
      if (order !== "") payload.order = parseInt(order, 10);

      if (editing) {
        await apiFetch(`/v1/streaming/admin/dares/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Updated");
      } else {
        await apiFetch("/v1/streaming/admin/dares", {
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
      await apiFetch(`/v1/streaming/admin/dares/${id}`, { method: "DELETE" });
      toast.success("Deactivated");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to deactivate");
    } finally {
      setDeleteId(null);
    }
  };

  const handleHardDelete = async (id: string) => {
    if (!confirm("Permanently delete this dare?")) return;
    setHardDeleteId(id);
    try {
      await apiFetch(`/v1/streaming/admin/dares/${id}/hard`, { method: "DELETE" });
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
        <Button onClick={() => { openCreate(); setOpen(true); }}>Add Dare</Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Dare" : "Add Dare"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="text">Text</Label>
              <Input
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Do your best dance move"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. fun"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order">Order</Label>
              <Input
                id="order"
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="12"
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
              <TableHead>Dare ID</TableHead>
              <TableHead>Text</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-48">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.dareId}</TableCell>
                <TableCell>{item.text}</TableCell>
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
