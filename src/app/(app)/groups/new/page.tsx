"use client";

import { useActionState, useState } from "react";
import { createGroupAction } from "@/actions/groups";
import type { ActionResult } from "@/actions/auth";
import { AvatarPicker } from "@/components/avatar-picker";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, Select } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/utils";

const initial: ActionResult = {};

export default function NewGroupPage() {
  const [coverAvatarId, setCoverAvatarId] = useState(1);
  const [state, action, pending] = useActionState(createGroupAction, initial);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="Create a group"
        description="Up to 5 people. Invite them after you create it."
      />
      <Card>
        <form action={action} className="space-y-4">
          <input type="hidden" name="coverAvatarId" value={coverAvatarId} />
          <div>
            <Label htmlFor="name">Group name</Label>
            <Input id="name" name="name" placeholder="Apartment" required />
          </div>
          <div>
            <Label htmlFor="currency">Default currency</Label>
            <Select id="currency" name="currency" defaultValue="INR">
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <AvatarPicker
            value={coverAvatarId}
            onChange={setCoverAvatarId}
            label="Group avatar"
          />
          {state.error && (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            Create group
          </Button>
        </form>
      </Card>
    </div>
  );
}
