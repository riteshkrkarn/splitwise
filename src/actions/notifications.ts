"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { migrate } from "@/db/ensure-migrated";
import { notifications } from "@/db/schema";
import { createId } from "@/lib/id";
import { createNotification } from "@/lib/group-data";
import { getGroupBalances, getGroupMembers, assertGroupMember } from "@/lib/group-data";
import { formatMoney } from "@/lib/utils";

migrate();

export async function markNotificationReadAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  db.update(notifications)
    .set({ read: true })
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, session.user.id))
    )
    .run();
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const session = await auth();
  if (!session?.user?.id) return;
  db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, session.user.id))
    .run();
  revalidatePath("/dashboard");
}

/** Payment reminders: notify users who owe money in a group */
export async function sendPaymentRemindersAction(groupId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  assertGroupMember(groupId, session.user.id);

  const members = getGroupMembers(groupId);
  const nameById = Object.fromEntries(members.map((m) => [m.userId, m.name]));
  const balances = getGroupBalances(groupId);

  for (const summary of balances) {
    for (const debt of summary.debts) {
      createNotification({
        userId: debt.fromUserId,
        groupId,
        type: "REMINDER",
        title: "Payment reminder",
        body: `You owe ${nameById[debt.toUserId] ?? "someone"} ${formatMoney(debt.amount, debt.currency)}`,
        href: `/groups/${groupId}/settle`,
      });
    }
  }

  // noop id usage to avoid unused import if tree-shaken oddly
  void createId;
  revalidatePath(`/groups/${groupId}`);
  return { success: "Reminders sent." };
}
