"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(n) || 0);

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  delivered: "Đã giao",
  cancelled: "Đã huỷ",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export type OrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  unit: string;
  qty: number;
  unit_price: number;
  subtotal: number;
};

export type Order = {
  id: string;
  order_code: string;
  customer_name: string;
  customer_phone?: string | null;
  status: string;
  note?: string | null;
  total_amount: number;
  created_at: string;
  order_items?: OrderItem[];
};

export type Product = {
  id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  price: number;
};

type ItemRow = { product_id: string; product_name: string; unit: string; qty: string; unit_price: string };

const emptyItem = (products: Product[]): ItemRow => ({
  product_id: products[0]?.id || "",
  product_name: products[0]?.name || "",
  unit: products[0]?.unit || "kg",
  qty: "1",
  unit_price: String(products[0]?.price || ""),
});

type Props = { initialOrders: Order[]; products: Product[] };

export function OrdersClient({ initialOrders, products }: Props) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemRow[]>([emptyItem(products)]);

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((o) =>
      o.order_code.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      (o.customer_phone || "").includes(q)
    );
    return list;
  }, [orders, search, statusFilter]);

  const totalCalc = useMemo(() =>
    items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0),
    [items]
  );

  function openCreate() {
    setCustomerName(""); setCustomerPhone(""); setNote("");
    setItems([emptyItem(products)]);
    setFormError(null);
    setShowModal(true);
  }

  function updateItem(i: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  }

  function pickProduct(i: number, pid: string) {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    updateItem(i, { product_id: p.id, product_name: p.name, unit: p.unit || "kg", unit_price: String(p.price) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!customerName.trim()) { setFormError("Vui lòng nhập tên khách hàng"); return; }
    const validItems = items.filter((i) => i.product_id && Number(i.qty) > 0);
    if (!validItems.length) { setFormError("Cần ít nhất 1 sản phẩm hợp lệ"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || null,
          note: note.trim() || null,
          items: validItems.map((i) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            unit: i.unit,
            qty: Number(i.qty),
            unit_price: Number(i.unit_price) || 0,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setFormError(json.error ?? "Lỗi tạo đơn hàng"); return; }
      setShowModal(false);
      router.refresh();
    } catch { setFormError("Lỗi kết nối"); }
    finally { setSaving(false); }
  }

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch(`/api/orders?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok || json.error) { alert(json.error ?? "Lỗi cập nhật"); return; }
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    if (detailOrder?.id === id) setDetailOrder((o) => o ? { ...o, status } : o);
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/orders?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) { alert(json.error ?? "Lỗi xoá"); return; }
      setDeleteId(null);
      router.refresh();
    } catch { alert("Lỗi kết nối"); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          className="border rounded-lg px-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Tìm mã đơn, khách hàng..."
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          + Tạo đơn hàng
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Mã đơn</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Khách hàng</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SĐT</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Tổng tiền</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Trạng thái</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <button className="font-mono text-blue-600 hover:underline text-xs" onClick={() => setDetailOrder(o)}>
                    {o.order_code}
                  </button>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{o.customer_name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{o.customer_phone || "—"}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">{money(o.total_amount)}</td>
                <td className="px-4 py-3 text-center">
                  <select
                    className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${STATUS_COLOR[o.status] ?? "bg-gray-100 text-gray-600"}`}
                    value={o.status}
                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                  >
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => setDeleteId(o.id)}
                    className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition">
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Chưa có đơn hàng nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal tạo đơn */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Tạo đơn hàng mới</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên khách hàng *</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nguyễn Văn A" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0909..." value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>
              </div>

              {/* Sản phẩm */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Sản phẩm *</label>
                  <button type="button" onClick={() => setItems([...items, emptyItem(products)])}
                    className="text-blue-600 text-xs hover:underline">+ Thêm dòng</button>
                </div>
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div key={i} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                          value={it.product_id} onChange={(e) => pickProduct(i, e.target.value)}>
                          <option value="">-- Chọn SP --</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
                        </select>
                      </div>
                      <div className="w-20">
                        <input type="number" min="0.1" step="0.1"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none text-center"
                          placeholder="SL" value={it.qty} onChange={(e) => updateItem(i, { qty: e.target.value })} />
                      </div>
                      <div className="w-32">
                        <input type="number" min="0"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                          placeholder="Đơn giá" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: e.target.value })} />
                      </div>
                      <div className="w-28 text-right text-sm font-medium text-gray-700 pb-2">
                        {money((Number(it.qty)||0) * (Number(it.unit_price)||0))}
                      </div>
                      {items.length > 1 && (
                        <button type="button" onClick={() => setItems(items.filter((_,idx)=>idx!==i))}
                          className="text-red-400 hover:text-red-600 text-lg pb-1">×</button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-right text-sm font-semibold text-gray-800">
                  Tổng: {money(totalCalc)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Giao hàng buổi sáng..." value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              {formError && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">⚠️ {formError}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition"
                  disabled={saving}>Huỷ</button>
                <button type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition"
                  disabled={saving}>{saving ? "Đang lưu..." : "Tạo đơn"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal xác nhận xoá */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Xoá đơn hàng?</h3>
            <p className="text-sm text-gray-500 mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
                disabled={saving}>Huỷ</button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded-lg"
                disabled={saving}>{saving ? "Đang xoá..." : "Xoá"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal chi tiết đơn */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{detailOrder.order_code}</h2>
              <button onClick={() => setDetailOrder(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">Khách:</span> <strong>{detailOrder.customer_name}</strong></div>
                <div><span className="text-gray-500">SĐT:</span> {detailOrder.customer_phone || "—"}</div>
                <div><span className="text-gray-500">Ngày tạo:</span> {new Date(detailOrder.created_at).toLocaleDateString("vi-VN")}</div>
                <div><span className="text-gray-500">Tổng:</span> <strong className="text-blue-700">{money(detailOrder.total_amount)}</strong></div>
              </div>
              {detailOrder.note && <div className="text-gray-500 italic">📝 {detailOrder.note}</div>}
              {detailOrder.order_items && detailOrder.order_items.length > 0 && (
                <div className="border rounded-lg overflow-hidden mt-2">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50"><tr>
                      <th className="text-left px-3 py-2">Sản phẩm</th>
                      <th className="text-center px-3 py-2">SL</th>
                      <th className="text-right px-3 py-2">Đơn giá</th>
                      <th className="text-right px-3 py-2">Thành tiền</th>
                    </tr></thead>
                    <tbody>
                      {detailOrder.order_items.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="px-3 py-2">{it.product_name}</td>
                          <td className="px-3 py-2 text-center">{it.qty} {it.unit}</td>
                          <td className="px-3 py-2 text-right">{money(it.unit_price)}</td>
                          <td className="px-3 py-2 text-right font-medium">{money(it.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
