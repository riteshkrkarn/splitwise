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

const initial: ActionResult = {};

export default function FriendsClient({
  friends,
}: {
  friends: {
    id: string;
    name: string;
    email: string;
    avatarId: number;
  }[];
}) {
  const [state, action, pending] = useActionState(addFriendAction, initial);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Friends"
        description="Split one-off costs without creating a group."
      />
      <Card>
        <form action={action} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="email">Add by email</Label>
            <p className="mb-1.5 text-xs text-muted">
              Sends an in-app request they can accept or reject.
            </p>
            <Input id="email" name="email" type="email" required />
          </div>
          <Button type="submit" disabled={pending}>
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
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {friends.map((f) => (
            <li key={f.id}>
              <Link
                href={`/friends/${f.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-bg"
              >
                <AvatarDisplay avatarId={f.avatarId} name={f.name} />
                <div>
                  <p className="font-semibold">{f.name}</p>
                  <p className="text-sm text-muted">{f.email}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
