"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function DevSeedButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function seed() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/dev/seed", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Seed failed");
      setMsg("Đã tạo dữ liệu mẫu. Refresh trang để xem.");
    } catch (e: any) {
      setMsg(e.message || "Seed failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={seed} disabled={loading}>
        {loading ? "Đang tạo..." : "Seed dữ liệu mẫu"}
      </Button>
      {msg ? <div className="text-xs text-zinc-600">{msg}</div> : null}
    </div>
  );
}
