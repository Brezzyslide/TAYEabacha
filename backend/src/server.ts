// Production backend entry point
// Bootstrap must be imported first to set timezone
import "../../backend/src/bootstrap";

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "../../server/routes";
import { logger, requestLoggingMiddleware } from "../../server/logger";
import path from 'path';
import fs from 'fs';

// Production Environment Configuration
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

// Disable Replit plugins in production
if (isProduction && !process.env.REPL_ID) {
  process.env.REPL_ID = '';
}

console.log(`[ENV] Starting CareConnect in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
console.log(`[ENV] Node environment: ${process.env.NODE_ENV}`);

// Strict environment validation for production readiness
let cfg: any = null;

try {
  // Import and validate all required environment variables using config schema
  const configModule = require("../../backend/src/config");
  cfg = configModule.cfg;
  console.log('[CONFIG] Environment validation passed ✓');
} catch (error) {
  if (isProduction) {
    console.error('[CONFIG] Environment validation failed:', error);
    console.error('[CONFIG] Please check your environment variables against .env.example');
    console.error('[CONFIG] Server cannot start in production without valid environment');
    process.exit(1);
  } else {
    console.log('[CONFIG] Development mode: using fallback config');
    cfg = {
      APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:5000',
      CORS_ORIGINS: process.env.CORS_ORIGINS,
      NODE_ENV: process.env.NODE_ENV || 'development'
    };
  }
}

// Load local environment variables for development FIRST
const localEnvPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(localEnvPath) && isDevelopment) {
  const envFile = fs.readFileSync(localEnvPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
  console.log('[ENV] Loaded local environment variables');
}

// Initialize email service AFTER environment is loaded
if (isDevelopment) {
  import("../../server/lib/email-service");
}

// Set timezone to Australian Eastern Standard Time
process.env.TZ = 'Australia/Sydney';
console.log(`[TIMEZONE] Server timezone set to: ${process.env.TZ}`);
console.log(`[TIMEZONE] Current server time: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`);

const app = express();

// Trust proxy for proper HTTPS detection in production
app.set("trust proxy", 1);

// CORS Configuration using validated config
const origins = (cfg.CORS_ORIGINS ?? cfg.APP_BASE_URL).split(",").map((s: string) => s.trim());
console.log('[CORS] Allowed origins:', origins);

app.use(cors({ 
  origin: origins, 
  credentials: true 
}));

// Request logging middleware with structured JSON logging
app.use(requestLoggingMiddleware);

// Production Security Headers
if (isProduction) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Security headers for production
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Hide server information in production
    res.removeHeader('X-Powered-By');
    
    next();
  });
  
  console.log('[SECURITY] Production security headers enabled');
}

// Increase payload size limits for comprehensive care plan data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Health check endpoint (including /healthz alias for Kubernetes)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    version: '1.0.0',
    environment: isProduction ? 'production' : 'development',
    timestamp: new Date().toISOString()
  });
});

app.get('/healthz', (req: Request, res: Response) => {
  res.json({
    ok: true,
    uptime: process.uptime(), 
    version: '1.0.0'
  });
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Serve built frontend static files in production
if (isProduction) {
  const frontendPath = path.join(process.cwd(), 'dist', 'public');
  console.log(`[STATIC] Serving frontend from: ${frontendPath}`);
  app.use(express.static(frontendPath));
  
  // Catch-all handler for client-side routing
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    // Skip API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path === '/health' || req.path === '/healthz') {
      return next();
    }
    
    // Serve index.html for all other routes (SPA routing)
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error('[STATIC] Frontend build not found at:', frontendPath);
      res.status(404).json({ error: 'Frontend build not found. Run npm run build:frontend first.' });
    }
  });
}

(async () => {
  const server = await registerRoutes(app);

  // DEMO DATA PROVISIONING COMPLETELY DISABLED
  console.log("[MULTI-TENANT FIX] ALL DEMO DATA PROVISIONING PERMANENTLY DISABLED");
  console.log("[MULTI-TENANT FIX] New tenants start completely clean - no automatic data creation");
  console.log("[MULTI-TENANT FIX] Users must create all their own data (clients, shifts, etc.)");

  // ALL DEMO DATA PROVISIONING COMPLETELY DISABLED
  console.log("[ZERO PROVISIONING] All tenant fixes and provisioning COMPLETELY DISABLED");
  console.log("[ZERO PROVISIONING] All new tenants will have absolutely ZERO data");
  console.log("[ZERO PROVISIONING] Users must create everything manually");

  // Apply composite foreign key constraints for database-level tenant isolation
  console.log("[COMPOSITE FK] Applying database-level tenant isolation constraints");
  try {
    const { applyCompositeForeignKeys } = await import('../../server/apply-composite-foreign-keys');
    await applyCompositeForeignKeys();
    console.log("[COMPOSITE FK] Database-level tenant isolation enabled successfully");
  } catch (error) {
    console.error("[COMPOSITE FK] Failed to apply composite foreign keys:", error);
    // Don't fail startup - continue with application-level protection
  }

  // Enhanced security startup validation
  console.log("[SECURITY] Running enhanced tenant security checks");
  try {
    const { runStartupSecurityChecks } = await import('../../server/enhanced-tenant-security');
    await runStartupSecurityChecks();
    console.log("[SECURITY] Enhanced security validation completed successfully");
  } catch (error) {
    console.error("[SECURITY] Enhanced security check failed:", error);
    // Don't fail startup - log error and continue
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  
  server.listen(port, "0.0.0.0", () => {
    console.log(`[SERVER] CareConnect ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} server started`);
    console.log(`[SERVER] Listening on http://0.0.0.0:${port}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV}`);
    console.log(`[SERVER] Health check: http://0.0.0.0:${port}/health`);
    
    if (isProduction) {
      console.log('[PRODUCTION] Static frontend served from /dist/public');
      console.log('[PRODUCTION] All routes fall back to index.html for SPA routing');
    } else {
      console.log('[DEVELOPMENT] Frontend development server should be running separately');
    }
  });
})();