"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import { migrate } from "@/db/ensure-migrated";
import { passwordResetTokens, users } from "@/db/schema";
import { createId } from "@/lib/id";

export type ActionResult = { error?: string; success?: string };

function safeNextPath(raw: FormDataEntryValue | null) {
  const next = String(raw ?? "/dashboard");
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

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
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const avatarId = Number(formData.get("avatarId") ?? 1);

  if (!name || !email || password.length < 6) {
    return { error: "Name, email, and password (6+ chars) are required." };
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).get();
  if (existing) return { error: "Email already registered." };

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users)
    .values({
      id: createId("usr"),
      email,
      name,
      passwordHash,
      avatarId: Math.min(5, Math.max(1, avatarId || 1)),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    ;

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
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = await db.select().from(users).where(eq(users.email, email)).get();
  if (!user) {
    return { success: "If that email exists, a reset link was created." };
  }

  const token = createId("rst");
  await db.insert(passwordResetTokens)
    .values({
      id: createId("prt"),
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      createdAt: new Date(),
    })
    ;

  const link = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
  console.log("[password-reset]", link);
  return {
    success: `Reset link generated (also logged to server console): ${link}`,
  };
}

export async function resetPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await migrate();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!token || password.length < 6) {
    return { error: "Valid token and password (6+ chars) required." };
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
  await db.update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, row.userId))
    ;
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
  redirect("/login");
}
