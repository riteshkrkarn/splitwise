import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { auth } from "@/auth";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { db } from "@/db";
import { activityEvents, groupMembers, groups } from "@/db/schema";

export default async function ActivityPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const memberships = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(
      and(eq(groupMembers.userId, session.user.id), isNull(groups.deletedAt))
    )
    .all();
  const groupIds = memberships.map((m) => m.groupId);

  const events =
    groupIds.length === 0
      ? []
      : await db
          .select()
          .from(activityEvents)
          .where(
            or(
              eq(activityEvents.userId, session.user.id),
              inArray(activityEvents.groupId, groupIds)
            )
          )
          .orderBy(desc(activityEvents.createdAt))
          .limit(50)
          .all();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Recent changes across your groups."
      />
      {events.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="When people add expenses, settle up, or join groups, it shows up here."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {events.map((e) => (
              <li key={e.id} className="px-5 py-3.5">
                <p className="text-sm font-medium text-ink">{e.message}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {e.type.replaceAll("_", " ").toLowerCase()} ·{" "}
                  {new Date(e.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
