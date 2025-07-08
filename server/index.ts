import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { provisionAllExistingTenants } from "./tenant-provisioning";
import { runCompleteConsistencyCheck } from "./simplified-multi-tenant-fix";
import { runStartupSecurityChecks } from "./enhanced-tenant-security";
import path from 'path';

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

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

(async () => {
  const server = await registerRoutes(app);

  // DEMO DATA PROVISIONING COMPLETELY DISABLED
  console.log("[MULTI-TENANT FIX] ALL DEMO DATA PROVISIONING PERMANENTLY DISABLED");
  console.log("[MULTI-TENANT FIX] New tenants start completely clean - no automatic data creation");
  console.log("[MULTI-TENANT FIX] Users must create all their own data (clients, shifts, etc.)");
  
  // Run complete demo data cleanup for all existing tenants
  try {
    console.log("[DEMO CLEANUP] Removing all existing demo data from all tenants");
    const { completeCleanupAllDemoData } = await import('./complete-demo-data-cleanup');
    await completeCleanupAllDemoData();
    console.log("[DEMO CLEANUP] All demo data removed - tenants now completely clean");
  } catch (error) {
    console.error("[DEMO CLEANUP] Demo data cleanup failed:", error);
  }
  
  // Only apply essential system fixes (employment types, tax brackets, pay scales)
  // NO demo data provisioning whatsoever
  try {
    console.log("[ESSENTIAL FIXES] Applying only essential system fixes (no demo data)");
    const { applyComprehensiveTenantFixes } = await import('./comprehensive-tenant-fixes');
    await applyComprehensiveTenantFixes();
    console.log("[ESSENTIAL FIXES] Essential system fixes completed - no demo data created");
  } catch (error) {
    console.error("[ESSENTIAL FIXES] Essential fixes failed:", error);
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
