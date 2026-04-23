"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDateVN, formatDateTimeVN } from "@/lib/date";
import {
  Phone, MapPin, FileText, CreditCard, AlertTriangle, CheckCircle, Clock,
  Users, Target, TrendingDown, Plus, ArrowRight, RefreshCw,
} from "lucide-react";

type Task = {
  id: string;
  type: string;
  description: string | null;
  lead_id: string | null;
  customer_id: string | null;
  opportunity_id: string | null;
  due_at: string | null;
  created_at: string;
};

type Visit = {
  id: string;
  customer_id: string | null;
  lead_id: string | null;
  checkin_at: string;
  result: string | null;
  note: string | null;
  display_name: string;
};

type StaleLead = { id: string; name: string; phone: string | null; status: string; temperature: string; days_since_update: number | null };
type StuckOpp = { id: string; title: string; stage: string; expected_value: number; expected_close_date: string | null; contact_name: string; days_stuck: number | null; is_past_due: boolean };
type CustomerOverdue = { id: string; name: string; phone: string | null; next_follow_up_at: string | null; overdue_days: number | null };
type DormantCustomer = { id: string; name: string; phone: string | null; last_order_at: string | null; days_since_last_order: number | null };

type Summary = {
  calls_total: number; calls_overdue: number;
  visits_planned: number; visits_overdue: number; visits_done_today: number;
  quotations_todo: number; debts_todo: number;
  stale_leads: number; stuck_opps: number;
  customers_overdue: number; dormant_customers: number;
};

type ApiResponse = {
  summary: Summary;
  calls: { overdue: Task[]; today: Task[] };
  visits: { planned_overdue: Task[]; planned_today: Task[]; done_today: Visit[] };
  quotations: Task[];
  debts: Task[];
  upcoming: Task[];
  stale_leads: StaleLead[];
  stuck_opportunities: StuckOpp[];
  customers_overdue: CustomerOverdue[];
  dormant_customers: DormantCustomer[];
};

const money = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));

const STAGE_LABEL: Record<string, string> = {
  new: "Mới", consulting: "Tư vấn", demo: "Demo",
  quoted: "Báo giá", negotiating: "Đàm phán", won: "Thắng", lost: "Mất",
};
const LEAD_STATUS_LABEL: Record<string, string> = {
  new: "Mới", contacted: "Đã LH", meeting_scheduled: "Hẹn", quoted: "Báo giá",
};

