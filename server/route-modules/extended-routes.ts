import type { Express, RequestHandler } from "express";
import {
  type NavigationPreferences,
  insertFavoriteSchema,
  insertNetWorthAccountSchema,
  insertSavingsGoalSchema,
} from "@shared/schema";
import type { IStorage } from "../storage";
import { getAuthenticatedUserId } from "../auth/request";

const REMOVED_FEATURE_RESPONSE = { message: "Feature removed" };
const TOOL_IDS = [
  "reports",
  "annual",
  "goals",
  "networth",
  "whatif",
  "history",
  "tags",
  "favorites",
  "compare",
];

function toUniqueStringList(value: unknown, allowed?: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;
    if (allowed && !allowed.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function normalizeNavigationPreferences(value: unknown): NavigationPreferences {
  const objectValue = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  return {
    hiddenToolIds: toUniqueStringList(objectValue.hiddenToolIds, new Set(TOOL_IDS)),
    moreExpanded: typeof objectValue.moreExpanded === "boolean" ? objectValue.moreExpanded : false,
  };
}

async function getUserNavigationPreferences(
  storage: IStorage,
  userId: string,
): Promise<NavigationPreferences> {
  const existing = await storage.getUserPreferences(userId);
  return normalizeNavigationPreferences(existing?.navigation);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

type ExtendedRouteDeps = {
  isAuthenticated: RequestHandler;
  storage: IStorage;
};

export function registerExtendedRoutes(
  app: Express,
  deps: ExtendedRouteDeps,
): void {
  const { isAuthenticated, storage } = deps;

  app.get("/api/savings-goals", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const budgetId = req.query.budgetId ? Number(req.query.budgetId) : undefined;
    const data = await storage.getSavingsGoals(userId, budgetId);
    res.json(data);
  });

  app.post("/api/savings-goals", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const parsed = insertSavingsGoalSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const goal = await storage.createSavingsGoal(parsed.data);
    res.status(201).json(goal);
  });

  app.patch("/api/savings-goals/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const parsed = insertSavingsGoalSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const goal = await storage.updateSavingsGoal(Number(req.params.id), parsed.data, userId);
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    res.json(goal);
  });

  app.delete("/api/savings-goals/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    await storage.deleteSavingsGoal(Number(req.params.id), userId);
    res.status(204).send();
  });

  app.get("/api/favorites", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const data = await storage.getFavorites(userId);
    res.json(data);
  });

  app.post("/api/favorites", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const parsed = insertFavoriteSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const favorite = await storage.createFavorite(parsed.data);
    res.status(201).json(favorite);
  });

  app.patch("/api/favorites/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const parsed = insertFavoriteSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const favorite = await storage.updateFavorite(Number(req.params.id), parsed.data, userId);
    if (!favorite) return res.status(404).json({ message: "Favorite not found" });
    res.json(favorite);
  });

  app.delete("/api/favorites/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    await storage.deleteFavorite(Number(req.params.id), userId);
    res.status(204).send();
  });

  app.get("/api/net-worth-accounts", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const data = await storage.getNetWorthAccounts(userId);
    res.json(data);
  });

  app.post("/api/net-worth-accounts", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const parsed = insertNetWorthAccountSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const account = await storage.createNetWorthAccount(parsed.data);
    res.status(201).json(account);
  });

  app.patch("/api/net-worth-accounts/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const parsed = insertNetWorthAccountSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const account = await storage.updateNetWorthAccount(Number(req.params.id), parsed.data, userId);
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.json(account);
  });

  app.delete("/api/net-worth-accounts/:id", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    await storage.deleteNetWorthAccount(Number(req.params.id), userId);
    res.status(204).send();
  });

  app.get("/api/user-preferences/navigation", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const navigation = await getUserNavigationPreferences(storage, userId);
    res.json(navigation);
  });

  app.patch("/api/user-preferences/navigation", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const payload = asObject(req.body?.navigation ?? req.body);
    if (!payload) return res.status(400).json({ message: "Invalid navigation payload" });

    const current = await getUserNavigationPreferences(storage, userId);
    const next: NavigationPreferences = {
      hiddenToolIds: current.hiddenToolIds ?? [],
      moreExpanded: current.moreExpanded ?? false,
    };

    if (Object.prototype.hasOwnProperty.call(payload, "hiddenToolIds")) {
      next.hiddenToolIds = toUniqueStringList(payload.hiddenToolIds, new Set(TOOL_IDS));
    }
    if (Object.prototype.hasOwnProperty.call(payload, "moreExpanded")) {
      if (typeof payload.moreExpanded !== "boolean") {
        return res.status(400).json({ message: "moreExpanded must be boolean" });
      }
      next.moreExpanded = payload.moreExpanded;
    }

    await storage.upsertUserPreferences(userId, { navigation: next });
    res.json(next);
  });

  app.all("/api/user-preferences/dashboard", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });
  app.all("/api/user-preferences/dashboard/{*rest}", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });

  app.all("/api/dashboard/watchlists", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });
  app.all("/api/dashboard/watchlists/{*rest}", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });

  app.all("/api/coach", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });
  app.all("/api/coach/{*rest}", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });

  app.all("/api/paychecks", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });
  app.all("/api/paychecks/{*rest}", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });

  app.all("/api/bill-reminders", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });
  app.all("/api/bill-reminders/{*rest}", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });

  app.all("/api/bill-occurrences", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });
  app.all("/api/bill-occurrences/{*rest}", isAuthenticated, async (_req, res) => {
    res.status(410).json(REMOVED_FEATURE_RESPONSE);
  });

  app.post("/api/budgets/:id/clone", isAuthenticated, async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const { name, parentId } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "name is required" });
    }
    try {
      const cloned = await storage.cloneBudget(Number(req.params.id), name, parentId, userId);
      res.status(201).json(cloned);
    } catch (err: any) {
      res.status(404).json({ message: err.message });
    }
  });
}
