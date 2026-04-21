"use client";

import { useEffect, useState } from "react";
import { formatDateVN } from "@/lib/date";
import { AlertTriangle, CheckCircle, Phone, MapPin, TrendingUp, Users, Target, Briefcase } from "lucide-react";

type KPI = {
  total_leads: number;
  converted_leads: number;
  total_opportunities: number;
  won_deals: number;
  won_revenue: number;
  order_revenue: number;
  visits_today: number;
  calls_today: number;
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

export function CrmDashboardClient() {
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline>({});
  const [tasks, setTasks] = useState<{ overdue: Task[]; today: Task[]; upcoming: Task[] }>({ overdue: [], today: [], upcoming: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crm-dashboard")
      .then(r => r.json())
      .then(res => {
        if (res.ok) {
          setKpi(res.data.kpi);
          setPipeline(res.data.pipeline);
          setTasks(res.data.tasks);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="space-y-3 animate-pulse">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>;
  }

  if (!kpi) return <div className="text-sm text-gray-500 p-4">Không tải được dữ liệu CRM</div>;

  const totalTasks = tasks.overdue.length + tasks.today.length + tasks.upcoming.length;

  return (
    <div className="space-y-4">

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KPICard icon={<Users className="h-4 w-4" />} label="Lead tháng này" value={kpi.total_leads} sub={`${kpi.converted_leads} converted`} />
        <KPICard icon={<Target className="h-4 w-4" />} label="Cơ hội" value={kpi.total_opportunities} sub={`${kpi.won_deals} thắng`} />
        <KPICard icon={<TrendingUp className="h-4 w-4" />} label="Doanh thu tháng" value={money(kpi.order_revenue)} sub="đ" isText />
        <KPICard icon={<Briefcase className="h-4 w-4" />} label="Hôm nay" value={`${kpi.visits_today} visit · ${kpi.calls_today} call`} isText />
      </div>

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
    </div>
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
