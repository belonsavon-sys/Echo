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
  getBudgets(): Promise<Budget[]>;
  getBudget(id: number): Promise<Budget | undefined>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: number, budget: Partial<InsertBudget>): Promise<Budget | undefined>;
  deleteBudget(id: number): Promise<void>;

  getCategories(budgetId: number): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<void>;

  getTags(): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: number, tag: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: number): Promise<void>;

  getEntries(budgetId: number): Promise<Entry[]>;
  getEntry(id: number): Promise<Entry | undefined>;
  createEntry(entry: InsertEntry): Promise<Entry>;
  updateEntry(id: number, entry: Partial<InsertEntry>): Promise<Entry | undefined>;
  deleteEntry(id: number): Promise<void>;
  getRecurringChildren(parentId: number): Promise<Entry[]>;

  getHistory(budgetId: number): Promise<EntryHistory[]>;
  createHistory(history: InsertEntryHistory): Promise<EntryHistory>;

  getSavingsGoals(budgetId?: number): Promise<SavingsGoal[]>;
  createSavingsGoal(goal: InsertSavingsGoal): Promise<SavingsGoal>;
  updateSavingsGoal(id: number, goal: Partial<InsertSavingsGoal>): Promise<SavingsGoal | undefined>;
  deleteSavingsGoal(id: number): Promise<void>;

  getFavorites(): Promise<Favorite[]>;
  createFavorite(favorite: InsertFavorite): Promise<Favorite>;
  updateFavorite(id: number, favorite: Partial<InsertFavorite>): Promise<Favorite | undefined>;
  deleteFavorite(id: number): Promise<void>;

  getNetWorthAccounts(): Promise<NetWorthAccount[]>;
  createNetWorthAccount(account: InsertNetWorthAccount): Promise<NetWorthAccount>;
  updateNetWorthAccount(id: number, account: Partial<InsertNetWorthAccount>): Promise<NetWorthAccount | undefined>;
  deleteNetWorthAccount(id: number): Promise<void>;

  cloneBudget(sourceId: number, newName: string, parentId?: number): Promise<Budget>;
}

export class DatabaseStorage implements IStorage {
  async getBudgets(): Promise<Budget[]> {
    return db.select().from(budgets).orderBy(asc(budgets.sortOrder));
  }

  async getBudget(id: number): Promise<Budget | undefined> {
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, id));
    return budget;
  }

  async createBudget(budget: InsertBudget): Promise<Budget> {
    const [created] = await db.insert(budgets).values(budget).returning();
    return created;
  }

  async updateBudget(id: number, budget: Partial<InsertBudget>): Promise<Budget | undefined> {
    const [updated] = await db.update(budgets).set(budget).where(eq(budgets.id, id)).returning();
    return updated;
  }

  async deleteBudget(id: number): Promise<void> {
    await db.delete(entryHistory).where(eq(entryHistory.budgetId, id));
    await db.delete(entries).where(eq(entries.budgetId, id));
    await db.delete(categories).where(eq(categories.budgetId, id));
    await db.delete(savingsGoals).where(eq(savingsGoals.budgetId, id));
    await db.delete(budgets).where(eq(budgets.id, id));
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

  async getTags(): Promise<Tag[]> {
    return db.select().from(tags).orderBy(asc(tags.name));
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [created] = await db.insert(tags).values(tag).returning();
    return created;
  }

  async updateTag(id: number, tag: Partial<InsertTag>): Promise<Tag | undefined> {
    const [updated] = await db.update(tags).set(tag).where(eq(tags.id, id)).returning();
    return updated;
  }

  async deleteTag(id: number): Promise<void> {
    await db.delete(tags).where(eq(tags.id, id));
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

  async getSavingsGoals(budgetId?: number): Promise<SavingsGoal[]> {
    if (budgetId) {
      return db.select().from(savingsGoals).where(eq(savingsGoals.budgetId, budgetId));
    }
    return db.select().from(savingsGoals);
  }

  async createSavingsGoal(goal: InsertSavingsGoal): Promise<SavingsGoal> {
    const [created] = await db.insert(savingsGoals).values(goal).returning();
    return created;
  }

  async updateSavingsGoal(id: number, goal: Partial<InsertSavingsGoal>): Promise<SavingsGoal | undefined> {
    const [updated] = await db.update(savingsGoals).set(goal).where(eq(savingsGoals.id, id)).returning();
    return updated;
  }

  async deleteSavingsGoal(id: number): Promise<void> {
    await db.delete(savingsGoals).where(eq(savingsGoals.id, id));
  }

  async getFavorites(): Promise<Favorite[]> {
    return db.select().from(favorites);
  }

  async createFavorite(favorite: InsertFavorite): Promise<Favorite> {
    const [created] = await db.insert(favorites).values(favorite).returning();
    return created;
  }

  async updateFavorite(id: number, favorite: Partial<InsertFavorite>): Promise<Favorite | undefined> {
    const [updated] = await db.update(favorites).set(favorite).where(eq(favorites.id, id)).returning();
    return updated;
  }

  async deleteFavorite(id: number): Promise<void> {
    await db.delete(favorites).where(eq(favorites.id, id));
  }

  async getNetWorthAccounts(): Promise<NetWorthAccount[]> {
    return db.select().from(netWorthAccounts);
  }

  async createNetWorthAccount(account: InsertNetWorthAccount): Promise<NetWorthAccount> {
    const [created] = await db.insert(netWorthAccounts).values(account).returning();
    return created;
  }

  async updateNetWorthAccount(id: number, account: Partial<InsertNetWorthAccount>): Promise<NetWorthAccount | undefined> {
    const [updated] = await db.update(netWorthAccounts).set(account).where(eq(netWorthAccounts.id, id)).returning();
    return updated;
  }

  async deleteNetWorthAccount(id: number): Promise<void> {
    await db.delete(netWorthAccounts).where(eq(netWorthAccounts.id, id));
  }

  async cloneBudget(sourceId: number, newName: string, parentId?: number): Promise<Budget> {
    const source = await this.getBudget(sourceId);
    if (!source) throw new Error("Source budget not found");

    const { id, ...budgetData } = source;
    const [newBudget] = await db.insert(budgets).values({
      ...budgetData,
      name: newName,
      parentId: parentId ?? null,
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
