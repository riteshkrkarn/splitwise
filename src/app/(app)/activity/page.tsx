import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull, or, lt } from "drizzle-orm";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { db } from "@/db";
import { activityEvents, groupMembers, groups } from "@/db/schema";
import { DEFAULT_PAGE_SIZE, parsePage } from "@/lib/pagination";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const sp = await searchParams;
  const cursor = sp.cursor ? Number(sp.cursor) : null;
  const page = parsePage(sp.page);

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
    .limit(DEFAULT_PAGE_SIZE + 1)
    .offset(cursor ? 0 : (page - 1) * DEFAULT_PAGE_SIZE)
    .all();

  const hasMore = events.length > DEFAULT_PAGE_SIZE;
  const pageEvents = hasMore ? events.slice(0, DEFAULT_PAGE_SIZE) : events;
  const nextCursor = hasMore
    ? pageEvents[pageEvents.length - 1]?.createdAt.getTime()
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Recent changes across your groups."
      />
      {pageEvents.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="When people add expenses, settle up, or join groups, it shows up here."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {pageEvents.map((e) => (
              <li key={e.id} className="px-5 py-3.5">
                <p className="text-sm font-medium text-ink">{e.message}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {e.type.replaceAll("_", " ").toLowerCase()} ·{" "}
                  {new Date(e.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
            {!cursor && page > 1 && (
              <Link href={`/activity?page=${page - 1}`}>
                <Button variant="secondary" size="sm">
                  Previous
                </Button>
              </Link>
            )}
            {nextCursor && (
              <Link
                href={
                  cursor
                    ? `/activity?cursor=${nextCursor}`
                    : `/activity?page=${page + 1}`
                }
              >
                <Button variant="secondary" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
