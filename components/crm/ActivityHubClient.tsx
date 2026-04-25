"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ActivitiesClient } from "./ActivitiesClient";
import { FollowupsClient } from "./FollowupsClient";
import { CrmCareTab } from "./CrmCareTab";

type Tab = "activities" | "followups" | "care";

const TABS: { id: Tab; label: string }[] = [
  { id: "activities", label: "Ghi nhận" },
  { id: "followups",  label: "Follow-up" },
  { id: "care",       label: "Chăm sóc KH" },
];

export function ActivityHubClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const initial = (sp.get("tab") as Tab) ?? "activities";
  const [tab, setTab] = useState<Tab>(TABS.find(t => t.id === initial) ? initial : "activities");

  function switchTab(t: Tab) {
    setTab(t);
    router.replace(`/crm/activities?tab=${t}`, { scroll: false });
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 bg-white border rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "activities" && <ActivitiesClient />}
      {tab === "followups"  && <FollowupsClient />}
      {tab === "care"       && <CrmCareTab />}
    </div>
  );
}
