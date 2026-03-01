import {
  type Budget, type InsertBudget,
  type Category, type InsertCategory,
  type Tag, type InsertTag,
  type Entry, type InsertEntry,
  type EntryHistory, type InsertEntryHistory,
  type SavingsGoal, type InsertSavingsGoal,
  type Favorite, type InsertFavorite,
  type NetWorthAccount, type InsertNetWorthAccount,
  type UserPreferences, type InsertUserPreferences,
  budgets, categories, tags, entries, entryHistory, savingsGoals, favorites, netWorthAccounts,
  userPreferences,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, inArray } from "drizzle-orm";

export interface IStorage {
  getBudgets(userId: string): Promise<Budget[]>;
  getBudget(id: number, userId: string): Promise<Budget | undefined>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: number, budget: Partial<InsertBudget>, userId: string): Promise<Budget | undefined>;
  deleteBudget(id: number, userId: string): Promise<void>;

  getCategories(budgetId: number): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<void>;

  getTags(userId: string): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: number, tag: Partial<InsertTag>, userId: string): Promise<Tag | undefined>;
  deleteTag(id: number, userId: string): Promise<void>;

  getEntries(budgetId: number): Promise<Entry[]>;
  getEntriesForBudgets(budgetIds: number[]): Promise<Entry[]>;
  getEntry(id: number): Promise<Entry | undefined>;
  createEntry(entry: InsertEntry): Promise<Entry>;
  updateEntry(id: number, entry: Partial<InsertEntry>): Promise<Entry | undefined>;
  deleteEntry(id: number): Promise<void>;
  getRecurringChildren(parentId: number): Promise<Entry[]>;
  reorderEntriesInBudget(budgetId: number, orderedEntryIds: number[]): Promise<void>;

  getHistory(budgetId: number): Promise<EntryHistory[]>;
  getHistoryForBudgets(budgetIds: number[]): Promise<EntryHistory[]>;
  createHistory(history: InsertEntryHistory): Promise<EntryHistory>;

  getCategoriesForBudgets(budgetIds: number[]): Promise<Category[]>;

  getSavingsGoals(userId: string, budgetId?: number): Promise<SavingsGoal[]>;
  createSavingsGoal(goal: InsertSavingsGoal): Promise<SavingsGoal>;
  updateSavingsGoal(id: number, goal: Partial<InsertSavingsGoal>, userId: string): Promise<SavingsGoal | undefined>;
  deleteSavingsGoal(id: number, userId: string): Promise<void>;

  getFavorites(userId: string): Promise<Favorite[]>;
  createFavorite(favorite: InsertFavorite): Promise<Favorite>;
  updateFavorite(id: number, favorite: Partial<InsertFavorite>, userId: string): Promise<Favorite | undefined>;
  deleteFavorite(id: number, userId: string): Promise<void>;

  getNetWorthAccounts(userId: string): Promise<NetWorthAccount[]>;
  createNetWorthAccount(account: InsertNetWorthAccount): Promise<NetWorthAccount>;
  updateNetWorthAccount(id: number, account: Partial<InsertNetWorthAccount>, userId: string): Promise<NetWorthAccount | undefined>;
  deleteNetWorthAccount(id: number, userId: string): Promise<void>;

  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  upsertUserPreferences(userId: string, values: Partial<InsertUserPreferences>): Promise<UserPreferences>;

  cloneBudget(sourceId: number, newName: string, parentId: number | undefined, userId: string): Promise<Budget>;
}

export class DatabaseStorage implements IStorage {
  private assertUserId(userId: string): string {
    const normalized = userId.trim();
    if (!normalized) {
      throw new Error("Missing authenticated user id");
    }
    return normalized;
  }

  async getBudgets(userId: string): Promise<Budget[]> {
    const scopedUserId = this.assertUserId(userId);
    return db
      .select()
      .from(budgets)
      .where(eq(budgets.userId, scopedUserId))
      .orderBy(asc(budgets.sortOrder));
  }

