"use client";

import { useActionState } from "react";
import Link from "next/link";
import { addFriendAction } from "@/actions/friends";
import type { ActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarDisplay } from "@/components/avatar-display";
import { PaginationNav } from "@/components/pagination-nav";

const initial: ActionResult = {};

export default function FriendsClient({
  friends,
  prevHref,
  nextHref,
}: {
  friends: {
    id: string;
    name: string;
    email: string;
    avatarId: number;
  }[];
  prevHref?: string | null;
  nextHref?: string | null;
}) {
  const [state, action, pending] = useActionState(addFriendAction, initial);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Friends"
        description="Split one-off costs without creating a group."
      />
      <Card>
        <form
          action={action}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div className="min-w-0 flex-1 sm:min-w-55">
            <Label htmlFor="email">Add by email</Label>
            <p className="mb-1.5 text-xs text-muted">
              Sends an in-app request they can accept or reject.
            </p>
            <Input id="email" name="email" type="email" required />
          </div>
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            Send request
          </Button>
        </form>
        {state.error && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="mt-3 text-sm text-accent">{state.success}</p>
        )}
      </Card>

      {friends.length === 0 ? (
        <EmptyState
          title="No friends yet"
          description="Add someone by email — they must already have an account."
        />
      ) : (
        <div>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {friends.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/friends/${f.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-bg"
                >
                  <AvatarDisplay avatarId={f.avatarId} name={f.name} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{f.name}</p>
                    <p className="truncate text-sm text-muted">{f.email}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <PaginationNav prevHref={prevHref} nextHref={nextHref} />
        </div>
      )}
    </div>
  );
}
