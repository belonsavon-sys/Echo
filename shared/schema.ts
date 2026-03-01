import { sql } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp, date, jsonb, index, customType, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./models/auth";

const money = customType<{ data: number; driverData: string }>({
  dataType() {
    return "numeric(14,2)";
  },
  toDriver(value: number): string {
    return Number.isFinite(value) ? value.toFixed(2) : "0.00";
  },
  fromDriver(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  },
});

export type NavigationPreferences = {
  hiddenToolIds?: string[];
  moreExpanded?: boolean;
};

export const budgets = pgTable(
  "budgets",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    description: text("description"),
    period: text("period").notNull().default("monthly"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    rolloverEnabled: boolean("rollover_enabled").notNull().default(false),
    rolloverAmount: money("rollover_amount").notNull().default(sql`0`),
    openingBalance: money("opening_balance").notNull().default(sql`0`),
    openingBalanceMode: text("opening_balance_mode").notNull().default("manual"),
    entryOrderMode: text("entry_order_mode").notNull().default("auto_date"),
    parentId: integer("parent_id").references((): AnyPgColumn => budgets.id, { onDelete: "set null" }),
    isFolder: boolean("is_folder").notNull().default(false),
    currency: text("currency").notNull().default("USD"),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    userSortIdx: index("budgets_user_sort_idx").on(table.userId, table.sortOrder),
    parentIdx: index("budgets_parent_id_idx").on(table.parentId),
    userPeriodIdx: index("budgets_user_period_idx").on(table.userId, table.period),
  }),
);

export const categories = pgTable(
  "categories",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#6366f1"),
    icon: text("icon"),
    budgetLimit: money("budget_limit"),
    budgetId: integer("budget_id").notNull().references(() => budgets.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    budgetSortIdx: index("categories_budget_sort_idx").on(table.budgetId, table.sortOrder),
    budgetNameIdx: index("categories_budget_name_idx").on(table.budgetId, table.name),
  }),
);

export const tags = pgTable(
  "tags",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#8b5cf6"),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    userNameIdx: index("tags_user_name_idx").on(table.userId, table.name),
  }),
);

export const entries = pgTable(
  "entries",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    budgetId: integer("budget_id").notNull().references(() => budgets.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    amount: money("amount").notNull(),
    note: text("note"),
    date: date("date").notNull(),
    isPaidOrReceived: boolean("is_paid_or_received").notNull().default(false),
    isStarred: boolean("is_starred").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isRecurring: boolean("is_recurring").notNull().default(false),
    recurringFrequency: text("recurring_frequency"),
    recurringEndDate: date("recurring_end_date"),
    recurringEndAmount: money("recurring_end_amount"),
    recurringParentId: integer("recurring_parent_id").references((): AnyPgColumn => entries.id, { onDelete: "set null" }),
    tagIds: integer("tag_ids").array(),
  },
  (table) => ({
    budgetSortIdx: index("entries_budget_sort_idx").on(table.budgetId, table.sortOrder),
    budgetDateIdx: index("entries_budget_date_idx").on(table.budgetId, table.date),
    recurringParentIdx: index("entries_recurring_parent_idx").on(table.recurringParentId),
    categoryIdx: index("entries_category_id_idx").on(table.categoryId),
  }),
);

export const entryHistory = pgTable(
  "entry_history",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    entryId: integer("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
    budgetId: integer("budget_id").notNull().references(() => budgets.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    previousData: text("previous_data"),
    newData: text("new_data"),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
  },
  (table) => ({
    budgetTimestampIdx: index("entry_history_budget_timestamp_idx").on(table.budgetId, table.timestamp),
    entryIdx: index("entry_history_entry_id_idx").on(table.entryId),
  }),
);

export const savingsGoals = pgTable(
  "savings_goals",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    targetAmount: money("target_amount").notNull(),
    currentAmount: money("current_amount").notNull().default(sql`0`),
    deadline: date("deadline"),
    color: text("color").notNull().default("#10b981"),
    budgetId: integer("budget_id").references(() => budgets.id, { onDelete: "set null" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    userIdx: index("savings_goals_user_idx").on(table.userId),
    budgetIdx: index("savings_goals_budget_idx").on(table.budgetId),
  }),
);

export const favorites = pgTable(
  "favorites",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    amount: money("amount").notNull(),
    note: text("note"),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    tagIds: integer("tag_ids").array(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    userIdx: index("favorites_user_idx").on(table.userId),
    categoryIdx: index("favorites_category_idx").on(table.categoryId),
  }),
);

export const netWorthAccounts = pgTable(
  "net_worth_accounts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    balance: money("balance").notNull(),
    currency: text("currency").notNull().default("USD"),
    accountType: text("account_type").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    userIdx: index("net_worth_accounts_user_idx").on(table.userId),
  }),
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    navigation: jsonb("navigation")
      .$type<NavigationPreferences>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    updatedAtIdx: index("user_preferences_updated_at_idx").on(table.updatedAt),
  }),
);

export const budgetsRelations = relations(budgets, ({ many }) => ({
  entries: many(entries),
  categories: many(categories),
  savingsGoals: many(savingsGoals),
  history: many(entryHistory),
}));

export const categoriesRelations = relations(categories, ({ one }) => ({
  budget: one(budgets, { fields: [categories.budgetId], references: [budgets.id] }),
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

export const insertBudgetSchema = createInsertSchema(budgets);
export const insertCategorySchema = createInsertSchema(categories);
export const insertTagSchema = createInsertSchema(tags);
export const insertEntrySchema = createInsertSchema(entries);
export const insertEntryHistorySchema = createInsertSchema(entryHistory);
export const insertSavingsGoalSchema = createInsertSchema(savingsGoals);
export const insertFavoriteSchema = createInsertSchema(favorites);
export const insertNetWorthAccountSchema = createInsertSchema(netWorthAccounts);
export const insertUserPreferencesSchema = createInsertSchema(userPreferences);

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

export * from "./models/auth";
