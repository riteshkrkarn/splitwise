import { client } from "./index";

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_id INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cover_avatar_id INTEGER NOT NULL DEFAULT 1,
    currency TEXT NOT NULL DEFAULT 'INR',
    simplify_debts INTEGER NOT NULL DEFAULT 0,
    default_split_mode TEXT NOT NULL DEFAULT 'EQUAL',
    deleted_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'MEMBER',
    joined_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS group_members_unique ON group_members(group_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS group_members_user_idx ON group_members(user_id)`,
  `CREATE TABLE IF NOT EXISTS group_invites (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS group_invites_email_idx ON group_invites(email)`,
  `CREATE TABLE IF NOT EXISTS default_splits (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    value REAL NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS default_splits_unique ON default_splits(group_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY,
    user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'ACCEPTED',
    requested_by TEXT,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS friendships_unique ON friendships(user_a_id, user_b_id)`,
  `CREATE INDEX IF NOT EXISTS friendships_user_a_idx ON friendships(user_a_id)`,
  `CREATE INDEX IF NOT EXISTS friendships_user_b_status_idx ON friendships(user_b_id, status)`,
  `CREATE TABLE IF NOT EXISTS recurring_expenses (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    category TEXT NOT NULL DEFAULT 'General',
    frequency TEXT NOT NULL,
    split_mode TEXT NOT NULL DEFAULT 'EQUAL',
    payer_id TEXT NOT NULL,
    split_json TEXT NOT NULL,
    next_run_at INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_by_id TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    friendship_id TEXT REFERENCES friendships(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    category TEXT NOT NULL DEFAULT 'General',
    notes TEXT,
    date INTEGER NOT NULL,
    split_mode TEXT NOT NULL DEFAULT 'EQUAL',
    created_by_id TEXT NOT NULL REFERENCES users(id),
    deleted_at INTEGER,
    is_iou INTEGER NOT NULL DEFAULT 0,
    recurring_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS expenses_group_idx ON expenses(group_id)`,
  `CREATE INDEX IF NOT EXISTS expenses_friendship_idx ON expenses(friendship_id)`,
  `CREATE INDEX IF NOT EXISTS expenses_group_active_date_idx ON expenses(group_id, deleted_at, date)`,
  `CREATE TABLE IF NOT EXISTS expense_splits (
    id TEXT PRIMARY KEY,
    expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    shares REAL,
    percent REAL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS expense_splits_unique ON expense_splits(expense_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS expense_splits_expense_idx ON expense_splits(expense_id)`,
  `CREATE TABLE IF NOT EXISTS expense_payers (
    id TEXT PRIMARY KEY,
    expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount REAL NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS expense_payers_unique ON expense_payers(expense_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS expense_payers_expense_idx ON expense_payers(expense_id)`,
  `CREATE INDEX IF NOT EXISTS expense_payers_user_idx ON expense_payers(user_id)`,
  `CREATE TABLE IF NOT EXISTS expense_comments (
    id TEXT PRIMARY KEY,
    expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS expense_comments_expense_idx ON expense_comments(expense_id)`,
  `CREATE TABLE IF NOT EXISTS expense_history (
    id TEXT PRIMARY KEY,
    expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS expense_history_expense_idx ON expense_history(expense_id)`,
  `CREATE TABLE IF NOT EXISTS settlements (
    id TEXT PRIMARY KEY,
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    from_user_id TEXT NOT NULL REFERENCES users(id),
    to_user_id TEXT NOT NULL REFERENCES users(id),
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    date INTEGER NOT NULL,
    note TEXT,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS settlements_group_idx ON settlements(group_id, deleted_at)`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    href TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id)`,
  `CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS activity_events (
    id TEXT PRIMARY KEY,
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    meta TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS activity_group_idx ON activity_events(group_id)`,
  `CREATE INDEX IF NOT EXISTS activity_user_created_idx ON activity_events(user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    count INTEGER NOT NULL DEFAULT 0,
    window_start INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_key_unique ON rate_limits(key)`,
  `CREATE TABLE IF NOT EXISTS ious (
    id TEXT PRIMARY KEY,
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    from_user_id TEXT NOT NULL REFERENCES users(id),
    to_user_id TEXT NOT NULL REFERENCES users(id),
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    note TEXT,
    date INTEGER NOT NULL,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    expense_id TEXT NOT NULL UNIQUE REFERENCES expenses(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    merchant TEXT,
    total REAL,
    scanned_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    raw_text TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS receipt_items (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    assigned_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS exchange_rates (
    id TEXT PRIMARY KEY,
    base TEXT NOT NULL,
    rates TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS exchange_rates_unique ON exchange_rates(base, date)`,
];

export async function migrate() {
  try {
    await client.execute("PRAGMA foreign_keys = ON;");
  } catch {
    // hosted Turso may ignore this pragma
  }
  for (const statement of statements) {
    await client.execute(statement);
  }
  for (const alter of [
    `ALTER TABLE friendships ADD COLUMN status TEXT NOT NULL DEFAULT 'ACCEPTED'`,
    `ALTER TABLE friendships ADD COLUMN requested_by TEXT`,
    `ALTER TABLE group_members ADD COLUMN role TEXT NOT NULL DEFAULT 'MEMBER'`,
  ]) {
    try {
      await client.execute(alter);
    } catch {
      // column already exists
    }
  }

  // Promote earliest member per group to OWNER when role is missing/MEMBER-only
  try {
    await client.execute(`
      UPDATE group_members
      SET role = 'OWNER'
      WHERE id IN (
        SELECT gm.id FROM group_members gm
        INNER JOIN (
          SELECT group_id, MIN(joined_at) AS min_joined
          FROM group_members
          GROUP BY group_id
        ) first ON first.group_id = gm.group_id AND first.min_joined = gm.joined_at
        WHERE NOT EXISTS (
          SELECT 1 FROM group_members o
          WHERE o.group_id = gm.group_id AND o.role = 'OWNER'
        )
      )
    `);
  } catch {
    // best-effort backfill
  }
}