  async getBudget(id: number, userId: string): Promise<Budget | undefined> {
    const scopedUserId = this.assertUserId(userId);
    const [budget] = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, scopedUserId)));
    return budget;
  }

  async createBudget(budget: InsertBudget): Promise<Budget> {
    const [created] = await db.insert(budgets).values(budget).returning();
    return created;
  }

  async updateBudget(id: number, budget: Partial<InsertBudget>, userId: string): Promise<Budget | undefined> {
    const scopedUserId = this.assertUserId(userId);
    const [updated] = await db
      .update(budgets)
      .set(budget)
      .where(and(eq(budgets.id, id), eq(budgets.userId, scopedUserId)))
      .returning();
    return updated;
  }

  async deleteBudget(id: number, userId: string): Promise<void> {
    const scopedUserId = this.assertUserId(userId);
    const ownerCheck = and(eq(budgets.id, id), eq(budgets.userId, scopedUserId));
    const [owned] = await db.select().from(budgets).where(ownerCheck);
    if (!owned) return;

    const childCondition = and(eq(budgets.parentId, id), eq(budgets.userId, scopedUserId));
    const children = await db.select().from(budgets).where(childCondition);
    for (const child of children) {
      await this.deleteBudget(child.id, scopedUserId);
    }
    await db.delete(entryHistory).where(eq(entryHistory.budgetId, id));
    await db.delete(entries).where(eq(entries.budgetId, id));
    await db.delete(categories).where(eq(categories.budgetId, id));
    await db.delete(savingsGoals).where(eq(savingsGoals.budgetId, id));

    const deleteCondition = and(eq(budgets.id, id), eq(budgets.userId, scopedUserId));
    await db.delete(budgets).where(deleteCondition);
  }

  async getCategories(budgetId: number): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.budgetId, budgetId)).orderBy(asc(categories.sortOrder));
  }

  async getCategoriesForBudgets(budgetIds: number[]): Promise<Category[]> {
    if (budgetIds.length === 0) return [];
    return db
      .select()
      .from(categories)
      .where(inArray(categories.budgetId, budgetIds))
      .orderBy(asc(categories.budgetId), asc(categories.sortOrder));
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [created] = await db.insert(categories).values(category).returning();
    return created;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updated] = await db.update(categories).set(category).where(eq(categories.id, id)).returning();
    return updated;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.update(entries).set({ categoryId: null }).where(eq(entries.categoryId, id));
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getTags(userId: string): Promise<Tag[]> {
    const scopedUserId = this.assertUserId(userId);
    return db.select().from(tags).where(eq(tags.userId, scopedUserId)).orderBy(asc(tags.name));
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [created] = await db.insert(tags).values(tag).returning();
    return created;
  }

  async updateTag(id: number, tag: Partial<InsertTag>, userId: string): Promise<Tag | undefined> {
    const scopedUserId = this.assertUserId(userId);
    const [updated] = await db
      .update(tags)
      .set(tag)
      .where(and(eq(tags.id, id), eq(tags.userId, scopedUserId)))
      .returning();
    return updated;
  }

  async deleteTag(id: number, userId: string): Promise<void> {
    const scopedUserId = this.assertUserId(userId);
    await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, scopedUserId)));
  }

  async getEntries(budgetId: number): Promise<Entry[]> {
    return db.select().from(entries).where(eq(entries.budgetId, budgetId)).orderBy(asc(entries.sortOrder));
  }

  async getEntriesForBudgets(budgetIds: number[]): Promise<Entry[]> {
    if (budgetIds.length === 0) return [];
    return db
      .select()
      .from(entries)
      .where(inArray(entries.budgetId, budgetIds))
      .orderBy(asc(entries.budgetId), asc(entries.sortOrder));
  }

  async getEntry(id: number): Promise<Entry | undefined> {
    const [entry] = await db.select().from(entries).where(eq(entries.id, id));
    return entry;
  }

  async createEntry(entry: InsertEntry): Promise<Entry> {
    const [created] = await db.insert(entries).values(entry).returning();
    return created;
  }

  async updateEntry(id: number, entry: Partial<InsertEntry>): Promise<Entry | undefined> {
    const [updated] = await db.update(entries).set(entry).where(eq(entries.id, id)).returning();
    return updated;
  }

  async deleteEntry(id: number): Promise<void> {
    await db.delete(entries).where(eq(entries.recurringParentId, id));
    await db.delete(entryHistory).where(eq(entryHistory.entryId, id));
    await db.delete(entries).where(eq(entries.id, id));
  }

  async getRecurringChildren(parentId: number): Promise<Entry[]> {
    return db.select().from(entries).where(eq(entries.recurringParentId, parentId));
  }

  async reorderEntriesInBudget(budgetId: number, orderedEntryIds: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let index = 0; index < orderedEntryIds.length; index += 1) {
        const entryId = orderedEntryIds[index];
        await tx
          .update(entries)
          .set({ sortOrder: index })
          .where(and(eq(entries.id, entryId), eq(entries.budgetId, budgetId)));
      }
    });
  }

  async getHistory(budgetId: number): Promise<EntryHistory[]> {
    return db.select().from(entryHistory).where(eq(entryHistory.budgetId, budgetId)).orderBy(desc(entryHistory.timestamp));
  }

  async getHistoryForBudgets(budgetIds: number[]): Promise<EntryHistory[]> {
    if (budgetIds.length === 0) return [];
    return db
      .select()
      .from(entryHistory)
      .where(inArray(entryHistory.budgetId, budgetIds))
      .orderBy(asc(entryHistory.budgetId), desc(entryHistory.timestamp));
  }

  async createHistory(history: InsertEntryHistory): Promise<EntryHistory> {
    const [created] = await db.insert(entryHistory).values(history).returning();
    return created;
  }

  async getSavingsGoals(userId: string, budgetId?: number): Promise<SavingsGoal[]> {
    const scopedUserId = this.assertUserId(userId);
    if (budgetId) {
      return db
        .select()
        .from(savingsGoals)
        .where(and(eq(savingsGoals.userId, scopedUserId), eq(savingsGoals.budgetId, budgetId)));
    }
    return db.select().from(savingsGoals).where(eq(savingsGoals.userId, scopedUserId));
  }

  async createSavingsGoal(goal: InsertSavingsGoal): Promise<SavingsGoal> {
    const [created] = await db.insert(savingsGoals).values(goal).returning();
    return created;
  }

  async updateSavingsGoal(id: number, goal: Partial<InsertSavingsGoal>, userId: string): Promise<SavingsGoal | undefined> {
    const scopedUserId = this.assertUserId(userId);
    const [updated] = await db
      .update(savingsGoals)
      .set(goal)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, scopedUserId)))
      .returning();
    return updated;
  }

  async deleteSavingsGoal(id: number, userId: string): Promise<void> {
    const scopedUserId = this.assertUserId(userId);
    await db.delete(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, scopedUserId)));
  }

  async getFavorites(userId: string): Promise<Favorite[]> {
    const scopedUserId = this.assertUserId(userId);
    return db.select().from(favorites).where(eq(favorites.userId, scopedUserId));
  }

  async createFavorite(favorite: InsertFavorite): Promise<Favorite> {
    const [created] = await db.insert(favorites).values(favorite).returning();
    return created;
  }

  async updateFavorite(id: number, favorite: Partial<InsertFavorite>, userId: string): Promise<Favorite | undefined> {
    const scopedUserId = this.assertUserId(userId);
    const [updated] = await db
      .update(favorites)
      .set(favorite)
      .where(and(eq(favorites.id, id), eq(favorites.userId, scopedUserId)))
      .returning();
    return updated;
  }

  async deleteFavorite(id: number, userId: string): Promise<void> {
    const scopedUserId = this.assertUserId(userId);
    await db.delete(favorites).where(and(eq(favorites.id, id), eq(favorites.userId, scopedUserId)));
  }

  async getNetWorthAccounts(userId: string): Promise<NetWorthAccount[]> {
    const scopedUserId = this.assertUserId(userId);
    return db.select().from(netWorthAccounts).where(eq(netWorthAccounts.userId, scopedUserId));
  }

  async createNetWorthAccount(account: InsertNetWorthAccount): Promise<NetWorthAccount> {
    const [created] = await db.insert(netWorthAccounts).values(account).returning();
    return created;
  }

  async updateNetWorthAccount(id: number, account: Partial<InsertNetWorthAccount>, userId: string): Promise<NetWorthAccount | undefined> {
    const scopedUserId = this.assertUserId(userId);
    const [updated] = await db
      .update(netWorthAccounts)
      .set(account)
      .where(and(eq(netWorthAccounts.id, id), eq(netWorthAccounts.userId, scopedUserId)))
      .returning();
    return updated;
  }

  async deleteNetWorthAccount(id: number, userId: string): Promise<void> {
    const scopedUserId = this.assertUserId(userId);
    await db
      .delete(netWorthAccounts)
      .where(and(eq(netWorthAccounts.id, id), eq(netWorthAccounts.userId, scopedUserId)));
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return preferences;
  }

  async upsertUserPreferences(userId: string, values: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    const [saved] = await db
      .insert(userPreferences)
      .values({
        userId,
        navigation: (values.navigation || {}) as any,
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          ...(values.navigation !== undefined ? { navigation: values.navigation as any } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    return saved;
  }

  async cloneBudget(sourceId: number, newName: string, parentId: number | undefined, userId: string): Promise<Budget> {
    const scopedUserId = this.assertUserId(userId);
    const source = await this.getBudget(sourceId, scopedUserId);
    if (!source) throw new Error("Source budget not found");

    const { id, ...budgetData } = source;
    const [newBudget] = await db.insert(budgets).values({
      ...budgetData,
      name: newName,
      parentId: parentId ?? null,
      userId: scopedUserId,
    }).returning();

    const sourceCategories = await this.getCategories(sourceId);
    const categoryIdMap = new Map<number, number>();

    for (const cat of sourceCategories) {
      const { id: oldCatId, ...catData } = cat;
      const [newCat] = await db.insert(categories).values({
        ...catData,
        budgetId: newBudget.id,
      }).returning();
      categoryIdMap.set(oldCatId, newCat.id);
    }

    const sourceEntries = await this.getEntries(sourceId);
    for (const entry of sourceEntries) {
      const { id: _entryId, ...entryData } = entry;
      await db.insert(entries).values({
        ...entryData,
        budgetId: newBudget.id,
        categoryId: entry.categoryId ? (categoryIdMap.get(entry.categoryId) ?? null) : null,
      });
    }

    return newBudget;
  }
}

export const storage = new DatabaseStorage();
