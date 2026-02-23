import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteSupabase } from "@/lib/supabase/route";

const CustomerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  credit_limit: z.coerce.number().min(0).default(0),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = CustomerSchema.omit({ id: true }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });

  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);

  const { error, data } = await supabase.from("customers").insert(parsed.data).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = CustomerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  if (!parsed.data.id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);

  const { id, ...patch } = parsed.data;
  const { error, data } = await supabase.from("customers").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);

  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
