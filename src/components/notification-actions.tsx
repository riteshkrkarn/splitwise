import {
  acceptFriendRequestAction,
  rejectFriendRequestAction,
} from "@/actions/friends";
import {
  acceptInviteAction,
  rejectInviteAction,
} from "@/actions/groups";
import { Button } from "@/components/ui/button";

export function NotificationActions({
  type,
  href,
}: {
  type: string;
  href: string | null;
}) {
  if (type === "INVITE" && href?.startsWith("group-invite:")) {
    const inviteId = href.replace("group-invite:", "");
    return (
      <div className="mt-2 flex gap-2">
        <form action={acceptInviteAction.bind(null, inviteId)}>
          <Button type="submit" size="sm">
            Accept
          </Button>
        </form>
        <form action={rejectInviteAction.bind(null, inviteId)}>
          <Button type="submit" size="sm" variant="outline">
            Reject
          </Button>
        </form>
      </div>
    );
  }

  if (type === "FRIEND_INVITE" && href?.startsWith("friend-invite:")) {
    const friendshipId = href.replace("friend-invite:", "");
    return (
      <div className="mt-2 flex gap-2">
        <form action={acceptFriendRequestAction.bind(null, friendshipId)}>
          <Button type="submit" size="sm">
            Accept
          </Button>
        </form>
        <form action={rejectFriendRequestAction.bind(null, friendshipId)}>
          <Button type="submit" size="sm" variant="outline">
            Reject
          </Button>
        </form>
      </div>
    );
  }

  return null;
}
