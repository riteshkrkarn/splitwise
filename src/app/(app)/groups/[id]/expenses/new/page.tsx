import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ExpenseForm } from "@/components/expense-form";
import {
  assertGroupMember,
  getDefaultSplits,
  getGroupMembers,
  getGroupOrThrow,
} from "@/lib/group-data";

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  try {
    await assertGroupMember(id, session.user.id);
  } catch {
    notFound();
  }
  const group = await getGroupOrThrow(id);
  const members = await getGroupMembers(id);
  const defaults = await getDefaultSplits(id);
  const defaultSplitValues = Object.fromEntries(
    defaults.map((d) => [d.userId, d.value])
  );

  return (
    <ExpenseForm
      groupId={id}
      friendshipId={null}
      members={members}
      defaultCurrency={group.currency}
      defaultSplitMode={group.defaultSplitMode}
      defaultSplitValues={defaultSplitValues}
      currentUserId={session.user.id}
    />
  );
}
