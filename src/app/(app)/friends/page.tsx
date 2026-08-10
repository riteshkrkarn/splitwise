import { and, eq, isNull, or } from "drizzle-orm";
import { auth } from "@/auth";
import FriendsClient from "./friends-client";
import { db } from "@/db";
import { migrate } from "@/db/ensure-migrated";
import { friendships, users } from "@/db/schema";
import { NotificationActions } from "@/components/notification-actions";
import { Card } from "@/components/ui/card";

migrate();

export default async function FriendsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const accepted = db
    .select()
    .from(friendships)
    .where(
      and(
        isNull(friendships.deletedAt),
        eq(friendships.status, "ACCEPTED"),
        or(eq(friendships.userAId, userId), eq(friendships.userBId, userId))
      )
    )
    .all();

  const pendingIncoming = db
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
    .filter((f) => f.requestedBy !== userId);

  const friends = accepted.map((f) => {
    const otherId = f.userAId === userId ? f.userBId : f.userAId;
    const other = db.select().from(users).where(eq(users.id, otherId)).get()!;
    return {
      id: f.id,
      name: other.name,
      email: other.email,
      avatarId: other.avatarId,
    };
  });

  const requests = pendingIncoming.map((f) => {
    const otherId = f.userAId === userId ? f.userBId : f.userAId;
    const other = db.select().from(users).where(eq(users.id, otherId)).get()!;
    return {
      id: f.id,
      name: other.name,
      email: other.email,
    };
  });

  return (
    <div className="space-y-6">
      {requests.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Pending requests</h2>
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="text-sm">
                <p className="font-medium">
                  {r.name} <span className="text-muted">({r.email})</span>
                </p>
                <NotificationActions
                  type="FRIEND_INVITE"
                  href={`friend-invite:${r.id}`}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <FriendsClient friends={friends} />
    </div>
  );
}
