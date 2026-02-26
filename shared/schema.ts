import { sql } from "drizzle-orm";
import { pgTable, text, integer, boolean, real, timestamp, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export type NavigationPreferences = {
  hiddenToolIds?: string[];
  moreExpanded?: boolean;
};

export type DashboardPreferences = {
  cardOrder?: string[];
  hiddenCards?: string[];
};

export const budgets = pgTable("budgets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  description: text("description"),
  period: text("period").notNull().default("monthly"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  rolloverEnabled: boolean("rollover_enabled").notNull().default(false),
  rolloverAmount: real("rollover_amount").notNull().default(0),
  parentId: integer("parent_id"),
  isFolder: boolean("is_folder").notNull().default(false),
  currency: text("currency").notNull().default("USD"),
  userId: text("user_id").notNull(),
});

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon"),
  budgetLimit: real("budget_limit"),
  budgetId: integer("budget_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tags = pgTable("tags", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8b5cf6"),
  userId: text("user_id").notNull(),
});

export const entries = pgTable("entries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  budgetId: integer("budget_id").notNull(),
  categoryId: integer("category_id"),
  type: text("type").notNull(),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  note: text("note"),
  date: date("date").notNull(),
  isPaidOrReceived: boolean("is_paid_or_received").notNull().default(false),
  isStarred: boolean("is_starred").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringFrequency: text("recurring_frequency"),
  recurringEndDate: date("recurring_end_date"),
  recurringParentId: integer("recurring_parent_id"),
  tagIds: integer("tag_ids").array(),
});

export const entryHistory = pgTable("entry_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  entryId: integer("entry_id").notNull(),
  budgetId: integer("budget_id").notNull(),
  action: text("action").notNull(),
  previousData: text("previous_data"),
  newData: text("new_data"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const savingsGoals = pgTable("savings_goals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  targetAmount: real("target_amount").notNull(),
  currentAmount: real("current_amount").notNull().default(0),
  deadline: date("deadline"),
  color: text("color").notNull().default("#10b981"),
  budgetId: integer("budget_id"),
  userId: text("user_id").notNull(),
});

export const favorites = pgTable("favorites", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  note: text("note"),
  categoryId: integer("category_id"),
  tagIds: integer("tag_ids").array(),
  userId: text("user_id").notNull(),
});

export const netWorthAccounts = pgTable("net_worth_accounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  balance: real("balance").notNull(),
  currency: text("currency").notNull().default("USD"),
  accountType: text("account_type").notNull(),
  userId: text("user_id").notNull(),
});

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  navigation: jsonb("navigation")
    .$type<NavigationPreferences>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  dashboard: jsonb("dashboard")
    .$type<DashboardPreferences>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const dashboardWatchlists = pgTable("dashboard_watchlists", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  budgetId: integer("budget_id"),
  categoryId: integer("category_id"),
  targetAmount: real("target_amount").notNull().default(0),
  monthKeyScope: text("month_key_scope").notNull().default("current"),
  fixedMonthKey: text("fixed_month_key"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const budgetsRelations = relations(budgets, ({ many }) => ({
  entries: many(entries),
  categories: many(categories),
  savingsGoals: many(savingsGoals),
  history: many(entryHistory),
  watchlists: many(dashboardWatchlists),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  budget: one(budgets, { fields: [categories.budgetId], references: [budgets.id] }),
  watchlists: many(dashboardWatchlists),
}));

export const entriesRelations = relations(entries, ({ one }) => ({
  budget: one(budgets, { fields: [entries.budgetId], references: [budgets.id] }),
  category: one(categories, { fields: [entries.categoryId], references: [categories.id] }),
  recurringParent: one(entries, { fields: [entries.recurringParentId], references: [entries.id] }),
}));

export const entryHistoryRelations = relations(entryHistory, ({ one }) => ({
  budget: one(budgets, { fields: [entryHistory.budgetId], references: [budgets.id] }),
}));

export const savingsGoalsRelations = relations(savingsGoals, ({ one }) => ({
  budget: one(budgets, { fields: [savingsGoals.budgetId], references: [budgets.id] }),
}));

export const dashboardWatchlistsRelations = relations(dashboardWatchlists, ({ one }) => ({
  budget: one(budgets, { fields: [dashboardWatchlists.budgetId], references: [budgets.id] }),
  category: one(categories, { fields: [dashboardWatchlists.categoryId], references: [categories.id] }),
}));

export const insertBudgetSchema = createInsertSchema(budgets);
export const insertCategorySchema = createInsertSchema(categories);
export const insertTagSchema = createInsertSchema(tags);
export const insertEntrySchema = createInsertSchema(entries);
export const insertEntryHistorySchema = createInsertSchema(entryHistory);
export const insertSavingsGoalSchema = createInsertSchema(savingsGoals);
export const insertFavoriteSchema = createInsertSchema(favorites);
export const insertNetWorthAccountSchema = createInsertSchema(netWorthAccounts);
export const insertUserPreferencesSchema = createInsertSchema(userPreferences);
export const insertDashboardWatchlistSchema = createInsertSchema(dashboardWatchlists);

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type Entry = typeof entries.$inferSelect;
export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type EntryHistory = typeof entryHistory.$inferSelect;
export type InsertEntryHistory = z.infer<typeof insertEntryHistorySchema>;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type InsertSavingsGoal = z.infer<typeof insertSavingsGoalSchema>;
export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type NetWorthAccount = typeof netWorthAccounts.$inferSelect;
export type InsertNetWorthAccount = z.infer<typeof insertNetWorthAccountSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type DashboardWatchlist = typeof dashboardWatchlists.$inferSelect;
export type InsertDashboardWatchlist = z.infer<typeof insertDashboardWatchlistSchema>;

export * from "./models/auth";
