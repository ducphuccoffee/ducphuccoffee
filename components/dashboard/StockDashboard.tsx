"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Flame, Package } from "lucide-react";

type RoastedStock = {
  green_type_name: string;
  total_remaining_kg: number;
  avg_cost_per_kg: number;
  lot_count: number;
  low_stock: boolean;
};

type SellableProduct = {
  product_id: string;
  product_name: string;
  kind: string;
  sellable_kg: number;
  limiting_factor: string | null;
  low_stock: boolean;
};

type RoastSuggestion = {
  product_name: string;
  kind: string;
  current_sellable_kg: number;
  limiting_green_type: string | null;
  suggestion: string;
  needed_roast_kg: number;
  green_available_kg: number | null;
  can_fulfill: boolean;
};

const money = (n: number) =>
  new Intl.NumberFormat("vi-VN").format(Math.round(n));

export function StockDashboard() {
  const [roasted, setRoasted] = useState<RoastedStock[]>([]);
  const [sellable, setSellable] = useState<SellableProduct[]>([]);
  const [suggestions, setSuggestions] = useState<RoastSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/roasted-stock").then(r => r.json()),
      fetch("/api/sellable-products").then(r => r.json()),
      fetch("/api/roasting-suggestions").then(r => r.json()),
    ]).then(([rs, sp, sg]) => {
      setRoasted(rs.data ?? []);
      setSellable(sp.data ?? []);
      setSuggestions(sg.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
      </div>
    );
  }

  const urgentSuggestions = suggestions.filter(s => s.needed_roast_kg > 0);

  return (
    <div className="space-y-4">

      {/* Urgent alerts */}
      {urgentSuggestions.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-800">Cần rang bổ sung</span>
          </div>
          <div className="space-y-1.5">
            {urgentSuggestions.map((s, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-gray-800">{s.product_name}</span>
                  <span className="text-gray-400 mx-1">·</span>
                  <span className="text-amber-700">{s.suggestion}</span>
                </div>
                <div className="shrink-0">
                  {s.can_fulfill ? (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Đủ nhân</span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Thiếu nhân</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roasted stock */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-3 py-2.5 border-b bg-gray-50 flex items-center gap-2">
          <Package className="h-4 w-4 text-gray-500" />
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Tồn kho rang nền</span>
        </div>
        {roasted.length === 0 ? (
          <div className="p-4 text-sm text-gray-400">Chưa có tồn kho rang nền</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {roasted.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  {r.low_stock ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-gray-800 truncate">{r.green_type_name}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-sm font-bold ${r.low_stock ? "text-amber-600" : "text-gray-800"}`}>
                    {Number(r.total_remaining_kg).toFixed(1)} kg
                  </span>
                  <div className="text-[10px] text-gray-400">
                    {r.lot_count} lô · {money(r.avg_cost_per_kg)}/kg
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sellable products */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="px-3 py-2.5 border-b bg-gray-50 flex items-center gap-2">
          <Package className="h-4 w-4 text-gray-500" />
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Khả năng bán</span>
        </div>
        {sellable.length === 0 ? (
          <div className="p-4 text-sm text-gray-400">Chưa có sản phẩm</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sellable.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800 truncate">{s.product_name}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded">{s.kind}</span>
                  </div>
                  {s.limiting_factor && (
                    <div className="text-[11px] text-amber-600 mt-0.5 truncate">
                      Giới hạn: {s.limiting_factor}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-sm font-bold ${s.low_stock ? "text-red-600" : "text-green-700"}`}>
                    {Number(s.sellable_kg).toFixed(1)} kg
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
