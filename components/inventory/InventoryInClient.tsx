"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { GreenInbound, GreenType } from "@/lib/types";

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

export function InventoryInClient({ initialTypes, initialInbounds }: { initialTypes: GreenType[]; initialInbounds: GreenInbound[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [types, setTypes] = useState<GreenType[]>(initialTypes);

  const [form, setForm] = useState({
    inbound_at: nowLocalInputValue(),
    lot_code: "",
    green_type_id: initialTypes?.[0]?.id || "",
    qty_kg: 0,
    unit_cost: 0,
    new_type_name: "",
  });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return initialInbounds;
    return initialInbounds.filter((r) => {
      return (
        (r.lot_code || "").toLowerCase().includes(s) ||
        (r.green_type_name || "").toLowerCase().includes(s)
      );
    });
  }, [initialInbounds, q]);

  function openCreate() {
    setError(null);
    setForm((f) => ({
      ...f,
      inbound_at: nowLocalInputValue(),
      lot_code: "",
      qty_kg: 0,
      unit_cost: 0,
      new_type_name: "",
      green_type_id: types?.[0]?.id || "",
    }));
    setOpen(true);
  }

  async function addType() {
    const name = form.new_type_name.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/green-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Create type failed");
      const created: GreenType = json.data;
      setTypes((prev) => [...prev, created]);
      setForm((f) => ({ ...f, green_type_id: created.id, new_type_name: "" }));
    } catch (e: any) {
      setError(e.message || "Create type failed");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        inbound_at: new Date(form.inbound_at).toISOString(),
        lot_code: form.lot_code || null,
        green_type_id: form.green_type_id,
        qty_kg: Number(form.qty_kg || 0),
        unit_cost: Number(form.unit_cost || 0),
      };
      const res = await fetch("/api/green-inbounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">Kg</th>
              <th className="px-4 py-3">Đơn giá</th>
              <th className="px-4 py-3">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 text-zinc-600">{new Date(r.inbound_at).toLocaleString("vi-VN")}</td>
                <td className="px-4 py-3 font-medium">{r.lot_code}</td>
                <td className="px-4 py-3"><Badge>{r.green_type_name || "-"}</Badge></td>
                <td className="px-4 py-3">{Number(r.qty_kg || 0).toFixed(2)}</td>
                <td className="px-4 py-3">{money(Number(r.unit_cost || 0))}</td>
                <td className="px-4 py-3">{money(Number(r.qty_kg || 0) * Number(r.unit_cost || 0))}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">Chưa có phiếu nhập</td>
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
            <Input type="datetime-local" value={form.inbound_at} onChange={(e) => setForm({ ...form, inbound_at: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Số lô (để trống tự tạo)</label>
            <Input value={form.lot_code} onChange={(e) => setForm({ ...form, lot_code: e.target.value })} placeholder="LOT-..." />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600">Cà phê nhân xanh</label>
            <div className="mt-1 flex gap-2">
              <select className="w-full rounded-xl border px-3 py-2 text-sm" value={form.green_type_id} onChange={(e) => setForm({ ...form, green_type_id: e.target.value })}>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <Button variant="secondary" onClick={addType} disabled={saving || !form.new_type_name.trim()}>+</Button>
            </div>
            <div className="mt-2">
              <Input value={form.new_type_name} onChange={(e) => setForm({ ...form, new_type_name: e.target.value })} placeholder="Thêm loại mới... (nhập tên rồi bấm +)" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Số kg</label>
            <Input type="number" value={form.qty_kg} onChange={(e) => setForm({ ...form, qty_kg: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Đơn giá (VND/kg)</label>
            <Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
