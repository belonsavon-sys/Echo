import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth, registerAuthRoutes } from "./auth";
import { registerDevExplorerRoutes } from "./dev-routes";

function loadLocalEnvFile() {
  const loadEnvFile = (process as any).loadEnvFile as ((path?: string) => void) | undefined;
  if (!loadEnvFile) return;
  try {
    loadEnvFile(".env");
  } catch {
    // Ignore when .env is missing; process env may come from the shell/provider.
  }
}

loadLocalEnvFile();

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

function summarizeJsonResponseForLog(payload: unknown): string {
  if (payload === null) return "null";
  if (Array.isArray(payload)) {
    return `array(len=${payload.length})`;
  }
  if (typeof payload === "object") {
    const keys = Object.keys(payload as Record<string, unknown>);
    const shownKeys = keys.slice(0, 6);
    const suffix = keys.length > shownKeys.length ? ",..." : "";
    return `object(keys=[${shownKeys.join(",")}${suffix}])`;
  }
  return `type=${typeof payload}`;
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: unknown = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse !== undefined) {
        logLine += ` :: ${summarizeJsonResponseForLog(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await setupAuth(app);
  registerAuthRoutes(app);

  await registerRoutes(httpServer, app);
  if (process.env.NODE_ENV !== "production") {
    registerDevExplorerRoutes(app);
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  httpServer.listen(
    {
      port,
      host,
    },
    () => {
      log(`serving on ${host}:${port}`);
    },
  );
})();
