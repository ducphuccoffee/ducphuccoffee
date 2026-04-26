"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, Plus, MessageSquare, Phone, Video, MapPin, FileText, StickyNote } from "lucide-react";
import { formatDateTimeVN } from "@/lib/date";
import { Sheet } from "@/components/ui/Sheet";

type Activity = {
  id: string;
  type: string;
  content: string | null;
  lead_id: string | null;
  customer_id: string | null;
  opportunity_id: string | null;
  owner_user_id: string;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = { call: "Gọi", message: "Nhắn tin", meeting: "Gặp mặt", visit: "Ghé thăm", quotation: "Báo giá", note: "Ghi chú" };
const TYPE_ICON: Record<string, any> = { call: Phone, message: MessageSquare, meeting: Video, visit: MapPin, quotation: FileText, note: StickyNote };
const TYPE_COLOR: Record<string, string> = { call: "bg-green-100 text-green-700", message: "bg-blue-100 text-blue-700", meeting: "bg-purple-100 text-purple-700", visit: "bg-orange-100 text-orange-700", quotation: "bg-amber-100 text-amber-700", note: "bg-gray-100 text-gray-600" };

export function ActivitiesClient() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("call");
  const [content, setContent] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);

  function load() {
    setLoading(true);
    fetch("/api/crm-activities")
      .then(r => r.json())
      .then(res => setActivities(res.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    fetch("/api/customers").then(r => r.json()).then(r => setCustomers((r.data ?? []).map((c: any) => ({ id: c.id, name: c.name }))));
    fetch("/api/leads").then(r => r.json()).then(r => setLeads((r.data ?? []).map((l: any) => ({ id: l.id, name: l.name }))));
  }, []);

  const filtered = useMemo(() => {
    let list = activities;
    if (filterType !== "all") list = list.filter(a => a.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => (a.content ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [activities, search, filterType]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId && !leadId) { setError("Chọn KH hoặc Lead"); return; }
    setSaving(true); setError(null);
    const res = await fetch("/api/crm-activities", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, content, customer_id: customerId || undefined, lead_id: leadId || undefined }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) { setError(json.error ?? "Lỗi"); setSaving(false); return; }
    setSaving(false); setShowModal(false); setContent(""); load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Tìm hoạt động..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={() => { setError(null); setShowModal(true); }}
          className="ml-3 flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Ghi nhận
        </button>
      </div>

      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {[{ key: "all", label: "Tất cả" }, ...Object.entries(TYPE_LABEL).map(([k, v]) => ({ key: k, label: v }))].map(f => (
          <button key={f.key} onClick={() => setFilterType(f.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${filterType === f.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-8">Chưa có hoạt động nào</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => {
            const Icon = TYPE_ICON[a.type] ?? MessageSquare;
            return (
              <div key={a.id} className="rounded-xl border bg-white p-3 flex items-start gap-3">
                <div className={`p-1.5 rounded-lg shrink-0 ${TYPE_COLOR[a.type] ?? "bg-gray-100"}`}><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-700">{TYPE_LABEL[a.type] ?? a.type}</span>
                    <span className="text-[10px] text-gray-400">{formatDateTimeVN(a.created_at)}</span>
                  </div>
                  {a.content && <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{a.content}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Ghi nhận hoạt động"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-3 py-2 border rounded-lg text-sm text-gray-600">Huỷ</button>
            <button type="submit" form="activity-form" disabled={saving} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? "..." : "Lưu"}</button>
          </div>
        }
      >
        <form id="activity-form" onSubmit={handleCreate} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Loại</label>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white">
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Khách hàng</label>
            <select value={customerId} onChange={e => { setCustomerId(e.target.value); if (e.target.value) setLeadId(""); }}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white">
              <option value="">-- Chọn --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Lead</label>
            <select value={leadId} onChange={e => { setLeadId(e.target.value); if (e.target.value) setCustomerId(""); }}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white">
              <option value="">-- Chọn --</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Nội dung</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm resize-none" placeholder="Ghi chú cuộc gọi..." />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}
        </form>
      </Sheet>
    </div>
  );
}
