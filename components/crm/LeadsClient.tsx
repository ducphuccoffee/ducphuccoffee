"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Phone, MapPin, User } from "lucide-react";
import { formatDateVN } from "@/lib/date";
import { Sheet } from "@/components/ui/Sheet";

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
  owner_user_id: string | null;
  created_at: string;
  updated_at?: string | null;
};

type OrgMember = {
  id: string;
  role: string;
  full_name: string | null;
  username: string | null;
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

const MANAGER_ROLES = ["admin", "manager", "roastery_manager"];

export function LeadsClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Org members + current user
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>("staff");
  const isManager = MANAGER_ROLES.includes(currentRole);

  // Reassignment state
  const [reassigning, setReassigning] = useState<string | null>(null);

  // Form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [source, setSource] = useState("");
  const [demand, setDemand] = useState("");
  const [temperature, setTemperature] = useState("cold");
  const [ownerUserId, setOwnerUserId] = useState("");

  function memberName(uid: string | null | undefined): string {
    if (!uid) return "Chưa giao";
    const m = members.find(m => m.id === uid);
    if (!m) return uid.slice(0, 8);
    return m.full_name || m.username || uid.slice(0, 8);
  }

  function memberInitial(uid: string | null | undefined): string {
    const n = memberName(uid);
    return (n.split(" ").pop() ?? "?")[0].toUpperCase();
  }

  function loadLeads() {
    setLoading(true);
    fetch("/api/leads")
      .then(r => r.json())
      .then(res => { if (res.ok) setLeads(res.data ?? []); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/org-members")
      .then(r => r.json())
      .then(j => {
        if (j.ok && j.data) {
          setMembers(j.data.members);
          setCurrentUserId(j.data.currentUserId);
          setCurrentRole(j.data.currentRole);
          // Default owner in form = self
          setOwnerUserId(j.data.currentUserId);
        }
      });
    loadLeads();
  }, []);

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

    if (filterOwner !== "all") {
      list = list.filter(l => l.owner_user_id === filterOwner);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.name.toLowerCase().includes(q) ||
        (l.phone ?? "").includes(q) ||
        (l.area ?? "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const aStale = daysSinceUpdate(a) ?? 0;
      const bStale = daysSinceUpdate(b) ?? 0;
      const aHot = a.temperature === "hot" ? 1 : 0;
      const bHot = b.temperature === "hot" ? 1 : 0;
      if (aHot !== bHot) return bHot - aHot;
      return bStale - aStale;
    });
  }, [leads, search, filterStatus, filterOwner]);

  const staleCount = useMemo(() =>
    leads.filter(l => !["converted", "lost"].includes(l.status) && (daysSinceUpdate(l) ?? 0) >= STALE_DAYS).length,
    [leads]
  );

  function resetForm() {
    setName(""); setPhone(""); setAddress(""); setArea("");
    setSource(""); setDemand(""); setTemperature("cold");
    setOwnerUserId(currentUserId ?? "");
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
        body: JSON.stringify({
          name, phone, address, area, source, demand, temperature,
          owner_user_id: ownerUserId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { setFormError(json.error || "Lỗi tạo lead"); return; }
      setShowModal(false);
      resetForm();
      loadLeads();
    } catch { setFormError("Lỗi kết nối"); }
    finally { setSaving(false); }
  }

  async function handleReassign(leadId: string, newOwnerId: string) {
    setReassigning(null);
    await fetch(`/api/leads?id=${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner_user_id: newOwnerId }),
    });
    loadLeads();
  }

  // Sales members for dropdowns (excludes warehouse/delivery)
  const salesMembers = members.filter(m =>
    ["admin", "manager", "roastery_manager", "sales", "collaborator"].includes(m.role)
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm lead..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Owner filter — managers only */}
        {isManager && salesMembers.length > 0 && (
          <select
            value={filterOwner}
            onChange={e => setFilterOwner(e.target.value)}
            className="px-2.5 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
          >
            <option value="all">Tất cả sale</option>
            {salesMembers.map(m => (
              <option key={m.id} value={m.id}>
                {m.full_name || m.username || m.id.slice(0, 8)}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all shrink-0 shadow-sm shadow-blue-500/30"
        >
          <Plus className="h-4 w-4" /> Tạo lead
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
        {[
          { key: "all", label: "Tất cả" },
          { key: "active_pipeline", label: "Đang theo" },
          { key: "stale", label: `Chưa chăm sóc${staleCount > 0 ? ` (${staleCount})` : ""}`, highlight: staleCount > 0 },
          ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ key: k, label: v })),
        ].map((f: any) => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
              filterStatus === f.key
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
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
            const isReassigning = reassigning === lead.id;
            return (
              <div key={lead.id} className={`rounded-2xl border bg-white p-3.5 active:bg-gray-50 transition-colors ${isStale ? "border-amber-300" : "border-gray-200"}`}>
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

                    {/* Owner row */}
                    <div className="flex items-center gap-1 mt-1">
                      <User className="h-3 w-3 text-gray-300 shrink-0" />
                      {isManager && isReassigning ? (
                        <select
                          autoFocus
                          defaultValue={lead.owner_user_id ?? ""}
                          onBlur={() => setReassigning(null)}
                          onChange={e => e.target.value && handleReassign(lead.id, e.target.value)}
                          className="text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        >
                          <option value="">-- Chọn sale --</option>
                          {salesMembers.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.full_name || m.username || m.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          type="button"
                          onClick={() => isManager && setReassigning(lead.id)}
                          className={`text-xs text-gray-500 ${isManager ? "hover:text-blue-600 hover:underline cursor-pointer" : "cursor-default"}`}
                          title={isManager ? "Click để đổi người phụ trách" : undefined}
                        >
                          {memberName(lead.owner_user_id)}
                        </button>
                      )}
                    </div>
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

      {/* Create modal */}
      <Sheet
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Tạo lead mới"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Huỷ</button>
            <button type="submit" form="lead-form" disabled={saving} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Đang lưu..." : "Tạo lead"}
            </button>
          </div>
        }
      >
        <form id="lead-form" onSubmit={handleCreate} className="p-4 space-y-3">
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

              {/* Assign to — managers only */}
              {isManager && salesMembers.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-600">Giao cho</label>
                  <select
                    value={ownerUserId}
                    onChange={e => setOwnerUserId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {salesMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.username || m.id.slice(0, 8)}
                        {m.id === currentUserId ? " (tôi)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600">Nhu cầu</label>
                <textarea value={demand} onChange={e => setDemand(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Cần 50kg/tháng, pha máy" />
              </div>
              {formError && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{formError}</div>}
        </form>
      </Sheet>
    </div>
  );
}
