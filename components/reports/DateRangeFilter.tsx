"use client";

import { useState } from "react";

export type DateRange = { from: string; to: string };

const presets: { key: string; label: string; calc: () => DateRange }[] = [
  { key: "today", label: "Hôm nay", calc: () => { const d = isoDay(new Date()); return { from: d, to: d + "T23:59:59" }; } },
  { key: "7d", label: "7 ngày", calc: () => ({ from: isoDay(daysAgo(7)), to: isoDay(new Date()) + "T23:59:59" }) },
  { key: "30d", label: "30 ngày", calc: () => ({ from: isoDay(daysAgo(30)), to: isoDay(new Date()) + "T23:59:59" }) },
  { key: "month", label: "Tháng này", calc: () => { const n = new Date(); return { from: `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`, to: isoDay(n) + "T23:59:59" }; } },
];

function isoDay(d: Date) { return d.toISOString().slice(0, 10); }
function daysAgo(n: number) { return new Date(Date.now() - n * 86_400_000); }

export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [active, setActive] = useState("30d");
  const [custom, setCustom] = useState(false);

  return (
    <div className="flex flex-wrap gap-1.5 items-center mb-4">
      {presets.map(p => (
        <button key={p.key} onClick={() => { setActive(p.key); setCustom(false); onChange(p.calc()); }}
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${active === p.key && !custom ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          {p.label}
        </button>
      ))}
      <button onClick={() => setCustom(!custom)}
        className={`px-2.5 py-1 rounded-full text-xs font-medium ${custom ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
        Tùy chọn
      </button>
      {custom && (
        <div className="flex gap-1.5 items-center">
          <input type="date" value={value.from.slice(0, 10)} onChange={e => onChange({ ...value, from: e.target.value })}
            className="px-2 py-1 border rounded text-xs" />
          <span className="text-xs text-gray-400">→</span>
          <input type="date" value={value.to.slice(0, 10)} onChange={e => onChange({ ...value, to: e.target.value + "T23:59:59" })}
            className="px-2 py-1 border rounded text-xs" />
        </div>
      )}
    </div>
  );
}
