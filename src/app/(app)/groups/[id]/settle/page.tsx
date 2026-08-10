import { notFound } from "next/navigation";
import { auth } from "@/auth";
import SettleClient from "./settle-client";
import {
  assertGroupMember,
  getGroupBalances,
  getGroupMembers,
  getGroupOrThrow,
} from "@/lib/group-data";

export default async function SettlePage({
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
  const balances = getGroupBalances(id);
  const summary =
    balances.find((b) => b.currency === group.currency) ?? balances[0];
  const suggestions = summary?.debts ?? [];

  return (
    <SettleClient
      groupId={id}
      members={members}
      currency={group.currency}
      suggestions={suggestions}
    />
  );
}
