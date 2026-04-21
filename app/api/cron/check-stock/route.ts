import { NextResponse } from "next/server";

const TARGET_SELLABLE_KG = 50;

export async function GET(request: Request) {
  // Auth: require CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = request.url.split("/api/cron/")[0];
  const cookies = request.headers.get("cookie") ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookies) headers["cookie"] = cookies;

  const log: string[] = [];
  let created = 0;
  let skipped = 0;

  // 1) Get sellable products
  const sellableRes = await fetch(`${baseUrl}/api/sellable-products`, { headers });
  if (!sellableRes.ok) {
    const err = await sellableRes.text();
    return NextResponse.json({ error: `sellable-products failed: ${err}` }, { status: 502 });
  }
  const { data: products } = await sellableRes.json();

  // 2) Collect green_types needing production with suggested_kg
  // key = green_type_id, value = { label, suggested_kg (max across products needing it) }
  const needsProduction = new Map<string, { label: string; suggested_kg: number }>();

  for (const p of products ?? []) {
    const sellable = Number(p.sellable_kg ?? 0);
    if (sellable >= TARGET_SELLABLE_KG) continue;

    const deficit = TARGET_SELLABLE_KG - sellable;
    let gtId: string | null = null;
    let suggested_kg = 0;

    if (p.kind === "original" && p.green_type_id) {
      gtId = p.green_type_id;
      suggested_kg = deficit;
    } else if (p.kind === "blend" && p.limiting_green_type_id) {
      gtId = p.limiting_green_type_id;
      const ratio = Number(p.limiting_ratio ?? 1);
      suggested_kg = deficit * ratio;
    }

    if (!gtId) continue;

    const existing = needsProduction.get(gtId);
    if (!existing || suggested_kg > existing.suggested_kg) {
      needsProduction.set(gtId, {
        label: p.product_name,
        suggested_kg: Math.round(suggested_kg * 100) / 100,
      });
    }
  }

  // 3) Create production tasks via existing API
  for (const [gtId, { label, suggested_kg }] of needsProduction) {
    const res = await fetch(`${baseUrl}/api/production-tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify({ green_type_id: gtId, suggested_kg }),
    });
    const json = await res.json();

    if (res.status === 409) {
      skipped++;
      log.push(`SKIP ${label} (${gtId}) — already active`);
    } else if (res.ok && json.ok) {
      created++;
      log.push(`CREATED ${label}: rang ${suggested_kg}kg (${gtId})`);
    } else {
      log.push(`ERROR ${label}: ${json.error ?? res.statusText}`);
    }
  }

  return NextResponse.json({
    ok: true,
    target_sellable_kg: TARGET_SELLABLE_KG,
    products_checked: (products ?? []).length,
    green_types_low: needsProduction.size,
    tasks_created: created,
    tasks_skipped: skipped,
    log,
  });
}
