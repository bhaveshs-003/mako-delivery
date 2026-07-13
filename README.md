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

## Integrations (email & files)

Both work in dev with **zero configuration** (console + local-disk fallbacks)
and switch to production providers by setting env vars:

- **Email** — set `RESEND_API_KEY` + `EMAIL_FROM`. Until then, emails are logged
  to the server console. All notifications route through `src/lib/notifications.ts`.
- **Files** — set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (Supabase Storage
  via the SDK; no S3 keys). Until then, uploads go to `./.uploads` and stream via
  `/api/files/[key]`. In production, downloads use short-lived signed URLs.

## Build status — all phases implemented

- **Foundation** — schema (22 tables), INSERT-ONLY audit trigger, SHA-256 hash
  chain + verifier (CLI/API/UI), NextAuth + role JWT, server-side RBAC (route +
  action matrices + query scoping), app shell, role dashboards.
- **Entities** — Projects CRUD (template snapshot + auto-milestones, archive,
  start/pause/resume/complete), list filters, Users CRUD (deactivation preserves
  history), SLA config editor.
- **Lifecycle & Dependencies** — milestones/subtasks (blocked-reason flow,
  submit guard), the dependency engine (business-day burn, SLA flagging,
  mandatory root-cause on breach), lifecycle + dependencies tabs.
- **Approvals & Tickets** — approval SLA (no restart on reject, self-approval
  blocked, mandatory comment), multi-project tickets with RL response/escalate/
  close rules.
- **CR / Comments / Documents / MoM** — change requests with timeline
  auto-adjust; threaded comments with edit-history (never deleted); S3-backed
  documents; meetings with 24h MoM deadline + late-reason attribution.
- **Reports** — delay-attribution report (stacked bar + CSV export, export
  gated to Admins), per-project post-mortem (print/Save-as-PDF evidence export).
- **Notifications & admin** — in-app notification feed + unread bell, global
  search, and the Hard-Delete Console (tombstone written before deletion in the
  same transaction).

Every state-changing action appends to the tamper-evident audit log; the chain
is verified after each phase.

**Remaining polish (not blocking):** Tiptap rich-text for comments/MoM,
lifecycle-template editor UI, resource-utilization heatmap, trend charts,
per-role dashboard variants, and a full mobile responsive pass.
