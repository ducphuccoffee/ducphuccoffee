"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
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

  // MODAL con: thêm NCC / thêm loại nhân
  const [openAddSupplier, setOpenAddSupplier] = useState(false);
  const [openAddItem, setOpenAddItem] = useState(false);

  const [newSupplier, setNewSupplier] = useState({ name: "", phone: "" });
  const [newItem, setNewItem] = useState({ name: "" });

  // qty_kg & unit_price dùng string để xoá trắng được
  const [form, setForm] = useState<{
    purchased_at: string;
    lot_code: string;
    supplier_id: string;
    item_id: string;
    qty_kg: string;
    unit_price: string;
  }>({
    purchased_at: nowLocalInputValue(),
    lot_code: "",
    supplier_id: initialSuppliers?.[0]?.id || "",
    item_id: initialGreenItems?.[0]?.id || "",
    qty_kg: "",
    unit_price: "",
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
    setForm({
      purchased_at: nowLocalInputValue(),
      lot_code: "",
      supplier_id: suppliers?.[0]?.id || "",
      item_id: greenItems?.[0]?.id || "",
      qty_kg: "",
      unit_price: "",
    });
    setNewSupplier({ name: "", phone: "" });
    setNewItem({ name: "" });
    setOpen(true);
  }

  async function addSupplier() {
    const name = newSupplier.name.trim();
    const phone = newSupplier.phone.trim() || null;
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

      setSuppliers((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setForm((f) => ({ ...f, supplier_id: created.id }));

      setNewSupplier({ name: "", phone: "" });
      setOpenAddSupplier(false);
    } catch (e: any) {
      setError(e.message || "Create supplier failed");
    } finally {
      setSaving(false);
    }
  }

  async function addGreenItem() {
    const name = newItem.name.trim();
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

      setGreenItems((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setForm((f) => ({ ...f, item_id: created.id }));

      setNewItem({ name: "" });
      setOpenAddItem(false);
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

  const total = Number(form.qty_kg || 0) * Number(form.unit_price || 0);

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 justify-between">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo số lô hoặc loại..."
          className="w-[min(420px,100%)]"
        />
        <Button type="button" onClick={openCreate}>
          + Nhập hàng
        </Button>
      </div>

      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* ✅ Mobile cards */}
      <div className="mt-4 md:hidden space-y-2">
        {rows.map((r) => (
          <div
            key={`${r.purchase_id}-${r.line_id}`}
            className="rounded-xl border bg-white p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{r.item_name || "-"}</div>
                <div className="mt-0.5 text-xs text-gray-600 truncate">
                  {r.supplier_name || "-"}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold">
                  {Number(r.qty_kg || 0).toFixed(2)} kg
                </div>
                <div className="text-xs text-gray-600">
                  {money(Number(r.unit_price || 0))}/kg
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
              <div className="truncate">
                {new Date(r.purchased_at).toLocaleString("vi-VN")}
              </div>
              <div className="font-semibold text-gray-900">
                {money(Number(r.line_total || 0))}
              </div>
            </div>

            {r.lot_code ? (
              <div className="mt-1 text-xs text-gray-600 font-mono truncate">
                {r.lot_code}
              </div>
            ) : null}
          </div>
        ))}

        {rows.length === 0 ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
            Chưa có phiếu nhập
          </div>
        ) : null}
      </div>

      {/* ✅ Desktop table */}
      <div className="mt-4 hidden md:block rounded-lg border bg-white overflow-hidden">
        <div className="grid grid-cols-7 gap-2 px-3 py-2 text-xs font-semibold text-gray-600 border-b">
          <div>Thời gian</div>
          <div>Số lô</div>
          <div>Nhà cung cấp</div>
          <div>Loại nhân</div>
          <div className="text-right">Kg</div>
          <div className="text-right">Đơn giá</div>
          <div className="text-right">Thành tiền</div>
        </div>

        {rows.map((r) => (
          <div
            key={`${r.purchase_id}-${r.line_id}`}
            className="grid grid-cols-7 gap-2 px-3 py-2 text-sm border-b last:border-b-0"
          >
            <div className="text-gray-700">
              {new Date(r.purchased_at).toLocaleString("vi-VN")}
            </div>
            <div className="font-mono text-xs">{r.lot_code}</div>
            <div>{r.supplier_name || "-"}</div>
            <div>{r.item_name || "-"}</div>
            <div className="text-right">{Number(r.qty_kg || 0).toFixed(2)}</div>
            <div className="text-right">{money(Number(r.unit_price || 0))}</div>
            <div className="text-right">{money(Number(r.line_total || 0))}</div>
          </div>
        ))}

        {rows.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">Chưa có phiếu nhập</div>
        ) : null}
      </div>

      {/* Modal chính */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nhập hàng nhân xanh"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setOpen(false)} disabled={saving}>
              Huỷ
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div>
            <div className="text-sm mb-1">Thời gian</div>
            <Input
              type="datetime-local"
              value={form.purchased_at}
              onChange={(e) => setForm({ ...form, purchased_at: e.target.value })}
            />
          </div>

          <div>
            <div className="text-sm mb-1">Số lô (để trống tự tạo)</div>
            <Input
              value={form.lot_code}
              onChange={(e) => setForm({ ...form, lot_code: e.target.value })}
              placeholder="LOT-..."
            />
          </div>

          <div>
            <div className="text-sm mb-1">Nhà cung cấp</div>
            <div className="flex items-center gap-2">
              <select
                className="h-10 w-full rounded-md border px-3"
                value={form.supplier_id}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="ghost"
                className="px-3"
                onClick={() => setOpenAddSupplier(true)}
                aria-label="Thêm nhà cung cấp"
                title="Thêm nhà cung cấp"
              >
                +
              </Button>
            </div>
          </div>

          <div>
            <div className="text-sm mb-1">Loại cà phê nhân xanh</div>
            <div className="flex items-center gap-2">
              <select
                className="h-10 w-full rounded-md border px-3"
                value={form.item_id}
                onChange={(e) => setForm({ ...form, item_id: e.target.value })}
              >
                {greenItems.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="ghost"
                className="px-3"
                onClick={() => setOpenAddItem(true)}
                aria-label="Thêm loại nhân"
                title="Thêm loại nhân"
              >
                +
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <div className="text-sm mb-1">Số kg</div>
              <Input
                type="number"
                inputMode="numeric"
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
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                placeholder="VD: 105000"
              />
            </div>
          </div>

          <div className="text-sm">
            Thành tiền: <b>{money(total)}</b> VND
          </div>
        </div>
      </Modal>

      {/* Modal con: Thêm NCC */}
      <Modal
        open={openAddSupplier}
        onClose={() => setOpenAddSupplier(false)}
        title="Thêm nhà cung cấp"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setOpenAddSupplier(false)} disabled={saving}>
              Huỷ
            </Button>
            <Button
              type="button"
              onClick={addSupplier}
              disabled={saving || !newSupplier.name.trim()}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div>
            <div className="text-sm mb-1">Tên nhà cung cấp</div>
            <Input
              value={newSupplier.name}
              onChange={(e) => setNewSupplier((s) => ({ ...s, name: e.target.value }))}
              placeholder="VD: Hoàng Thắng Coffee"
            />
          </div>
          <div>
            <div className="text-sm mb-1">SĐT (tuỳ chọn)</div>
            <Input
              value={newSupplier.phone}
              onChange={(e) => setNewSupplier((s) => ({ ...s, phone: e.target.value }))}
              placeholder="VD: 09xxxxxxx"
            />
          </div>
        </div>
      </Modal>

      {/* Modal con: Thêm loại nhân */}
      <Modal
        open={openAddItem}
        onClose={() => setOpenAddItem(false)}
        title="Thêm loại nhân xanh"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setOpenAddItem(false)} disabled={saving}>
              Huỷ
            </Button>
            <Button
              type="button"
              onClick={addGreenItem}
              disabled={saving || !newItem.name.trim()}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div>
            <div className="text-sm mb-1">Tên loại nhân</div>
            <Input
              value={newItem.name}
              onChange={(e) => setNewItem({ name: e.target.value })}
              placeholder="VD: Arabica S18"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}