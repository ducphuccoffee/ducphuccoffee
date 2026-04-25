"use client";

import { useEffect, useState } from "react";
import { CrmCareClient, type CrmCustomer, type Profile } from "./CrmCareClient";

export function CrmCareTab() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/crm-care")
      .then(r => r.json())
      .then(j => {
        if (!j.ok) throw new Error(j.error ?? "Lỗi");
        setCustomers(j.data ?? []);
        setProfiles(j.profiles ?? []);
        setCurrentUserId(j.currentUserId ?? "");
        setIsAdmin(!!j.isAdmin);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}</div>;
  if (error)
    return <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>;

  return (
    <CrmCareClient
      initialCustomers={customers}
      profiles={profiles}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
    />
  );
}
