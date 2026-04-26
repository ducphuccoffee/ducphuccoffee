"use client";

import { useEffect, useState, useMemo } from "react";
import { CheckCircle, AlertTriangle, Clock, Plus, ChevronRight } from "lucide-react";
import { formatDateVN, formatDateTimeVN } from "@/lib/date";
import Link from "next/link";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type PlannedVisit = {
  id: string;
  customer_id: string | null;
  lead_id: string | null;
  checkin_at: string;
  note: string | null;
  customers?: { id: string; name: string } | null;
  leads?: { id: string; name: string } | null;
};

type FollowupVisit = PlannedVisit & { result: string };

export function FollowupsClient() {
  const [planned, setPlanned] = useState<PlannedVisit[]>([]);
  const [followups, setFollowups] = useState<FollowupVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [note, setNote] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/sfa-visits?planned=true").then(r => r.json()),
      fetch("/api/sfa-visits?followup_needed=true").then(r => r.json()),
    ]).then(([p, f]) => {
      setPlanned(p.data ?? []);
      setFollowups(f.data ?? []);
    }).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    fetch("/api/customers").then(r => r.json()).then(r =>
      setCustomers((r.data ?? []).map((c: any) => ({ id: c.id, name: c.name })))
    );
  }, []);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowEnd = new Date(todayStart.getTime() + 2 * 86_400_000);

  const grouped = useMemo(() => {
    const overdue: PlannedVisit[] = [];
    const today: PlannedVisit[] = [];
    const upcoming: PlannedVisit[] = [];
    for (const v of planned) {
      const d = new Date(v.checkin_at);
      if (d < todayStart) overdue.push(v);
      else if (d < tomorrowEnd) today.push(v);
      else upcoming.push(v);
    }
    return { overdue, today, upcoming };
  }, [planned, todayStart, tomorrowEnd]);

  async function postpone(id: string) {
    const tomorrow = new Date(Date.now() + 86_400_000);
    tomorrow.setHours(10, 0, 0, 0);
    await fetch(`/api/sfa-visits?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkin_at: tomorrow.toISOString() }),
    });
    load();
  }

  async function doCancel(id: string) {
    setCancelling(true);
    try {
      await fetch(`/api/sfa-visits?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "lost", note: "(huỷ kế hoạch)" }),
      });
      load();
    } finally {
      setCancelling(false);
      setCancelId(null);
    }
  }

  async function resolveFollowup(id: string) {
    // Mark as 'met_owner' to close the followup loop without losing the record.
    await fetch(`/api/sfa-visits?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: "met_owner", note: "(đã follow-up)" }),
    });
    load();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) { setError("Chọn khách hàng"); return; }
    setSaving(true); setError(null);
    const res = await fetch("/api/sfa-visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode:         "plan",
        customer_id:  customerId,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        note:         note.trim() || null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok || !json.ok) { setError(json.error ?? "Lỗi"); return; }
    setShowCreate(false); setNote(""); setCustomerId("");
    load();
  }

  function displayName(v: PlannedVisit) {
    return v.customers?.name ?? v.leads?.name ?? "—";
  }

  function PlannedCard({ v }: { v: PlannedVisit }) {
    const checkinHref = v.customer_id
      ? `/crm/sfa?customer_id=${v.customer_id}&visit_id=${v.id}`
      : `/crm/sfa?visit_id=${v.id}`;
    return (
      <div className="flex items-start gap-2 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded">Ghé thăm</span>
            <span className="text-sm text-gray-800 truncate">{displayName(v)}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
            <span>{formatDateTimeVN(v.checkin_at)}</span>
            {v.note && <span className="truncate">· {v.note}</span>}
            {v.customer_id && <Link href={`/crm/customers/${v.customer_id}`} className="text-blue-500 hover:underline flex items-center gap-0.5">KH <ChevronRight className="h-2.5 w-2.5" /></Link>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Link href={checkinHref} className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700">Check-in</Link>
          <button onClick={() => postpone(v.id)} className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-200">+1d</button>
          <button onClick={() => setCancelId(v.id)} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-200">Huỷ</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-700">Follow-up Center</h2>
        <button onClick={() => { setError(null); setShowCreate(true); }}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Lên kế hoạch visit
        </button>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {grouped.overdue.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-red-600" /><span className="text-xs font-bold text-red-800">Quá hạn ({grouped.overdue.length})</span></div>
              <div className="divide-y divide-red-100">{grouped.overdue.map(v => <PlannedCard key={v.id} v={v} />)}</div>
            </div>
          )}
          {grouped.today.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-blue-600" /><span className="text-xs font-bold text-blue-800">Hôm nay ({grouped.today.length})</span></div>
              <div className="divide-y divide-blue-100">{grouped.today.map(v => <PlannedCard key={v.id} v={v} />)}</div>
            </div>
          )}
          {grouped.upcoming.length > 0 && (
            <div className="rounded-xl border bg-white p-3">
              <div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold text-gray-600">Sắp tới ({grouped.upcoming.length})</span></div>
              <div className="divide-y divide-gray-100">{grouped.upcoming.map(v => <PlannedCard key={v.id} v={v} />)}</div>
            </div>
          )}
          {planned.length === 0 && (
            <div className="rounded-xl border bg-green-50 p-4 text-center text-sm text-green-700 flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4" /> Không có kế hoạch ghé thăm nào
            </div>
          )}

          {/* Follow-up needed (from check-ins with result='followup_needed') */}
          {followups.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-800">Cần follow-up sau ghé thăm ({followups.length})</span>
              </div>
              <div className="divide-y divide-amber-100">
                {followups.map(f => (
                  <div key={f.id} className="flex items-start gap-2 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800 truncate">{displayName(f)}</div>
                      {f.note && <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{f.note}</div>}
                      <div className="text-[10px] text-amber-700 mt-0.5">{formatDateVN(f.checkin_at)}</div>
                    </div>
                    <button onClick={() => resolveFollowup(f.id)}
                      className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded hover:bg-green-200 shrink-0">
                      Đã xử lý
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create (plan visit) sheet */}
      <Sheet
        open={showCreate}
        onClose={() => !saving && setShowCreate(false)}
        title={<h3 className="text-base font-bold text-gray-800">Lên kế hoạch ghé thăm</h3>}
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-3 py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50" disabled={saving}>Huỷ</button>
            <button type="submit" form="plan-visit-form" disabled={saving || !customerId} className="flex-1 px-3 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Đang lưu…" : "Lên kế hoạch"}
            </button>
          </div>
        }
      >
        <form id="plan-visit-form" onSubmit={handleCreate} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Khách hàng *</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border rounded-lg text-sm bg-white">
              <option value="">-- Chọn KH --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Giờ dự kiến</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Ghi chú</label>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="Chào hàng sản phẩm mới…"
              className="w-full mt-1 px-3 py-2.5 border rounded-lg text-sm" />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}
        </form>
      </Sheet>

      {/* Confirm cancel visit */}
      <ConfirmDialog
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={() => { if (cancelId) return doCancel(cancelId); }}
        title="Huỷ kế hoạch ghé thăm?"
        description="Visit sẽ bị đánh dấu là 'lost' và biến mất khỏi danh sách kế hoạch."
        confirmLabel="Huỷ kế hoạch"
        loading={cancelling}
        destructive
      />
    </div>
  );
}
