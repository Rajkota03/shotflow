import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/", "/signin", "/signup"]);
const PUBLIC_PREFIXES = ["/api/auth/", "/_next/", "/favicon"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get("sf_session");
  if (!session?.value) {
    const signinUrl = new URL("/signin", request.url);
    signinUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs)$).*)"],
};
