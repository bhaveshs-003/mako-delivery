# Mako Governance Platform

Internal project-governance platform for the **Mako–Rocketlane** engagement. It
tracks Migration, Integration, and Custom-App projects Mako delivers inside
Rocketlane client engagements and makes every delay **visible, attributed,
timestamped, and defensible** — because this data may be used as evidence in a
partner dispute.

> This repository is **Phase 1 — the Foundation scaffold**. See
> [Build status](#build-status) for what's implemented vs. planned.

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma · PostgreSQL 15 ·
NextAuth (credentials) · TanStack Query/Table · Recharts · date-fns.

## Prerequisites

- Node 20+
- PostgreSQL 15 (this repo was set up with Homebrew: `brew install postgresql@15`)
  - `postgresql@15` is keg-only; add it to PATH when running Prisma/psql:
    `export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"`

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env        # then edit DATABASE_URL / NEXTAUTH_SECRET

# 3. Create the database (once)
createdb mako_governance

# 4. Apply migrations (includes the INSERT-ONLY audit-log trigger)
npx prisma migrate deploy

# 5. Seed demo data (15 users, 6 projects, hash-chained audit log)
npx prisma db seed

# 6. Run
npm run dev                 # http://localhost:3000
```

### Demo accounts

All demo users share the password **`password123`**:

| Role        | Email                 |
| ----------- | --------------------- |
| Super Admin | `super@mako.dev`      |
| Admin       | `admin@mako.dev`      |
| Sub-admin   | `priya@mako.dev`      |
| RL User     | `john@rocketlane.dev` |
| Resource    | `raj@mako.dev`        |

## The tamper-evident audit log

Every state-changing action appends one hash-chained row to `audit_log`:

```
row_hash = SHA256(sequence_number | actor_id | action | entity_type
                  | entity_id | timestamp | previous_hash)
```

- The table is **INSERT-ONLY at the database level** — a trigger rejects every
  `UPDATE`/`DELETE` (see `prisma/migrations/*_audit_log_insert_only`).
- Actor identity (`actor_id`, `actor_email`, `actor_role`) is **snapshotted**,
  not FK'd, so history survives user deactivation/deletion.
- Verify the whole chain any time:

  ```bash
  npm run audit:verify        # walks the chain, exits non-zero on any break
  ```

  or from the UI: **Org Settings → Audit Log → Verify Full Chain** (Super Admin).

## Architecture notes

- **RBAC is server-side.** `src/middleware.ts` guards pages at the edge;
  `requireRole()` guards API routes; `projectScopeWhere()` filters every list
  query so a user cannot read data outside their assignments even by crafting
  requests. (All three are verified end-to-end.)
- **Business days everywhere.** All burn/SLA math goes through
  `src/lib/business-days.ts` (weekends excluded, holiday-ready).
- **Attribution palette is sacred.** The four delay-owner colors live in
  `src/lib/constants.ts` and are used identically in every badge and chart.

## Scripts

| Script                 | Purpose                      |
| ---------------------- | ---------------------------- |
| `npm run dev`          | Dev server                   |
| `npm run build`        | Production build             |
| `npm run db:migrate`   | Create/apply a dev migration |
| `npm run db:seed`      | Seed demo data               |
| `npm run db:reset`     | Drop, re-migrate, re-seed    |
| `npm run audit:verify` | Verify the audit hash chain  |

## Build status

**Implemented (Phase 1):**

- Full Prisma schema — all 22 tables, enums, relations, snake_case audit log
- INSERT-ONLY audit-log trigger + SHA-256 hash chain + verifier (CLI + API + UI)
- NextAuth credentials auth, role in JWT, immediate-deactivation enforcement
- Server-side RBAC: route matrix, action matrix, query scoping
- App shell (role-aware sidebar, header, breadcrumbs)
- Role-aware dashboard with real metrics + delay-attribution donut
- Scoped Projects list + project-detail header (three timelines)
- Live Audit Log viewer (per-row + full-chain verification)
- Seed data: 15 users, 6 projects, dependencies (some SLA-breached), approvals,
  a multi-project ticket, a change request, pauses, MoMs

**Planned (Phases 2–7):** milestones/subtasks UI, dependency logging UI,
approval/ticket/CR/MoM/comment engines, full reports + PDF/CSV export,
notifications + email, hard-delete console. See the build plan in the project
spec (§11).
