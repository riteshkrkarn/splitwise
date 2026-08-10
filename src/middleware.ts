import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedPrefixes = [
  "/dashboard",
  "/groups",
  "/friends",
  "/profile",
  "/activity",
  "/analytics",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!isProtected) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/groups/:path*",
    "/friends/:path*",
    "/profile/:path*",
    "/activity/:path*",
    "/analytics/:path*",
  ],
};
