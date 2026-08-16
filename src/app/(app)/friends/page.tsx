import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import FriendsClient from "./friends-client";
import { db } from "@/db";
import { friendships, users } from "@/db/schema";
import { NotificationActions } from "@/components/notification-actions";
import { PaginationNav } from "@/components/pagination-nav";
import { Card } from "@/components/ui/card";
import {
  DEFAULT_PAGE_SIZE,
  hasNextPage,
  pageOffset,
  parsePage,
  withPageParam,
} from "@/lib/pagination";

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; requestsPage?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const requestsPage = parsePage(sp.requestsPage);
  const offset = pageOffset(page, DEFAULT_PAGE_SIZE);
  const requestsOffset = pageOffset(requestsPage, DEFAULT_PAGE_SIZE);

  const friendWhere = and(
    isNull(friendships.deletedAt),
    eq(friendships.status, "ACCEPTED"),
    or(eq(friendships.userAId, userId), eq(friendships.userBId, userId))
  );
  const pendingIncomingWhere = and(
    isNull(friendships.deletedAt),
    eq(friendships.status, "PENDING"),
    or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)),
    ne(friendships.requestedBy, userId)
  );

  const [acceptedRows, acceptedTotal, pendingRows, pendingTotal] =
    await Promise.all([
      db
        .select()
        .from(friendships)
        .where(friendWhere)
        .orderBy(desc(friendships.createdAt))
        .limit(DEFAULT_PAGE_SIZE)
        .offset(offset)
        .all(),
      db
        .select({ value: sql<number>`count(*)`.mapWith(Number) })
        .from(friendships)
        .where(friendWhere)
        .get(),
      db
        .select()
        .from(friendships)
        .where(pendingIncomingWhere)
        .orderBy(desc(friendships.createdAt))
        .limit(DEFAULT_PAGE_SIZE)
        .offset(requestsOffset)
        .all(),
      db
        .select({ value: sql<number>`count(*)`.mapWith(Number) })
        .from(friendships)
        .where(pendingIncomingWhere)
        .get(),
    ]);

  const otherIds = [
    ...new Set(
      [...acceptedRows, ...pendingRows].map((f) =>
        f.userAId === userId ? f.userBId : f.userAId
      )
    ),
  ];
  const otherUsers =
    otherIds.length === 0
      ? []
      : await db.select().from(users).where(inArray(users.id, otherIds)).all();
  const userById = Object.fromEntries(otherUsers.map((u) => [u.id, u]));

  const friends = acceptedRows.map((f) => {
    const otherId = f.userAId === userId ? f.userBId : f.userAId;
    const other = userById[otherId];
    return {
      id: f.id,
      name: other?.name ?? "Unknown",
      email: other?.email ?? "",
      avatarId: other?.avatarId ?? 1,
    };
  });

  const requests = pendingRows.map((f) => {
    const otherId = f.userAId === userId ? f.userBId : f.userAId;
    const other = userById[otherId];
    return {
      id: f.id,
      name: other?.name ?? "Unknown",
      email: other?.email ?? "",
    };
  });

  const totalFriends = acceptedTotal?.value ?? 0;
  const totalRequests = pendingTotal?.value ?? 0;

  return (
    <div className="space-y-6">
      {totalRequests > 0 && (
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
          <PaginationNav
            prevHref={
              requestsPage > 1
                ? withPageParam("/friends", page, {
                    requestsPage: String(requestsPage - 1),
                  })
                : null
            }
            nextHref={
              hasNextPage(requestsPage, DEFAULT_PAGE_SIZE, totalRequests)
                ? withPageParam("/friends", page, {
                    requestsPage: String(requestsPage + 1),
                  })
                : null
            }
          />
        </Card>
      )}
      <FriendsClient
        friends={friends}
        prevHref={
          page > 1
            ? withPageParam("/friends", page - 1, {
                requestsPage:
                  requestsPage > 1 ? String(requestsPage) : undefined,
              })
            : null
        }
        nextHref={
          hasNextPage(page, DEFAULT_PAGE_SIZE, totalFriends)
            ? withPageParam("/friends", page + 1, {
                requestsPage:
                  requestsPage > 1 ? String(requestsPage) : undefined,
              })
            : null
        }
      />
    </div>
  );
}
