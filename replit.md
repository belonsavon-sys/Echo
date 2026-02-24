# Fudget Budget Tracker

## Overview
A minimalist budget tracking application inspired by Fudget, featuring income/expense management with smart status marking, recurring entries, envelope/category budgeting, custom tags, spending reports, savings goals, what-if scenario planning, annual overview, change history with undo, and CSV export.

## Recent Changes
- 2026-02-24: Initial build with full feature set
- 2026-02-24: Added wouter routing for all pages
- 2026-02-24: Added undo/revert endpoint for history records
- 2026-02-24: Added Zod validation for all PATCH routes
- 2026-02-24: Added rollover/carry-over API endpoint
- 2026-02-24: Added data-testid attributes to all interactive elements

## Project Architecture

### Stack
- **Frontend**: React + Vite + TypeScript, shadcn/ui, TanStack Query, Recharts, wouter
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **Styling**: Tailwind CSS with Fudget-inspired minimal theme

### Structure
- `shared/schema.ts` - Data model (budgets, entries, categories, tags, history, savings goals)
- `server/routes.ts` - REST API routes with Zod validation
- `server/storage.ts` - Database storage interface (IStorage + DatabaseStorage)
- `client/src/App.tsx` - Main app with wouter routing
- `client/src/pages/budget.tsx` - Core budget page with entry management
- `client/src/pages/reports.tsx` - Spending reports with pie/bar charts
- `client/src/pages/annual-overview.tsx` - Annual month-by-month dashboard
- `client/src/pages/savings-goals.tsx` - Savings goals with progress bars
- `client/src/pages/what-if.tsx` - What-if scenario planner
- `client/src/pages/history.tsx` - Change history log with undo
- `client/src/pages/manage-tags.tsx` - Tag management
- `client/src/pages/categories.tsx` - Category sidebar with spending limits
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/lib/export-csv.ts` - CSV export utility

### Routes
- `/` - Welcome page
- `/budget/:id` - Budget view with entries and categories sidebar
- `/reports` - Spending reports
- `/annual` - Annual overview
- `/goals` - Savings goals
- `/whatif` - What-if scenarios
- `/history` - Change history with undo
- `/tags` - Tag management

### Design Decisions
- Status marking is context-aware: "Paid" for expenses, "Received" for income
- Recurring entries auto-populate child entries until end date or end of year
- Money-left indicator uses fuel gauge-style progress bar
- Categories shown in right sidebar on desktop
- Color scheme: emerald for income, red for expenses, blue for balance
- Fudget-inspired minimal aesthetic with clean borders and subtle shadows
