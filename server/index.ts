import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { provisionAllExistingTenants } from "./tenant-provisioning";
import { runCompleteConsistencyCheck } from "./simplified-multi-tenant-fix";
import { runStartupSecurityChecks } from "./enhanced-tenant-security";

// Set timezone to Australian Eastern Standard Time
process.env.TZ = 'Australia/Sydney';

console.log(`[TIMEZONE] Server timezone set to: ${process.env.TZ}`);
console.log(`[TIMEZONE] Current server time: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Run comprehensive multi-tenant consistency enforcement on startup
  console.log("[MULTI-TENANT FIX] Running comprehensive consistency enforcement for ALL tenants");
  try {
    await runCompleteConsistencyCheck();
    console.log("[MULTI-TENANT FIX] Consistency enforcement completed successfully");
  } catch (error) {
    console.error("[MULTI-TENANT FIX] Consistency enforcement failed:", error);
  }

  // Apply composite foreign key constraints for database-level tenant isolation
  console.log("[COMPOSITE FK] Applying database-level tenant isolation constraints");
  try {
    const { applyCompositeForeignKeys } = await import('./apply-composite-foreign-keys');
    await applyCompositeForeignKeys();
    console.log("[COMPOSITE FK] Database-level tenant isolation enabled successfully");
  } catch (error) {
    console.error("[COMPOSITE FK] Failed to apply composite foreign keys:", error);
    // Don't fail startup - continue with application-level protection
  }

  // Run enhanced security validation
  console.log("[SECURITY] Running enhanced tenant security checks");
  try {
    await runStartupSecurityChecks();
    console.log("[SECURITY] Enhanced security validation completed successfully");
  } catch (error) {
    console.error("[SECURITY] Enhanced security validation failed:", error);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
