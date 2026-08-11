"use server";

import { and, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ActionResult } from "@/actions/auth";
import { db } from "@/db";
import { friendships, users } from "@/db/schema";
import { createNotification } from "@/lib/group-data";
import { createId } from "@/lib/id";

function orderedPair(a: string, b: string) {
  return a < b ? ([a, b] as const) : ([b, a] as const);
}

export async function addFriendAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const friend = await db.select().from(users).where(eq(users.email, email)).get();
  if (!friend) {
    return { error: "No registered user with that email. They need an account first." };
  }
  if (friend.id === session.user.id) return { error: "You cannot add yourself." };

  const [userAId, userBId] = orderedPair(session.user.id, friend.id);
  const existing = await db
    .select()
    .from(friendships)
    .where(
      and(eq(friendships.userAId, userAId), eq(friendships.userBId, userBId))
    )
    .get();

  if (existing && !existing.deletedAt && existing.status === "ACCEPTED") {
    return { error: "Already friends." };
  }
  if (existing && !existing.deletedAt && existing.status === "PENDING") {
    return { error: "Friend request already pending." };
  }

  let friendshipId: string;
  if (existing) {
    friendshipId = existing.id;
    await db.update(friendships)
      .set({
        deletedAt: null,
        status: "PENDING",
        requestedBy: session.user.id,
      })
      .where(eq(friendships.id, existing.id))
      ;
  } else {
    friendshipId = createId("frn");
    await db.insert(friendships)
      .values({
        id: friendshipId,
        userAId,
        userBId,
        status: "PENDING",
        requestedBy: session.user.id,
        createdAt: new Date(),
      })
      ;
  }

  await createNotification({
    userId: friend.id,
    type: "FRIEND_INVITE",
    title: "Friend request",
    body: `${session.user.name} sent you a friend request`,
    href: `friend-invite:${friendshipId}`,
  });

  revalidatePath("/friends");
  revalidatePath("/dashboard");
  return { success: `Friend request sent to ${friend.name}.` };
}

export async function acceptFriendRequestAction(friendshipId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const friendship = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId))
    .get();
  if (!friendship || friendship.deletedAt || friendship.status !== "PENDING") {
    throw new Error("Request not found");
  }
  if (
    friendship.userAId !== session.user.id &&
    friendship.userBId !== session.user.id
  ) {
    throw new Error("Not your request");
  }
  if (friendship.requestedBy === session.user.id) {
    throw new Error("You cannot accept your own request");
  }

  await db.update(friendships)
    .set({ status: "ACCEPTED" })
    .where(eq(friendships.id, friendshipId))
    ;

  if (friendship.requestedBy) {
    await createNotification({
      userId: friendship.requestedBy,
      type: "INVITE_ACCEPTED",
      title: "Friend request accepted",
      body: `${session.user.name} accepted your friend request`,
      href: `/friends/${friendshipId}`,
    });
  }

  revalidatePath("/friends");
  revalidatePath("/dashboard");
  redirect(`/friends/${friendshipId}`);
}

export async function rejectFriendRequestAction(friendshipId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const friendship = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId))
    .get();
  if (!friendship || friendship.deletedAt || friendship.status !== "PENDING") {
    throw new Error("Request not found");
  }
  if (
    friendship.userAId !== session.user.id &&
    friendship.userBId !== session.user.id
  ) {
    throw new Error("Not your request");
  }
  if (friendship.requestedBy === session.user.id) {
    throw new Error("You cannot reject your own request");
  }

  await db.update(friendships)
    .set({ deletedAt: new Date(), status: "DECLINED" })
    .where(eq(friendships.id, friendshipId))
    ;

  if (friendship.requestedBy) {
    await createNotification({
      userId: friendship.requestedBy,
      type: "INVITE",
      title: "Friend request declined",
      body: `${session.user.name} declined your friend request`,
    });
  }

  revalidatePath("/friends");
  revalidatePath("/dashboard");
}

export async function getMyFriendships(userId: string) {
  return await db
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
}
