"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import { migrate } from "@/db/ensure-migrated";
import { passwordResetTokens, users } from "@/db/schema";
import { createId } from "@/lib/id";
import { clientKey } from "@/lib/request-key";
import { checkRateLimit, safeNextPath, validatePassword } from "@/lib/security";

export type ActionResult = { error?: string; success?: string };

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(72),
  avatarId: z.coerce.number().int().min(1).max(5).default(1),
});

function credentialsFailed(error: unknown) {
  if (error instanceof AuthError) return true;
  const type = (error as { type?: string } | null)?.type;
  return type === "CredentialsSignin" || type === "CallbackRouteError";
}

async function signInWithPassword(email: string, password: string) {
  if (!process.env.AUTH_SECRET) {
    return { error: "Server is missing AUTH_SECRET. Add it in Vercel and redeploy." };
  }
  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result && typeof result === "object" && "error" in result && result.error) {
      return { error: "Invalid email or password." };
    }
  } catch (error) {
    if (credentialsFailed(error)) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
  return null;
}

export async function registerAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await migrate();
  const rate = await checkRateLimit(await clientKey("register"), 10);
  if (!rate.ok) {
    return { error: `Too many attempts. Try again in ${rate.retryAfterSec}s.` };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").toLowerCase(),
    password: formData.get("password"),
    avatarId: formData.get("avatarId") ?? 1,
  });
  if (!parsed.success) {
    return { error: "Name, valid email, and password (10–72 chars) are required." };
  }

  const { name, email, password, avatarId } = parsed.data;
  const existing = await db.select().from(users).where(eq(users.email, email)).get();
  if (existing) return { error: "Unable to create account with that email." };

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    id: createId("usr"),
    email,
    name,
    passwordHash,
    avatarId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const signInError = await signInWithPassword(email, password);
  if (signInError) {
    return { error: "Account created, but sign-in failed. Try logging in." };
  }
  redirect("/dashboard");
}

export async function loginAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const rate = await checkRateLimit(await clientKey("login"), 20);
  if (!rate.ok) {
    return { error: `Too many attempts. Try again in ${rate.retryAfterSec}s.` };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const signInError = await signInWithPassword(email, password);
  if (signInError) return signInError;
  redirect(safeNextPath(formData.get("next")));
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function requestPasswordResetAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await migrate();
  const rate = await checkRateLimit(await clientKey("reset"), 5);
  if (!rate.ok) {
    return { error: `Too many attempts. Try again in ${rate.retryAfterSec}s.` };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const generic = "If that email exists, a reset link was created.";
  const user = await db.select().from(users).where(eq(users.email, email)).get();
  if (!user) {
    return { success: generic };
  }

  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id));

  const token = createId("rst");
  await db.insert(passwordResetTokens).values({
    id: createId("prt"),
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    createdAt: new Date(),
  });

  const link = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
  if (process.env.NODE_ENV !== "production") {
    console.log("[password-reset]", link);
  }

  if (process.env.RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "Splitwise <onboarding@resend.dev>",
          to: email,
          subject: "Reset your password",
          text: `Reset your password: ${link}`,
        }),
      });
    } catch (err) {
      console.error("[password-reset] email failed", err);
    }
  }

  return { success: generic };
}

export async function resetPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await migrate();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordError = validatePassword(password);
  if (!token || passwordError) {
    return { error: passwordError ?? "Valid token and password required." };
  }

  const row = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .get();
  if (!row || row.expiresAt.getTime() < Date.now()) {
    return { error: "Invalid or expired token." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, row.userId));
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, row.userId));

  return { success: "Password updated. You can log in now." };
}

export { safeNextPath };
