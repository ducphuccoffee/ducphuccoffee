import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function safeNextPath(v: unknown) {
  const s = typeof v === "string" ? v : "";
  // chặn open-redirect, chỉ cho path nội bộ
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  return "/dashboard";
}

export async function POST(request: Request) {
  // Hỗ trợ cả JSON và form submit
  const ct = request.headers.get("content-type") || "";
  let email = "";
  let password = "";
  let next = "/dashboard";

  if (ct.includes("application/json")) {
    const body = (await request.json()) as any;
    email = body?.email || "";
    password = body?.password || "";
    next = safeNextPath(body?.next);
  } else {
    const fd = await request.formData();
    email = String(fd.get("email") || "");
    password = String(fd.get("password") || "");
    next = safeNextPath(fd.get("next"));
  }

  // Response redirect (để browser không bị đứng ở /api/auth/login)
  const url = new URL(next, request.url);
  const response = NextResponse.redirect(url, { status: 303 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = request.headers.get("cookie") || "";
          const match = cookie.split("; ").find((c) => c.startsWith(name + "="));
          return match ? match.split("=").slice(1).join("=") : undefined;
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

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // login fail => quay về /login và kèm lỗi
    const back = new URL(`/login?err=${encodeURIComponent(error.message)}`, request.url);
    return NextResponse.redirect(back, { status: 303 });
  }

  return response;
}