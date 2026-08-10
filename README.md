# Splitwise Clone

Expense-splitting web app (Next.js + local SQLite via Drizzle / better-sqlite3).

## Setup

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo accounts

- `rahul@demo.com` / `password123`
- `priya@demo.com` / `password123`

## Stack

- Next.js App Router + TypeScript + Tailwind
- Auth.js (credentials)
- **Local SQLite** at `data/splitwise.db` (Drizzle ORM + better-sqlite3)
- No Docker / Prisma / remote DB required

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm run db:migrate` | Create/update SQLite schema |
| `npm run db:seed` | Seed demo users + group |
| `npm test` | Run balance/split unit tests |
| `npm run build` | Production build |

## Features

- Auth, profiles with 5 preset avatars
- Groups (max 5 members), invites, settings, debt simplification
- Expenses: equal / exact / % / shares, multi-payer, categories, comments, history
- Settle up: “A transferred ₹X to B”
- Friends, search, soft delete/restore, notifications
- Multi-currency, activity feed, charts, CSV/JSON export, receipts/itemization, payment reminders
- Group/friend invites by email → in-app Accept / Reject, with notifications back to the sender
