import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getCookieFromHeader(cookieHeader: string | null, name: string) {
  const cookie = cookieHeader || "";
  const match = cookie.split("; ").find((c) => c.startsWith(name + "="));
  return match ? match.split("=").slice(1).join("=") : undefined;
}

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return getCookieFromHeader(request.headers.get("cookie"), name);
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Insert a sample RAW product
  const p = await supabase.from("products").insert({
    name: "Arabica Đà Lạt",
    sku: "RAW-ARABICA-DL",
    type: "raw",
    unit: "kg",
    cost_price: 120000,
    sell_price: 0,
    is_active: true,
  });

  if (p.error && !String(p.error.message).includes("duplicate key")) {
    return NextResponse.json({ ok: false, error: p.error.message }, { status: 400 });
  }

  // Insert a sample FINISHED product
  const p2 = await supabase.from("products").insert({
    name: "Arabica Rang Medium (250g)",
    sku: "FIN-ARABICA-M-250",
    type: "finished",
    unit: "bag",
    cost_price: 65000,
    sell_price: 95000,
    is_active: true,
  });

  if (p2.error && !String(p2.error.message).includes("duplicate key")) {
    return NextResponse.json({ ok: false, error: p2.error.message }, { status: 400 });
  }

  // Insert a sample customer
  const c = await supabase.from("customers").insert({
    name: "Quán Cafe A",
    phone: "0900000000",
      // Optional legacy column
      phone_norm: "0900000000",
    email: "cafea@example.com",
    address: "TP.HCM",
    credit_limit: 5000000,
  });

  if (c.error) {
    // customer doesn't have unique constraints by default; ignore only if any
    return NextResponse.json({ ok: false, error: c.error.message }, { status: 400 });
  }

  return response;
}
