# Deploy Checklist (Render + Supabase)

## 1. Render Service Settings
- [ ] Build command: `npm run build`
- [ ] Start command: `npm run start`
- [ ] Root directory points to this repo root
- [ ] Auto-deploy target branch is correct (usually `main`)

## 2. Required Environment Variables
- [ ] `DATABASE_URL` points to the production Postgres instance
- [ ] `SUPABASE_URL` is the HTTPS URL for your Supabase project
- [ ] `SUPABASE_JWT_AUD` is set (default: `authenticated`)
- [ ] `VITE_SUPABASE_URL` matches `SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY` is the public anon key from Supabase
- [ ] `NODE_ENV=production`
- [ ] Supabase Auth redirect URLs include `https://<your-domain>/auth/callback`

## 3. Environment Variables That Must Stay Disabled In Production
- [ ] `LOCAL_DEV_AUTH` is unset or `false`
- [ ] `LOCAL_DEV_USER_ID`, `LOCAL_DEV_EMAIL`, `LOCAL_DEV_FIRST_NAME`, `LOCAL_DEV_LAST_NAME` are unset (or non-production-safe defaults)
- [ ] Confirm startup safety: app should refuse boot if `NODE_ENV=production` and `LOCAL_DEV_AUTH=true`

## 4. Pre-Deploy Validation
- [ ] `npm run env:check` passes with production env values
- [ ] `npm run check` passes locally (regression tests + type check)
- [ ] `npm run build` passes locally
- [ ] SQL/data migration scripts for this release are reviewed
- [ ] Apply `script/migrate-entry-order-mode.sql` before app deploy
- [ ] Supabase JWT settings (issuer/audience) match server expectations
- [ ] Dev-only endpoints are absent in production (for example `/api/dev/routes` returns `404`)

## 5. Deploy
- [ ] Trigger deploy in Render (or merge to auto-deploy branch)
- [ ] Confirm deploy log reaches `serving on 0.0.0.0:<PORT>`
- [ ] Confirm `/api/auth/user` returns `401` without auth token and `200` after login

## 6. Post-Deploy Smoke Test
- [ ] Sign in and sign out
- [ ] Sign up and email-magic-link flow returns through `/auth/callback` and lands on dashboard
- [ ] Create/edit budget and entry
- [ ] Validate year-folder routing and recurring entry behavior
- [ ] Validate carryover opening/closing balances across year-folder month chain (including month opening-balance adjustments)
- [ ] Validate date-first default entry order, then drag reorder switches to manual order and persists
- [ ] Validate dashboard/reports/annual totals
- [ ] Validate reports month/year mode for historical, current, and future periods
- [ ] Validate dashboard and compare pages scroll without white footer reveal/header loss
- [ ] Verify tenant isolation by logging in as a second user and confirming no cross-user data visibility
