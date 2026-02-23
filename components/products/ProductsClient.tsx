"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import type { Product } from "@/lib/types";

const emptyForm = {
  id: "",
  name: "",
  sku: "",
  type: "raw" as Product["type"],
  unit: "kg",
  cost_price: 0,
  sell_price: 0,
  is_active: true,
};

function money(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0));
}

export function ProductsClient({ initial }: { initial: Product[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return initial;
    return initial.filter((p) => (p.name || "").toLowerCase().includes(s) || (p.sku || "").toLowerCase().includes(s));
  }, [initial, q]);

  function openCreate() {
    setError(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setError(null);
    setForm({
      id: p.id,
      name: p.name || "",
      sku: p.sku || "",
      type: p.type,
      unit: p.unit || "",
      cost_price: Number(p.cost_price || 0),
      sell_price: Number(p.sell_price || 0),
      is_active: !!p.is_active,
    });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        name: form.name,
        sku: form.sku || null,
        type: form.type,
        unit: form.unit || null,
        cost_price: Number(form.cost_price || 0),
        sell_price: Number(form.sell_price || 0),
        is_active: !!form.is_active,
      };

      const res = await fetch("/api/products", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.id ? { id: form.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Save failed");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Delete failed");
      setConfirmId(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Input placeholder="Tìm theo tên hoặc SKU..." value={q} onChange={(e) => setQ(e.target.value)} className="w-[min(420px,100%)]" />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate}>+ Thêm sản phẩm</Button>
        </div>
      </div>

      {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">ĐVT</th>
              <th className="px-4 py-3">Giá bán</th>
              <th className="px-4 py-3">Giá vốn</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-zinc-600">{p.sku || "-"}</td>
                <td className="px-4 py-3">
                  <Badge>{p.type}</Badge>
                </td>
                <td className="px-4 py-3 text-zinc-600">{p.unit || "-"}</td>
                <td className="px-4 py-3">{money(Number(p.sell_price || 0))}</td>
                <td className="px-4 py-3">{money(Number(p.cost_price || 0))}</td>
                <td className="px-4 py-3">{p.is_active ? <Badge>active</Badge> : <Badge>inactive</Badge>}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Button variant="secondary" onClick={() => openEdit(p)}>
                      Sửa
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmId(p.id)}>
                      Xoá
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                  Không có dữ liệu
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Sửa sản phẩm" : "Thêm sản phẩm"}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Huỷ
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600">Tên</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Arabica Đà Lạt" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">SKU</label>
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="RAW-..." />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Loại</label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as any })}
            >
              <option value="raw">raw (nguyên liệu)</option>
              <option value="finished">finished (thành phẩm)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">ĐVT</label>
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg / bag / box..." />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Giá vốn</label>
            <Input
              type="number"
              value={form.cost_price}
              onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Giá bán</label>
            <Input
              type="number"
              value={form.sell_price}
              onChange={(e) => setForm({ ...form, sell_price: Number(e.target.value) })}
              placeholder="0"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="is_active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <label htmlFor="is_active" className="text-sm text-zinc-700">
              Đang hoạt động
            </label>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        title="Xoá sản phẩm?"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmId(null)} disabled={saving}>
              Huỷ
            </Button>
            <Button onClick={() => confirmId && remove(confirmId)} disabled={saving}>
              {saving ? "Đang xoá..." : "Xoá"}
            </Button>
          </div>
        }
      >
        <div className="text-sm text-zinc-700">Hành động này không thể hoàn tác.</div>
      </Modal>
    </div>
  );
}
