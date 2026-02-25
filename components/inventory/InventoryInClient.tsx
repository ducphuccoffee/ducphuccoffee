"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { InventoryInHistoryRow, Item, Supplier } from "@/lib/types";

function money(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0));
}

function nowLocalInputValue() {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function InventoryInClient({
  initialSuppliers,
  initialGreenItems,
  initialHistory,
  error: initialError,
}: {
  initialSuppliers: Supplier[];
  initialGreenItems: Item[];
  initialHistory: InventoryInHistoryRow[];
  error: string | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [greenItems, setGreenItems] = useState<Item[]>(initialGreenItems);

  const [form, setForm] = useState({
    purchased_at: nowLocalInputValue(),
    lot_code: "",
    supplier_id: initialSuppliers?.[0]?.id || "",
    item_id: initialGreenItems?.[0]?.id || "",
    qty_kg: 0,
    unit_price: 0,
    new_supplier_name: "",
    new_supplier_phone: "",
    new_item_name: "",
  });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return initialHistory;
    return initialHistory.filter((r) => {
      return (
        (r.lot_code || "").toLowerCase().includes(s) ||
        (r.supplier_name || "").toLowerCase().includes(s) ||
        (r.item_name || "").toLowerCase().includes(s)
      );
    });
  }, [initialHistory, q]);

  function openCreate() {
    setError(null);
    setForm((f) => ({
      ...f,
      purchased_at: nowLocalInputValue(),
      lot_code: "",
      qty_kg: 0,
      unit_price: 0,
      new_supplier_name: "",
      new_supplier_phone: "",
      new_item_name: "",
      supplier_id: suppliers?.[0]?.id || "",
      item_id: greenItems?.[0]?.id || "",
    }));
    setOpen(true);
  }

  async function addSupplier() {
    const name = form.new_supplier_name.trim();
    const phone = form.new_supplier_phone.trim() || null;
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create supplier failed");
      const created: Supplier = json.data;
      setSuppliers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, supplier_id: created.id, new_supplier_name: "", new_supplier_phone: "" }));
    } catch (e: any) {
      setError(e.message || "Create type failed");
    } finally {
      setSaving(false);
    }
  }

  async function addGreenItem() {
    const name = form.new_item_name.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/items/green", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create item failed");
      const created: Item = json.data;
      setGreenItems((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, item_id: created.id, new_item_name: "" }));
    } catch (e: any) {
      setError(e.message || "Create item failed");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        purchased_at: new Date(form.purchased_at).toISOString(),
        lot_code: form.lot_code || null,
        supplier_id: form.supplier_id || null,
        item_id: form.item_id,
        qty_kg: Number(form.qty_kg || 0),
        unit_price: Number(form.unit_price || 0),
      };
      const res = await fetch("/api/inventory-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input placeholder="Tìm theo số lô hoặc loại..." value={q} onChange={(e) => setQ(e.target.value)} className="w-[min(420px,100%)]" />
        <Button onClick={openCreate}>+ Nhập hàng</Button>
      </div>

      {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Số lô</th>
              <th className="px-4 py-3">Nhà cung cấp</th>
              <th className="px-4 py-3">Loại nhân</th>
              <th className="px-4 py-3">Kg</th>
              <th className="px-4 py-3">Đơn giá</th>
              <th className="px-4 py-3">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 text-zinc-600">{new Date(r.purchased_at).toLocaleString("vi-VN")}</td>
                <td className="px-4 py-3 font-medium">{r.lot_code}</td>
                <td className="px-4 py-3"><Badge>{r.supplier_name || "-"}</Badge></td>
                <td className="px-4 py-3"><Badge>{r.item_name || "-"}</Badge></td>
                <td className="px-4 py-3">{Number(r.qty_kg || 0).toFixed(2)}</td>
                <td className="px-4 py-3">{money(Number(r.unit_price || 0))}</td>
                <td className="px-4 py-3">{money(Number(r.line_total || 0))}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">Chưa có phiếu nhập</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nhập hàng nhân xanh"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Huỷ</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-600">Thời gian</label>
            <Input type="datetime-local" value={form.purchased_at} onChange={(e) => setForm({ ...form, purchased_at: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Số lô (để trống tự tạo)</label>
            <Input value={form.lot_code} onChange={(e) => setForm({ ...form, lot_code: e.target.value })} placeholder="LOT-..." />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600">Nhà cung cấp</label>
            <div className="mt-1 flex gap-2">
              <select className="w-full rounded-xl border px-3 py-2 text-sm" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Button variant="secondary" onClick={addSupplier} disabled={saving || !form.new_supplier_name.trim()}>+</Button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input value={form.new_supplier_name} onChange={(e) => setForm({ ...form, new_supplier_name: e.target.value })} placeholder="Thêm NCC... (nhập tên rồi bấm +)" />
              <Input value={form.new_supplier_phone} onChange={(e) => setForm({ ...form, new_supplier_phone: e.target.value })} placeholder="SĐT (tuỳ chọn)" />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600">Loại cà phê nhân xanh</label>
            <div className="mt-1 flex gap-2">
              <select className="w-full rounded-xl border px-3 py-2 text-sm" value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })}>
                {greenItems.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <Button variant="secondary" onClick={addGreenItem} disabled={saving || !form.new_item_name.trim()}>+</Button>
            </div>
            <div className="mt-2">
              <Input value={form.new_item_name} onChange={(e) => setForm({ ...form, new_item_name: e.target.value })} placeholder="Thêm loại nhân mới... (nhập tên rồi bấm +)" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Số kg</label>
            <Input type="number" value={form.qty_kg} onChange={(e) => setForm({ ...form, qty_kg: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Đơn giá (VND/kg)</label>
            <Input type="number" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} />
          </div>
          <div className="sm:col-span-2 text-sm text-zinc-600">
            Thành tiền: <span className="font-semibold">{money(Number(form.qty_kg || 0) * Number(form.unit_price || 0))} VND</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
