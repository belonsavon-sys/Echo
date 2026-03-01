# Echo Budget Tracker

## Overview
A mobile-first minimalist budget tracking application called Echo. Features hierarchical budget folders, dark mode with 10 color themes, income/expense management with smart status marking, recurring entries, envelope/category budgeting, custom tags, spending reports with comparisons and predictions, savings goals tracking, what-if scenario planning, annual overview, change history with undo, CSV export, quick-add favorites, net worth tracker, multi-currency support, budget comparison, and PWA support.

## Recent Changes
- 2026-02-28: Added non-Replit local dev tooling (status banner, API timing panel, React Query Devtools loader)
- 2026-02-28: Added auth-protected dev route explorer (`GET /api/dev/routes`, UI at `/dev/routes`) enabled only outside production
- 2026-02-28: Added local stack bootstrap (`docker-compose.dev.yml`, `npm run dev:stack`) and env validation script (`npm run env:check`)
- 2026-02-28: Replaced high-impact client mutation `any` payloads with typed DTO payload shapes
- 2026-02-28: Core API route registration split into domain modules (`budget-routes`, `entry-history-routes`, `budget-aggregate`, `extended-routes`)
- 2026-02-28: Added typed auth request helpers for safer user identity access in routes
- 2026-02-28: Renamed architecture doc from `replit.md` to `ARCHITECTURE.md` for provider-neutral documentation
- 2026-02-28: Removed Replit-only tooling (`@replit/*` Vite plugins and `.replit` config)
- 2026-02-28: Storage layer now fails closed when authenticated `userId` is missing (removed unscoped fallback queries)
- 2026-02-28: Production guard added to block `LOCAL_DEV_AUTH=true` when `NODE_ENV=production`
- 2026-02-28: Removed unused legacy auth/session dependencies from `package.json`
- 2026-02-28: Build allowlist in `script/build.ts` aligned to current runtime dependencies
- 2026-02-28: Started route modularization (`server/route-modules/budget-aggregate.ts`, `server/route-modules/extended-routes.ts`)
- 2026-02-28: CI guardrails tightened (checks on push + pull_request, includes test typechecking)
- 2026-02-28: Reduced auth DB write amplification by skipping unchanged user profile upserts
- 2026-02-28: API request logging now redacts response payload values (logs only payload shape/keys)
- 2026-02-28: Financial columns moved to exact `numeric(14,2)` (no `real` money fields)
- 2026-02-28: Added DB foreign keys + query indexes for integrity and performance
- 2026-02-24: Multi-user authentication via Supabase Auth (JWT) with data isolation
- 2026-02-24: Landing page for unauthenticated users, user profile & logout in sidebar
- 2026-02-24: userId columns on budgets, tags, favorites, netWorthAccounts, savingsGoals
- 2026-02-24: All API routes protected with isAuthenticated middleware + budget ownership verification
- 2026-02-24: Initial build with full feature set
- 2026-02-24: Added hierarchical budget folders with collapse/expand
- 2026-02-24: Dark mode toggle + 10 preset color themes (Default, Ocean, Sunset, Forest, Midnight, Rose, Amber, Lavender, Slate, Coral)
- 2026-02-24: Mobile-first responsive redesign across all pages
- 2026-02-24: Dashboard home page with total balance, starred expenses, goals, recent activity
- 2026-02-24: Quick-add favorites system
- 2026-02-24: Multi-currency support (15 currencies) with per-budget currency selection
- 2026-02-24: Net worth tracker with assets/liabilities
- 2026-02-24: Enhanced reports with comparison views, predictions, category breakdown
- 2026-02-24: Side-by-side budget comparison page
- 2026-02-24: Animated number counters and entry transitions
- 2026-02-24: Starred unpaid expense highlighting
- 2026-02-24: PWA support with service worker and offline capability
- 2026-02-24: Budget clone/template functionality
- 2026-02-24: Fixed button-in-button nesting and setState during render bugs

## Project Architecture

### Stack
- **Frontend**: React + Vite + TypeScript, shadcn/ui, TanStack Query, Recharts, wouter
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL via Drizzle ORM (FK constraints + indexed access paths)
- **Styling**: Tailwind CSS with dark mode support
- **PWA**: Service worker with offline caching

