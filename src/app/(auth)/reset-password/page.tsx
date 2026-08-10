"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import {
  requestPasswordResetAction,
  resetPasswordAction,
  type ActionResult,
} from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Suspense } from "react";

const initial: ActionResult = {};

function ResetInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [reqState, reqAction, reqPending] = useActionState(
    requestPasswordResetAction,
    initial
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetPasswordAction,
    initial
  );

  if (token) {
    return (
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-ink">Set new password</h1>
        <form action={resetAction} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" minLength={6} required />
          </div>
          {resetState.error && (
            <p className="text-sm text-danger">{resetState.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={resetPending}>
            Update password
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <h1 className="text-2xl font-bold text-ink">Reset password</h1>
      <form action={reqAction} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        {reqState.error && <p className="text-sm text-danger">{reqState.error}</p>}
        {reqState.success && (
          <p className="break-all text-sm text-accent">{reqState.success}</p>
        )}
        <Button type="submit" className="w-full" disabled={reqPending}>
          Send reset link
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Suspense>
        <ResetInner />
      </Suspense>
    </div>
  );
}
