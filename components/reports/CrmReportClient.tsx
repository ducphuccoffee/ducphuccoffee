"use client";

import { useState, useEffect } from "react";
import { Users, Target, AlertTriangle, Footprints, MessageSquare } from "lucide-react";
import { formatDateTimeVN, formatCurrencyVN } from "@/lib/date";
import { DateRangeFilter, DateRange } from "./DateRangeFilter";

function daysAgo(n: number) { return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10); }

const STAGE_LABEL: Record<string, string> = { new: "Mới", consulting: "Tư vấn", demo: "Demo", quoted: "Báo giá", negotiating: "Đàm phán", won: "Thắng", lost: "Mất" };
const STATUS_LABEL: Record<string, string> = { new: "Mới", contacted: "Đã LH", meeting_scheduled: "Hẹn gặp", quoted: "Báo giá", converted: "Chuyển đổi", lost: "Mất" };
const TEMP_LABEL: Record<string, string> = { cold: "Lạnh", warm: "Ấm", hot: "Nóng" };
const TEMP_COLOR: Record<string, string> = { cold: "bg-blue-100 text-blue-700", warm: "bg-amber-100 text-amber-700", hot: "bg-red-100 text-red-700" };
const ACT_LABEL: Record<string, string> = { call: "Gọi", message: "Nhắn tin", meeting: "Gặp", visit: "Ghé thăm", quotation: "Báo giá", note: "Ghi chú" };

const money = (n: number) => formatCurrencyVN(Math.round(n));

export function CrmReportClient() {
  const [range, setRange] = useState<DateRange>({ from: daysAgo(30), to: new Date().toISOString().slice(0, 10) + "T23:59:59" });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?type=crm&from=${range.from}&to=${range.to}`)
      .then(r => r.json())
      .then(res => { if (res.ok) setData(res.data); })
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div>
      <DateRangeFilter value={range} onChange={setRange} />

      {loading ? <Loading /> : !data ? <Empty /> : (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KPI icon={<Users className="h-4 w-4" />} label="Lead" value={data.kpi.total_leads} bg="bg-blue-50" />
            <KPI icon={<Target className="h-4 w-4" />} label="Cơ hội" value={data.kpi.total_opps} bg="bg-green-50" />
            <KPI icon={<AlertTriangle className="h-4 w-4" />} label="F/U quá hạn" value={data.kpi.overdue_followups} bg="bg-red-50" />
            <KPI icon={<Footprints className="h-4 w-4" />} label="Visit" value={data.kpi.visits} bg="bg-amber-50" />
          </div>

          {/* Lead by status */}
          <Section title="Lead theo trạng thái">
            {Object.keys(data.leads_by_status).length === 0 ? <Empty /> : (
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(data.leads_by_status).map(([s, c]) => (
                  <div key={s} className="text-center py-2">
                    <div className="text-[10px] text-gray-400">{STATUS_LABEL[s] ?? s}</div>
                    <div className="text-lg font-bold text-gray-800">{c as number}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Lead by temperature */}
          <Section title="Lead theo nhiệt độ">
            <div className="flex gap-2 justify-center">
              {Object.entries(data.leads_by_temperature).map(([t, c]) => (
                <div key={t} className={`px-4 py-2 rounded-xl text-center ${TEMP_COLOR[t] ?? "bg-gray-100"}`}>
                  <div className="text-xl font-bold">{c as number}</div>
                  <div className="text-[10px]">{TEMP_LABEL[t] ?? t}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Opportunity by stage */}
          <Section title="Cơ hội theo giai đoạn">
            {Object.keys(data.opps_by_stage).length === 0 ? <Empty /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-left py-1">Stage</th><th className="text-right py-1">SL</th><th className="text-right py-1">Giá trị</th></tr></thead>
                <tbody>{Object.entries(data.opps_by_stage).map(([s, v]: any) => (
                  <tr key={s} className="border-t border-gray-100">
                    <td className="py-1.5 text-gray-700">{STAGE_LABEL[s] ?? s}</td>
                    <td className="py-1.5 text-right text-gray-600">{v.count}</td>
                    <td className="py-1.5 text-right font-medium text-gray-800">{money(v.value)}đ</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Section>

          {/* Recent activities */}
          <Section title="Hoạt động gần đây">
            {data.recent_activities.length === 0 ? <Empty /> : (
              <div className="divide-y divide-gray-100">
                {data.recent_activities.map((a: any) => (
                  <div key={a.id} className="py-1.5 flex items-start gap-2">
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded shrink-0">{ACT_LABEL[a.type] ?? a.type}</span>
                    <div className="min-w-0">
                      <span className="text-xs text-gray-600 line-clamp-1">{a.content ?? "—"}</span>
                      <div className="text-[10px] text-gray-400">{formatDateTimeVN(a.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function KPI({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: any; bg: string }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${bg}`}>
      <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">{icon}<span className="text-[10px] uppercase">{label}</span></div>
      <div className="text-lg font-bold text-gray-800">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="px-3 py-2 border-b bg-gray-50"><span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{title}</span></div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function Loading() { return <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>; }
function Empty() { return <div className="text-center text-sm text-gray-400 py-4">Không có dữ liệu</div>; }
