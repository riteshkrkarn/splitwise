"use client";

import { useActionState, useState } from "react";
import {
  leaveGroupAction,
  softDeleteGroupAction,
  updateGroupSettingsAction,
  removeMemberAction,
} from "@/actions/groups";
import type { ActionResult } from "@/actions/auth";
import { AvatarPicker } from "@/components/avatar-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/utils";

const initial: ActionResult = {};

export function SettingsClient({
  groupId,
  name,
  coverAvatarId,
  currency,
  simplifyDebts,
  defaultSplitMode,
  members,
  defaultSplitValues,
}: {
  groupId: string;
  name: string;
  coverAvatarId: number;
  currency: string;
  simplifyDebts: boolean;
  defaultSplitMode: string;
  members: { userId: string; name: string }[];
  defaultSplitValues: Record<string, number>;
}) {
  const [avatar, setAvatar] = useState(coverAvatarId);
  const bound = updateGroupSettingsAction.bind(null, groupId);
  const [state, action, pending] = useActionState(bound, initial);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Card>
        <h1 className="text-2xl font-bold text-ink">Group settings</h1>
        <form action={action} className="mt-6 space-y-4">
          <input type="hidden" name="coverAvatarId" value={avatar} />
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={name} />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              name="currency"
              defaultValue={currency}
              className="h-11 w-full rounded-xl border px-3 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <AvatarPicker value={avatar} onChange={setAvatar} label="Cover avatar" />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="simplifyDebts"
              defaultChecked={simplifyDebts}
            />
            Simplify debts
          </label>
          <div>
            <Label htmlFor="defaultSplitMode">Default split mode</Label>
            <select
              id="defaultSplitMode"
              name="defaultSplitMode"
              defaultValue={defaultSplitMode}
              className="h-11 w-full rounded-xl border px-3 text-sm"
            >
              <option value="EQUAL">Equal</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="SHARES">Shares</option>
              <option value="EXACT">Exact</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Default split values</p>
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-2">
                <span className="w-28 truncate text-sm">{m.name}</span>
                <Input
                  name={`split_${m.userId}`}
                  type="number"
                  step="0.01"
                  defaultValue={defaultSplitValues[m.userId] ?? ""}
                  placeholder="value"
                />
              </div>
            ))}
          </div>
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          {state.success && <p className="text-sm text-accent">{state.success}</p>}
          <Button type="submit" disabled={pending}>
            Save
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold">Members</h2>
        <ul className="mt-3 space-y-2">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between text-sm">
              <span>{m.name}</span>
              <form action={removeMemberAction.bind(null, groupId, m.userId)}>
                <Button type="submit" variant="ghost" size="sm">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-wrap gap-2">
        <form action={leaveGroupAction.bind(null, groupId)}>
          <Button type="submit" variant="outline">
            Leave group
          </Button>
        </form>
        <form action={softDeleteGroupAction.bind(null, groupId)}>
          <Button type="submit" variant="danger">
            Delete group
          </Button>
        </form>
      </Card>
    </div>
  );
}
