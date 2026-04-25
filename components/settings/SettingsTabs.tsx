"use client";

import { useState } from "react";
import { AccountSettings } from "./AccountSettings";
import { UsersAdmin } from "./UsersAdmin";
import { OrgAndCrmSettings } from "./OrgAndCrmSettings";
import { UserTargets } from "./UserTargets";
import { CommissionRules } from "./CommissionRules";
import { StockAlertsSettings } from "./StockAlertsSettings";
import { AuditLogViewer } from "./AuditLogViewer";

type Tab = "account" | "users" | "org" | "kpi" | "commission" | "stock" | "audit";

export function SettingsTabs({
  canManage,
  currentUserId,
  initialFullName,
}: {
  canManage: boolean;
  currentUserId: string;
  initialFullName: string | null;
}) {
  const [tab, setTab] = useState<Tab>("account");

  const tabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: "account",    label: "Tài khoản" },
    { id: "users",      label: "Thành viên",   adminOnly: true },
    { id: "org",        label: "Doanh nghiệp", adminOnly: true },
    { id: "stock",      label: "Tồn kho",      adminOnly: true },
    { id: "kpi",        label: "KPI",          adminOnly: true },
    { id: "commission", label: "Hoa hồng",     adminOnly: true },
    { id: "audit",      label: "Nhật ký",      adminOnly: true },
  ];

  const visible = tabs.filter(t => !t.adminOnly || canManage);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border overflow-x-auto">
        <div className="flex min-w-max">
          {visible.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "account"    && <AccountSettings initialFullName={initialFullName} />}
      {tab === "users"      && canManage && <UsersAdmin currentUserId={currentUserId} />}
      {tab === "org"        && canManage && <OrgAndCrmSettings />}
      {tab === "stock"      && canManage && <StockAlertsSettings />}
      {tab === "kpi"        && canManage && <UserTargets />}
      {tab === "commission" && canManage && <CommissionRules />}
      {tab === "audit"      && canManage && <AuditLogViewer />}
    </div>
  );
}
