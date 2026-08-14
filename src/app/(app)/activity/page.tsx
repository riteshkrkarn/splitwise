import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull, or, lt } from "drizzle-orm";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { db } from "@/db";
import { activityEvents, groupMembers, groups } from "@/db/schema";

const PAGE_SIZE = 50;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const sp = await searchParams;
  const cursor = sp.cursor ? Number(sp.cursor) : null;

  const memberships = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(
      and(eq(groupMembers.userId, session.user.id), isNull(groups.deletedAt))
    )
    .all();
  const groupIds = memberships.map((m) => m.groupId);

  const baseWhere =
    groupIds.length === 0
      ? eq(activityEvents.userId, session.user.id)
      : or(
          eq(activityEvents.userId, session.user.id),
          inArray(activityEvents.groupId, groupIds)
        );

  const events = await db
    .select()
    .from(activityEvents)
    .where(
      cursor
        ? and(baseWhere, lt(activityEvents.createdAt, new Date(cursor)))
        : baseWhere
    )
    .orderBy(desc(activityEvents.createdAt))
    .limit(PAGE_SIZE + 1)
    .all();

  const hasMore = events.length > PAGE_SIZE;
  const page = hasMore ? events.slice(0, PAGE_SIZE) : events;
  const nextCursor = hasMore
    ? page[page.length - 1]?.createdAt.getTime()
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Recent changes across your groups."
      />
      {page.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="When people add expenses, settle up, or join groups, it shows up here."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {page.map((e) => (
              <li key={e.id} className="px-5 py-3.5">
                <p className="text-sm font-medium text-ink">{e.message}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {e.type.replaceAll("_", " ").toLowerCase()} ·{" "}
                  {new Date(e.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
          {nextCursor && (
            <div className="border-t border-border px-5 py-3">
              <Link href={`/activity?cursor=${nextCursor}`}>
                <Button variant="secondary" size="sm">
                  Load more
                </Button>
              </Link>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
