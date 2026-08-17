import type { NextAuthConfig } from "next-auth";

const protectedPrefixes = [
  "/dashboard",
  "/groups",
  "/friends",
  "/profile",
  "/transfers",
  "/activity",
  "/analytics",
];

const isProd = process.env.NODE_ENV === "production";

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProd,
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isProtected = protectedPrefixes.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
      );
      if (!isProtected) return true;
      return Boolean(auth?.user);
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.avatarId = (user as { avatarId?: number }).avatarId ?? 1;
        token.name = user.name;
        token.email = user.email;
      }
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.avatarId) token.avatarId = session.avatarId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.avatarId = (token.avatarId as number) ?? 1;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
