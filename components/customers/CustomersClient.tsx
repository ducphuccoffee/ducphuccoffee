"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";

const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(n) || 0);

export type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  created_at: string;
  total_spend: number;
  order_count: number;
};

type Props = { initialCustomers: Customer[] };

export function CustomersClient({ initialCustomers }: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.address || "").toLowerCase().includes(q)
    );
  }, [customers, search]);

  function openCreate() {
    setEditTarget(null);
    setName(""); setPhone(""); setAddress("");
    setFormError(null); setShowModal(true);
  }

  function openEdit(c: Customer) {
    setEditTarget(c);
    setName(c.name); setPhone(c.phone || ""); setAddress(c.address || "");
    setFormError(null); setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) { setFormError("Vui lòng nhập tên khách hàng"); return; }
    setSaving(true);
    try {
      if (editTarget) {
        const res = await fetch(`/api/customers?id=${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null, address: address.trim() || null }),
        });
        const json = await res.json();
        if (!res.ok || json.error) { setFormError(json.error ?? "Lỗi cập nhật"); return; }
        setCustomers((prev) => prev.map((c) => c.id === editTarget.id ? { ...c, name: name.trim(), phone: phone.trim() || null, address: address.trim() || null } : c));
      } else {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null, address: address.trim() || null }),
        });
        const json = await res.json();
        if (!res.ok || json.error) { setFormError(json.error ?? "Lỗi tạo khách hàng"); return; }
        setCustomers((prev) => [...prev, { ...json.data, total_spend: 0, order_count: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowModal(false); router.refresh();
    } catch { setFormError("Lỗi kết nối"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) { toast.error(json.error ?? "Lỗi xoá"); return; }
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      setDeleteId(null);
      toast.success("Đã xoá khách hàng");
    } catch { toast.error("Lỗi kết nối"); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          className="border rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Tìm tên, SĐT, địa chỉ..."
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex-1" />
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          + Thêm khách hàng
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">Tổng khách</p>
          <p className="text-2xl font-bold text-gray-800">{customers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">Đã mua hàng</p>
          <p className="text-2xl font-bold text-gray-800">{customers.filter((c) => c.order_count > 0).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">Tổng doanh thu</p>
          <p className="text-lg font-bold text-blue-700">{money(customers.reduce((s, c) => s + c.total_spend, 0))}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tên khách</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SĐT</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Địa chỉ</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Đơn hàng</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Tổng mua</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{c.address || "—"}</td>
                <td className="px-4 py-3 text-center">
                  <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                    {c.order_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                  {c.total_spend > 0 ? money(c.total_spend) : "—"}
                </td>
                <td className="px-4 py-3 text-center flex items-center justify-center gap-2">
                  <button onClick={() => openEdit(c)}
                    className="text-blue-400 hover:text-blue-600 text-xs px-2 py-1 rounded hover:bg-blue-50 transition">
                    Sửa
                  </button>
                  <button onClick={() => setDeleteId(c.id)}
                    className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition">
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Chưa có khách hàng nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal create/edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">
                {editTarget ? "Cập nhật khách hàng" : "Thêm khách hàng mới"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên khách *</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nguyễn Văn A" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0901 234 567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 Nguyễn Huệ, Q.1, TP.HCM" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              {formError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">⚠️ {formError}</div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} disabled={saving}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition">
                  Hủy
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition">
                  {saving ? "Đang lưu..." : editTarget ? "Cập nhật" : "Thêm khách"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Xóa khách hàng?</h3>
            <p className="text-sm text-gray-500 mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={saving}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={() => handleDelete(deleteId)} disabled={saving}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded-lg">
                {saving ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
