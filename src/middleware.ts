import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password"];
const PUBLIC_PREFIXES = ["/api/auth", "/api/cron", "/_next", "/favicon", "/icons"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const isPublicPage = PUBLIC_ROUTES.includes(pathname);

  // Convite público: /b/<slug>/join continua acessível, mas exige login para palpitar.
  if (!isLoggedIn && !isPublicPage) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isPublicPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
