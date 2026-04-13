"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// ── Constants ─────────────────────────────────────────────────────
const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(n) || 0);

export const ORDER_STATUS_LABEL: Record<string, string> = {
  draft:     "Nháp",
  confirmed: "Đã xác nhận",
  delivered: "Đã giao",
  closed:    "Đã đóng",
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  confirmed: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  closed:    "bg-emerald-100 text-emerald-700",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid:       "Chưa TT",
  partial_paid: "TT một phần",
  paid:         "Đã TT",
  debt:         "Công nợ",
};

export const PAYMENT_STATUS_COLOR: Record<string, string> = {
  unpaid:       "bg-gray-100 text-gray-600",
  partial_paid: "bg-amber-100 text-amber-700",
  paid:         "bg-green-100 text-green-700",
  debt:         "bg-red-100 text-red-700",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash:          "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  debt:          "Công nợ",
};

const TAX_OPTIONS = [
  { label: "0%", value: 0 },
  { label: "8%", value: 0.08 },
  { label: "10%", value: 0.10 },
];

// ── Types ─────────────────────────────────────────────────────────
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
  customer_id?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  status: string;
  payment_status: string;
  payment_method: string;
  note?: string | null;
  total_amount: number;
  total_qty_kg?: number;
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

export type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
};

type ItemRow = { product_id: string; product_name: string; unit: string; qty: string; unit_price: string };

const emptyItem = (products: Product[]): ItemRow => ({
  product_id:   products[0]?.id   || "",
  product_name: products[0]?.name || "",
  unit:         products[0]?.unit || "kg",
  qty:          "1",
  unit_price:   String(products[0]?.price || ""),
});

type Props = { initialOrders: Order[]; products: Product[]; initialCustomers?: Customer[] };

