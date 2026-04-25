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
      {/* Tab bar — full-width segmented on mobile, fit on desktop */}
      <div className="flex gap-1 mb-4 bg-gray-100 border border-gray-200 rounded-xl p-1 w-full sm:w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 active:text-gray-800 hover:text-gray-700"
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
