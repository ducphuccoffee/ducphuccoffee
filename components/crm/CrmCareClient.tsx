"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

export interface CrmCustomer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  assigned_user_id: string | null;
  assigned_name: string | null;
  next_follow_up_at: string | null;
  latitude: number | null;
  longitude: number | null;
  crm_status: string | null;
  order_count: number;
  revenue: number;
  last_order: string | null;
}

export interface Profile { id: string; full_name: string }
export interface Note { id: string; content: string; created_by: string; created_at: string; profiles?: { full_name: string } | null }

const STATUS_LABELS: Record<string, string> = {
  active:    "Đang hoạt động",
  inactive:  "Không hoạt động",
  prospect:  "Tiềm năng",
};

export function CrmCareClient({
  initialCustomers, profiles, currentUserId, isAdmin,
}: {
  initialCustomers: CrmCustomer[];
  profiles: Profile[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [customers, setCustomers] = useState<CrmCustomer[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<CrmCustomer | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editFollowUp, setEditFollowUp] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let rows = customers;
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.assigned_name ?? "").toLowerCase().includes(q)
    );
    if (filterStatus !== "all") rows = rows.filter(c => (c.crm_status ?? "active") === filterStatus);
    return rows;
  }, [customers, search, filterStatus]);

  async function openDetail(c: CrmCustomer) {
    setSelected(c);
    setNoteText("");
    setError(null);
    setEditFollowUp(c.next_follow_up_at ? c.next_follow_up_at.slice(0, 16) : "");
    setLoadingNotes(true);
    const res = await fetch(`/api/crm/notes?customer_id=${c.id}`);
    const json = await res.json();
    setNotes(json.data ?? []);
    setLoadingNotes(false);
  }

  async function addNote() {
    if (!selected || !noteText.trim()) return;
    setSavingNote(true);
    setError(null);
    const res = await fetch("/api/crm/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: selected.id, content: noteText.trim() }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error); setSavingNote(false); return; }
    setNotes(prev => [json.data, ...prev]);
    setNoteText("");
    setSavingNote(false);
  }

  async function deleteNote(id: string) {
    await fetch(`/api/crm/notes?id=${id}`, { method: "DELETE" });
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  async function saveFollowUp() {
    if (!selected) return;
    setSavingFollowUp(true);
    const res = await fetch(`/api/customers?id=${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next_follow_up_at: editFollowUp || null }),
    });
    if (res.ok) {
      const updated = { ...selected, next_follow_up_at: editFollowUp || null };
      setSelected(updated);
      setCustomers(prev => prev.map(c => c.id === selected.id ? { ...c, next_follow_up_at: editFollowUp || null } : c));
    }
    setSavingFollowUp(false);
  }

  const totalRevenue = customers.reduce((s, c) => s + c.revenue, 0);
  const withOrders = customers.filter(c => c.order_count > 0).length;
  const dueFollowUp = customers.filter(c => c.next_follow_up_at && new Date(c.next_follow_up_at) <= new Date()).length;

  return (
    <div className="p-6 space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Tổng khách", value: customers.length },
          { label: "Có đơn hàng", value: withOrders },
          { label: "Follow-up quá hạn", value: dueFollowUp },
          { label: "Tổng doanh thu", value: totalRevenue.toLocaleString("vi-VN") + " ₫" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <input
          className="border rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Tìm tên, SĐT, phụ trách..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">Tên</th>
              <th className="text-left px-4 py-3">SĐT</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Phụ trách</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Đơn hàng</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Doanh thu</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">Follow-up</th>
              <th className="text-center px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const overdue = c.next_follow_up_at && new Date(c.next_follow_up_at) <= new Date();
              return (
                <tr key={c.id}
                  className="border-t border-gray-100 hover:bg-blue-50/40 cursor-pointer transition"
                  onClick={() => openDetail(c)}>
                  <td className="px-4 py-3 font-medium text-blue-700 hover:underline">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{c.assigned_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">{c.order_count}</td>
                  <td className="px-4 py-3 text-right hidden md:table-cell font-medium">
                    {c.revenue > 0 ? c.revenue.toLocaleString("vi-VN") + " ₫" : "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {c.next_follow_up_at ? (
                      <span className={`text-xs ${overdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                        {overdue ? "⚠ " : ""}{new Date(c.next_follow_up_at).toLocaleDateString("vi-VN")}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={c.crm_status ?? "active"} />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Không có khách hàng</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelected(null)}>
          <div
            className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{selected.name}</h2>
                <p className="text-sm text-gray-500">{selected.phone ?? "Không có SĐT"}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <Metric label="Đơn hàng" value={String(selected.order_count)} />
                <Metric label="Doanh thu" value={selected.revenue > 0 ? selected.revenue.toLocaleString("vi-VN") + "₫" : "—"} />
                <Metric label="Đơn gần nhất" value={selected.last_order ? new Date(selected.last_order).toLocaleDateString("vi-VN") : "—"} />
              </div>

              {/* Info */}
              <InfoRow label="Địa chỉ" value={selected.address ?? "—"} />
              <InfoRow label="Phụ trách" value={selected.assigned_name ?? "—"} />
              <InfoRow label="Trạng thái CRM" value={STATUS_LABELS[selected.crm_status ?? "active"] ?? selected.crm_status ?? "—"} />
              {(selected.latitude && selected.longitude) && (
                <InfoRow label="Toạ độ" value={`${selected.latitude}, ${selected.longitude}`} />
              )}

              {/* Follow-up */}
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Follow-up tiếp theo</p>
                <div className="flex gap-2">
                  <input type="datetime-local" value={editFollowUp}
                    onChange={e => setEditFollowUp(e.target.value)}
                    className="border rounded-lg px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <button onClick={saveFollowUp} disabled={savingFollowUp}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {savingFollowUp ? "…" : "Lưu"}
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div className="border rounded-lg p-3 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ghi chú CRM</p>
                <div className="flex gap-2">
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                    rows={2} placeholder="Nhập ghi chú..."
                    className="border rounded-lg px-2 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                  <button onClick={addNote} disabled={savingNote || !noteText.trim()}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 self-end">
                    {savingNote ? "…" : "+ Thêm"}
                  </button>
                </div>
                {error && <p className="text-red-500 text-xs">{error}</p>}
                {loadingNotes ? (
                  <p className="text-sm text-gray-400">Đang tải...</p>
                ) : notes.length === 0 ? (
                  <p className="text-sm text-gray-400">Chưa có ghi chú</p>
                ) : (
                  <ul className="space-y-2">
                    {notes.map(n => (
                      <li key={n.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-gray-700 flex-1">{n.content}</p>
                          <button onClick={() => deleteNote(n.id)}
                            className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {(n.profiles as any)?.full_name ?? "—"} · {new Date(n.created_at).toLocaleString("vi-VN")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:   "bg-green-100 text-green-700",
    inactive: "bg-gray-100 text-gray-500",
    prospect: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-bold text-gray-800 mt-1 text-sm">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-400 w-28 shrink-0">{label}</span>
      <span className="text-gray-700">{value}</span>
    </div>
  );
}
