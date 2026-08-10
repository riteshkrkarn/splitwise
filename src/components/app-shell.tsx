import Link from "next/link";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { auth } from "@/auth";
import { logoutAction } from "@/actions/auth";
import { AvatarDisplay } from "@/components/avatar-display";
import { NavbarControls } from "@/components/navbar-controls";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { migrate } from "@/db/ensure-migrated";
import { friendships, groupInvites, notifications } from "@/db/schema";

migrate();

const nav = [
  { href: "/dashboard", label: "Home" },
  { href: "/friends", label: "Friends" },
  { href: "/activity", label: "Activity" },
  { href: "/analytics", label: "Insights" },
  { href: "/profile", label: "Profile" },
] as const;

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id;

  const notes = userId
    ? db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(12)
        .all()
    : [];

  const unreadCount = notes.filter((n) => !n.read).length;

  const pendingGroupInviteIds = userId
    ? db
        .select()
        .from(groupInvites)
        .where(
          and(
            eq(groupInvites.email, session!.user.email),
            eq(groupInvites.status, "PENDING")
          )
        )
        .all()
        .map((i) => i.id)
    : [];

  const pendingFriendIds = userId
    ? db
        .select()
        .from(friendships)
        .where(
          and(
            isNull(friendships.deletedAt),
            eq(friendships.status, "PENDING"),
            or(eq(friendships.userAId, userId), eq(friendships.userBId, userId))
          )
        )
        .all()
        .filter((f) => f.requestedBy !== userId)
        .map((f) => f.id)
    : [];

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
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

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {session?.user && (
              <>
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
                <Link
                  href="/profile"
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={session.user.name}
                >
                  <AvatarDisplay
                    avatarId={session.user.avatarId}
                    name={session.user.name}
                    size={36}
                  />
                </Link>
                <form action={logoutAction} className="hidden sm:block">
                  <Button type="submit" variant="ghost" size="sm">
                    Log out
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>

        <nav
          className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden"
          aria-label="Mobile"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
