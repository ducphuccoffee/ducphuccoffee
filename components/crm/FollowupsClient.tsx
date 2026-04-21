"use client";

import { useEffect, useState, useMemo } from "react";
import { CheckCircle, AlertTriangle, Clock, Plus, ChevronRight } from "lucide-react";
import { formatDateVN } from "@/lib/date";
import Link from "next/link";

type Task = {
  id: string;
  type: string;
  status: string;
  description: string | null;
  lead_id: string | null;
  customer_id: string | null;
  opportunity_id: string | null;
  owner_user_id: string;
  due_at: string | null;
  created_at: string;
};

const TASK_LABEL: Record<string, string> = { crm_followup: "Follow-up", visit: "Ghé thăm", quotation_followup: "Theo báo giá", debt_followup: "Thu nợ" };
const STATUS_LABEL: Record<string, string> = { todo: "Cần làm", in_progress: "Đang làm", done: "Xong" };

export function FollowupsClient() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [taskType, setTaskType] = useState("crm_followup");
  const [dueAt, setDueAt] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);
  const [showDone, setShowDone] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/crm-tasks").then(r => r.json()),
      fetch("/api/crm-tasks?status=done").then(r => r.json()),
    ]).then(([active, done]) => {
      setTasks(active.data ?? []);
      setDoneTasks(done.data ?? []);
    }).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    fetch("/api/customers").then(r => r.json()).then(r => setCustomers((r.data ?? []).map((c: any) => ({ id: c.id, name: c.name }))));
    fetch("/api/leads").then(r => r.json()).then(r => setLeads((r.data ?? []).map((l: any) => ({ id: l.id, name: l.name }))));
  }, []);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowEnd = new Date(todayStart.getTime() + 2 * 86_400_000);

  const grouped = useMemo(() => {
    let list = tasks;
    if (filterType !== "all") list = list.filter(t => t.type === filterType);

    const overdue: Task[] = [];
    const today: Task[] = [];
    const upcoming: Task[] = [];

    for (const t of list) {
      if (!t.due_at) { upcoming.push(t); continue; }
      const d = new Date(t.due_at);
      if (d < todayStart) overdue.push(t);
      else if (d < tomorrowEnd) today.push(t);
      else upcoming.push(t);
    }
    return { overdue, today, upcoming };
  }, [tasks, filterType]);

  async function complete(id: string) {
    await fetch(`/api/crm-tasks?id=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) });
    load();
  }

  async function postpone(id: string) {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    await fetch(`/api/crm-tasks?id=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ due_at: tomorrow }) });
    load();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!desc.trim()) { setError("Mô tả bắt buộc"); return; }
    setSaving(true); setError(null);
    const res = await fetch("/api/crm-tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: taskType, description: desc, due_at: dueAt || undefined, customer_id: customerId || undefined, lead_id: leadId || undefined }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) { setError(json.error ?? "Lỗi"); setSaving(false); return; }
    setSaving(false); setShowCreate(false); setDesc(""); load();
  }

  function TaskCard({ t }: { t: Task }) {
    return (
      <div className="flex items-start gap-2 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded">{TASK_LABEL[t.type] ?? t.type}</span>
            <span className="text-sm text-gray-800">{t.description ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
            {t.due_at && <span>{formatDateVN(t.due_at)}</span>}
            {t.customer_id && <Link href={`/crm/customers/${t.customer_id}`} className="text-blue-500 hover:underline flex items-center gap-0.5">KH <ChevronRight className="h-2.5 w-2.5" /></Link>}
            {t.lead_id && <span>Lead</span>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => postpone(t.id)} className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-200">+1d</button>
          <button onClick={() => complete(t.id)} className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded hover:bg-green-200">Xong</button>
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
          <Plus className="h-4 w-4" /> Tạo task
        </button>
      </div>

      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {[{ key: "all", label: "Tất cả" }, ...Object.entries(TASK_LABEL).map(([k, v]) => ({ key: k, label: v }))].map(f => (
          <button key={f.key} onClick={() => setFilterType(f.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${filterType === f.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {grouped.overdue.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-red-600" /><span className="text-xs font-bold text-red-800">Quá hạn ({grouped.overdue.length})</span></div>
              <div className="divide-y divide-red-100">{grouped.overdue.map(t => <TaskCard key={t.id} t={t} />)}</div>
            </div>
          )}
          {grouped.today.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-blue-600" /><span className="text-xs font-bold text-blue-800">Hôm nay ({grouped.today.length})</span></div>
              <div className="divide-y divide-blue-100">{grouped.today.map(t => <TaskCard key={t.id} t={t} />)}</div>
            </div>
          )}
          {grouped.upcoming.length > 0 && (
            <div className="rounded-xl border bg-white p-3">
              <div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold text-gray-600">Sắp tới ({grouped.upcoming.length})</span></div>
              <div className="divide-y divide-gray-100">{grouped.upcoming.map(t => <TaskCard key={t.id} t={t} />)}</div>
            </div>
          )}
          {tasks.length === 0 && (
            <div className="rounded-xl border bg-green-50 p-4 text-center text-sm text-green-700 flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4" /> Không có task follow-up nào cần xử lý
            </div>
          )}

          {/* Done section */}
          {doneTasks.length > 0 && (
            <div>
              <button onClick={() => setShowDone(!showDone)} className="text-xs text-gray-400 hover:text-gray-600">
                {showDone ? "Ẩn" : "Hiện"} đã xong ({doneTasks.length})
              </button>
              {showDone && (
                <div className="rounded-xl border bg-gray-50 p-3 mt-1">
                  <div className="divide-y divide-gray-100">
                    {doneTasks.slice(0, 10).map(t => (
                      <div key={t.id} className="py-1.5 text-sm text-gray-400 line-through">{t.description ?? "—"}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">Tạo follow-up task</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Loại</label>
                <select value={taskType} onChange={e => setTaskType(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white">
                  {Object.entries(TASK_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Mô tả *</label>
                <input value={desc} onChange={e => setDesc(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Gọi lại xác nhận đơn hàng..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Hạn</label>
                <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Khách hàng</label>
                  <select value={customerId} onChange={e => { setCustomerId(e.target.value); if (e.target.value) setLeadId(""); }}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="">--</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Lead</label>
                  <select value={leadId} onChange={e => { setLeadId(e.target.value); if (e.target.value) setCustomerId(""); }}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="">--</option>
                    {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-3 py-2 border rounded-lg text-sm text-gray-600">Huỷ</button>
                <button type="submit" disabled={saving} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? "..." : "Tạo"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
