import { notFound } from "next/navigation";
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
  if (!session?.user?.id) return null;
  try {
    assertGroupMember(id, session.user.id);
  } catch {
    notFound();
  }
  const group = getGroupOrThrow(id);
  const members = getGroupMembers(id);
  const defaults = getDefaultSplits(id);
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
    />
  );
}
