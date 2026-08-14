import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, isNull, or } from "drizzle-orm";
import { auth } from "@/auth";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { NotificationList } from "@/components/notification-list";
import { markAllNotificationsReadAction } from "@/actions/notifications";
import { db } from "@/db";
import { friendships, groupMembers, groups } from "@/db/schema";
import {
  getGroupBalances,
  getNotificationsForUser,
  getPendingFriendIdsForUser,
  getPendingInviteIdsForEmail,
} from "@/lib/group-data";
import { formatMoney } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [memberships, notes, pendingGroupInviteIds, pendingFriendIds, friends] =
    await Promise.all([
      db
        .select({
          groupId: groups.id,
          name: groups.name,
          coverAvatarId: groups.coverAvatarId,
          currency: groups.currency,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(and(eq(groupMembers.userId, userId), isNull(groups.deletedAt)))
        .all(),
      getNotificationsForUser(userId),
      getPendingInviteIdsForEmail(session.user.email),
      getPendingFriendIdsForUser(userId),
      db
        .select()
        .from(friendships)
        .where(
          and(
            isNull(friendships.deletedAt),
            eq(friendships.status, "ACCEPTED"),
            or(eq(friendships.userAId, userId), eq(friendships.userBId, userId))
          )
        )
        .all(),
    ]);

  const groupCards = await Promise.all(
    memberships.map(async (m) => {
      const balances = await getGroupBalances(m.groupId);
      const nets = balances
        .map((b) => ({
          currency: b.currency,
          myNet: b.netByUser[userId] ?? 0,
        }))
        .filter((b) => Math.abs(b.myNet) > 0.009);
      const primary =
        nets.find((b) => b.currency === m.currency) ??
        nets[0] ??
        { currency: m.currency, myNet: 0 };
      return { ...m, nets, myNet: primary.myNet, currency: primary.currency };
    })
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hi, ${session.user.name}`}
        description="Your groups and what you owe — or are owed."
        actions={
          <Link href="/groups/new">
            <Button>New group</Button>
          </Link>
        }
      />

      <section aria-label="Groups" className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">Groups</h2>
        {groupCards.length === 0 ? (
          <EmptyState
            title="No groups yet"
            description="Create a group and invite up to four friends to start tracking shared expenses."
            action={
              <Link href="/groups/new">
                <Button>Create your first group</Button>
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {groupCards.map((g) => (
              <li key={g.groupId}>
                <Link
                  href={`/groups/${g.groupId}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-bg"
                >
                  <AvatarDisplay
                    avatarId={g.coverAvatarId}
                    name={g.name}
                    size={44}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{g.name}</p>
                    {g.nets.length === 0 ? (
                      <p className="text-sm money text-muted">Settled up</p>
                    ) : (
                      <div className="space-y-0.5">
                        {g.nets.map((n) => (
                          <p
                            key={n.currency}
                            className={`text-sm money ${
                              n.myNet > 0.009
                                ? "text-owed"
                                : n.myNet < -0.009
                                  ? "text-owe"
                                  : "text-muted"
                            }`}
                          >
                            {n.myNet > 0
                              ? `You’re owed ${formatMoney(n.myNet, n.currency)}`
                              : `You owe ${formatMoney(Math.abs(n.myNet), n.currency)}`}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Notifications</h2>
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="ghost" size="sm">
                Clear all
              </Button>
            </form>
          </div>
          <NotificationList
            notifications={notes.map((n) => ({
              id: n.id,
              type: n.type,
              title: n.title,
              body: n.body,
              href: n.href,
              read: n.read,
            }))}
            pendingGroupInviteIds={pendingGroupInviteIds}
            pendingFriendIds={pendingFriendIds}
          />
        </Card>
        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Friends</h2>
            <Link href="/friends">
              <Button variant="secondary" size="sm">
                Manage
              </Button>
            </Link>
          </div>
          <p className="text-3xl font-bold money tracking-tight text-ink">
            {friends.length}
          </p>
          <p className="mt-1 text-sm text-muted">
            People you can split with outside a group.
          </p>
        </Card>
      </section>
    </div>
  );
}
