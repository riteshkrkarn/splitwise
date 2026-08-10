"use client";

import { useActionState } from "react";
import { inviteToGroupAction } from "@/actions/groups";
import type { ActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionResult = {};

export function InviteForm({ groupId }: { groupId: string }) {
  const bound = inviteToGroupAction.bind(null, groupId);
  const [state, action, pending] = useActionState(bound, initial);
  return (
    <form action={action} className="space-y-2">
      <Label htmlFor="email">Add member by email</Label>
      <p className="text-xs text-muted">
        They need an account. They’ll get an in-app invite to accept or reject.
      </p>
      <div className="flex gap-2">
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="friend@email.com"
          required
        />
        <Button type="submit" disabled={pending} size="sm">
          Invite
        </Button>
      </div>
      {state.error && (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-xs text-accent">{state.success}</p>
      )}
    </form>
  );
}