### Structure
- `shared/schema.ts` - Data model (budgets with folders/currency, entries, categories, tags, history, savings goals, favorites, net worth accounts)
- `shared/models/auth.ts` - Auth schema (users, sessions tables)
- `server/auth/` - Supabase Auth token verification + user bootstrap
- `server/routes.ts` - Route registry/composition point for modular route groups
- `server/dev-routes.ts` - Dev-only route explorer endpoint registration (`/api/dev/routes`)
- `server/route-modules/budget-routes.ts` - Budget, category, tag, year-folder, rollover routes
- `server/route-modules/budget-aggregate.ts` - Aggregated multi-budget reporting endpoint
- `server/route-modules/entry-history-routes.ts` - Entry CRUD + recurring generation + history/undo routes
- `server/route-modules/extended-routes.ts` - Savings/favorites/net-worth/preferences/deprecated route group
- `server/lib/budget-service.ts` - Shared budget domain/service helpers used by route modules
- `server/auth/request.ts` - Typed authenticated request helpers (`getAuthenticatedUserId`)
- `server/storage.ts` - Database storage interface with userId filtering and cascade delete
- `client/src/App.tsx` - Main app with AuthGate (landing page vs app), wouter routing
- `client/src/components/dev/` - Dev-only tooling components (status banner, request panel, query devtools loader)
- `client/src/pages/dev-routes.tsx` - Dev route explorer UI
- `client/src/pages/landing.tsx` - Landing page for unauthenticated users
- `client/src/hooks/use-auth.ts` - Auth state hook (useAuth)
- `client/src/pages/dashboard.tsx` - Home page with cross-budget summary
- `client/src/pages/budget.tsx` - Core budget page with entry management, animated counters
- `client/src/pages/reports.tsx` - Enhanced reports with comparisons, predictions, analytics
- `client/src/pages/annual-overview.tsx` - Annual month-by-month dashboard
- `client/src/pages/savings-goals.tsx` - Savings goals with progress bars
- `client/src/pages/what-if.tsx` - What-if scenario planner
- `client/src/pages/history.tsx` - Change history log with undo
- `client/src/pages/manage-tags.tsx` - Tag management
- `client/src/pages/categories.tsx` - Category sidebar/sheet with spending limits
- `client/src/pages/favorites.tsx` - Favorite entry templates
- `client/src/pages/net-worth.tsx` - Net worth tracker with assets/liabilities
- `client/src/pages/compare.tsx` - Side-by-side budget comparison
- `client/src/components/app-sidebar.tsx` - Navigation sidebar with folder tree, themes, dark mode
- `client/src/components/theme-provider.tsx` - Theme and dark mode management
- `client/src/lib/currency.ts` - Currency formatting utility (15 currencies)
- `client/src/lib/export-csv.ts` - CSV export utility
- `client/public/manifest.json` - PWA manifest
- `client/public/sw.js` - Service worker for offline caching

### Routes
- `/` - Dashboard (home page with cross-budget summary)
- `/budget/:id` - Budget view with entries and categories (sheet on mobile, panel on desktop)
- `/reports` - Enhanced spending reports with comparisons and predictions
- `/annual` - Annual overview
- `/goals` - Savings goals
- `/whatif` - What-if scenarios
- `/history` - Change history with undo
- `/tags` - Tag management
- `/favorites` - Favorite entry templates
- `/networth` - Net worth tracker
- `/compare` - Budget comparison
- `/dev/routes` - Dev route explorer (development only)

### Key API Endpoints
- `POST /api/budgets/:id/clone` - Clone a budget with all entries, categories, tags
- `GET/POST /api/favorites` - Favorite entry templates
- `GET/POST /api/net-worth-accounts` - Net worth accounts
- `GET/POST /api/savings-goals` - Savings goals
- `GET /api/dev/routes` - Dev-only API route explorer (requires auth, disabled in production)

### Design Decisions
- Status marking is context-aware: "Paid" for expenses, "Received" for income
- Recurring entries auto-populate child entries until end date or end of year
- Money-left indicator uses fuel gauge-style progress bar
- Categories shown in right panel on desktop, bottom sheet on mobile
- Sidebar as drawer on mobile with hamburger trigger
- Color scheme: emerald for income, red for expenses, blue for balance
- 10 preset color themes stored in localStorage
- Currency stored per budget, formatted with proper symbols
- Money is stored as exact `numeric(14,2)` values in PostgreSQL
- Starred unpaid expenses highlighted with amber/yellow and sorted first
- Animated number counters for stat totals
- PWA with network-first API caching and cache-first static assets
- API logs capture response metadata only (status/duration/key summary), not full payload bodies
- Storage access is tenant-scoped and fails closed without an authenticated user id
- Production startup blocks local-dev auth bypass configuration
