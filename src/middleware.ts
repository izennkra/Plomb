import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath, isValidSession, SESSION_COOKIE } from "@/modules/auth/session";

/**
 * Online, Plomb is private: every page and action asks for the password (PLOMB_PASSWORD), until reader accounts
 * exist (brick 7). Without a password set: open on the Mac (development), closed online (safety).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const password = process.env.PLOMB_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("Plomb n'est pas encore protégé par un mot de passe (réglage PLOMB_PASSWORD).", { status: 503 });
  }

  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value, password)) return NextResponse.next();

  const signIn = new URL("/connexion", request.url);
  signIn.searchParams.set("suite", pathname + request.nextUrl.search);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
