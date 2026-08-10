"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { migrate } from "@/db/ensure-migrated";
import {
  defaultSplits,
  groupInvites,
  groupMembers,
  groups,
  users,
} from "@/db/schema";
import type { ActionResult } from "@/actions/auth";
import {
  assertGroupMember,
  createActivity,
  createNotification,
  getGroupMembers,
  getGroupOrThrow,
} from "@/lib/group-data";
import { createId } from "@/lib/id";
import { MAX_GROUP_MEMBERS } from "@/lib/utils";

migrate();

export async function createGroupAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const name = String(formData.get("name") ?? "").trim();
  const coverAvatarId = Number(formData.get("coverAvatarId") ?? 1);
  const currency = String(formData.get("currency") ?? "INR");
  if (!name) return { error: "Group name is required." };

  const id = createId("grp");
  db.insert(groups)
    .values({
      id,
      name,
      coverAvatarId: Math.min(5, Math.max(1, coverAvatarId || 1)),
      currency,
      simplifyDebts: false,
      defaultSplitMode: "EQUAL",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();

  db.insert(groupMembers)
    .values({
      id: createId("gmem"),
      groupId: id,
      userId: session.user.id,
      joinedAt: new Date(),
    })
    .run();

  createActivity({
    userId: session.user.id,
    groupId: id,
    type: "GROUP_CREATED",
    message: `${session.user.name} created group ${name}`,
  });

  redirect(`/groups/${id}`);
}

export async function inviteToGroupAction(
  groupId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  assertGroupMember(groupId, session.user.id);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Email is required." };

  const invitee = db.select().from(users).where(eq(users.email, email)).get();
  if (!invitee) {
    return { error: "No registered user with that email. They need an account first." };
  }
  if (invitee.id === session.user.id) {
    return { error: "You cannot invite yourself." };
  }

  const memberCount =
    db
      .select({ value: count() })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId))
      .get()?.value ?? 0;

  const pendingCount =
    db
      .select({ value: count() })
      .from(groupInvites)
      .where(
        and(eq(groupInvites.groupId, groupId), eq(groupInvites.status, "PENDING"))
      )
      .get()?.value ?? 0;

  if (memberCount + pendingCount >= MAX_GROUP_MEMBERS) {
    return { error: `Group is limited to ${MAX_GROUP_MEMBERS} people.` };
  }

  const existingMember = db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, invitee.id))
    )
    .get();
  if (existingMember) return { error: "User is already a member." };

  const existingPending = db
    .select()
    .from(groupInvites)
    .where(
      and(
        eq(groupInvites.groupId, groupId),
        eq(groupInvites.email, email),
        eq(groupInvites.status, "PENDING")
      )
    )
    .get();
  if (existingPending) return { error: "An invite is already pending for this user." };

  const group = getGroupOrThrow(groupId);
  const inviteId = createId("ginv");
  const token = createId("inv");
  db.insert(groupInvites)
    .values({
      id: inviteId,
      groupId,
      email,
      token,
      status: "PENDING",
      invitedBy: session.user.id,
      createdAt: new Date(),
    })
    .run();

  createNotification({
    userId: invitee.id,
    groupId,
    type: "INVITE",
    title: "Group invite",
    body: `${session.user.name} invited you to join “${group.name}”`,
    href: `group-invite:${inviteId}`,
  });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
  return { success: `Invite sent to ${invitee.name}. They can accept or reject in the app.` };
}

export async function acceptInviteAction(inviteId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const invite = db
    .select()
    .from(groupInvites)
    .where(eq(groupInvites.id, inviteId))
    .get();
  if (!invite || invite.status !== "PENDING") {
    throw new Error("Invite not found or already handled");
  }
  if (invite.email !== session.user.email) {
    throw new Error("This invite was sent to a different account.");
  }

  const memberCount =
    db
      .select({ value: count() })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, invite.groupId))
      .get()?.value ?? 0;
  if (memberCount >= MAX_GROUP_MEMBERS) {
    throw new Error("Group is full (max 5).");
  }

  const already = db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, invite.groupId),
        eq(groupMembers.userId, session.user.id)
      )
    )
    .get();
  if (!already) {
    db.insert(groupMembers)
      .values({
        id: createId("gmem"),
        groupId: invite.groupId,
        userId: session.user.id,
        joinedAt: new Date(),
      })
      .run();
  }

  db.update(groupInvites)
    .set({ status: "ACCEPTED" })
    .where(eq(groupInvites.id, invite.id))
    .run();

  const group = getGroupOrThrow(invite.groupId);

  createActivity({
    userId: session.user.id,
    groupId: invite.groupId,
    type: "MEMBER_JOINED",
    message: `${session.user.name} joined the group`,
  });
  createNotification({
    userId: invite.invitedBy,
    groupId: invite.groupId,
    type: "INVITE_ACCEPTED",
    title: "Invite accepted",
    body: `${session.user.name} accepted your invite to “${group.name}”`,
    href: `/groups/${invite.groupId}`,
  });

  revalidatePath(`/groups/${invite.groupId}`);
  revalidatePath("/dashboard");
  redirect(`/groups/${invite.groupId}`);
}

