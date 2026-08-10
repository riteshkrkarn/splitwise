"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registerAction, type ActionResult } from "@/actions/auth";
import { AvatarPicker } from "@/components/avatar-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionResult = {};

export default function RegisterPage() {
  const [avatarId, setAvatarId] = useState(1);
  const [state, action, pending] = useActionState(registerAction, initial);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <Card className="w-full max-w-md">
        <p className="text-sm font-semibold text-primary">Splitwise</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Create account</h1>
        <p className="mt-1 text-sm text-muted">
          Start splitting with your people — private to your groups.
        </p>
        <form action={action} className="mt-6 space-y-4">
          <input type="hidden" name="avatarId" value={avatarId} />
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={6}
              autoComplete="new-password"
              required
            />
          </div>
          <AvatarPicker value={avatarId} onChange={setAvatarId} />
          {state.error && (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-5 text-sm text-muted">
          Already have an account?{" "}
          <Link className="font-semibold text-primary" href="/login">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
