"use client";

import { useEffect, useState } from "react";
import { formatDateVN } from "@/lib/date";
import { AlertTriangle, CheckCircle, Phone, MapPin, TrendingUp, Users, Target, Briefcase } from "lucide-react";
import Link from "next/link";

type KPI = {
  total_leads: number;
  converted_leads: number;
  total_opportunities: number;
  won_deals: number;
  won_revenue: number;
  order_revenue: number;
  visits_today: number;
  calls_today: number;
  predicted_revenue: number;
};

type Pipeline = Record<string, { count: number; value: number }>;

type Task = {
  id: string;
  type: string;
  status: string;
  description: string | null;
  lead_id: string | null;
  customer_id: string | null;
  due_at: string | null;
  created_at: string;
};

type Alert = {
  type: string;
  message: string;
  severity: "high" | "medium";
};

type LeadScore = {
  lead_id: string;
  name: string;
  phone: string | null;
  score: number;
  level: string;
  next_action: string;
  priority: string;
};

const money = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));

const STAGE_LABEL: Record<string, string> = {
  new: "Mới",
  consulting: "Tư vấn",
  demo: "Demo",
  quoted: "Báo giá",
  negotiating: "Đàm phán",
};

const TASK_TYPE_LABEL: Record<string, string> = {
  crm_followup: "Follow-up",
  visit: "Ghé thăm",
  quotation_followup: "Theo báo giá",
  debt_followup: "Thu nợ",
};

type DebtRow = {
  customer_name: string;
  debt_amount: number;
  is_overdue: boolean;
  is_high_debt: boolean;
  days_since_last_order: number;
};

type SalesKPI = {
  user_name: string;
  total_orders: number;
  total_revenue: number;
  total_commission: number;
  conversion_rate: number;
};

