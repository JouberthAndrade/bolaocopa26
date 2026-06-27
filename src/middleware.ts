import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password"];
// /api/cron e /api/admin são endpoints máquina-a-máquina protegidos pelo próprio
// handler via `Authorization: Bearer <CRON_SECRET>` — não passam pela sessão do
// next-auth, então precisam ficar fora do gate de login do middleware (senão são
// redirecionados para /login e o Bearer nunca chega a rodar).
const PUBLIC_PREFIXES = ["/api/auth", "/api/cron", "/api/admin", "/_next", "/favicon", "/icons"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const isPublicPage = PUBLIC_ROUTES.includes(pathname);

  // Convite público: /b/<slug>/join continua acessível, mas exige login para palpitar.
  // Convites públicos: /b/<slug>/join remains accessible, but requires login to participate.
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
