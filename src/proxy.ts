import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// Routes that require authentication (after locale prefix is stripped)
const protectedPaths = ["/chat", "/profile", "/settings", "/verse-finder", "/trivia", "/bookmarks"];
const adminPaths = ["/admin"];
const authPaths = ["/login", "/register", "/forgot-password"];

function getPathnameWithoutLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return pathname.replace(`/${locale}`, "") || "/";
    }
  }
  return pathname;
}

export default async function proxy(request: NextRequest) {
  // 1. Run intl middleware first to handle locale routing
  const intlResponse = intlMiddleware(request);

  // 2. Create a Supabase client that can read/write cookies on the response
  let response = intlResponse || NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set on request for downstream server components
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Set on response so browser receives updated cookies
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. Refresh the session (important: always call getUser to refresh tokens)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathWithoutLocale = getPathnameWithoutLocale(request.nextUrl.pathname);

  // 4. Redirect unauthenticated users away from protected routes
  const isProtected =
    protectedPaths.some((p) => pathWithoutLocale.startsWith(p)) ||
    adminPaths.some((p) => pathWithoutLocale.startsWith(p));

  if (isProtected && !user) {
    const loginUrl = new URL(`/${routing.defaultLocale}/login`, request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Redirect authenticated users away from auth pages
  const isAuthPage = authPaths.some((p) => pathWithoutLocale.startsWith(p));
  if (isAuthPage && user) {
    return NextResponse.redirect(
      new URL(`/${routing.defaultLocale}`, request.url)
    );
  }

  // 6. Admin route protection (check role via profile)
  const isAdminRoute = adminPaths.some((p) =>
    pathWithoutLocale.startsWith(p)
  );
  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(
        new URL(`/${routing.defaultLocale}`, request.url)
      );
    }
  }

  return response;
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
