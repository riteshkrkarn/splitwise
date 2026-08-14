"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { sendPaymentRemindersAction } from "@/actions/advanced";

export async function markNotificationReadAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, session.user.id))
    );
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const session = await auth();
  if (!session?.user?.id) return;
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, session.user.id));
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

export { sendPaymentRemindersAction };
