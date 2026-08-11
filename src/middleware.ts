import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/groups",
    "/groups/:path*",
    "/friends",
    "/friends/:path*",
    "/profile",
    "/profile/:path*",
    "/activity",
    "/activity/:path*",
    "/analytics",
    "/analytics/:path*",
  ],
};
