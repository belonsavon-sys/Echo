# QA and Test Strategy

## Testing Levels
- Unit-level logic validation where practical
- API route validation for major workflows
- Manual end-to-end smoke checks every release
- Security and tenancy guardrail checks (auth env safety + user-scoped data access)

## Mandatory Manual Test Areas
- Sign up, sign in, sign out
- Auth callback redirect (`/auth/callback`) for email-link flows
- Budget create/edit/delete
- Category create/edit/delete
- Entry create/edit/delete
- Recurring entry flow
- Carryover opening/closing balances across month budgets in year folders (with month-level starting-balance adjustments)
- Date-first default transaction ordering and switch-to-manual after drag reorder
- Manual drag reorder persistence on mobile and desktop
- Reports and annual overview consistency, including Reports month/year mode
- Cross-account isolation (user A cannot access user B data)

## Regression Gate
- No release until all mandatory checks pass
- No next feature starts until current feature passes QA
- `npm run env:check` must pass for intended deploy profile
- `npm run check` must pass (regression tests + app typecheck + test typecheck)
- CI must pass on both push and pull request

## Bug Severity
- P0: data loss, auth/security, app unavailable
- P1: core budgeting flow broken
- P2: non-blocking defects