export function SalesTodayClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [showPlan, setShowPlan] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/sales-today").then(r => r.json());
      if (r.ok) setData(r.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    fetch("/api/customers").then(r => r.json()).then(r => {
      setCustomers((r.data ?? []).map((c: any) => ({ id: c.id, name: c.name })));
    });
  }, []);

  async function completeTask(id: string) {
    setBusyId(id);
    await fetch(`/api/crm-tasks?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    setBusyId(null);
    load();
  }

  async function postponeTask(id: string) {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    setBusyId(id);
    await fetch(`/api/crm-tasks?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ due_at: tomorrow }),
    });
    setBusyId(null);
    load();
  }

  async function logCall(task: Task) {
    if (!task.lead_id && !task.customer_id) { completeTask(task.id); return; }
    setBusyId(task.id);
    await fetch("/api/crm-activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "call",
        content: task.description ? `Đã gọi: ${task.description}` : "Đã gọi",
        lead_id: task.lead_id ?? undefined,
        customer_id: task.customer_id ?? undefined,
      }),
    });
    await fetch(`/api/crm-tasks?id=${task.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    setBusyId(null);
    load();
  }

  const allEmpty = useMemo(() => {
    if (!data) return false;
    const s = data.summary;
    return (
      s.calls_total + s.visits_planned + s.quotations_todo + s.debts_todo +
      s.stale_leads + s.stuck_opps + s.customers_overdue + s.dormant_customers === 0
    );
  }, [data]);

  if (loading) {
    return <div className="space-y-3 animate-pulse">{[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}</div>;
  }

  if (!data) return <div className="text-sm text-gray-500 p-4">Không tải được dữ liệu</div>;

  const s = data.summary;

  return (
    <div className="space-y-4 pb-10">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700">Việc cần làm hôm nay</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowPlan(true)}
            className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" /> Kế hoạch visit
          </button>
          <button onClick={load} className="p-1.5 border rounded-lg text-gray-500 hover:bg-gray-50" aria-label="Làm mới">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-2">
        <KpiTile label="Gọi" value={s.calls_total} alert={s.calls_overdue > 0} icon={<Phone className="h-3.5 w-3.5" />} />
        <KpiTile label="Visit" value={s.visits_planned} alert={s.visits_overdue > 0} icon={<MapPin className="h-3.5 w-3.5" />} sub={`${s.visits_done_today} xong`} />
        <KpiTile label="Báo giá" value={s.quotations_todo} icon={<FileText className="h-3.5 w-3.5" />} />
        <KpiTile label="Thu nợ" value={s.debts_todo} icon={<CreditCard className="h-3.5 w-3.5" />} />
      </div>

      {allEmpty && (
        <div className="rounded-xl border bg-green-50 p-4 text-center text-sm text-green-700 flex items-center justify-center gap-2">
          <CheckCircle className="h-4 w-4" /> Tuyệt! Hôm nay không còn việc cần xử lý.
        </div>
      )}

      {/* CALLS — overdue + today */}
      {(data.calls.overdue.length > 0 || data.calls.today.length > 0) && (
        <Section
          title="Cần gọi / follow-up"
          icon={<Phone className="h-4 w-4 text-blue-600" />}
          count={data.calls.overdue.length + data.calls.today.length}
          accent={data.calls.overdue.length > 0 ? "red" : "blue"}
        >
          {data.calls.overdue.length > 0 && (
            <GroupLabel label={`Quá hạn (${data.calls.overdue.length})`} color="red" />
          )}
          {data.calls.overdue.map(t => (
            <CallRow key={t.id} task={t} busy={busyId === t.id} overdue onComplete={() => logCall(t)} onPostpone={() => postponeTask(t.id)} />
          ))}
          {data.calls.today.length > 0 && (
            <GroupLabel label={`Hôm nay (${data.calls.today.length})`} color="blue" />
          )}
          {data.calls.today.map(t => (
            <CallRow key={t.id} task={t} busy={busyId === t.id} onComplete={() => logCall(t)} onPostpone={() => postponeTask(t.id)} />
          ))}
        </Section>
      )}

      {/* VISITS — planned + done */}
      {(data.visits.planned_overdue.length > 0 || data.visits.planned_today.length > 0 || data.visits.done_today.length > 0) && (
        <Section
          title="Ghé thăm hôm nay"
          icon={<MapPin className="h-4 w-4 text-orange-600" />}
          count={data.visits.planned_overdue.length + data.visits.planned_today.length}
          accent={data.visits.planned_overdue.length > 0 ? "red" : "orange"}
          extraLink={{ label: "Mở SFA", href: "/crm/sfa" }}
        >
          {data.visits.planned_overdue.length > 0 && <GroupLabel label={`Chưa thực hiện (${data.visits.planned_overdue.length})`} color="red" />}
          {data.visits.planned_overdue.map(t => (
            <VisitPlanRow key={t.id} task={t} busy={busyId === t.id} overdue onComplete={() => completeTask(t.id)} onPostpone={() => postponeTask(t.id)} />
          ))}
          {data.visits.planned_today.length > 0 && <GroupLabel label={`Kế hoạch hôm nay (${data.visits.planned_today.length})`} color="orange" />}
          {data.visits.planned_today.map(t => (
            <VisitPlanRow key={t.id} task={t} busy={busyId === t.id} onComplete={() => completeTask(t.id)} onPostpone={() => postponeTask(t.id)} />
          ))}
          {data.visits.done_today.length > 0 && (
            <>
              <GroupLabel label={`Đã check-in (${data.visits.done_today.length})`} color="green" />
              {data.visits.done_today.map(v => (
                <div key={v.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-gray-700 truncate">{v.display_name}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{formatDateTimeVN(v.checkin_at)}</span>
                </div>
              ))}
            </>
          )}
        </Section>
      )}

      {/* QUOTATIONS */}
      {data.quotations.length > 0 && (
        <Section
          title="Theo báo giá"
          icon={<FileText className="h-4 w-4 text-amber-600" />}
          count={data.quotations.length}
          accent="amber"
        >
          {data.quotations.map(t => (
            <QuotationRow key={t.id} task={t} busy={busyId === t.id} onComplete={() => completeTask(t.id)} onPostpone={() => postponeTask(t.id)} />
          ))}
        </Section>
      )}

      {/* DEBTS */}
      {data.debts.length > 0 && (
        <Section
          title="Thu nợ"
          icon={<CreditCard className="h-4 w-4 text-red-600" />}
          count={data.debts.length}
          accent="red"
          extraLink={{ label: "Báo cáo nợ", href: "/reports/debt" }}
        >
          {data.debts.map(t => (
            <DebtRow key={t.id} task={t} busy={busyId === t.id} onComplete={() => completeTask(t.id)} onPostpone={() => postponeTask(t.id)} />
          ))}
        </Section>
      )}

      {/* STUCK OPPS */}
      {data.stuck_opportunities.length > 0 && (
        <Section
          title="Cơ hội cần hành động"
          icon={<Target className="h-4 w-4 text-purple-600" />}
          count={data.stuck_opportunities.length}
          accent="purple"
          extraLink={{ label: "Tất cả cơ hội", href: "/crm/opportunities" }}
        >
          {data.stuck_opportunities.slice(0, 8).map(o => (
            <Link key={o.id} href={`/crm/opportunities`} className="flex items-start justify-between py-2 hover:bg-gray-50 -mx-1 px-1 rounded">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-800 truncate">{o.title}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded">{STAGE_LABEL[o.stage] ?? o.stage}</span>
                </div>
                <div className="flex gap-2 text-[10px] text-gray-500 mt-0.5">
                  <span>{o.contact_name}</span>
                  <span>•</span>
                  <span>{money(Number(o.expected_value))}đ</span>
                  {o.days_stuck != null && o.days_stuck > 0 && <><span>•</span><span className="text-amber-600">Kẹt {o.days_stuck}n</span></>}
                  {o.is_past_due && <><span>•</span><span className="text-red-600">Quá hạn chốt</span></>}
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-gray-300 shrink-0 mt-1" />
            </Link>
          ))}
        </Section>
      )}

      {/* STALE LEADS */}
      {data.stale_leads.length > 0 && (
        <Section
          title="Lead chưa chăm sóc"
          icon={<Users className="h-4 w-4 text-indigo-600" />}
          count={data.stale_leads.length}
          accent="indigo"
          extraLink={{ label: "Danh sách lead", href: "/leads" }}
        >
          {data.stale_leads.slice(0, 8).map(l => (
            <div key={l.id} className="flex items-center justify-between py-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-800 truncate">{l.name}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded">{LEAD_STATUS_LABEL[l.status] ?? l.status}</span>
                  {l.temperature === "hot" && <span className="text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded">Hot</span>}
                </div>
                <div className="text-[10px] text-amber-600 mt-0.5">Không hoạt động {l.days_since_update}n</div>
              </div>
              {l.phone && (
                <a href={`tel:${l.phone}`} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 shrink-0">Gọi</a>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* CUSTOMERS OVERDUE */}
      {data.customers_overdue.length > 0 && (
        <Section
          title="Khách hẹn follow-up đã trễ"
          icon={<Clock className="h-4 w-4 text-pink-600" />}
          count={data.customers_overdue.length}
          accent="pink"
          extraLink={{ label: "Customer Care", href: "/crm/care" }}
        >
          {data.customers_overdue.slice(0, 8).map(c => (
            <div key={c.id} className="flex items-center justify-between py-1.5">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-gray-800 truncate block">{c.name}</span>
                {c.next_follow_up_at && (
                  <div className="text-[10px] text-red-600 mt-0.5">
                    Trễ {c.overdue_days}n ({formatDateVN(c.next_follow_up_at)})
                  </div>
                )}
              </div>
              {c.phone && (
                <a href={`tel:${c.phone}`} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 shrink-0">Gọi</a>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* DORMANT CUSTOMERS */}
      {data.dormant_customers.length > 0 && (
        <Section
          title="Khách lâu không mua"
          icon={<TrendingDown className="h-4 w-4 text-gray-600" />}
          count={data.dormant_customers.length}
          accent="gray"
          extraLink={{ label: "Customer Care", href: "/crm/care" }}
        >
          {data.dormant_customers.map(c => (
            <div key={c.id} className="flex items-center justify-between py-1.5">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-gray-800 truncate block">{c.name}</span>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {c.days_since_last_order != null ? `${c.days_since_last_order}n chưa mua` : "Chưa có đơn"}
                </div>
              </div>
              {c.phone && (
                <a href={`tel:${c.phone}`} className="text-[10px] bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 shrink-0">Gọi</a>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Plan visit modal */}
      {showPlan && (
        <PlanVisitModal
          customers={customers}
          onClose={() => setShowPlan(false)}
          onCreated={() => { setShowPlan(false); load(); }}
        />
      )}
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────

function KpiTile({ label, value, sub, alert, icon }: { label: string; value: number; sub?: string; alert?: boolean; icon: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-2.5 ${alert ? "border-red-200 bg-red-50" : "bg-white border-gray-200"}`}>
      <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wider ${alert ? "text-red-600" : "text-gray-400"}`}>
        {icon}<span className="truncate">{label}</span>
      </div>
      <div className={`text-xl font-bold mt-0.5 ${alert ? "text-red-700" : "text-gray-800"}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  );
}

