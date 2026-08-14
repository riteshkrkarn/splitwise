import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { expenses, receipts } from "@/db/schema";
import { assertGroupMember } from "@/lib/group-data";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { id, expenseId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertGroupMember(id, session.user.id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const expense = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .get();
  if (!expense || expense.groupId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const receipt = await db
    .select()
    .from(receipts)
    .where(eq(receipts.expenseId, expenseId))
    .get();
  if (!receipt || !receipt.filePath || receipt.filePath === "none") {
    return NextResponse.json({ error: "No receipt" }, { status: 404 });
  }

  // Legacy public paths are no longer served
  if (receipt.filePath.startsWith("/")) {
    return NextResponse.json({ error: "Receipt unavailable" }, { status: 404 });
  }

  const filePath = path.join(
    process.cwd(),
    "data",
    "uploads",
    "receipts",
    path.basename(receipt.filePath)
  );
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const ext = path.extname(filePath).slice(1).toLowerCase();
  const bytes = fs.readFileSync(filePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="receipt-${expenseId}.${ext || "bin"}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
