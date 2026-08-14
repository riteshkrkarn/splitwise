import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { migrate } from "@/db/migrate-fn";
import {
  expensePayers,
  expenseSplits,
  expenses,
  groupMembers,
  groups,
  users,
} from "@/db/schema";
import { createId } from "@/lib/id";
import { computeSplits } from "@/lib/split-validator";

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in production.");
  }
  await migrate();
  const passwordHash = await bcrypt.hash("password123", 10);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, "rahul@demo.com"))
    .get();
  if (existing) {
    console.log("Seed already applied (rahul@demo.com exists)");
    return;
  }

  const rahulId = createId("usr");
  const priyaId = createId("usr");

  await db.insert(users)
    .values([
      {
        id: rahulId,
        email: "rahul@demo.com",
        name: "Rahul",
        passwordHash,
        avatarId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: priyaId,
        email: "priya@demo.com",
        name: "Priya",
        passwordHash,
        avatarId: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    ;

  const groupId = createId("grp");
  await db.insert(groups)
    .values({
      id: groupId,
      name: "Apartment",
      coverAvatarId: 3,
      currency: "INR",
      simplifyDebts: true,
      defaultSplitMode: "EQUAL",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    ;

  await db.insert(groupMembers)
    .values([
      {
        id: createId("gmem"),
        groupId,
        userId: rahulId,
        role: "OWNER",
        joinedAt: new Date(),
      },
      {
        id: createId("gmem"),
        groupId,
        userId: priyaId,
        role: "MEMBER",
        joinedAt: new Date(),
      },
    ])
    ;

  const amount = 1200;
  const splits = computeSplits(amount, "EQUAL", [
    { userId: rahulId },
    { userId: priyaId },
  ]);
  const expenseId = createId("exp");
  await db.insert(expenses)
    .values({
      id: expenseId,
      groupId,
      description: "Groceries",
      amount,
      currency: "INR",
      category: "Groceries",
      date: new Date(),
      splitMode: "EQUAL",
      createdById: rahulId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    ;

  for (const s of splits) {
    await db.insert(expenseSplits)
      .values({
        id: createId("spl"),
        expenseId,
        userId: s.userId,
        amount: s.amount,
      })
      ;
  }
  await db.insert(expensePayers)
    .values({
      id: createId("pay"),
      expenseId,
      userId: rahulId,
      amount,
    })
    ;

  console.log("Seeded demo users:");
  console.log("  rahul@demo.com / password123");
  console.log("  priya@demo.com / password123");
  console.log(`  group: Apartment (${groupId})`);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
