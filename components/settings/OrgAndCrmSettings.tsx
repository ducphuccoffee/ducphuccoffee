"use client";

import { useEffect, useState } from "react";

type Org = {
  id: string;
  name: string | null;
  address: string | null;
  tax_code: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  settings: {
    crm: { stale_lead_days: number; stuck_opp_days: number; dormant_customer_days: number };
    kpi: { monthly_revenue_target: number };
  };
};

export function OrgAndCrmSettings() {
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"org" | "crm" | "kpi" | null>(null);
  const [msg, setMsg] = useState<{ key: string; ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/org");
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi");
      setOrg(j.data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function save(key: "org" | "crm" | "kpi", body: any) {
    setSaving(key);
    setMsg(null);
    try {
      const r = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi");
      setMsg({ key, ok: true, text: "Đã lưu" });
      await load();
    } catch (e: any) {
      setMsg({ key, ok: false, text: e.message ?? "Lỗi" });
    } finally {
      setSaving(null);
    }
  }

  if (loading || !org) return <div className="bg-white rounded-xl border p-4 text-sm text-gray-400">Đang tải…</div>;

  return (
    <div className="space-y-3">
      {/* Org profile */}
      <form
        className="bg-white rounded-xl border p-4 space-y-2"
        onSubmit={e => {
          e.preventDefault();
          save("org", {
            name: org.name, address: org.address, tax_code: org.tax_code,
            phone: org.phone, email: org.email, logo_url: org.logo_url,
          });
        }}
      >
        <h3 className="text-sm font-semibold text-gray-800">Thông tin doanh nghiệp</h3>
        <Field label="Tên công ty" value={org.name ?? ""} onChange={v => setOrg({ ...org, name: v })} />
        <Field label="Địa chỉ" value={org.address ?? ""} onChange={v => setOrg({ ...org, address: v })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Mã số thuế" value={org.tax_code ?? ""} onChange={v => setOrg({ ...org, tax_code: v })} />
          <Field label="Điện thoại" value={org.phone ?? ""} onChange={v => setOrg({ ...org, phone: v })} />
          <Field label="Email" value={org.email ?? ""} onChange={v => setOrg({ ...org, email: v })} />
          <Field label="Logo URL" value={org.logo_url ?? ""} onChange={v => setOrg({ ...org, logo_url: v })} />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button disabled={saving === "org"} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving === "org" ? "Đang lưu…" : "Lưu doanh nghiệp"}
          </button>
          {msg?.key === "org" && <span className={`text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      </form>

      {/* CRM thresholds */}
      <form
        className="bg-white rounded-xl border p-4 space-y-2"
        onSubmit={e => {
          e.preventDefault();
          save("crm", { settings: { crm: org.settings.crm } });
        }}
      >
        <h3 className="text-sm font-semibold text-gray-800">Ngưỡng cảnh báo CRM</h3>
        <p className="text-[11px] text-gray-500">Áp dụng cho &quot;Việc hôm nay&quot; và CRM Dashboard</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <NumField
            label="Lead ngủ (ngày)"
            help="Lead không cập nhật quá N ngày"
            value={org.settings.crm.stale_lead_days}
            onChange={v => setOrg({ ...org, settings: { ...org.settings, crm: { ...org.settings.crm, stale_lead_days: v } } })}
          />
          <NumField
            label="Opp kẹt (ngày)"
            help="Opportunity không cập nhật > N ngày"
            value={org.settings.crm.stuck_opp_days}
            onChange={v => setOrg({ ...org, settings: { ...org.settings, crm: { ...org.settings.crm, stuck_opp_days: v } } })}
          />
          <NumField
            label="KH ngủ (ngày)"
            help="Khách hàng không mua > N ngày"
            value={org.settings.crm.dormant_customer_days}
            onChange={v => setOrg({ ...org, settings: { ...org.settings, crm: { ...org.settings.crm, dormant_customer_days: v } } })}
          />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button disabled={saving === "crm"} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving === "crm" ? "Đang lưu…" : "Lưu ngưỡng CRM"}
          </button>
          {msg?.key === "crm" && <span className={`text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      </form>

      {/* KPI org target */}
      <form
        className="bg-white rounded-xl border p-4 space-y-2"
        onSubmit={e => {
          e.preventDefault();
          save("kpi", { settings: { kpi: org.settings.kpi } });
        }}
      >
        <h3 className="text-sm font-semibold text-gray-800">Target doanh thu tháng (toàn công ty)</h3>
        <NumField
          label="VND/tháng"
          help="Dùng để tính % hoàn thành KPI trên dashboard"
          value={org.settings.kpi.monthly_revenue_target}
          onChange={v => setOrg({ ...org, settings: { ...org.settings, kpi: { monthly_revenue_target: v } } })}
          step={100000}
        />
        <div className="flex items-center gap-2 pt-1">
          <button disabled={saving === "kpi"} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving === "kpi" ? "Đang lưu…" : "Lưu target"}
          </button>
          {msg?.key === "kpi" && <span className={`text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function NumField({ label, help, value, onChange, step = 1 }: { label: string; help?: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {help && <span className="text-[10px] text-gray-400">{help}</span>}
    </label>
  );
}
