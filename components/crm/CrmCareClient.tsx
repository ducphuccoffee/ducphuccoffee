"use client";

import { formatDateVN, formatDateTimeVN } from "@/lib/date";
import { useState, useMemo } from "react";
import {
  computeAttentionStatus,
  daysSince,
  overdueDays,
  buildTimeline,
  ATTENTION_CONFIG,
  SEGMENT_CONFIG,
  computeCrmSegment,
  type AttentionStatus,
  type CrmSegment,
  type TimelineItem,
  CRM_THRESHOLDS,
} from "@/lib/crm-automation";

// ── Types ─────────────────────────────────────────────────────────────────

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
  crm_segment: string | null;
  order_count: number;
  revenue: number;
  last_order: string | null;
}

export interface Profile { id: string; full_name: string }
export interface Note {
  id: string;
  content: string;
  created_by: string;
  created_at: string;
  profiles?: { full_name?: string | null } | null;
}

type FilterAttention = "all" | "overdue_followup" | "at_risk" | "churn_risk" | "need_attention" | "healthy" | "new";

const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n ?? 0);

// ── Main component ─────────────────────────────────────────────────────────

export function CrmCareClient({
  initialCustomers,
  profiles,
  currentUserId,
  isAdmin,
}: {
  initialCustomers: CrmCustomer[];
  profiles: Profile[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [customers, setCustomers] = useState<CrmCustomer[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [filterAttention, setFilterAttention] = useState<FilterAttention>("all");
  const [selected, setSelected] = useState<CrmCustomer | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "timeline" | "notes">("info");

  // Detail panel state
  const [notes, setNotes] = useState<Note[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editFollowUp, setEditFollowUp] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Enrich with automation status ──────────────────────────────────────
  const enriched = useMemo(() =>
    customers.map(c => ({
      ...c,
      days_since: daysSince(c.last_order),
      attention: computeAttentionStatus(
        daysSince(c.last_order),
        c.next_follow_up_at,
        c.order_count
      ),
      segment: computeCrmSegment(c.order_count, c.revenue, daysSince(c.last_order), c.crm_segment),
      overdue: overdueDays(c.next_follow_up_at),
    })), [customers]);

  // ── Filtering ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = enriched;
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.assigned_name ?? "").toLowerCase().includes(q)
    );
    if (filterAttention !== "all") rows = rows.filter(c => c.attention === filterAttention);
    // Sort: overdue first, then at_risk, then by days_since desc
    return rows.sort((a, b) => {
      const priority: Record<string, number> = {
        overdue_followup: 0, churn_risk: 1, at_risk: 2,
        need_attention: 3, new: 4, healthy: 5,
      };
      const pa = priority[a.attention] ?? 5;
      const pb = priority[b.attention] ?? 5;
      if (pa !== pb) return pa - pb;
      return (b.days_since ?? -1) - (a.days_since ?? -1);
    });
  }, [enriched, search, filterAttention]);

  // ── Summary counts ────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:   enriched.length,
    overdue: enriched.filter(c => c.attention === "overdue_followup").length,
    atRisk:  enriched.filter(c => c.attention === "at_risk" || c.attention === "churn_risk").length,
    revenue: enriched.reduce((s, c) => s + c.revenue, 0),
  }), [enriched]);

  // ── Open detail ────────────────────────────────────────────────────────
  async function openDetail(c: typeof enriched[number]) {
    setSelected(c);
    setActiveTab("info");
    setNoteText("");
    setError(null);
    setEditFollowUp(c.next_follow_up_at ? c.next_follow_up_at.slice(0, 16) : "");
    setLoadingDetail(true);
    const [noteRes, visitRes, orderRes] = await Promise.all([
      fetch(`/api/crm/notes?customer_id=${c.id}`).then(r => r.json()),
      fetch(`/api/crm/visits?customer_id=${c.id}`).then(r => r.json()),
      fetch(`/api/orders?customer_id=${c.id}`).then(r => r.json()),
    ]);
    setNotes(noteRes.data ?? []);
    setVisits(visitRes.data ?? []);
    setOrders(orderRes.data ?? []);
    setLoadingDetail(false);
  }

  // ── Notes CRUD ─────────────────────────────────────────────────────────
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

  // ── Follow-up save ─────────────────────────────────────────────────────
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
      setSelected(updated as any);
      setCustomers(prev =>
        prev.map(c => c.id === selected.id ? { ...c, next_follow_up_at: editFollowUp || null } : c)
      );
    }
    setSavingFollowUp(false);
  }

  const timeline: TimelineItem[] = useMemo(() =>
    buildTimeline(orders, notes, visits), [orders, notes, visits]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-10">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Tổng khách" value={stats.total} />
        <StatCard label="Follow-up trễ" value={stats.overdue} highlight={stats.overdue > 0} color="purple" />
        <StatCard label="Có nguy cơ rớt" value={stats.atRisk}  highlight={stats.atRisk > 0}  color="red" />
        <StatCard label="Doanh thu" value={money(stats.revenue)} small />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <input
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px] focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Tìm tên, SĐT, phụ trách…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={filterAttention}
          onChange={e => setFilterAttention(e.target.value as FilterAttention)}
        >
          <option value="all">Tất cả ({enriched.length})</option>
          <option value="overdue_followup">⏰ Follow-up trễ ({enriched.filter(c => c.attention === "overdue_followup").length})</option>
          <option value="churn_risk">✕ Nguy cơ mất ({enriched.filter(c => c.attention === "churn_risk").length})</option>
          <option value="at_risk">⚠ Rủi ro ({enriched.filter(c => c.attention === "at_risk").length})</option>
          <option value="need_attention">! Cần chú ý ({enriched.filter(c => c.attention === "need_attention").length})</option>
          <option value="healthy">✓ Bình thường ({enriched.filter(c => c.attention === "healthy").length})</option>
          <option value="new">★ Mới ({enriched.filter(c => c.attention === "new").length})</option>
        </select>
      </div>

      {/* Customer cards — mobile-first */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            Không có khách hàng nào
          </div>
        )}
        {filtered.map(c => {
          const attnCfg = ATTENTION_CONFIG[c.attention];
          const segCfg  = SEGMENT_CONFIG[c.segment];
          return (
            <button
              key={c.id}
              onClick={() => openDetail(c)}
              className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-blue-300 hover:shadow-sm transition active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800 text-sm">{c.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${attnCfg.bg} ${attnCfg.color}`}>
                      {attnCfg.icon} {attnCfg.label}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${segCfg.bg} ${segCfg.color}`}>
                      {segCfg.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-gray-500">
                    {c.phone && <span>📞 {c.phone}</span>}
                    {c.assigned_name && <span>👤 {c.assigned_name}</span>}
                    <span>🛒 {c.order_count} đơn</span>
                    {c.revenue > 0 && <span>💰 {money(c.revenue)}</span>}
                    {c.days_since != null && (
                      <span className={c.days_since >= CRM_THRESHOLDS.DAYS_AT_RISK ? "text-red-500 font-medium" : ""}>
                        🕒 {c.days_since} ngày chưa mua
                      </span>
                    )}
                  </div>
                </div>
                {/* Follow-up indicator */}
                {c.next_follow_up_at && (
                  <div className={`text-xs shrink-0 rounded-lg px-2 py-1 ${c.overdue != null ? "bg-red-100 text-red-700 font-semibold" : "bg-amber-50 text-amber-700"}`}>
                    {c.overdue != null ? `⏰ Trễ ${c.overdue}n` : `📅 ${formatDateVN(c.next_follow_up_at)}`}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail slide-in panel */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white w-full max-w-lg h-full overflow-hidden flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="px-4 py-4 border-b border-gray-100 flex items-start justify-between gap-2 shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-800 truncate">{selected.name}</h2>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {selected.phone && (
                    <a href={`tel:${selected.phone}`}
                      className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 hover:bg-blue-100">
                      📞 {selected.phone}
                    </a>
                  )}
                  <AttentionBadge status={(selected as any).attention ?? computeAttentionStatus(
                    daysSince(selected.last_order), selected.next_follow_up_at, selected.order_count
                  )} />
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none shrink-0"
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 shrink-0">
              {(["info", "timeline", "notes"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-xs font-medium transition ${
                    activeTab === tab
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "info" ? "Thông tin" : tab === "timeline" ? "Timeline" : "Ghi chú"}
                </button>
              ))}
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto">
              {loadingDetail ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Đang tải…</div>
              ) : (
                <>
                  {/* INFO tab */}
                  {activeTab === "info" && (
                    <div className="p-4 space-y-4">
                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-2">
                        <MetricBox label="Đơn hàng"  value={String(selected.order_count)} />
                        <MetricBox label="Doanh thu" value={selected.revenue > 0 ? money(selected.revenue) : "—"} small />
                        <MetricBox
                          label="Đơn gần nhất"
                          value={selected.last_order
                            ? `${daysSince(selected.last_order)}n trước`
                            : "Chưa có"}
                        />
                      </div>

                      {/* Info rows */}
                      <dl className="space-y-2 text-sm">
                        {selected.address && <InfoItem k="Địa chỉ" v={selected.address} />}
                        {selected.assigned_name && <InfoItem k="Phụ trách" v={selected.assigned_name} />}
                        {selected.crm_segment && <InfoItem k="Phân khúc" v={SEGMENT_CONFIG[selected.crm_segment as CrmSegment]?.label ?? selected.crm_segment} />}
                        {(selected.latitude && selected.longitude) && (
                          <InfoItem k="Toạ độ" v={`${selected.latitude}, ${selected.longitude}`} />
                        )}
                      </dl>

                      {/* Follow-up section */}
                      <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-up tiếp theo</p>
                        {selected.next_follow_up_at && (
                          <p className={`text-sm font-medium ${
                            (selected as any).overdue != null ? "text-red-600" : "text-amber-600"
                          }`}>
                            {(selected as any).overdue != null
                              ? `⏰ Trễ ${(selected as any).overdue} ngày — ${formatDateTimeVN(selected.next_follow_up_at)}`
                              : `📅 ${formatDateTimeVN(selected.next_follow_up_at)}`}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="datetime-local"
                            value={editFollowUp}
                            onChange={e => setEditFollowUp(e.target.value)}
                            className="border rounded-lg px-2 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <button
                            onClick={saveFollowUp}
                            disabled={savingFollowUp}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            {savingFollowUp ? "…" : "Lưu"}
                          </button>
                        </div>
                        {editFollowUp && (
                          <button
                            onClick={() => { setEditFollowUp(""); }}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Xoá lịch follow-up
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TIMELINE tab */}
                  {activeTab === "timeline" && (
                    <div className="p-4">
                      {timeline.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">Chưa có lịch sử hoạt động</p>
                      ) : (
                        <ol className="relative border-l border-gray-200 space-y-4 ml-2">
                          {timeline.map(item => (
                            <li key={item.id} className="pl-4">
                              <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-white border-2 border-blue-400" />
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-400">{formatDateTimeVN(item.ts)}</p>
                                  <p className="text-sm font-medium text-gray-800 mt-0.5">
                                    {item.type === "order" ? "🛒" : item.type === "note" ? "📝" : "📍"} {item.title}
                                  </p>
                                  {item.subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{item.subtitle}</p>}
                                </div>
                                {item.badge && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 font-medium ${
                                    item.badge_color === "green" ? "bg-green-100 text-green-700" :
                                    item.badge_color === "red"   ? "bg-red-100 text-red-700" :
                                    "bg-blue-100 text-blue-700"
                                  }`}>
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}

                  {/* NOTES tab */}
                  {activeTab === "notes" && (
                    <div className="p-4 space-y-3">
                      {/* Add note */}
                      <div className="flex gap-2">
                        <textarea
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          rows={2}
                          placeholder="Nhập ghi chú chăm sóc…"
                          className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                        />
                        <button
                          onClick={addNote}
                          disabled={savingNote || !noteText.trim()}
                          className="px-3 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 self-stretch"
                        >
                          {savingNote ? "…" : "+ Thêm"}
                        </button>
                      </div>
                      {error && <p className="text-red-500 text-xs">{error}</p>}

                      {/* Note list */}
                      {notes.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4 text-center">Chưa có ghi chú</p>
                      ) : (
                        <ul className="space-y-2">
                          {notes.map(n => (
                            <li key={n.id} className="bg-gray-50 rounded-xl p-3 text-sm">
                              <div className="flex justify-between items-start gap-2">
                                <p className="text-gray-700 flex-1 leading-snug">{n.content}</p>
                                <button
                                  onClick={() => deleteNote(n.id)}
                                  className="text-gray-300 hover:text-red-400 text-xs shrink-0 mt-0.5"
                                >
                                  ✕
                                </button>
                              </div>
                              <p className="text-xs text-gray-400 mt-1.5">
                                {(n.profiles as any)?.full_name ?? "—"} · {formatDateTimeVN(n.created_at)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatCard({
  label, value, highlight = false, color = "blue", small = false,
}: {
  label: string; value: string | number; highlight?: boolean; color?: string; small?: boolean;
}) {
  const bg: Record<string, string> = {
    blue:   "bg-white border-gray-200",
    purple: "bg-purple-50 border-purple-200",
    red:    "bg-red-50 border-red-200",
  };
  const text: Record<string, string> = {
    blue:   "text-gray-800",
    purple: "text-purple-700",
    red:    "text-red-700",
  };
  return (
    <div className={`rounded-xl border p-3 ${highlight ? bg[color] : "bg-white border-gray-200"}`}>
      <p className="text-xs text-gray-500 truncate">{label}</p>
      <p className={`font-bold mt-1 ${small ? "text-sm" : "text-2xl"} ${highlight ? text[color] : "text-gray-800"}`}>
        {value}
      </p>
    </div>
  );
}

function AttentionBadge({ status }: { status: AttentionStatus }) {
  const cfg = ATTENTION_CONFIG[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function MetricBox({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-500 truncate">{label}</p>
      <p className={`font-bold text-gray-800 mt-1 leading-tight ${small ? "text-xs" : "text-sm"}`}>{value}</p>
    </div>
  );
}

function InfoItem({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-gray-400 w-24 shrink-0">{k}</dt>
      <dd className="text-gray-700 flex-1 min-w-0 break-words">{v}</dd>
    </div>
  );
}
