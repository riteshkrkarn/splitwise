import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  acceptInviteAction,
  rejectInviteAction,
} from "@/actions/groups";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db } from "@/db";
import { groupInvites, groups } from "@/db/schema";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();
  const invite = await db
    .select()
    .from(groupInvites)
    .where(eq(groupInvites.token, token))
    .get();
  const group = invite
    ? await db.select().from(groups).where(eq(groups.id, invite.groupId)).get()
    : null;

  if (!invite || !group) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card>Invite not found.</Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#ccfbf1,_#f7f6f2_50%)] px-4">
      <Card className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-ink">
          Join {group.name}
        </h1>
        <p className="text-sm text-muted">
          Invite sent to <strong>{invite.email}</strong>
        </p>
        <p className="text-sm text-muted">
          You can also accept or reject this from Notifications on your dashboard.
        </p>
        {!session?.user ? (
          <Link href={`/login?next=/invites/${token}`}>
            <Button className="w-full">Log in to respond</Button>
          </Link>
        ) : session.user.email !== invite.email ? (
          <p className="text-sm text-danger">
            Log in as {invite.email} to respond to this invite.
          </p>
        ) : invite.status !== "PENDING" ? (
          <p className="text-sm">
            This invite was already {invite.status.toLowerCase()}.
          </p>
        ) : (
          <div className="flex gap-2">
            <form action={acceptInviteAction.bind(null, invite.id)} className="flex-1">
              <Button type="submit" className="w-full">
                Accept
              </Button>
            </form>
            <form action={rejectInviteAction.bind(null, invite.id)} className="flex-1">
              <Button type="submit" variant="outline" className="w-full">
                Reject
              </Button>
            </form>
          </div>
        )}
      </Card>
    </div>
  );
}
