import { relations, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  avatarId: integer("avatar_id").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  coverAvatarId: integer("cover_avatar_id").notNull().default(1),
  currency: text("currency").notNull().default("INR"),
  simplifyDebts: integer("simplify_debts", { mode: "boolean" })
    .notNull()
    .default(false),
  defaultSplitMode: text("default_split_mode").notNull().default("EQUAL"),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const groupMembers = sqliteTable(
  "group_members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("MEMBER"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("group_members_unique").on(t.groupId, t.userId),
    index("group_members_user_idx").on(t.userId),
  ]
);

export const groupInvites = sqliteTable(
  "group_invites",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("PENDING"),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("group_invites_email_idx").on(t.email)]
);

export const defaultSplits = sqliteTable(
  "default_splits",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    value: real("value").notNull(),
  },
  (t) => [uniqueIndex("default_splits_unique").on(t.groupId, t.userId)]
);

export const friendships = sqliteTable(
  "friendships",
  {
    id: text("id").primaryKey(),
    userAId: text("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: text("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("ACCEPTED"),
    requestedBy: text("requested_by"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("friendships_unique").on(t.userAId, t.userBId),
    index("friendships_user_a_idx").on(t.userAId),
    index("friendships_user_b_status_idx").on(t.userBId, t.status),
  ]
);

export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    friendshipId: text("friendship_id").references(() => friendships.id, {
      onDelete: "cascade",
    }),
    description: text("description").notNull(),
    amount: real("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    category: text("category").notNull().default("General"),
    notes: text("notes"),
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    splitMode: text("split_mode").notNull().default("EQUAL"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    isIou: integer("is_iou", { mode: "boolean" }).notNull().default(false),
    recurringId: text("recurring_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("expenses_group_idx").on(t.groupId),
    index("expenses_friendship_idx").on(t.friendshipId),
    index("expenses_group_active_date_idx").on(t.groupId, t.deletedAt, t.date),
  ]
);

export const expenseSplits = sqliteTable(
  "expense_splits",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    shares: real("shares"),
    percent: real("percent"),
  },
  (t) => [
    uniqueIndex("expense_splits_unique").on(t.expenseId, t.userId),
    index("expense_splits_expense_idx").on(t.expenseId),
  ]
);

export const expensePayers = sqliteTable(
  "expense_payers",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
  },
  (t) => [
    uniqueIndex("expense_payers_unique").on(t.expenseId, t.userId),
    index("expense_payers_expense_idx").on(t.expenseId),
    index("expense_payers_user_idx").on(t.userId),
  ]
);

export const expenseComments = sqliteTable(
  "expense_comments",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("expense_comments_expense_idx").on(t.expenseId)]
);

export const expenseHistory = sqliteTable(
  "expense_history",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    snapshot: text("snapshot").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("expense_history_expense_idx").on(t.expenseId)]
);

export const settlements = sqliteTable(
  "settlements",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => users.id),
    amount: real("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    note: text("note"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("settlements_group_idx").on(t.groupId, t.deletedAt)]
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: text("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId),
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
  ]
);

export const activityEvents = sqliteTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    message: text("message").notNull(),
    meta: text("meta"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("activity_group_idx").on(t.groupId),
    index("activity_user_created_idx").on(t.userId, t.createdAt),
  ]
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull().default(0),
    windowStart: integer("window_start", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("rate_limits_key_unique").on(t.key)]
);

export const ious = sqliteTable("ious", {
  id: text("id").primaryKey(),
  groupId: text("group_id").references(() => groups.id, {
    onDelete: "cascade",
  }),
  fromUserId: text("from_user_id")
    .notNull()
    .references(() => users.id),
  toUserId: text("to_user_id")
    .notNull()
    .references(() => users.id),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  note: text("note"),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const recurringExpenses = sqliteTable("recurring_expenses", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  category: text("category").notNull().default("General"),
  frequency: text("frequency").notNull(),
  splitMode: text("split_mode").notNull().default("EQUAL"),
  payerId: text("payer_id").notNull(),
  splitJson: text("split_json").notNull(),
  nextRunAt: integer("next_run_at", { mode: "timestamp_ms" }).notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const receipts = sqliteTable("receipts", {
  id: text("id").primaryKey(),
  expenseId: text("expense_id")
    .notNull()
    .unique()
    .references(() => expenses.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  merchant: text("merchant"),
  total: real("total"),
  scannedAt: integer("scanned_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  rawText: text("raw_text"),
});

export const receiptItems = sqliteTable("receipt_items", {
  id: text("id").primaryKey(),
  receiptId: text("receipt_id")
    .notNull()
    .references(() => receipts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: real("price").notNull(),
  quantity: integer("quantity").notNull().default(1),
  assignedToUserId: text("assigned_to_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

export const exchangeRates = sqliteTable(
  "exchange_rates",
  {
    id: text("id").primaryKey(),
    base: text("base").notNull(),
    rates: text("rates").notNull(),
    date: text("date").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("exchange_rates_unique").on(t.base, t.date)]
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(groupMembers),
  notifications: many(notifications),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  expenses: many(expenses),
  settlements: many(settlements),
  invites: many(groupInvites),
  defaultSplits: many(defaultSplits),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  group: one(groups, {
    fields: [expenses.groupId],
    references: [groups.id],
  }),
  friendship: one(friendships, {
    fields: [expenses.friendshipId],
    references: [friendships.id],
  }),
  createdBy: one(users, {
    fields: [expenses.createdById],
    references: [users.id],
  }),
  splits: many(expenseSplits),
  payers: many(expensePayers),
  comments: many(expenseComments),
  history: many(expenseHistory),
  receipt: one(receipts),
}));

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.id],
  }),
  user: one(users, {
    fields: [expenseSplits.userId],
    references: [users.id],
  }),
}));

export const expensePayersRelations = relations(expensePayers, ({ one }) => ({
  expense: one(expenses, {
    fields: [expensePayers.expenseId],
    references: [expenses.id],
  }),
  user: one(users, {
    fields: [expensePayers.userId],
    references: [users.id],
  }),
}));
