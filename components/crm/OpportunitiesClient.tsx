"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Search, ChevronDown, DollarSign, User, ArrowRight, ShoppingCart } from "lucide-react";
import { formatDateVN } from "@/lib/date";

type Opportunity = {
  id: string;
  title: string;
  expected_value: number;
  probability: number;
  stage: string;
  owner_user_id: string;
  lead_id: string | null;
  customer_id: string | null;
  expected_close_date: string | null;
  created_at: string;
  updated_at: string;
  leads?: { name: string; phone: string } | null;
  customers?: { name: string; phone: string } | null;
};

const STAGES = ["new", "consulting", "demo", "quoted", "negotiating", "won", "lost"] as const;

const STAGE_LABEL: Record<string, string> = {
  new: "Mới", consulting: "Tư vấn", demo: "Demo",
  quoted: "Báo giá", negotiating: "Đàm phán", won: "Thắng", lost: "Mất",
};
const STAGE_COLOR: Record<string, string> = {
  new: "border-blue-300 bg-blue-50",
  consulting: "border-cyan-300 bg-cyan-50",
  demo: "border-purple-300 bg-purple-50",
  quoted: "border-orange-300 bg-orange-50",
  negotiating: "border-amber-300 bg-amber-50",
  won: "border-green-300 bg-green-50",
  lost: "border-red-300 bg-red-50",
};

const money = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));