export function CrmDashboardClient() {
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline>({});
  const [tasks, setTasks] = useState<{ overdue: Task[]; today: Task[]; upcoming: Task[] }>({ overdue: [], today: [], upcoming: [] });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [topLeads, setTopLeads] = useState<LeadScore[]>([]);
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [salesKpi, setSalesKpi] = useState<SalesKPI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/crm-dashboard").then(r => r.json()),
      fetch("/api/lead-scoring").then(r => r.json()),
      fetch("/api/customer-debt").then(r => r.json()),
      fetch("/api/sales-kpi").then(r => r.json()),
    ]).then(([dash, scoring, debt, skpi]) => {
      if (dash.ok) {
        setKpi(dash.data.kpi);
        setPipeline(dash.data.pipeline);
        setTasks(dash.data.tasks);
        setAlerts(dash.data.alerts ?? []);
      }
      if (scoring.ok) setTopLeads((scoring.data ?? []).slice(0, 5));
      if (debt.ok) setDebts((debt.data ?? []).slice(0, 5));
      if (skpi.ok) setSalesKpi(skpi.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="space-y-3 animate-pulse">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>;
  }

  if (!kpi) return <div className="text-sm text-gray-500 p-4">Không tải được dữ liệu CRM</div>;

  const totalTasks = tasks.overdue.length + tasks.today.length + tasks.upcoming.length;

  return (
    <div className="space-y-4">

      {/* Quick links */}
      <div className="flex gap-2 flex-wrap">
        <QuickLink href="/crm/today" label="Việc hôm nay" />
        <QuickLink href="/leads" label="Tạo lead" />
        <QuickLink href="/crm/opportunities" label="Tạo cơ hội" />
        <QuickLink href="/crm/activities" label="Ghi hoạt động" />
        <QuickLink href="/crm/sfa" label="Check-in visit" />
        <QuickLink href="/crm/followups" label="Follow-ups" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KPICard icon={<Users className="h-4 w-4" />} label="Lead tháng này" value={kpi.total_leads} sub={`${kpi.converted_leads} converted`} />
        <KPICard icon={<Target className="h-4 w-4" />} label="Cơ hội" value={kpi.total_opportunities} sub={`${kpi.won_deals} thắng`} />
        <KPICard icon={<TrendingUp className="h-4 w-4" />} label="Doanh thu tháng" value={money(kpi.order_revenue)} sub="đ" isText />
        <KPICard icon={<Briefcase className="h-4 w-4" />} label="Dự báo pipeline" value={money(kpi.predicted_revenue)} sub="đ" isText />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border bg-white p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase">Visit hôm nay</div>
          <div className="text-2xl font-bold text-gray-800">{kpi.visits_today}</div>
        </div>
        <div className="rounded-xl border bg-white p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase">Call hôm nay</div>
          <div className="text-2xl font-bold text-gray-800">{kpi.calls_today}</div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-bold text-red-800">Cảnh báo ({alerts.length})</span>
          </div>
          <div className="space-y-1">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`text-xs px-1 py-0.5 rounded ${a.severity === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {a.severity === "high" ? "Cao" : "TB"}
                </span>
                <span className="text-gray-700">{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top leads */}
      {topLeads.length > 0 && (
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-3 py-2.5 border-b bg-gray-50">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Top Lead (scoring)</span>
          </div>
          <div className="divide-y divide-gray-100">
            {topLeads.map(l => (
              <div key={l.lead_id} className="px-3 py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      l.level === "hot" ? "bg-red-100 text-red-700" : l.level === "warm" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                    }`}>{l.score}</span>
                    <span className="text-sm font-medium text-gray-800 truncate">{l.name}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 truncate">{l.next_action}</div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                  l.priority === "high" ? "bg-red-100 text-red-700" : l.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                }`}>{l.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue tasks alert */}
      {tasks.overdue.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-bold text-red-800">Task quá hạn ({tasks.overdue.length})</span>
          </div>
          <div className="space-y-1">
            {tasks.overdue.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        </div>
      )}

      {/* Today tasks */}
      {tasks.today.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-bold text-blue-800">Task hôm nay ({tasks.today.length})</span>
          </div>
          <div className="space-y-1">
            {tasks.today.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        </div>
      )}

      {/* Upcoming tasks */}
      {tasks.upcoming.length > 0 && (
        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-gray-600">Sắp tới ({tasks.upcoming.length})</span>
          </div>
          <div className="space-y-1">
            {tasks.upcoming.slice(0, 5).map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        </div>
      )}

      {totalTasks === 0 && (
        <div className="rounded-xl border bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> Không có task CRM nào cần xử lý
        </div>
      )}

      {/* Pipeline */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-3 py-2.5 border-b bg-gray-50">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Pipeline cơ hội</span>
        </div>
        <div className="divide-y divide-gray-100">
          {Object.entries(pipeline).map(([stage, data]) => (
            <div key={stage} className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-gray-700">{STAGE_LABEL[stage] ?? stage}</span>
              <div className="text-right">
                <span className="text-sm font-bold text-gray-800">{data.count}</span>
                {data.value > 0 && <span className="text-xs text-gray-400 ml-1.5">{money(data.value)}đ</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer debt */}
      {debts.length > 0 && (
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-3 py-2.5 border-b bg-gray-50">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Công nợ khách hàng</span>
          </div>
          <div className="divide-y divide-gray-100">
            {debts.map((d, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {(d.is_overdue || d.is_high_debt) && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <span className="text-sm font-medium text-gray-800 truncate">{d.customer_name}</span>
                  </div>
                  {d.is_overdue && <div className="text-[10px] text-red-500">Quá hạn {d.days_since_last_order} ngày</div>}
                </div>
                <span className={`text-sm font-bold shrink-0 ${d.is_high_debt ? "text-red-600" : "text-amber-600"}`}>
                  {money(d.debt_amount)}đ
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales KPI per user */}
      {salesKpi.length > 0 && (
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-3 py-2.5 border-b bg-gray-50">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">KPI nhân viên</span>
          </div>
          <div className="divide-y divide-gray-100">
            {salesKpi.map((s, i) => (
              <div key={i} className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800 truncate">{s.user_name}</span>
                  <span className="text-sm font-bold text-gray-800">{money(s.total_revenue)}đ</span>
                </div>
                <div className="flex gap-3 mt-0.5 text-[10px] text-gray-400">
                  <span>{s.total_orders} đơn</span>
                  <span>HH: {money(s.total_commission)}đ</span>
                  <span>CVR: {s.conversion_rate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="px-3 py-1.5 border rounded-lg text-xs text-blue-600 font-medium hover:bg-blue-50">{label}</Link>
  );
}

function KPICard({ icon, label, value, sub, isText }: { icon: React.ReactNode; label: string; value: any; sub?: string; isText?: boolean }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="flex items-center gap-1.5 text-gray-400 mb-1">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <div className={`font-bold ${isText ? "text-sm" : "text-xl"} text-gray-800`}>{value}</div>
      {sub && !isText && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <div className="min-w-0">
        <span className="text-xs bg-gray-100 text-gray-600 px-1 py-0.5 rounded mr-1.5">{TASK_TYPE_LABEL[task.type] ?? task.type}</span>
        <span className="text-gray-800">{task.description ?? "—"}</span>
      </div>
      {task.due_at && <span className="text-xs text-gray-400 shrink-0">{formatDateVN(task.due_at)}</span>}
    </div>
  );
}
