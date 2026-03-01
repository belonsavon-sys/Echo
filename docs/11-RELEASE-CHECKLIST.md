# Release Checklist

## Pre-Release
- [ ] Scope matches approved change request
- [ ] All acceptance criteria verified
- [ ] Manual smoke tests passed
- [ ] No critical console/server errors
- [ ] Migration or SQL scripts documented
- [ ] Financial precision/integrity migration applied when relevant (`script/migrate-money-precision-and-integrity.sql`)
- [ ] Dependency list + build allowlist reviewed for drift (remove unused runtime deps)
- [ ] User-scoped storage paths fail closed when authenticated `userId` is missing (no global fallback paths)
- [ ] Regression tests include auth guard + storage scope coverage
- [ ] No stale platform-specific tooling/config remains (for current stack, no Replit-only plugins/files)
- [ ] Root `README.md` runbook is current (setup/env/check/deploy instructions match shipped behavior)
- [ ] `npm run env:check` passes for target environment profile
- [ ] Dev-only tooling remains dev-only (`/api/dev/*` unavailable in production)

## Deployment
- [ ] Build succeeds
- [ ] Start succeeds
- [ ] Environment variables verified
- [ ] Database schema up to date
- [ ] CI check passed on both push and pull request
- [ ] Production boot guard verified: `LOCAL_DEV_AUTH=true` is blocked when `NODE_ENV=production`

## Post-Release
- [ ] Login flow verified
- [ ] Budget create/edit/entry flow verified
- [ ] Report/overview totals sanity check
- [ ] Rollback plan identified
- [ ] Server API logs verified to avoid sensitive payload value logging
