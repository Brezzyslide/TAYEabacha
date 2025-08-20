// Backend bootstrap removed - Phase 1 cleanup

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runStartupSecurityChecks } from "./enhanced-tenant-security";
// Structured logging removed - Phase cleanup
import path from 'path';
import fs from 'fs';

// Environment Configuration
const isDevelopment = process.env.NODE_ENV !== 'production';

console.log(`[ENV] Starting CareConnect in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
console.log(`[ENV] Node environment: ${process.env.NODE_ENV}`);
console.log(`[ENV] Replit ID: ${process.env.REPL_ID || 'undefined'}`);

// Basic configuration
const cfg = {
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:5000',
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  NODE_ENV: process.env.NODE_ENV || 'development'
};

if (isDevelopment) {
  console.log('[DEV] Continuing in development mode...');
} else {
  console.log('[PROD] Running in production mode...');
}

// Load local environment variables for development FIRST
const localEnvPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(localEnvPath)) {
  const envFile = fs.readFileSync(localEnvPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
      console.log(`[ENV] Override: ${key.trim()} = ${value.includes('DATABASE_URL') ? value.replace(/:[^:]*@/, ':***@') : value.substring(0, 20)}...`);
    }
  });
  console.log('[ENV] Loaded local environment variables');
  console.log('[ENV] GMAIL_EMAIL now set to:', process.env.GMAIL_EMAIL);
  console.log('[ENV] GMAIL_APP_PASSWORD length:', process.env.GMAIL_APP_PASSWORD?.length || 0);
} else {
  console.log('[ENV] .env.local file not found, using default environment');
}

// Force environment logging for debugging
console.log('[ENV] FINAL CHECK:');
console.log('[ENV] GMAIL_EMAIL:', process.env.GMAIL_EMAIL);
console.log('[ENV] GMAIL_APP_PASSWORD_SET:', !!process.env.GMAIL_APP_PASSWORD);
console.log('[ENV] GMAIL_APP_PASSWORD_LENGTH:', process.env.GMAIL_APP_PASSWORD?.length || 0);
console.log('[ENV] DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@'));

// Initialize email service and database AFTER environment is loaded
import "./lib/email-service";

// Timezone configuration removed - Phase cleanup

const app = express();

// Basic express setup - production proxy removed

// Basic CORS Configuration - production config removed
app.use(cors({ 
  origin: true, 
  credentials: true 
}));

// Basic request logging - structured logging removed

// Production security headers removed - Phase cleanup
// Increase payload size limits for comprehensive care plan data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Basic health check for development
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

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
  

  
  // ALL DEMO DATA PROVISIONING COMPLETELY DISABLED
  // NO tenant fixes, NO comprehensive fixes, NO automatic provisioning of ANY kind
  console.log("[ZERO PROVISIONING] All tenant fixes and provisioning COMPLETELY DISABLED");
  console.log("[ZERO PROVISIONING] All new tenants will have absolutely ZERO data");
  console.log("[ZERO PROVISIONING] Users must create everything manually");

  // Composite foreign key functionality removed - Phase cleanup

  // Run enhanced security validation
  console.log("[SECURITY] Running enhanced tenant security checks");
  try {
    await runStartupSecurityChecks();
    console.log("[SECURITY] Enhanced security validation completed successfully");
  } catch (error) {
    console.error("[SECURITY] Enhanced security validation failed:", error);
  }

  // Environment-aware error handling
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    
    // Development: Show detailed errors
    const message = err.message || "Internal Server Error";
    console.error('[DEV ERROR]:', err);
    res.status(status).json({ 
      message,
      stack: err.stack,
      url: req.url,
      method: req.method
    });
  });

  // Environment-aware frontend setup
  if (isDevelopment) {
    console.log("[FRONTEND] Setting up Vite development server");
    await setupVite(app, server);
  } else {
    console.log("[FRONTEND] Setting up static file serving for production");
    serveStatic(app);
  }

  // Health endpoint already registered above

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = Number(process.env.PORT || 5000);
  const host = "0.0.0.0";
  
  server.listen({
    port,
    host,
    reusePort: true,
  }, () => {
    console.log(`[SERVER] CareConnect ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} server started`);
    console.log(`[SERVER] Listening on http://${host}:${port}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[SERVER] Health check: http://${host}:${port}/health`);
    
    if (isDevelopment) {
      console.log(`[DEVELOPMENT] Full debugging enabled`);
      console.log(`[DEVELOPMENT] Permissive CORS for development`);
      console.log(`[DEVELOPMENT] Vite development server active`);
    } else {
      console.log(`[PRODUCTION] Static file serving active`);
      console.log(`[PRODUCTION] Built assets served from dist/public`);
    }
    
    log(`serving on port ${port}`);
  });
})();
