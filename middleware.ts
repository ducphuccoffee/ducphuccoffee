import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Create Supabase client (SSR version) with Next.js cookies API
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookies: {
            name: string;
            value: string;
            options: any;
          }[]
        ) {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Paths that do NOT require auth
  const publicPaths = ["/login", "/signup"];
  const pathname = request.nextUrl.pathname;

  // Allow public paths + api routes + static
  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return response;
  }

  const { data } = await supabase.auth.getUser();

  // If not logged in => redirect login
  if (!data?.user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};