export function OpportunitiesClient() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editOpp, setEditOpp] = useState<Opportunity | null>(null);
  const [viewMode, setViewMode] = useState<"pipeline" | "list">("list"); // mobile default list
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [expectedValue, setExpectedValue] = useState("");
  const [probability, setProbability] = useState("50");
  const [leadId, setLeadId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");

  // Leads + customers for dropdowns
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

  function loadOpps() {
    setLoading(true);
    fetch("/api/opportunities")
      .then(r => r.json())
      .then(res => { if (res.ok) setOpps(res.data ?? []); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadOpps();
    fetch("/api/leads").then(r => r.json()).then(res => { if (res.ok) setLeads((res.data ?? []).map((l: any) => ({ id: l.id, name: l.name }))); });
    fetch("/api/customers").then(r => r.json()).then(res => { if (res.ok) setCustomers((res.data ?? []).map((c: any) => ({ id: c.id, name: c.name }))); });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return opps;
    const q = search.toLowerCase();
    return opps.filter(o =>
      o.title.toLowerCase().includes(q) ||
      o.leads?.name?.toLowerCase().includes(q) ||
      o.customers?.name?.toLowerCase().includes(q)
    );
  }, [opps, search]);

  const byStage = useMemo(() => {
    const map: Record<string, Opportunity[]> = {};
    for (const s of STAGES) map[s] = [];
    for (const o of filtered) {
      if (map[o.stage]) map[o.stage].push(o);
      else map[o.stage] = [o];
    }
    return map;
  }, [filtered]);

  function resetForm() {
    setTitle(""); setExpectedValue(""); setProbability("50");
    setLeadId(""); setCustomerId(""); setExpectedCloseDate("");
    setFormError(null); setEditOpp(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setFormError("Tiêu đề bắt buộc"); return; }
    if (!leadId && !customerId) { setFormError("Cần chọn lead hoặc khách hàng"); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, expected_value: Number(expectedValue || 0), probability: Number(probability || 50),
          lead_id: leadId || undefined, customer_id: customerId || undefined,
          expected_close_date: expectedCloseDate || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { setFormError(json.error || "Lỗi"); return; }
      setShowCreate(false); resetForm(); loadOpps();
    } catch { setFormError("Lỗi kết nối"); }
    finally { setSaving(false); }
  }

  async function changeStage(oppId: string, newStage: string) {
    await fetch(`/api/opportunities?id=${oppId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
    loadOpps();
  }

  function contactName(o: Opportunity) {
    return o.customers?.name || o.leads?.name || "—";
  }

  // Opportunity card
  function OppCard({ o }: { o: Opportunity }) {
    const [showStages, setShowStages] = useState(false);
    return (
      <div className="rounded-xl border bg-white p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-bold text-gray-800 truncate">{o.title}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${STAGE_COLOR[o.stage]?.replace("bg-", "bg-").replace("border-", "text-") || "bg-gray-100 text-gray-600"}`}>
            {STAGE_LABEL[o.stage] ?? o.stage}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{money(Number(o.expected_value))}đ</span>
          <span className="flex items-center gap-1"><User className="h-3 w-3" />{contactName(o)}</span>
        </div>
        <div className="text-[10px] text-gray-400">{formatDateVN(o.updated_at)}</div>

        {/* Stage changer */}
        <div className="relative pt-1">
          <button onClick={() => setShowStages(!showStages)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
            <ArrowRight className="h-3 w-3" /> Chuyển giai đoạn <ChevronDown className="h-3 w-3" />
          </button>
          {showStages && (
            <div className="absolute z-10 left-0 top-7 bg-white border rounded-lg shadow-lg py-1 w-40">
              {STAGES.filter(s => s !== o.stage).map(s => (
                <button key={s} onClick={() => { changeStage(o.id, s); setShowStages(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-700">
                  {STAGE_LABEL[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Won → create order */}
        {o.stage === "won" && o.customer_id && (
          <a href={`/orders?customer_id=${o.customer_id}&opportunity_id=${o.id}`}
            className="flex items-center gap-1 text-xs text-green-600 font-medium hover:text-green-800 pt-1">
            <ShoppingCart className="h-3 w-3" /> Tạo đơn hàng
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Tìm cơ hội..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2 ml-3">
          <button onClick={() => setViewMode(v => v === "list" ? "pipeline" : "list")}
            className="px-2.5 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">
            {viewMode === "list" ? "Pipeline" : "Danh sách"}
          </button>
          <button onClick={() => { resetForm(); setShowCreate(true); }}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Tạo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>
      ) : viewMode === "list" ? (
        /* List view (mobile default) */
        <div>
          {STAGES.map(stage => {
            const items = byStage[stage] ?? [];
            if (items.length === 0) return null;
            const stageTotal = items.reduce((s, o) => s + Number(o.expected_value), 0);
            return (
              <div key={stage} className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-500 uppercase">{STAGE_LABEL[stage]} ({items.length})</span>
                  <span className="text-xs text-gray-400">{money(stageTotal)}đ</span>
                </div>
                <div className="space-y-2">
                  {items.map(o => <OppCard key={o.id} o={o} />)}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-center text-sm text-gray-400 py-8">Chưa có cơ hội nào</div>}
        </div>
      ) : (
        /* Pipeline view (horizontal scroll) */
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 300 }}>
          {STAGES.map(stage => {
            const items = byStage[stage] ?? [];
            const stageTotal = items.reduce((s, o) => s + Number(o.expected_value), 0);
            return (
              <div key={stage} className="flex-shrink-0 w-60">
                <div className={`rounded-t-lg px-2.5 py-1.5 border-t-2 ${STAGE_COLOR[stage]}`}>
                  <div className="text-xs font-bold text-gray-700">{STAGE_LABEL[stage]}</div>
                  <div className="text-[10px] text-gray-500">{items.length} · {money(stageTotal)}đ</div>
                </div>
                <div className="space-y-2 mt-2">
                  {items.map(o => <OppCard key={o.id} o={o} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">Tạo cơ hội mới</h3>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Tiêu đề *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Cung cấp 50kg/tháng" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Giá trị dự kiến (đ)</label>
                  <input type="number" value={expectedValue} onChange={e => setExpectedValue(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="5000000" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Xác suất (%)</label>
                  <input type="number" value={probability} onChange={e => setProbability(e.target.value)} min={0} max={100} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Lead</label>
                <select value={leadId} onChange={e => { setLeadId(e.target.value); if (e.target.value) setCustomerId(""); }}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Chọn lead --</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Khách hàng</label>
                <select value={customerId} onChange={e => { setCustomerId(e.target.value); if (e.target.value) setLeadId(""); }}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Chọn KH --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Ngày chốt dự kiến</label>
                <input type="date" value={expectedCloseDate} onChange={e => setExpectedCloseDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {formError && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{formError}</div>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowCreate(false); resetForm(); }} className="flex-1 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Huỷ</button>
                <button type="submit" disabled={saving} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Đang lưu..." : "Tạo cơ hội"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
