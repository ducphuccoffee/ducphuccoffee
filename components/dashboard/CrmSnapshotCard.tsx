"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SaleRow = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  lead_count: number;
  active_count: number; // not converted/lost
  overdue_followup: number;
};

type SnapshotData = {
  total_leads: number;
  unassigned: number;
  overdue_followup: number;
  by_sales: SaleRow[];
};

export function CrmSnapshotCard() {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crm-snapshot")
      .then(r => r.json())
      .then(j => j.ok && setData(j.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-4 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-40 mb-3" />
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}</div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-gray-800">CRM — Lead theo sale</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {data.total_leads} lead tổng ·
            {data.unassigned > 0 && <span className="text-orange-600 font-medium"> {data.unassigned} chưa giao ·</span>}
            {data.overdue_followup > 0 && <span className="text-red-600 font-medium"> {data.overdue_followup} trễ follow-up</span>}
          </p>
        </div>
        <Link href="/crm/pipeline" className="text-[12px] text-blue-500 hover:underline font-medium">
          Pipeline →
        </Link>
      </div>

      {data.by_sales.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">Chưa có lead nào</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {data.by_sales.map(s => (
            <div key={s.user_id} className="px-4 py-2.5 flex items-center gap-3">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                {((s.full_name || s.username || "?").split(" ").pop() ?? "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {s.full_name || s.username || s.user_id.slice(0, 8)}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                  <span>{s.active_count} đang theo</span>
                  <span>·</span>
                  <span>{s.lead_count} tổng</span>
                  {s.overdue_followup > 0 && (
                    <span className="text-red-600 font-semibold">· ⏰ {s.overdue_followup} trễ</span>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-20 shrink-0">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: data.total_leads > 0
                        ? `${Math.round((s.lead_count / data.total_leads) * 100)}%`
                        : "0%",
                    }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 text-right mt-0.5">
                  {data.total_leads > 0 ? Math.round((s.lead_count / data.total_leads) * 100) : 0}%
                </p>
              </div>
            </div>
          ))}
          {data.unassigned > 0 && (
            <div className="px-4 py-2 flex items-center gap-3 bg-orange-50">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center shrink-0">?</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-orange-700">Chưa giao</p>
                <p className="text-[11px] text-orange-500">{data.unassigned} lead chưa có người phụ trách</p>
              </div>
              <Link href="/crm/pipeline" className="text-xs text-orange-700 font-semibold underline shrink-0">Giao ngay</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
