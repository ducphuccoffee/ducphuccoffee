"use client";

import { useEffect, useState } from "react";

type Alert = {
  kind: "item" | "product";
  id: string;
  name: string;
  sku: string | null;
  uom: string;
  type: string | null;
  onhand: number;
  min_stock: number;
  is_default_threshold: boolean;
  deficit: number;
};

export function StockAlertsCard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stock-alerts")
      .then(r => r.json())
      .then(j => {
        if (cancelled) return;
        setAlerts(j?.data?.alerts ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-3 text-xs text-gray-400">Đang tải tồn kho…</div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
        ✓ Tồn kho ổn — không có cảnh báo
      </div>
    );
  }

  const top = alerts.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-3 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-red-700">
          🚨 {alerts.length} mặt hàng dưới ngưỡng
        </span>
        <a href="/settings" className="text-[11px] text-red-700 underline hover:text-red-900">
          Quản lý ngưỡng
        </a>
      </div>
      <div className="divide-y divide-gray-100">
        {top.map(a => (
          <div key={`${a.kind}-${a.id}`} className="px-3 py-2 flex items-center gap-2 text-sm">
            <div className="flex-1 min-w-0 truncate">{a.name}</div>
            <div className="text-xs">
              <span className={a.onhand <= 0 ? "text-red-600 font-bold" : "text-orange-600 font-semibold"}>
                {a.onhand} {a.uom}
              </span>
              <span className="text-gray-400"> / {a.min_stock}</span>
            </div>
          </div>
        ))}
      </div>
      {alerts.length > top.length && (
        <div className="px-3 py-1.5 text-center text-[11px] text-gray-500 border-t bg-gray-50">
          + {alerts.length - top.length} mặt hàng khác
        </div>
      )}
    </div>
  );
}