export async function rejectInviteAction(inviteId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const invite = db
    .select()
    .from(groupInvites)
    .where(eq(groupInvites.id, inviteId))
    .get();
  if (!invite || invite.status !== "PENDING") {
    throw new Error("Invite not found or already handled");
  }
  if (invite.email !== session.user.email) {
    throw new Error("This invite was sent to a different account.");
  }

  db.update(groupInvites)
    .set({ status: "DECLINED" })
    .where(eq(groupInvites.id, invite.id))
    .run();

  const group = db.select().from(groups).where(eq(groups.id, invite.groupId)).get();

  createNotification({
    userId: invite.invitedBy,
    groupId: invite.groupId,
    type: "INVITE",
    title: "Invite declined",
    body: `${session.user.name} declined your invite${group ? ` to “${group.name}”` : ""}`,
    href: group ? `/groups/${invite.groupId}` : undefined,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/groups/${invite.groupId}`);
}

export async function updateGroupSettingsAction(
  groupId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  assertGroupMember(groupId, session.user.id);

  const name = String(formData.get("name") ?? "").trim();
  const coverAvatarId = Number(formData.get("coverAvatarId") ?? 1);
  const currency = String(formData.get("currency") ?? "INR");
  const simplifyDebts = formData.get("simplifyDebts") === "on";
  const defaultSplitMode = String(formData.get("defaultSplitMode") ?? "EQUAL");

  db.update(groups)
    .set({
      name: name || getGroupOrThrow(groupId).name,
      coverAvatarId: Math.min(5, Math.max(1, coverAvatarId || 1)),
      currency,
      simplifyDebts,
      defaultSplitMode,
      updatedAt: new Date(),
    })
    .where(eq(groups.id, groupId))
    .run();

  // Optional default split values: value_<userId>
  const members = getGroupMembers(groupId);
  db.delete(defaultSplits).where(eq(defaultSplits.groupId, groupId)).run();
  for (const m of members) {
    const raw = formData.get(`split_${m.userId}`);
    if (raw == null || raw === "") continue;
    db.insert(defaultSplits)
      .values({
        id: createId("ds"),
        groupId,
        userId: m.userId,
        value: Number(raw),
      })
      .run();
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: "Settings saved." };
}

export async function leaveGroupAction(groupId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  assertGroupMember(groupId, session.user.id);

  db.delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, session.user.id)
      )
    )
    .run();

  createActivity({
    userId: session.user.id,
    groupId,
    type: "MEMBER_LEFT",
    message: `${session.user.name} left the group`,
  });

  redirect("/dashboard");
}

export async function removeMemberAction(groupId: string, userId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  assertGroupMember(groupId, session.user.id);
  if (userId === session.user.id) throw new Error("Use leave group instead");

  db.delete(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    )
    .run();

  revalidatePath(`/groups/${groupId}/settings`);
}

export async function softDeleteGroupAction(groupId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  assertGroupMember(groupId, session.user.id);
  db.update(groups)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(groups.id, groupId))
    .run();
  redirect("/dashboard");
}

export async function restoreGroupAction(groupId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  db.update(groups)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(groups.id, groupId))
    .run();
  // re-add membership if missing
  const member = db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, session.user.id))
    )
    .get();
  if (!member) {
    db.insert(groupMembers)
      .values({
        id: createId("gmem"),
        groupId,
        userId: session.user.id,
        joinedAt: new Date(),
      })
      .run();
  }
  redirect(`/groups/${groupId}`);
}
