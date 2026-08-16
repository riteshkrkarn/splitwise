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

  if (!session?.user) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md space-y-4">
          <h1 className="page-title">Group invite</h1>
          <p className="text-sm text-muted">
            Log in to view and respond to this invite.
          </p>
          <Link href={`/login?next=/invites/${token}`}>
            <Button className="w-full">Log in to continue</Button>
          </Link>
        </Card>
      </div>
    );
  }

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
      <div className="flex min-h-dvh items-center justify-center px-4 py-8">
        <Card>Invite not found.</Card>
      </div>
    );
  }

  if (session.user.email !== invite.email) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md space-y-4">
          <h1 className="page-title">Wrong account</h1>
          <p className="text-sm text-danger">
            This invite was sent to a different email. Log in with that account
            to respond.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,#ccfbf1,#f7f6f2_50%)] px-4 py-8 dark:bg-[radial-gradient(circle_at_top,oklch(0.28_0.06_180),var(--bg)_55%)]">
      <Card className="w-full max-w-md space-y-4">
        <h1 className="page-title">Join {group.name}</h1>
        <p className="text-sm text-muted">
          You can also accept or reject this from Notifications on your
          dashboard.
        </p>
        {invite.status !== "PENDING" ? (
          <p className="text-sm">
            This invite was already {invite.status.toLowerCase()}.
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <form
              action={acceptInviteAction.bind(null, invite.id)}
              className="flex-1"
            >
              <Button type="submit" className="w-full">
                Accept
              </Button>
            </form>
            <form
              action={rejectInviteAction.bind(null, invite.id)}
              className="flex-1"
            >
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
