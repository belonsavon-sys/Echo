# Echo

Echo is a full-stack budgeting application (React + Express + PostgreSQL) with Supabase Auth, multi-budget planning, recurring entries, reports, and annual summaries.

## Core Stack
- Frontend: React, Vite, TypeScript, TanStack Query, shadcn/ui
- Backend: Express 5, TypeScript
- Data: PostgreSQL + Drizzle ORM
- Auth: Supabase JWT verification on server
- CI: GitHub Actions (`npm run check` on `push` and `pull_request`)

For full architecture details, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL 16+ (or compatible hosted Postgres)

## Environment Setup
1. Copy env template:
```bash
cp .env.example .env
```
2. Set required values in `.env`:
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_JWT_AUD` (usually `authenticated`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Supabase dashboard Auth Redirect URL must include `http://localhost:5000/auth/callback` for local magic-link/email-confirm flows

3. Local-only auth bypass (optional for offline dev):
- `LOCAL_DEV_AUTH=true` can be used only in development.
- Production guard: app startup fails if `NODE_ENV=production` and `LOCAL_DEV_AUTH=true`.

4. Validate env before running:
```bash
npm run env:check
```

## Install and Run
```bash
npm ci
npm run db:push
npm run dev
```

App runs on `http://localhost:5000` by default.

## One-Command Local Stack (App + Postgres)
If you want a local Postgres container plus the app process in one command:
```bash
npm run dev:stack
```

Useful helpers:
```bash
npm run dev:db:up
npm run dev:db:down
```

Compose file: [`docker-compose.dev.yml`](./docker-compose.dev.yml).  
Default DB credentials in container are `postgres/postgres` on DB `postgres`.

## Developer Diagnostics (Dev Only)
In development builds only, the app includes:
- Dev status banner (version, commit, auth mode, API origin, build timestamp)
- API request timing/status panel
- React Query Devtools
- Route explorer page: `/dev/routes` (auth-protected, dev-only endpoint)

Server endpoint used by explorer:
- `GET /api/dev/routes` (registered only when `NODE_ENV !== production`)

## Database and SQL Scripts
Schema is managed by Drizzle (`shared/schema.ts` + `npm run db:push`).

Important SQL scripts live in `script/`, including:
- `migrate-money-precision-and-integrity.sql`
- `migrate-opening-balance-and-recurrence-cap.sql`
- `drop-dashboard-customization.sql`
- `seed-default-categories.sql`
- `delete-seed-demo-data.sql`
- `reset-app-data.sql`

Apply SQL scripts intentionally and in release notes when relevant.

## Quality Gates
Run before opening/merging changes:
```bash
npm run check
npm run build
```

`npm run check` includes:
- Regression tests (`tests/**/*.test.ts`)
- App typecheck
- Test typecheck

## Release and Deploy
- CI must pass on both `push` and `pull_request`.
- Follow release checklist: [docs/11-RELEASE-CHECKLIST.md](./docs/11-RELEASE-CHECKLIST.md)
- Follow Render+Supabase deploy checklist: [docs/12-DEPLOY-CHECKLIST-RENDER-SUPABASE.md](./docs/12-DEPLOY-CHECKLIST-RENDER-SUPABASE.md)

## Product/Operations Docs
Start here: [docs/README.md](./docs/README.md)
