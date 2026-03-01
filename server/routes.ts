import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import { registerBudgetRoutes } from "./route-modules/budget-routes";
import { registerBudgetAggregateRoutes } from "./route-modules/budget-aggregate";
import { registerEntryHistoryRoutes } from "./route-modules/entry-history-routes";
import { registerExtendedRoutes } from "./route-modules/extended-routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  const deps = { storage, isAuthenticated };

  registerBudgetRoutes(app, deps);
  registerBudgetAggregateRoutes(app, deps);
  registerEntryHistoryRoutes(app, deps);
  registerExtendedRoutes(app, deps);

  return httpServer;
}
