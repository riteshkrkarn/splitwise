"use server";

import { and, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { auth } from "@/auth";
import type { ActionResult } from "@/actions/auth";
import { db } from "@/db";
import { expenses, notifications, receiptItems, receipts } from "@/db/schema";
import {
  assertGroupMember,
  getGroupBalances,
  getGroupExpenseBundle,
  getGroupMembers,
} from "@/lib/group-data";
import { createId } from "@/lib/id";
import { formatMoney } from "@/lib/utils";

const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

function detectMime(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

export async function attachReceiptAction(
  expenseId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const expense = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .get();
  if (!expense?.groupId) return { error: "Expense not found" };
  await assertGroupMember(expense.groupId, session.user.id);

  const file = formData.get("receipt") as File | null;
  const merchant = String(formData.get("merchant") ?? "") || null;
  const itemsJson = String(formData.get("itemsJson") ?? "[]");

  let filePath = "";
  if (file && file.size > 0) {
    if (file.size > MAX_RECEIPT_BYTES) {
      return { error: "Receipt must be 2MB or smaller." };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = detectMime(bytes);
    if (!mime || !ALLOWED_MIME.has(mime)) {
      return { error: "Only JPEG, PNG, WebP, or PDF receipts are allowed." };
    }
    const ext = ALLOWED_MIME.get(mime)!;
    const dir = path.join(process.cwd(), "data", "uploads", "receipts");
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${expenseId}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(dir, filename), bytes);
    filePath = filename;
  }

  const rawText = `${file?.name ?? ""} ${merchant ?? ""}`;
  const match = rawText.match(/(\d+(\.\d{1,2})?)/);
  const scannedTotal = match ? Number(match[1]) : expense.amount;

  const receiptId = createId("rcp");
  const existing = await db
    .select()
    .from(receipts)
    .where(eq(receipts.expenseId, expenseId))
    .get();
  if (existing) {
    await db.delete(receiptItems).where(eq(receiptItems.receiptId, existing.id));
    await db.delete(receipts).where(eq(receipts.id, existing.id));
    if (existing.filePath && !existing.filePath.startsWith("/")) {
      try {
        fs.unlinkSync(
          path.join(process.cwd(), "data", "uploads", "receipts", existing.filePath)
        );
      } catch {
        /* ignore */
      }
    }
  }

  await db.insert(receipts).values({
    id: receiptId,
    expenseId,
    filePath: filePath || "none",
    merchant,
    total: scannedTotal,
    scannedAt: new Date(),
    rawText,
  });

  try {
    const items = JSON.parse(itemsJson) as Array<{
      name: string;
      price: number;
      quantity?: number;
      assignedToUserId?: string;
    }>;
    for (const item of items) {
      if (!item.name || !(item.price > 0)) continue;
      await db.insert(receiptItems).values({
        id: createId("rit"),
        receiptId,
        name: item.name,
        price: item.price,
        quantity: item.quantity ?? 1,
        assignedToUserId: item.assignedToUserId || null,
      });
    }
  } catch {
    /* ignore bad json */
  }

  revalidatePath(`/groups/${expense.groupId}/expenses/${expenseId}`);
  return { success: "Receipt saved." };
}

export async function getGroupExportData(groupId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const me = await assertGroupMember(groupId, session.user.id);
  const members = await getGroupMembers(groupId);
  const bundle = await getGroupExpenseBundle(groupId);
  const safeMembers =
    me.role === "OWNER"
      ? members
      : members.map(({ email: _email, ...rest }) => ({ ...rest, email: null }));
  return { members: safeMembers, ...bundle, isOwner: me.role === "OWNER" };
}

export async function sendPaymentRemindersAction(groupId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  await assertGroupMember(groupId, session.user.id);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.groupId, groupId),
        eq(notifications.type, "REMINDER"),
        gte(notifications.createdAt, since)
      )
    )
    .get();
  if (recent) {
    return { error: "Reminders were already sent in the last 24 hours." };
  }

  const members = await getGroupMembers(groupId);
  const nameById = Object.fromEntries(members.map((m) => [m.userId, m.name]));
  const balances = await getGroupBalances(groupId);
  const { createNotification } = await import("@/lib/group-data");

  for (const summary of balances) {
    const debts = summary.pairwiseDebts ?? summary.debts;
    for (const debt of debts) {
      await createNotification({
        userId: debt.fromUserId,
        groupId,
        type: "REMINDER",
        title: "Payment reminder",
        body: `You owe ${nameById[debt.toUserId] ?? "someone"} ${formatMoney(debt.amount, debt.currency)}`,
        href: `/groups/${groupId}`,
      });
    }
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: "Reminders sent." };
}
