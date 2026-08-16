"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { loginAction, type ActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

const initial: ActionResult = {};

function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  const next = useSearchParams().get("next") ?? "/dashboard";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-8" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))", paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
      <Card className="w-full max-w-md">
        <p className="text-sm font-semibold text-primary">Splitwise</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Log in</h1>
        <p className="mt-1 text-sm text-muted">
          Pick up where you left your group balances.
        </p>
        <form action={action} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>
          {state.error && (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-5 text-sm text-muted">
          No account?{" "}
          <Link className="font-semibold text-primary" href="/register">
            Register
          </Link>
          {" · "}
          <Link className="font-semibold text-accent" href="/reset-password">
            Reset password
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
