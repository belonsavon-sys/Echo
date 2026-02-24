import {
  type Budget, type InsertBudget,
  type Category, type InsertCategory,
  type Tag, type InsertTag,
  type Entry, type InsertEntry,
  type EntryHistory, type InsertEntryHistory,
  type SavingsGoal, type InsertSavingsGoal,
  type Favorite, type InsertFavorite,
  type NetWorthAccount, type InsertNetWorthAccount,
  budgets, categories, tags, entries, entryHistory, savingsGoals, favorites, netWorthAccounts,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";

export interface IStorage {
  getBudgets(userId: string): Promise<Budget[]>;
  getBudget(id: number, userId: string): Promise<Budget | undefined>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: number, budget: Partial<InsertBudget>, userId: string): Promise<Budget | undefined>;
  deleteBudget(id: number, userId: string): Promise<void>;

  getCategories(budgetId: number): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<void>;

  getTags(userId: string): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: number, tag: Partial<InsertTag>, userId: string): Promise<Tag | undefined>;
  deleteTag(id: number, userId: string): Promise<void>;

  getEntries(budgetId: number): Promise<Entry[]>;
  getEntry(id: number): Promise<Entry | undefined>;
  createEntry(entry: InsertEntry): Promise<Entry>;
  updateEntry(id: number, entry: Partial<InsertEntry>): Promise<Entry | undefined>;
  deleteEntry(id: number): Promise<void>;
  getRecurringChildren(parentId: number): Promise<Entry[]>;

  getHistory(budgetId: number): Promise<EntryHistory[]>;
  createHistory(history: InsertEntryHistory): Promise<EntryHistory>;

  getSavingsGoals(budgetId?: number, userId?: string): Promise<SavingsGoal[]>;
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

  cloneBudget(sourceId: number, newName: string, parentId?: number, userId?: string): Promise<Budget>;
}

export class DatabaseStorage implements IStorage {
  async getBudgets(userId: string): Promise<Budget[]> {
    if (userId) {
      return db.select().from(budgets).where(eq(budgets.userId, userId)).orderBy(asc(budgets.sortOrder));
    }
    return db.select().from(budgets).orderBy(asc(budgets.sortOrder));
  }

