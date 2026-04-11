import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// TEMP: probe order_status enum values
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Probe by trying each candidate value — the one that doesn't error is valid
  const candidates = ["pending", "draft", "new", "open", "confirmed", "delivered", "cancelled", "closed"];
  const results: Record<string, string> = {};

  for (const val of candidates) {
    // Try a SELECT with a WHERE that casts to the enum — no rows needed, just type check
    const { error } = await supabase
      .from("orders")
      .select("id")
      .eq("status", val)
      .limit(0);
    results[val] = error ? `INVALID: ${error.message}` : "VALID";
  }

  return NextResponse.json({ order_status_probe: results });
}
