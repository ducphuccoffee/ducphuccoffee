"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LeadsClient } from "./LeadsClient";
import { OpportunitiesClient } from "./OpportunitiesClient";

type Tab = "leads" | "opportunities";

const TABS: { id: Tab; label: string }[] = [
  { id: "leads",         label: "Leads" },
  { id: "opportunities", label: "Cơ hội" },
];

export function PipelineClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const initial = (sp.get("tab") as Tab) ?? "leads";
  const [tab, setTab] = useState<Tab>(TABS.find(t => t.id === initial) ? initial : "leads");

  function switchTab(t: Tab) {
    setTab(t);
    router.replace(`/crm/pipeline?tab=${t}`, { scroll: false });
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

      {tab === "leads"         && <LeadsClient />}
      {tab === "opportunities" && <OpportunitiesClient />}
    </div>
  );
}
