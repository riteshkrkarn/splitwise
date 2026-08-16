import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { logoutAction } from "@/actions/auth";
import { AvatarDisplay } from "@/components/avatar-display";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { NavbarControls } from "@/components/navbar-controls";
import { Button } from "@/components/ui/button";
import {
  getNotificationsForUser,
  getPendingFriendIdsForUser,
  getPendingInviteIdsForEmail,
} from "@/lib/group-data";

const nav = [
  { href: "/dashboard", label: "Home" },
  { href: "/friends", label: "Friends" },
  { href: "/activity", label: "Activity" },
  { href: "/analytics", label: "Insights" },
  { href: "/profile", label: "Profile" },
] as const;

async function NavbarData({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [notes, pendingGroupInviteIds, pendingFriendIds] = await Promise.all([
    getNotificationsForUser(userId),
    getPendingInviteIdsForEmail(email),
    getPendingFriendIdsForUser(userId),
  ]);
  const unreadCount = notes.filter((n) => !n.read).length;

  return (
    <NavbarControls
      notifications={notes.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        href: n.href,
        read: n.read,
        createdAt: n.createdAt,
      }))}
      unreadCount={unreadCount}
      pendingGroupInviteIds={pendingGroupInviteIds}
      pendingFriendIds={pendingFriendIds}
    />
  );
}

function NavbarSkeleton() {
  return (
    <div
      className="h-11 w-11 animate-pulse rounded-full bg-surface"
      aria-hidden
    />
  );
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header
        className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5 sm:gap-3 sm:py-3">
          <Link
            href="/dashboard"
            className="shrink-0 text-lg font-bold tracking-tight text-primary"
          >
            Splitwise
          </Link>

          <nav
            className="ml-2 hidden items-center gap-0.5 md:flex"
            aria-label="Primary"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
            {session?.user && (
              <>
                <Suspense fallback={<NavbarSkeleton />}>
                  <NavbarData
                    userId={session.user.id}
                    email={session.user.email}
                  />
                </Suspense>
                <Link
                  href="/profile"
                  className="hidden min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
                  title={session.user.name}
                >
                  <AvatarDisplay
                    avatarId={session.user.avatarId}
                    name={session.user.name}
                    size={36}
                  />
                </Link>
                <form action={logoutAction} className="hidden md:block">
                  <Button type="submit" variant="ghost" size="sm">
                    Log out
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </header>

      <main
        className={
          session?.user
            ? "mx-auto max-w-5xl px-4 py-5 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:py-8 md:pb-8"
            : "mx-auto max-w-5xl px-4 py-5 sm:py-8"
        }
      >
        {children}
      </main>

      {session?.user ? <MobileBottomNav /> : null}
    </div>
  );
}