// ── Main Component ────────────────────────────────────────────────
export function OrdersClient({ initialOrders, products, initialCustomers = [] }: Props) {
  const router = useRouter();
  const [orders, setOrders]           = useState<Order[]>(initialOrders);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState<string | null>(null);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);

  // Order form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerName, setCustomerName]     = useState("");
  const [customerPhone, setCustomerPhone]   = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [note, setNote]               = useState("");
  const [items, setItems]             = useState<ItemRow[]>([emptyItem(products)]);
  const [taxRate, setTaxRate]         = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");

  // Customer search dropdown
  const [custSearch, setCustSearch]   = useState("");
  const [custDropOpen, setCustDropOpen] = useState(false);
  const custDropRef = useRef<HTMLDivElement>(null);

  // Quick-create customer modal
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [qcName, setQcName]       = useState("");
  const [qcPhone, setQcPhone]     = useState("");
  const [qcAddress, setQcAddress] = useState("");
  const [qcSaving, setQcSaving]   = useState(false);
  const [qcError, setQcError]     = useState<string | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (custDropRef.current && !custDropRef.current.contains(e.target as Node)) {
        setCustDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = custSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone || "").includes(q)
    );
  }, [customers, custSearch]);

  function selectCustomer(c: Customer) {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerPhone(c.phone || "");
    setCustomerAddress(c.address || "");
    setCustSearch(c.name);
    setCustDropOpen(false);
  }

  function clearCustomer() {
    setSelectedCustomerId("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustSearch("");
  }

  const subtotalCalc = useMemo(
    () => items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0),
    [items]
  );
  const taxAmount = Math.round(subtotalCalc * taxRate);
  const totalCalc = subtotalCalc + taxAmount;

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

  function openCreate() {
    clearCustomer();
    setNote("");
    setItems([emptyItem(products)]);
    setFormError(null);
    setTaxRate(0);
    setPaymentMethod("cash");
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
    if (!customerName.trim()) { setFormError("Vui lòng chọn hoặc nhập tên khách hàng"); return; }
    const validItems = items.filter((i) => i.product_id && Number(i.qty) > 0);
    if (!validItems.length) { setFormError("Cần ít nhất 1 sản phẩm hợp lệ"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id:    selectedCustomerId || null,
          customer_name:  customerName.trim(),
          tax_rate:       taxRate,
          payment_method: paymentMethod,
          note:           note.trim() || null,
          items: validItems.map((i) => ({
            product_id:   i.product_id,
            product_name: i.product_name,
            unit:         i.unit,
            qty:          Number(i.qty),
            unit_price:   Number(i.unit_price) || 0,
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

  async function handleQuickCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    setQcError(null);
    if (!qcName.trim()) { setQcError("Vui lòng nhập tên khách hàng"); return; }
    setQcSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: qcName.trim(), phone: qcPhone.trim() || null, address: qcAddress.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setQcError(json.error ?? "Lỗi tạo khách hàng"); return; }
      const newCustomer: Customer = json.data;
      setCustomers((prev) => [...prev, newCustomer].sort((a, b) => a.name.localeCompare(b.name, "vi")));
      selectCustomer(newCustomer);
      setShowQuickCreate(false);
    } catch { setQcError("Lỗi kết nối"); }
    finally { setQcSaving(false); }
  }

  function openQuickCreate() {
    setQcName(custSearch);
    setQcPhone(""); setQcAddress(""); setQcError(null);
    setShowQuickCreate(true);
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

  // Payment status is local-only until DB schema is extended with payment columns
  function handlePaymentStatusChange(id: string, payment_status: string) {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, payment_status } : o));
    if (detailOrder?.id === id) setDetailOrder((o) => o ? { ...o, payment_status } : o);
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

  // ── Counts for status tabs ──────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    for (const o of orders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  return (
    <div className="p-4 md:p-6">

      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          className="border rounded-lg px-3 py-2 text-sm w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Tìm mã đơn, khách hàng..."
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Tất cả ({statusCounts.all || 0})</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v} {statusCounts[k] ? `(${statusCounts[k]})` : ""}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button onClick={openCreate}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition">
          + Tạo đơn hàng
        </button>
      </div>

      {/* ── Order list — cards on mobile, table on desktop ──────── */}

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Mã đơn</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Khách hàng</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Tổng tiền</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 w-40">Trạng thái đơn</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 w-36">Thanh toán</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 w-24">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <button className="font-mono text-blue-600 hover:underline text-xs font-semibold" onClick={() => setDetailOrder(o)}>
                    {o.order_code}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800 text-sm">{o.customer_name}</p>
                  {o.customer_phone && <p className="text-xs text-gray-400">{o.customer_phone}</p>}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">{money(o.total_amount)}</td>
                <td className="px-4 py-3 text-center">
                  <select
                    className={`text-xs px-2 py-1 rounded-full border-0 font-semibold cursor-pointer w-full max-w-[148px] ${ORDER_STATUS_COLOR[o.status] ?? "bg-gray-100 text-gray-600"}`}
                    value={o.status}
                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                  >
                    {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <select
                    className={`text-xs px-2 py-1 rounded-full border-0 font-semibold cursor-pointer ${PAYMENT_STATUS_COLOR[o.payment_status] ?? "bg-gray-100 text-gray-600"}`}
                    value={o.payment_status}
                    onChange={(e) => handlePaymentStatusChange(o.id, e.target.value)}
                  >
                    {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-12 text-center text-gray-400">
            Chưa có đơn hàng nào
          </div>
        )}
        {filtered.map((o) => (
          <div key={o.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <button
                className="font-mono text-blue-600 text-sm font-bold"
                onClick={() => setDetailOrder(o)}
              >
                {o.order_code}
              </button>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ORDER_STATUS_COLOR[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {ORDER_STATUS_LABEL[o.status] ?? o.status}
                </span>
                <button onClick={() => setDeleteId(o.id)}
                  className="text-red-400 text-xs p-1 rounded hover:bg-red-50">✕</button>
              </div>
            </div>
            {/* Card body */}
            <div className="px-4 py-3 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{o.customer_name}</p>
                  {o.customer_phone && <p className="text-xs text-gray-400">{o.customer_phone}</p>}
                </div>
                <p className="font-bold text-blue-700 text-base">{money(o.total_amount)}</p>
              </div>
              {/* Status controls */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Trạng thái đơn</p>
                  <select
                    className={`w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 font-semibold cursor-pointer ${ORDER_STATUS_COLOR[o.status] ?? "bg-gray-100 text-gray-600"}`}
                    value={o.status}
                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                  >
                    {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Thanh toán</p>
                  <select
                    className={`w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 font-semibold cursor-pointer ${PAYMENT_STATUS_COLOR[o.payment_status] ?? "bg-gray-100 text-gray-600"}`}
                    value={o.payment_status}
                    onChange={(e) => handlePaymentStatusChange(o.id, e.target.value)}
                  >
                    {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              {/* Payment method + date */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{PAYMENT_METHOD_LABEL[o.payment_method] ?? o.payment_method}</span>
                <span>{new Date(o.created_at).toLocaleDateString("vi-VN")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modal tạo đơn ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold text-gray-800">Tạo đơn hàng mới</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl p-1">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">

              {/* Customer search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Khách hàng *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1" ref={custDropRef}>
                    <input
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Tìm tên hoặc SĐT..."
                      value={custSearch}
                      onChange={(e) => {
                        setCustSearch(e.target.value);
                        setCustomerName(e.target.value);
                        setSelectedCustomerId("");
                        setCustDropOpen(true);
                      }}
                      onFocus={() => setCustDropOpen(true)}
                      autoComplete="off"
                    />
                    {custDropOpen && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredCustomers.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-400">Không tìm thấy</div>
                        ) : (
                          filteredCustomers.map((c) => (
                            <button key={c.id} type="button"
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition flex flex-col"
                              onMouseDown={(e) => { e.preventDefault(); selectCustomer(c); }}
                            >
                              <span className="font-medium">{c.name}</span>
                              {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={openQuickCreate}
                    className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition font-bold text-lg">
                    +
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SĐT</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0909..." value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thanh toán</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="cash">Tiền mặt</option>
                    <option value="bank_transfer">Chuyển khoản</option>
                    <option value="debt">Công nợ</option>
                  </select>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Sản phẩm *</label>
                  <button type="button" onClick={() => setItems([...items, emptyItem(products)])}
                    className="text-blue-600 text-xs hover:underline font-medium">+ Thêm dòng</button>
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
                      <div className="w-16">
                        <input type="number" min="0.1" step="0.1"
                          className="w-full border rounded-lg px-2 py-2 text-sm focus:outline-none text-center"
                          placeholder="SL" value={it.qty} onChange={(e) => updateItem(i, { qty: e.target.value })} />
                      </div>
                      <div className="w-28">
                        <input type="number" min="0"
                          className="w-full border rounded-lg px-2 py-2 text-sm focus:outline-none"
                          placeholder="Đơn giá" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: e.target.value })} />
                      </div>
                      <div className="w-24 text-right text-sm font-medium text-gray-700 pb-2 shrink-0">
                        {money((Number(it.qty)||0) * (Number(it.unit_price)||0))}
                      </div>
                      {items.length > 1 && (
                        <button type="button" onClick={() => setItems(items.filter((_,idx)=>idx!==i))}
                          className="text-red-400 hover:text-red-600 text-lg pb-1 shrink-0">×</button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Tax + totals */}
                <div className="mt-3 space-y-1.5 text-sm border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Tạm tính</span>
                    <span className="font-medium text-gray-800">{money(subtotalCalc)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500 shrink-0">Thuế VAT</span>
                    <div className="flex items-center gap-2">
                      <select className="border rounded-lg px-2 py-1 text-xs focus:outline-none"
                        value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))}>
                        {TAX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <span className="font-medium text-gray-800 w-24 text-right">{money(taxAmount)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between font-bold text-gray-800 text-base border-t border-gray-100 pt-1.5">
                    <span>Tổng cộng</span>
                    <span className="text-blue-700">{money(totalCalc)}</span>
                  </div>
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
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-3 rounded-xl hover:bg-gray-50 transition"
                  disabled={saving}>Huỷ</button>
                <button type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 rounded-xl transition"
                  disabled={saving}>{saving ? "Đang lưu..." : "Tạo đơn"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quick-create customer modal ───────────────────────────── */}
      {showQuickCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Thêm khách hàng mới</h2>
              <button type="button" onClick={() => setShowQuickCreate(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleQuickCreateCustomer} className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên khách *</label>
                <input className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nguyễn Văn A" value={qcName} onChange={(e) => setQcName(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0901 234 567" value={qcPhone} onChange={(e) => setQcPhone(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 Nguyễn Huệ..." value={qcAddress} onChange={(e) => setQcAddress(e.target.value)} />
              </div>
              {qcError && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">⚠️ {qcError}</div>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowQuickCreate(false)} disabled={qcSaving}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50">Huỷ</button>
                <button type="submit" disabled={qcSaving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-xl">
                  {qcSaving ? "Đang lưu..." : "Thêm khách"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal xác nhận xoá ────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-800 mb-2">Xoá đơn hàng?</h3>
            <p className="text-sm text-gray-500 mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={saving}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50">Huỷ</button>
              <button onClick={() => handleDelete(deleteId)} disabled={saving}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2.5 rounded-xl">
                {saving ? "Đang xoá..." : "Xoá"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal chi tiết đơn ────────────────────────────────────── */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-bold text-gray-800">{detailOrder.order_code}</h2>
                <p className="text-xs text-gray-400">{new Date(detailOrder.created_at).toLocaleString("vi-VN")}</p>
              </div>
              <button onClick={() => setDetailOrder(null)} className="text-gray-400 text-2xl p-1">×</button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              {/* Customer info */}
              <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-2">
                <div><span className="text-gray-400 text-xs">Khách hàng</span><p className="font-semibold">{detailOrder.customer_name}</p></div>
                <div><span className="text-gray-400 text-xs">SĐT</span><p>{detailOrder.customer_phone || "—"}</p></div>
              </div>

              {/* Status row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Trạng thái đơn</p>
                  <select
                    className={`w-full text-sm px-3 py-2 rounded-xl border-0 font-semibold cursor-pointer ${ORDER_STATUS_COLOR[detailOrder.status] ?? "bg-gray-100"}`}
                    value={detailOrder.status}
                    onChange={(e) => handleStatusChange(detailOrder.id, e.target.value)}
                  >
                    {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Thanh toán</p>
                  <select
                    className={`w-full text-sm px-3 py-2 rounded-xl border-0 font-semibold cursor-pointer ${PAYMENT_STATUS_COLOR[detailOrder.payment_status] ?? "bg-gray-100"}`}
                    value={detailOrder.payment_status}
                    onChange={(e) => handlePaymentStatusChange(detailOrder.id, e.target.value)}
                  >
                    {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              {/* Phương thức TT */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">Phương thức TT:</span>
                <span className="font-medium">{PAYMENT_METHOD_LABEL[detailOrder.payment_method] ?? detailOrder.payment_method}</span>
              </div>

              {detailOrder.note && (
                <div className="bg-amber-50 rounded-xl p-3 text-sm text-gray-700">
                  📝 {detailOrder.note}
                </div>
              )}

              {/* Items table */}
              {detailOrder.order_items && detailOrder.order_items.length > 0 && (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Sản phẩm</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-600">SL</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">Đơn giá</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">T.tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailOrder.order_items.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="px-3 py-2">{it.product_name}</td>
                          <td className="px-3 py-2 text-center">{it.qty} {it.unit}</td>
                          <td className="px-3 py-2 text-right">{money(it.unit_price)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{money(it.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 font-bold text-right">Tổng cộng</td>
                        <td className="px-3 py-2 text-right font-bold text-blue-700">{money(detailOrder.total_amount)}</td>
                      </tr>
                    </tfoot>
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
