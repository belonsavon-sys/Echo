# Fudget Budget Tracker

## Overview
A mobile-first minimalist budget tracking application inspired by Fudget. Features hierarchical budget folders, dark mode with 10 color themes, income/expense management with smart status marking, recurring entries, envelope/category budgeting, custom tags, spending reports with comparisons and predictions, savings goals tracking, what-if scenario planning, annual overview, change history with undo, CSV export, quick-add favorites, net worth tracker, multi-currency support, budget comparison, and PWA support.

## Recent Changes
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
- **Database**: PostgreSQL via Drizzle ORM
- **Styling**: Tailwind CSS with dark mode support
- **PWA**: Service worker with offline caching

### Structure
- `shared/schema.ts` - Data model (budgets with folders/currency, entries, categories, tags, history, savings goals, favorites, net worth accounts)
- `server/routes.ts` - REST API routes with Zod validation
- `server/storage.ts` - Database storage interface (IStorage + DatabaseStorage) with cascade delete
- `client/src/App.tsx` - Main app with wouter routing and responsive layout
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

### Key API Endpoints
- `POST /api/budgets/:id/clone` - Clone a budget with all entries, categories, tags
- `GET/POST /api/favorites` - Favorite entry templates
- `GET/POST /api/net-worth-accounts` - Net worth accounts
- `GET/POST /api/savings-goals` - Savings goals

### Design Decisions
- Status marking is context-aware: "Paid" for expenses, "Received" for income
- Recurring entries auto-populate child entries until end date or end of year
- Money-left indicator uses fuel gauge-style progress bar
- Categories shown in right panel on desktop, bottom sheet on mobile
- Sidebar as drawer on mobile with hamburger trigger
- Color scheme: emerald for income, red for expenses, blue for balance
- 10 preset color themes stored in localStorage
- Currency stored per budget, formatted with proper symbols
- Starred unpaid expenses highlighted with amber/yellow and sorted first
- Animated number counters for stat totals
- PWA with network-first API caching and cache-first static assets
