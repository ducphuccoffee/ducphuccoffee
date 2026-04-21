"use client";
import { formatDateVN } from "@/lib/date";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pencil, Trash2 } from "lucide-react";

function money(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export type GreenType = { id: string; name: string };
export type Supplier = { id: string; name: string };
export type GreenInbound = {
  id: string;
  inbound_at: string;
  lot_code: string;
  green_type_id: string;
  green_type_name: string;
  qty_kg: number;
  unit_cost: number;
  line_total: number;
  remaining_kg?: number;
  supplier_id?: string | null;
  supplier_name?: string | null;
};

export function InventoryInClient({
  initialInbounds,
  initialGreenTypes,
  initialSuppliers,
  error: initialError,
}: {
  initialInbounds: GreenInbound[];
  initialGreenTypes: GreenType[];
  initialSuppliers: Supplier[];
  error: string | null;
}) {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [greenTypes, setGreenTypes] = useState<GreenType[]>(initialGreenTypes);

  const [openAddType, setOpenAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const [form, setForm] = useState({
    inbound_at: today(),
    lot_code: "",
    green_type_id: initialGreenTypes?.[0]?.id || "",
    qty_kg: "",
    unit_cost: "",
    supplier_id: "",
  });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return initialInbounds;
    return initialInbounds.filter((r) =>
      (r.lot_code || "").toLowerCase().includes(s) ||
      (r.green_type_name || "").toLowerCase().includes(s) ||
      (r.supplier_name || "").toLowerCase().includes(s)
    );
  }, [initialInbounds, q]);

  const total = Number(form.qty_kg || 0) * Number(form.unit_cost || 0);

  const stockSummary = useMemo(() => {
    const map: Record<string, { name: string; remaining: number }> = {};
    for (const r of initialInbounds) {
      if (!map[r.green_type_id]) map[r.green_type_id] = { name: r.green_type_name, remaining: 0 };
      map[r.green_type_id].remaining += Number(r.remaining_kg ?? r.qty_kg ?? 0);
    }
    return Object.values(map);
  }, [initialInbounds]);

  function openCreate() {
    setError(null);
    setEditId(null);
    setForm({
      inbound_at: today(),
      lot_code: "",
      green_type_id: greenTypes?.[0]?.id || "",
      qty_kg: "",
      unit_cost: "",
      supplier_id: "",
    });
    setOpen(true);
  }

  function openEdit(r: GreenInbound) {
    setError(null);
    setEditId(r.id);
    setForm({
      inbound_at: r.inbound_at?.slice(0, 10) || today(),
      lot_code: r.lot_code || "",
      green_type_id: r.green_type_id || "",
      qty_kg: String(r.qty_kg || ""),
      unit_cost: String(r.unit_cost || ""),
      supplier_id: r.supplier_id || "",
    });
    setOpen(true);
  }

  async function addGreenType() {
    const name = newTypeName.trim();
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
      if (!res.ok) throw new Error(json.error || "Tạo loại nhân thất bại");
      const created: GreenType = json.data;
      setGreenTypes((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, green_type_id: created.id }));
      setNewTypeName("");
      setOpenAddType(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        inbound_at: form.inbound_at || today(),
        lot_code: form.lot_code.trim() || null,
        green_type_id: form.green_type_id,
        qty_kg: Number(form.qty_kg || 0),
        unit_cost: Number(form.unit_cost || 0),
        supplier_id: form.supplier_id || null,
      };
      if (!payload.green_type_id) throw new Error("Vui lòng chọn loại nhân");
      if (!(payload.qty_kg > 0)) throw new Error("Số kg phải lớn hơn 0");
      if (!(payload.unit_cost > 0)) throw new Error("Đơn giá phải lớn hơn 0");

      const url = editId ? `/api/green-inbounds?id=${editId}` : "/api/green-inbounds";
      const method = editId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lưu thất bại");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, lotCode: string) {
    if (!confirm(`Xoá lô ${lotCode}? Không thể hoàn tác.`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/green-inbounds?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Xoá thất bại");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      {stockSummary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stockSummary.map((s) => (
            <div key={s.name} className="rounded-xl border bg-white p-3">
              <div className="text-xs text-gray-500 truncate">{s.name}</div>
              <div className="mt-1 text-xl font-bold text-emerald-600">
                {Number(s.remaining).toFixed(1)} kg
              </div>
              <div className="text-xs text-gray-400">còn tồn</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 justify-between">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo số lô, loại nhân, NCC..."
          className="w-[min(420px,100%)]"
        />
        <Button type="button" onClick={openCreate}>
          + Nhập lô nhân
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{r.green_type_name}</div>
                <div className="mt-0.5 text-xs text-gray-500 font-mono truncate">{r.lot_code}</div>
                {r.supplier_name && (
                  <div className="text-xs text-gray-400 truncate">NCC: {r.supplier_name}</div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold">{Number(r.qty_kg).toFixed(2)} kg</div>
                <div className="text-xs text-gray-500">{money(Number(r.unit_cost))}/kg</div>
              </div>
            </div>
            <div className="mt-2 flex justify-between items-center text-xs text-gray-500">
              <span>{formatDateVN(r.inbound_at)}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">{money(Number(r.line_total || r.qty_kg * r.unit_cost))}</span>
                <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-blue-600" title="Sửa">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(r.id, r.lot_code)} className="text-gray-400 hover:text-red-600" title="Xoá">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">Chưa có lô nhân nào</div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border bg-white overflow-hidden">
        <div className="grid grid-cols-9 gap-2 px-3 py-2 text-xs font-semibold text-gray-500 border-b bg-gray-50">
          <div>Ngày nhập</div>
          <div>Số lô</div>
          <div>Loại nhân</div>
          <div>NCC</div>
          <div className="text-right">Số kg</div>
          <div className="text-right">Đơn giá</div>
          <div className="text-right">Thành tiền</div>
          <div className="text-right">Còn tồn</div>
          <div className="text-center">Thao tác</div>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-9 gap-2 px-3 py-2.5 text-sm border-b last:border-b-0 hover:bg-gray-50">
            <div className="text-gray-600">{formatDateVN(r.inbound_at)}</div>
            <div className="font-mono text-xs text-gray-600 truncate">{r.lot_code}</div>
            <div className="font-medium truncate">{r.green_type_name}</div>
            <div className="text-gray-500 truncate">{r.supplier_name || "—"}</div>
            <div className="text-right">{Number(r.qty_kg).toFixed(2)}</div>
            <div className="text-right">{money(Number(r.unit_cost))}</div>
            <div className="text-right font-medium">{money(Number(r.line_total || r.qty_kg * r.unit_cost))}</div>
            <div className="text-right font-medium text-emerald-600">{Number(r.remaining_kg ?? 0).toFixed(1)}</div>
            <div className="flex justify-center gap-1">
              <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-blue-600 p-1" title="Sửa">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDelete(r.id, r.lot_code)} className="text-gray-400 hover:text-red-600 p-1" title="Xoá">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="p-4 text-sm text-gray-500">Chưa có lô nhân nào</div>
        )}
      </div>

      {/* Modal nhập/sửa lô */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Sửa lô nhân xanh" : "Nhập lô nhân xanh"}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setOpen(false)} disabled={saving}>Huỷ</Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div>
            <div className="text-sm mb-1">Ngày nhập</div>
            <Input
              type="date"
              value={form.inbound_at}
              onChange={(e) => setForm({ ...form, inbound_at: e.target.value })}
            />
          </div>
          <div>
            <div className="text-sm mb-1">Số lô (để trống tự tạo)</div>
            <Input
              value={form.lot_code}
              onChange={(e) => setForm({ ...form, lot_code: e.target.value })}
              placeholder="VD: LOT-2026-001"
            />
          </div>
          <div>
            <div className="text-sm mb-1">Loại nhân xanh</div>
            <div className="flex gap-2">
              <select
                className="h-10 w-full rounded-md border px-3 text-sm"
                value={form.green_type_id}
                onChange={(e) => setForm({ ...form, green_type_id: e.target.value })}
              >
                <option value="">-- Chọn loại nhân --</option>
                {greenTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <Button type="button" variant="ghost" className="px-3" onClick={() => setOpenAddType(true)} title="Thêm loại">+</Button>
            </div>
          </div>
          <div>
            <div className="text-sm mb-1">Nhà cung cấp</div>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.supplier_id}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            >
              <option value="">-- Không chọn --</option>
              {initialSuppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-sm mb-1">Số kg</div>
              <Input
                type="number"
                inputMode="decimal"
                value={form.qty_kg}
                onChange={(e) => setForm({ ...form, qty_kg: e.target.value })}
                placeholder="VD: 60"
              />
            </div>
            <div>
              <div className="text-sm mb-1">Đơn giá (VND/kg)</div>
              <Input
                type="number"
                inputMode="numeric"
                value={form.unit_cost}
                onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                placeholder="VD: 105000"
              />
            </div>
          </div>
          {total > 0 && (
            <div className="text-sm text-gray-600">
              Thành tiền: <b className="text-gray-900">{money(total)} VND</b>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal thêm loại nhân */}
      <Modal
        open={openAddType}
        onClose={() => setOpenAddType(false)}
        title="Thêm loại nhân xanh"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setOpenAddType(false)} disabled={saving}>Huỷ</Button>
            <Button type="button" onClick={addGreenType} disabled={saving || !newTypeName.trim()}>
              {saving ? "Đang lưu..." : "Thêm"}
            </Button>
          </div>
        }
      >
        <div>
          <div className="text-sm mb-1">Tên loại nhân</div>
          <Input
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder="VD: Arabica Cầu Đất S18"
          />
        </div>
      </Modal>
    </div>
  );
}
