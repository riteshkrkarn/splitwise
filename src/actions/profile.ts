"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import type { ActionResult } from "@/actions/auth";
import { db } from "@/db";
import { migrate } from "@/db/ensure-migrated";
import { users } from "@/db/schema";

migrate();

export async function updateProfileAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const name = String(formData.get("name") ?? "").trim();
  const avatarId = Number(formData.get("avatarId") ?? 1);
  if (!name) return { error: "Name is required." };

  db.update(users)
    .set({
      name,
      avatarId: Math.min(5, Math.max(1, avatarId || 1)),
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id))
    .run();

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: "Profile updated." };
}
