"use client";

import { useEffect, useMemo, useState } from "react";

type Supplier = { id: string; name: string; phone?: string | null };
type GreenItem = { id: string; name: string; sku?: string | null };

type HistoryRow = {
  id: string;
  qty_kg: number;
  unit_price: number;
  line_total: number;
  created_at: string;
  purchases: {
    id: string;
    org_id?: string;
    purchased_at: string;
    supplier_id: string | null;
    supplier_name: string | null;
    note: string | null; // tạm dùng note làm lot_code
  };
  item: { id: string; name: string; sku: string; type: string };
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}
function fmtDT(iso: string) {
  return new Date(iso).toLocaleString("vi-VN");
}

export default function InventoryInPage() {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [greens, setGreens] = useState<GreenItem[]>([]);

  const [open, setOpen] = useState(false);

  const [purchasedAt, setPurchasedAt] = useState<string>(() => {
    const d = new Date();
    const pad = (x: number) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  });
  const [lotCode, setLotCode] = useState<string>("");

  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierNameFallback, setSupplierNameFallback] = useState<string>("");

  const [itemId, setItemId] = useState<string>("");
  const [qtyKg, setQtyKg] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadHistory() {
    setLoadingHistory(true);
    const res = await fetch("/api/inventory-in/history", { cache: "no-store" });
    const json = await res.json();
    setHistory(json.data ?? []);
    setLoadingHistory(false);
  }

  async function loadSuppliers() {
    const res = await fetch("/api/suppliers", { cache: "no-store" });
    const json = await res.json();
    setSuppliers(json.data ?? []);
  }

  async function loadGreens() {
    const res = await fetch("/api/items/green", { cache: "no-store" });
    const json = await res.json();
    setGreens(json.data ?? []);
  }

  useEffect(() => {
    loadHistory();
    loadSuppliers();
    loadGreens();
  }, []);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId) ?? null,
    [suppliers, supplierId]
  );

  const selectedGreen = useMemo(() => greens.find((g) => g.id === itemId) ?? null, [greens, itemId]);

  const computedTotal = useMemo(() => {
    const q = Number(qtyKg || 0);
    const p = Number(unitPrice || 0);
    if (!(q > 0 && p > 0)) return 0;
    return q * p;
  }, [qtyKg, unitPrice]);

  async function createSupplierQuick() {
    const name = prompt("Tên nhà cung cấp:");
    if (!name) return;
    const phone = prompt("Số điện thoại (có thể bỏ trống):") ?? "";

    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error ?? "Tạo nhà cung cấp thất bại");

    const created: Supplier = json.data;
    setSuppliers((prev) => [created, ...prev]);
    setSupplierId(created.id);
    setSupplierNameFallback("");
  }

  async function save() {
    setErr(null);

    if (!itemId) return setErr("Chọn loại nhân xanh");
    if (!qtyKg || !(Number(qtyKg) > 0)) return setErr("Nhập số kg > 0");
    if (!unitPrice || !(Number(unitPrice) > 0)) return setErr("Nhập đơn giá > 0");

    setSaving(true);
    const res = await fetch("/api/inventory-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchased_at: new Date(purchasedAt).toISOString(),
        lot_code: lotCode,
        supplier_id: supplierId || null,
        supplier_name: supplierId ? null : supplierNameFallback || null,
        item_id: itemId,
        qty_kg: Number(qtyKg),
        unit_price: Number(unitPrice),
      }),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) return setErr(json.error ?? "Lưu thất bại");

    setOpen(false);
    setLotCode("");
    setQtyKg("");
    setUnitPrice("");
    await loadHistory();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Nhập hàng nhân xanh</h1>
          <div className="text-sm text-gray-500">Lịch sử nhập hàng + tạo phiếu nhập theo lô</div>
        </div>

        <button
          type="button"
          onClick={() => {
            setErr(null);
            setOpen(true);
          }}
          className="h-10 rounded-md bg-black px-4 text-sm font-medium text-white"
        >
          Nhập hàng
        </button>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="border-b px-4 py-3 text-sm font-medium">Lịch sử nhập gần nhất</div>

        {loadingHistory ? (
          <div className="p-4 text-sm text-gray-500">Đang tải...</div>
        ) : history.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">Chưa có lịch sử nhập.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-2">Thời gian</th>
                  <th className="px-4 py-2">Số lô</th>
                  <th className="px-4 py-2">Nhà cung cấp</th>
                  <th className="px-4 py-2">Loại nhân</th>
                  <th className="px-4 py-2 text-right">Kg</th>
                  <th className="px-4 py-2 text-right">Đơn giá</th>
                  <th className="px-4 py-2 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 whitespace-nowrap">{fmtDT(r.purchases.purchased_at)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{r.purchases.note ?? "-"}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{r.purchases.supplier_name ?? "-"}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{r.item?.name ?? "-"}</td>
                    <td className="px-4 py-2 text-right">{r.qty_kg}</td>
                    <td className="px-4 py-2 text-right">{fmtMoney(r.unit_price)}</td>
                    <td className="px-4 py-2 text-right">{fmtMoney(r.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end border-t px-4 py-2">
          <button type="button" onClick={loadHistory} className="text-sm text-gray-600 underline">
            Làm mới
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-base font-semibold">Phiếu nhập nhân xanh</div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-sm hover:bg-gray-100">
                Đóng
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm">Ngày giờ</label>
                <input
                  type="datetime-local"
                  className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                  value={purchasedAt}
                  onChange={(e) => setPurchasedAt(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm">Số lô (để trống sẽ tự tạo)</label>
                <input
                  className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                  value={lotCode}
                  onChange={(e) => setLotCode(e.target.value)}
                  placeholder="VD: GB-20260224-113337-a1c2"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm">Nhà cung cấp</label>
                <div className="mt-1 flex gap-2">
                  <select
                    className="h-10 w-full rounded-md border px-3 text-sm"
                    value={supplierId}
                    onChange={(e) => {
                      setSupplierId(e.target.value);
                      setSupplierNameFallback("");
                    }}
                  >
                    <option value="">Chọn nhà cung cấp (hoặc nhập tay)</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="h-10 w-10 rounded-md border text-lg" onClick={createSupplierQuick}>
                    +
                  </button>
                </div>

                {!supplierId && (
                  <input
                    className="mt-2 h-10 w-full rounded-md border px-3 text-sm"
                    value={supplierNameFallback}
                    onChange={(e) => setSupplierNameFallback(e.target.value)}
                    placeholder="Hoặc nhập tên NCC (nếu chưa tạo)"
                  />
                )}

                {selectedSupplier && (
                  <div className="mt-1 text-xs text-gray-500">
                    Đã chọn: {selectedSupplier.name} {selectedSupplier.phone ? `(${selectedSupplier.phone})` : ""}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm">Loại cà phê nhân xanh</label>
                <select className="mt-1 h-10 w-full rounded-md border px-3 text-sm" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                  <option value="">Chọn loại nhân xanh</option>
                  {greens.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {selectedGreen && <div className="mt-1 text-xs text-gray-500">Đã chọn: {selectedGreen.name}</div>}
              </div>

              <div>
                <label className="text-sm">Số kg</label>
                <input
                  inputMode="decimal"
                  className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                  value={qtyKg}
                  onChange={(e) => setQtyKg(e.target.value)}
                  placeholder="VD: 100"
                />
              </div>

              <div>
                <label className="text-sm">Đơn giá (VND/kg)</label>
                <input
                  inputMode="numeric"
                  className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="VD: 80000"
                />
              </div>

              <div className="sm:col-span-2 rounded-md bg-gray-50 p-3 text-sm">
                Thành tiền: <span className="font-semibold">{fmtMoney(computedTotal)}</span> VND
              </div>

              {err && <div className="sm:col-span-2 text-sm text-red-600">{err}</div>}

              <div className="sm:col-span-2 flex gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="h-10 flex-1 rounded-md bg-black px-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="h-10 flex-1 rounded-md border px-3 text-sm">
                  Hủy
                </button>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  loadSuppliers();
                  loadGreens();
                }}
                className="text-sm text-gray-600 underline"
              >
                Làm mới danh sách
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}