function Section({
  title, icon, count, accent = "blue", extraLink, children,
}: {
  title: string; icon: React.ReactNode; count: number;
  accent?: "red" | "blue" | "orange" | "amber" | "purple" | "indigo" | "pink" | "gray" | "green";
  extraLink?: { label: string; href: string };
  children: React.ReactNode;
}) {
  const borderClass: Record<string, string> = {
    red: "border-red-200", blue: "border-blue-200", orange: "border-orange-200",
    amber: "border-amber-200", purple: "border-purple-200", indigo: "border-indigo-200",
    pink: "border-pink-200", gray: "border-gray-200", green: "border-green-200",
  };
  return (
    <div className={`rounded-xl border bg-white ${borderClass[accent]}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-bold text-gray-700">{title}</span>
          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{count}</span>
        </div>
        {extraLink && (
          <Link href={extraLink.href} className="text-[11px] text-blue-600 hover:underline">
            {extraLink.label} →
          </Link>
        )}
      </div>
      <div className="px-3 py-2 divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function GroupLabel({ label, color }: { label: string; color: "red" | "orange" | "blue" | "green" }) {
  const cls: Record<string, string> = {
    red: "text-red-600", orange: "text-orange-600", blue: "text-blue-600", green: "text-green-600",
  };
  return <div className={`text-[10px] uppercase tracking-wider font-bold mt-2 first:mt-0 ${cls[color]}`}>{label}</div>;
}

function TaskActions({ busy, onComplete, onPostpone, completeLabel = "Xong" }: { busy: boolean; onComplete: () => void; onPostpone: () => void; completeLabel?: string }) {
  return (
    <div className="flex gap-1 shrink-0">
      <button onClick={onPostpone} disabled={busy}
        className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-200 disabled:opacity-50">+1d</button>
      <button onClick={onComplete} disabled={busy}
        className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded hover:bg-green-200 disabled:opacity-50">{completeLabel}</button>
    </div>
  );
}

function CallRow({ task, busy, overdue, onComplete, onPostpone }: { task: Task; busy: boolean; overdue?: boolean; onComplete: () => void; onPostpone: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-800">{task.description ?? "Follow-up"}</div>
        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
          {task.due_at && <span className={overdue ? "text-red-600 font-medium" : ""}>{formatDateVN(task.due_at)}</span>}
          {task.customer_id && <Link href={`/crm/customers/${task.customer_id}`} className="text-blue-500 hover:underline">KH</Link>}
          {task.lead_id && <Link href="/leads" className="text-blue-500 hover:underline">Lead</Link>}
        </div>
      </div>
      <TaskActions busy={busy} onComplete={onComplete} onPostpone={onPostpone} completeLabel="Đã gọi" />
    </div>
  );
}

function VisitPlanRow({ task, busy, overdue, onComplete, onPostpone }: { task: Task; busy: boolean; overdue?: boolean; onComplete: () => void; onPostpone: () => void }) {
  const checkinHref = task.customer_id ? `/crm/sfa?customer_id=${task.customer_id}&task_id=${task.id}` : `/crm/sfa?task_id=${task.id}`;
  return (
    <div className="flex items-start justify-between gap-2 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-800">{task.description ?? "Ghé thăm"}</div>
        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
          {task.due_at && <span className={overdue ? "text-red-600 font-medium" : ""}>{formatDateVN(task.due_at)}</span>}
          {task.customer_id && <Link href={`/crm/customers/${task.customer_id}`} className="text-blue-500 hover:underline">KH</Link>}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Link href={checkinHref}
          className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700">Check-in</Link>
        <button onClick={onPostpone} disabled={busy}
          className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-200 disabled:opacity-50">+1d</button>
      </div>
    </div>
  );
}

function QuotationRow({ task, busy, onComplete, onPostpone }: { task: Task; busy: boolean; onComplete: () => void; onPostpone: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-800">{task.description ?? "Theo báo giá"}</div>
        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
          {task.due_at && <span>{formatDateVN(task.due_at)}</span>}
          {task.opportunity_id && <Link href="/crm/opportunities" className="text-blue-500 hover:underline">Cơ hội</Link>}
        </div>
      </div>
      <TaskActions busy={busy} onComplete={onComplete} onPostpone={onPostpone} />
    </div>
  );
}

function DebtRow({ task, busy, onComplete, onPostpone }: { task: Task; busy: boolean; onComplete: () => void; onPostpone: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-800">{task.description ?? "Thu nợ"}</div>
        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
          {task.due_at && <span>{formatDateVN(task.due_at)}</span>}
          {task.customer_id && <Link href={`/crm/customers/${task.customer_id}`} className="text-blue-500 hover:underline">KH</Link>}
        </div>
      </div>
      <TaskActions busy={busy} onComplete={onComplete} onPostpone={onPostpone} completeLabel="Đã thu" />
    </div>
  );
}

function PlanVisitModal({ customers, onClose, onCreated }: {
  customers: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date();
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) { setError("Chọn khách hàng"); return; }
    setSaving(true); setError(null);
    const res = await fetch("/api/crm-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "visit",
        description: note.trim() || "Ghé thăm khách hàng",
        customer_id: customerId,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok || !json.ok) { setError(json.error ?? "Lỗi"); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto p-4 space-y-3">
        <h3 className="text-base font-bold text-gray-800">Lên kế hoạch ghé thăm</h3>
        <div>
          <label className="text-xs font-medium text-gray-600">Khách hàng *</label>
          <select value={customerId} onChange={e => setCustomerId(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="">-- Chọn KH --</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Giờ dự kiến</label>
          <input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Ghi chú</label>
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="Chào hàng sản phẩm mới…"
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-3 py-2 border rounded-lg text-sm text-gray-600">Huỷ</button>
          <button type="submit" disabled={saving} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {saving ? "Đang lưu…" : "Lên kế hoạch"}
          </button>
        </div>
      </form>
    </div>
  );
}
