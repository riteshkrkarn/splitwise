"use client";

import { useActionState, useState } from "react";
import { updateProfileAction } from "@/actions/profile";
import type { ActionResult } from "@/actions/auth";
import { AvatarPicker } from "@/components/avatar-picker";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionResult = {};

export default function ProfileClient({
  name,
  email,
  avatarId,
}: {
  name: string;
  email: string;
  avatarId: number;
}) {
  const [avatar, setAvatar] = useState(avatarId);
  const [state, action, pending] = useActionState(updateProfileAction, initial);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Profile" description={email} />
      <Card>
        <form action={action} className="space-y-4">
          <input type="hidden" name="avatarId" value={avatar} />
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input id="name" name="name" defaultValue={name} required />
          </div>
          <AvatarPicker value={avatar} onChange={setAvatar} />
          {state.error && (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          )}
          {state.success && (
            <p className="text-sm text-accent">{state.success}</p>
          )}
          <Button type="submit" disabled={pending}>
            Save changes
          </Button>
        </form>
      </Card>
    </div>
  );
}
