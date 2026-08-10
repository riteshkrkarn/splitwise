"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { markNotificationReadAction } from "@/actions/notifications";
import { NotificationActions } from "@/components/notification-actions";

type Item = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
};

export function NotificationList({
  notifications,
  pendingGroupInviteIds,
  pendingFriendIds,
}: {
  notifications: Item[];
  pendingGroupInviteIds: string[];
  pendingFriendIds: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const dismissed = new Set(dismissedIds);
  const items = notifications.filter((n) => !n.read && !dismissed.has(n.id));

  const groupSet = new Set(pendingGroupInviteIds);
  const friendSet = new Set(pendingFriendIds);

  function dismiss(id: string) {
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted">No new notifications</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((n) => {
        const showGroupActions =
          n.type === "INVITE" &&
          n.href?.startsWith("group-invite:") &&
          groupSet.has(n.href.replace("group-invite:", ""));
        const showFriendActions =
          n.type === "FRIEND_INVITE" &&
          n.href?.startsWith("friend-invite:") &&
          friendSet.has(n.href.replace("friend-invite:", ""));
        return (
          <li
            key={n.id}
            className="flex items-start gap-2 rounded-xl bg-bg px-3 py-2.5"
          >
            <div className="min-w-0 flex-1 text-sm text-ink">
              <span className="font-medium">{n.title}</span>
              <span className="text-muted"> — {n.body}</span>
              {(showGroupActions || showFriendActions) && (
                <NotificationActions type={n.type} href={n.href} />
              )}
            </div>
            <button
              type="button"
              title="Mark as read"
              aria-label="Mark as read"
              onClick={() => dismiss(n.id)}
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-surface"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
