"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Phone, MapPin } from "lucide-react";
import { formatDateVN } from "@/lib/date";

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  area: string | null;
  source: string | null;
  demand: string | null;
  temperature: string;
  status: string;
  owner_user_id: string;
  created_at: string;
  updated_at?: string | null;
};

const STALE_DAYS = 7;
function daysSinceUpdate(l: Lead): number | null {
  const ts = l.updated_at ?? l.created_at;
  if (!ts) return null;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
}

const STATUS_LABEL: Record<string, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  meeting_scheduled: "Hẹn gặp",
  quoted: "Báo giá",
  converted: "Chuyển đổi",
  lost: "Mất",
};

const STATUS_COLOR: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  meeting_scheduled: "bg-purple-100 text-purple-700",
  quoted: "bg-orange-100 text-orange-700",
  converted: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

const TEMP_LABEL: Record<string, string> = { cold: "Lạnh", warm: "Ấm", hot: "Nóng" };
const TEMP_COLOR: Record<string, string> = {
  cold: "bg-blue-50 text-blue-600",
  warm: "bg-amber-50 text-amber-600",
  hot: "bg-red-50 text-red-600",
};

export function LeadsClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [source, setSource] = useState("");
  const [demand, setDemand] = useState("");
  const [temperature, setTemperature] = useState("cold");

  function loadLeads() {
    setLoading(true);
    fetch("/api/leads")
      .then(r => r.json())
      .then(res => { if (res.ok) setLeads(res.data ?? []); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadLeads(); }, []);

  const filtered = useMemo(() => {
    let list = leads;
    if (filterStatus === "stale") {
      list = list.filter(l => {
        if (["converted", "lost"].includes(l.status)) return false;
        const d = daysSinceUpdate(l);
        return d != null && d >= STALE_DAYS;
      });
    } else if (filterStatus === "active_pipeline") {
      list = list.filter(l => !["converted", "lost"].includes(l.status));
    } else if (filterStatus !== "all") {
      list = list.filter(l => l.status === filterStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.name.toLowerCase().includes(q) ||
        (l.phone ?? "").includes(q) ||
        (l.area ?? "").toLowerCase().includes(q)
      );
    }
    // Prioritise: hot temperature + stale leads first.
    return [...list].sort((a, b) => {
      const aStale = daysSinceUpdate(a) ?? 0;
      const bStale = daysSinceUpdate(b) ?? 0;
      const aHot = a.temperature === "hot" ? 1 : 0;
      const bHot = b.temperature === "hot" ? 1 : 0;
      if (aHot !== bHot) return bHot - aHot;
      return bStale - aStale;
    });
  }, [leads, search, filterStatus]);

  const staleCount = useMemo(() =>
    leads.filter(l => !["converted", "lost"].includes(l.status) && (daysSinceUpdate(l) ?? 0) >= STALE_DAYS).length,
    [leads]
  );

  function resetForm() {
    setName(""); setPhone(""); setAddress(""); setArea("");
    setSource(""); setDemand(""); setTemperature("cold");
    setFormError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setFormError("Tên lead bắt buộc"); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address, area, source, demand, temperature }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { setFormError(json.error || "Lỗi tạo lead"); return; }
      setShowModal(false);
      resetForm();
      loadLeads();
    } catch { setFormError("Lỗi kết nối"); }
    finally { setSaving(false); }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm lead..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="ml-3 flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Tạo lead
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {[
          { key: "all", label: "Tất cả" },
          { key: "active_pipeline", label: "Đang theo" },
          { key: "stale", label: `Chưa chăm sóc ${staleCount > 0 ? `(${staleCount})` : ""}`, highlight: staleCount > 0 },
          ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ key: k, label: v })),
        ].map((f: any) => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
              filterStatus === f.key
                ? "bg-blue-600 text-white"
                : f.highlight
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-8">Chưa có lead nào</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => {
            const d = daysSinceUpdate(lead);
            const isStale = d != null && d >= STALE_DAYS && !["converted", "lost"].includes(lead.status);
            return (
              <div key={lead.id} className={`rounded-xl border bg-white p-3 ${isStale ? "border-amber-300" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">{lead.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TEMP_COLOR[lead.temperature] ?? ""}`}>
                        {TEMP_LABEL[lead.temperature] ?? lead.temperature}
                      </span>
                      {isStale && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                          ⏰ {d}n
                        </span>
                      )}
                    </div>
                    {lead.phone && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                        <Phone className="h-3 w-3" /> {lead.phone}
                      </div>
                    )}
                    {lead.area && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                        <MapPin className="h-3 w-3" /> {lead.area}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[lead.status] ?? lead.status}
                    </span>
                    <div className="text-[10px] text-gray-400 mt-1">{formatDateVN(lead.created_at)}</div>
                  </div>
                </div>
                {lead.demand && (
                  <div className="text-xs text-gray-500 mt-1.5 truncate">Nhu cầu: {lead.demand}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">Tạo lead mới</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Tên *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Quán cà phê ABC" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">SĐT</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0901234567" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Khu vực</label>
                  <input value={area} onChange={e => setArea(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Quận 1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Địa chỉ</label>
                <input value={address} onChange={e => setAddress(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="123 Nguyễn Huệ" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Nguồn</label>
                  <select value={source} onChange={e => setSource(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">-- Chọn --</option>
                    <option value="referral">Giới thiệu</option>
                    <option value="facebook">Facebook</option>
                    <option value="walk_in">Tự tìm</option>
                    <option value="event">Sự kiện</option>
                    <option value="cold_call">Cold call</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Mức độ</label>
                  <select value={temperature} onChange={e => setTemperature(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="cold">Lạnh</option>
                    <option value="warm">Ấm</option>
                    <option value="hot">Nóng</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Nhu cầu</label>
                <textarea value={demand} onChange={e => setDemand(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Cần 50kg/tháng, pha máy" />
              </div>
              {formError && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{formError}</div>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Huỷ</button>
                <button type="submit" disabled={saving} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Đang lưu..." : "Tạo lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
