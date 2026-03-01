import type { Express } from "express";
import { isAuthenticated } from "./auth";

type RouteRecord = {
  method: string;
  path: string;
};

function collectRegisteredRoutes(app: Express): RouteRecord[] {
  const router = (app as any).router;
  const stack = Array.isArray(router?.stack) ? router.stack : [];
  const routes: RouteRecord[] = [];

  for (const layer of stack) {
    const route = layer?.route;
    if (!route) continue;

    const methods = Object.entries(route.methods ?? {})
      .filter(([, enabled]) => enabled)
      .map(([method]) => method.toUpperCase());

    const paths = Array.isArray(route.path) ? route.path : [route.path];

    for (const method of methods) {
      for (const pathValue of paths) {
        routes.push({
          method,
          path: typeof pathValue === "string" ? pathValue : String(pathValue ?? ""),
        });
      }
    }
  }

  routes.sort((left, right) => {
    const pathCmp = left.path.localeCompare(right.path);
    if (pathCmp !== 0) return pathCmp;
    return left.method.localeCompare(right.method);
  });

  return routes;
}

export function registerDevExplorerRoutes(app: Express): void {
  app.get("/api/dev/routes", isAuthenticated, async (_req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ message: "Not found" });
    }

    const routes = collectRegisteredRoutes(app);
    return res.json({
      generatedAt: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || "development",
      authMode: process.env.LOCAL_DEV_AUTH === "true" ? "LOCAL_DEV_AUTH" : "SUPABASE_JWT",
      routeCount: routes.length,
      routes,
    });
  });
}
