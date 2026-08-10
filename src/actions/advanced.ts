"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import type { ActionResult } from "@/actions/auth";
import { db } from "@/db";
import { migrate } from "@/db/ensure-migrated";
import { expenses, receiptItems, receipts } from "@/db/schema";
import { assertGroupMember, getGroupExpenseBundle, getGroupMembers } from "@/lib/group-data";
import { createId } from "@/lib/id";
import fs from "fs";
import path from "path";

migrate();

export async function attachReceiptAction(
  expenseId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const expense = db.select().from(expenses).where(eq(expenses.id, expenseId)).get();
  if (!expense?.groupId) return { error: "Expense not found" };
  assertGroupMember(expense.groupId, session.user.id);

  const file = formData.get("receipt") as File | null;
  const merchant = String(formData.get("merchant") ?? "") || null;
  const itemsJson = String(formData.get("itemsJson") ?? "[]");

  let filePath = "";
  if (file && file.size > 0) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "uploads", "receipts");
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${expenseId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    fs.writeFileSync(path.join(dir, filename), bytes);
    filePath = `/uploads/receipts/${filename}`;
  } else {
    filePath = "/uploads/receipts/placeholder.txt";
  }

  const rawText = `${file?.name ?? ""} ${merchant ?? ""}`;
  const match = rawText.match(/(\d+(\.\d{1,2})?)/);
  const scannedTotal = match ? Number(match[1]) : expense.amount;

  const receiptId = createId("rcp");
  const existing = db
    .select()
    .from(receipts)
    .where(eq(receipts.expenseId, expenseId))
    .get();
  if (existing) {
    db.delete(receiptItems).where(eq(receiptItems.receiptId, existing.id)).run();
    db.delete(receipts).where(eq(receipts.id, existing.id)).run();
  }

  db.insert(receipts)
    .values({
      id: receiptId,
      expenseId,
      filePath,
      merchant,
      total: scannedTotal,
      scannedAt: new Date(),
      rawText,
    })
    .run();

  try {
    const items = JSON.parse(itemsJson) as Array<{
      name: string;
      price: number;
      quantity?: number;
      assignedToUserId?: string;
    }>;
    for (const item of items) {
      if (!item.name || !(item.price > 0)) continue;
      db.insert(receiptItems)
        .values({
          id: createId("rit"),
          receiptId,
          name: item.name,
          price: item.price,
          quantity: item.quantity ?? 1,
          assignedToUserId: item.assignedToUserId || null,
        })
        .run();
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
  assertGroupMember(groupId, session.user.id);
  const members = getGroupMembers(groupId);
  const bundle = getGroupExpenseBundle(groupId);
  return { members, ...bundle };
}
