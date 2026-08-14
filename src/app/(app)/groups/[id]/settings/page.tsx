import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { SettingsClient } from "./settings-client";
import {
  assertGroupMember,
  getDefaultSplits,
  getGroupMembers,
  getGroupOrThrow,
} from "@/lib/group-data";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  try {
    await assertGroupMember(id, session.user.id);
  } catch {
    notFound();
  }
  const group = await getGroupOrThrow(id);
  const members = await getGroupMembers(id);
  const defaults = await getDefaultSplits(id);
  const me = members.find((m) => m.userId === session.user.id);
  return (
    <SettingsClient
      groupId={id}
      name={group.name}
      coverAvatarId={group.coverAvatarId}
      currency={group.currency}
      simplifyDebts={group.simplifyDebts}
      defaultSplitMode={group.defaultSplitMode}
      members={members}
      defaultSplitValues={Object.fromEntries(defaults.map((d) => [d.userId, d.value]))}
      isOwner={me?.role === "OWNER"}
      currentUserId={session.user.id}
    />
  );
}
