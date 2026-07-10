# Hosting Guide — Supabase + Resend + Vercel

This app is provider-agnostic; going live is **configuration only** (no code
changes). You'll set up three free accounts, copy some keys into environment
variables, run the migrations against the hosted DB, and deploy.

---

## 1. Supabase — Postgres database

1. Create an account at <https://supabase.com> → **New project**. Pick a region
   close to your users and set a strong database password (save it).
2. Wait for provisioning, then go to **Project Settings → Database → Connection
   string → "Connection pooling"**. Copy two URLs:
   - **Transaction pooler** (port `6543`) → this is your `DATABASE_URL`
     (append `?pgbouncer=true`).
   - **Session / direct** (port `5432`) → this is your `DIRECT_URL`.
   Put the DB password into both where it shows `[YOUR-PASSWORD]`.

## 2. Supabase — file storage (S3-compatible)

1. **Storage → New bucket** → name it `mako-governance` (keep it **private**).
2. **Project Settings → Storage → S3 Connection**: copy the **Endpoint** and
   **Region** → `S3_ENDPOINT`, `S3_REGION`.
3. Click **New access key** → copy the access key + secret →
   `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

> The app already talks S3 (`src/lib/storage.ts`), so no code changes — it just
> points at Supabase instead of the local `.uploads` fallback.

## 3. Resend — email

1. Create an account at <https://resend.com>.
2. **API Keys → Create** → copy it → `RESEND_API_KEY`.
3. Verify a sending domain (or use Resend's onboarding sandbox sender) and set
   `EMAIL_FROM` to a verified address.

## 4. Run migrations against Supabase

With the Supabase `DATABASE_URL` + `DIRECT_URL` in your `.env`:

```bash
npx prisma migrate deploy   # creates all tables + the INSERT-ONLY audit trigger
npx prisma db seed          # OPTIONAL: demo data. Skip for a clean production DB.
```

## 5. Deploy on Vercel

1. Push this repo to GitHub (see below), then import it at
   <https://vercel.com/new>. Framework preset: **Next.js** (auto-detected).
2. Add every variable from `.env.example` under **Settings → Environment
   Variables** with your real values. Set `NEXTAUTH_URL` to your Vercel URL and
   generate a fresh `NEXTAUTH_SECRET` (`openssl rand -hex 32`).
3. Deploy. Vercel runs `next build`; the app connects to Supabase + Resend.

> **Migrations on deploy:** run `prisma migrate deploy` yourself against the
> hosted DB (step 4) whenever the schema changes — don't run it inside the
> Vercel build. `prisma generate` runs automatically via the build.

---

## Environment variable checklist

| Variable | From |
|---|---|
| `DATABASE_URL` | Supabase pooled connection (6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Supabase direct connection (5432) |
| `NEXTAUTH_URL` | Your deployed URL |
| `NEXTAUTH_SECRET` | `openssl rand -hex 32` |
| `AUDIT_GENESIS_SEED` | Keep as-is; **never change after data exists** |
| `RESEND_API_KEY` | Resend → API Keys |
| `EMAIL_FROM` | A Resend-verified sender |
| `S3_ENDPOINT` / `S3_REGION` | Supabase → Storage → S3 Connection |
| `S3_BUCKET` | The bucket you created (`mako-governance`) |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Supabase → Storage → S3 access key |

Nothing else changes: RBAC, the audit hash chain, business-day math, and every
feature behave identically on hosted infra.