  async getBudget(id: number, userId: string): Promise<Budget | undefined> {
    if (userId) {
      const [budget] = await db.select().from(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
      return budget;
    }
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, id));
    return budget;
  }

  async createBudget(budget: InsertBudget): Promise<Budget> {
    const [created] = await db.insert(budgets).values(budget).returning();
    return created;
  }

  async updateBudget(id: number, budget: Partial<InsertBudget>, userId: string): Promise<Budget | undefined> {
    if (userId) {
      const [updated] = await db.update(budgets).set(budget).where(and(eq(budgets.id, id), eq(budgets.userId, userId))).returning();
      return updated;
    }
    const [updated] = await db.update(budgets).set(budget).where(eq(budgets.id, id)).returning();
    return updated;
  }

  async deleteBudget(id: number, userId: string): Promise<void> {
    const childCondition = userId
      ? and(eq(budgets.parentId, id), eq(budgets.userId, userId))
      : eq(budgets.parentId, id);
    const children = await db.select().from(budgets).where(childCondition);
    for (const child of children) {
      await this.deleteBudget(child.id, userId);
    }
    await db.delete(entryHistory).where(eq(entryHistory.budgetId, id));
    await db.delete(entries).where(eq(entries.budgetId, id));
    await db.delete(categories).where(eq(categories.budgetId, id));
    await db.delete(savingsGoals).where(eq(savingsGoals.budgetId, id));
    const deleteCondition = userId
      ? and(eq(budgets.id, id), eq(budgets.userId, userId))
      : eq(budgets.id, id);
    await db.delete(budgets).where(deleteCondition);
  }

  async getCategories(budgetId: number): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.budgetId, budgetId)).orderBy(asc(categories.sortOrder));
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
    if (userId) {
      return db.select().from(tags).where(eq(tags.userId, userId)).orderBy(asc(tags.name));
    }
    return db.select().from(tags).orderBy(asc(tags.name));
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [created] = await db.insert(tags).values(tag).returning();
    return created;
  }

  async updateTag(id: number, tag: Partial<InsertTag>, userId: string): Promise<Tag | undefined> {
    if (userId) {
      const [updated] = await db.update(tags).set(tag).where(and(eq(tags.id, id), eq(tags.userId, userId))).returning();
      return updated;
    }
    const [updated] = await db.update(tags).set(tag).where(eq(tags.id, id)).returning();
    return updated;
  }

  async deleteTag(id: number, userId: string): Promise<void> {
    if (userId) {
      await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
    } else {
      await db.delete(tags).where(eq(tags.id, id));
    }
  }

  async getEntries(budgetId: number): Promise<Entry[]> {
    return db.select().from(entries).where(eq(entries.budgetId, budgetId)).orderBy(asc(entries.sortOrder));
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

  async getHistory(budgetId: number): Promise<EntryHistory[]> {
    return db.select().from(entryHistory).where(eq(entryHistory.budgetId, budgetId)).orderBy(desc(entryHistory.timestamp));
  }

  async createHistory(history: InsertEntryHistory): Promise<EntryHistory> {
    const [created] = await db.insert(entryHistory).values(history).returning();
    return created;
  }

  async getSavingsGoals(budgetId?: number, userId?: string): Promise<SavingsGoal[]> {
    const conditions = [];
    if (budgetId) {
      conditions.push(eq(savingsGoals.budgetId, budgetId));
    }
    if (userId) {
      conditions.push(eq(savingsGoals.userId, userId));
    }
    if (conditions.length > 0) {
      return db.select().from(savingsGoals).where(and(...conditions));
    }
    return db.select().from(savingsGoals);
  }

  async createSavingsGoal(goal: InsertSavingsGoal): Promise<SavingsGoal> {
    const [created] = await db.insert(savingsGoals).values(goal).returning();
    return created;
  }

  async updateSavingsGoal(id: number, goal: Partial<InsertSavingsGoal>, userId: string): Promise<SavingsGoal | undefined> {
    if (userId) {
      const [updated] = await db.update(savingsGoals).set(goal).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId))).returning();
      return updated;
    }
    const [updated] = await db.update(savingsGoals).set(goal).where(eq(savingsGoals.id, id)).returning();
    return updated;
  }

  async deleteSavingsGoal(id: number, userId: string): Promise<void> {
    if (userId) {
      await db.delete(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
    } else {
      await db.delete(savingsGoals).where(eq(savingsGoals.id, id));
    }
  }

  async getFavorites(userId: string): Promise<Favorite[]> {
    if (userId) {
      return db.select().from(favorites).where(eq(favorites.userId, userId));
    }
    return db.select().from(favorites);
  }

  async createFavorite(favorite: InsertFavorite): Promise<Favorite> {
    const [created] = await db.insert(favorites).values(favorite).returning();
    return created;
  }

  async updateFavorite(id: number, favorite: Partial<InsertFavorite>, userId: string): Promise<Favorite | undefined> {
    if (userId) {
      const [updated] = await db.update(favorites).set(favorite).where(and(eq(favorites.id, id), eq(favorites.userId, userId))).returning();
      return updated;
    }
    const [updated] = await db.update(favorites).set(favorite).where(eq(favorites.id, id)).returning();
    return updated;
  }

  async deleteFavorite(id: number, userId: string): Promise<void> {
    if (userId) {
      await db.delete(favorites).where(and(eq(favorites.id, id), eq(favorites.userId, userId)));
    } else {
      await db.delete(favorites).where(eq(favorites.id, id));
    }
  }

  async getNetWorthAccounts(userId: string): Promise<NetWorthAccount[]> {
    if (userId) {
      return db.select().from(netWorthAccounts).where(eq(netWorthAccounts.userId, userId));
    }
    return db.select().from(netWorthAccounts);
  }

  async createNetWorthAccount(account: InsertNetWorthAccount): Promise<NetWorthAccount> {
    const [created] = await db.insert(netWorthAccounts).values(account).returning();
    return created;
  }

  async updateNetWorthAccount(id: number, account: Partial<InsertNetWorthAccount>, userId: string): Promise<NetWorthAccount | undefined> {
    if (userId) {
      const [updated] = await db.update(netWorthAccounts).set(account).where(and(eq(netWorthAccounts.id, id), eq(netWorthAccounts.userId, userId))).returning();
      return updated;
    }
    const [updated] = await db.update(netWorthAccounts).set(account).where(eq(netWorthAccounts.id, id)).returning();
    return updated;
  }

  async deleteNetWorthAccount(id: number, userId: string): Promise<void> {
    if (userId) {
      await db.delete(netWorthAccounts).where(and(eq(netWorthAccounts.id, id), eq(netWorthAccounts.userId, userId)));
    } else {
      await db.delete(netWorthAccounts).where(eq(netWorthAccounts.id, id));
    }
  }

  async cloneBudget(sourceId: number, newName: string, parentId?: number, userId?: string): Promise<Budget> {
    const source = userId
      ? await this.getBudget(sourceId, userId)
      : await this.getBudget(sourceId, "");
    if (!source) throw new Error("Source budget not found");

    const { id, ...budgetData } = source;
    const [newBudget] = await db.insert(budgets).values({
      ...budgetData,
      name: newName,
      parentId: parentId ?? null,
      userId: userId ?? budgetData.userId,
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
