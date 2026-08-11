"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { createId } from "@/lib/id";
import { createNotification } from "@/lib/group-data";
import { getGroupBalances, getGroupMembers, assertGroupMember } from "@/lib/group-data";
import { formatMoney } from "@/lib/utils";

export async function markNotificationReadAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await db.update(notifications)
    .set({ read: true })
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, session.user.id))
    )
    ;
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const session = await auth();
  if (!session?.user?.id) return;
  await db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, session.user.id))
    ;
  revalidatePath("/dashboard");
}

/** Payment reminders: notify users who owe money in a group */
export async function sendPaymentRemindersAction(groupId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  await assertGroupMember(groupId, session.user.id);

  const members = await getGroupMembers(groupId);
  const nameById = Object.fromEntries(members.map((m) => [m.userId, m.name]));
  const balances = await getGroupBalances(groupId);

  for (const summary of balances) {
    for (const debt of summary.debts) {
      await createNotification({
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
