import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteSupabase } from "@/lib/supabase/route";

const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  sku: z.string().min(1).optional().nullable(),
  type: z.enum(["raw", "finished"]),
  unit: z.string().min(1).optional().nullable(),
  cost_price: z.coerce.number().min(0).default(0),
  sell_price: z.coerce.number().min(0).default(0),
  is_active: z.coerce.boolean().default(true),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = ProductSchema.omit({ id: true }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });

  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);

  const { error, data } = await supabase.from("products").insert(parsed.data).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = ProductSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  if (!parsed.data.id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);

  const { id, ...patch } = parsed.data;
  const { error, data } = await supabase.from("products").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
