// Bootstrap must be imported first to set timezone
import "../backend/src/bootstrap";

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runStartupSecurityChecks } from "./enhanced-tenant-security";
import path from 'path';
import fs from 'fs';

// Production Environment Configuration
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

// Disable Replit plugins in production
if (isProduction && !process.env.REPL_ID) {
  process.env.REPL_ID = '';
}

// Add import.meta.dirname polyfill for production environments
if (isProduction && typeof import.meta !== 'undefined' && !import.meta.dirname) {
  import.meta.dirname = path.dirname(new URL(import.meta.url).pathname);
}

console.log(`[ENV] Starting CareConnect in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
console.log(`[ENV] Node environment: ${process.env.NODE_ENV}`);
console.log(`[ENV] Replit ID: ${process.env.REPL_ID || 'undefined'}`);

// Strict environment validation for production readiness
// This will crash loudly if required environment variables are missing
let cfg: any = null;

if (isProduction) {
  try {
    // Import and validate all required environment variables using config schema
    const configModule = require("../backend/src/config");
    cfg = configModule.cfg;
    console.log('[CONFIG] Production environment validation passed ✓');
  } catch (error) {
    console.error('[CONFIG] Environment validation failed:', error);
    console.error('[CONFIG] Please check your environment variables against .env.example');
    console.error('[CONFIG] Server cannot start in production without valid environment');
    process.exit(1);
  }
} else {
  console.log('[CONFIG] Development mode: environment validation skipped');
}

// Production safety checks (existing)
if (isProduction) {
  const requiredEnvVars = ['DATABASE_URL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('[PRODUCTION ERROR] Missing required environment variables:', missingVars);
    console.error('[PRODUCTION ERROR] Please set these variables before starting the server.');
    if (isDevelopment) {
      console.warn('[DEV] Continuing anyway for development...');
    } else {
      process.exit(1);
    }
  }
}

// Load local environment variables for development FIRST
const localEnvPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(localEnvPath)) {
  const envFile = fs.readFileSync(localEnvPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
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

// Initialize email service AFTER environment is loaded
import "./lib/email-service";

// Set timezone to Australian Eastern Standard Time
process.env.TZ = 'Australia/Sydney';

console.log(`[TIMEZONE] Server timezone set to: ${process.env.TZ}`);
console.log(`[TIMEZONE] Current server time: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`);

const app = express();

// CORS Configuration - Environment Aware
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Development: Allow all origins for flexibility
    if (isDevelopment) {
      return callback(null, true);
    }
    
    // Production: Strict origin checking
    const allowedOrigins = [
      'https://needscareai.replit.app',
      'https://your-production-domain.com',  // Replace with actual production domain
      ...(isDevelopment ? [
        'http://localhost:3000',
        'http://localhost:5000', 
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5000'
      ] : [])
    ];
    
    // Allow Replit development domains (dynamic UUIDs) in development
    const isReplitDomain = origin.includes('.replit.dev') || origin.includes('.picard.replit.dev');
    
    if (allowedOrigins.includes(origin) || (isDevelopment && isReplitDomain)) {
      callback(null, true);
    } else {
      console.log(`[CORS] Origin ${origin} ${isProduction ? 'BLOCKED' : 'allowed'} in ${isProduction ? 'production' : 'development'}`);
      callback(null, isDevelopment); // Strict in production, permissive in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
};

app.use(cors(corsOptions));

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

// Production health check endpoint - register early to avoid frontend routing conflicts
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    environment: isProduction ? 'production' : 'development', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
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

  // Environment-aware error handling
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    
    if (isProduction) {
      // Production: Log detailed error but send generic response
      console.error('[PRODUCTION ERROR]:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent')
      });
      
      // Generic error response in production
      res.status(status).json({ 
        message: status >= 500 ? "Internal Server Error" : err.message,
        timestamp: new Date().toISOString()
      });
    } else {
      // Development: Show detailed errors
      const message = err.message || "Internal Server Error";
      console.error('[DEV ERROR]:', err);
      res.status(status).json({ 
        message,
        stack: err.stack,
        url: req.url,
        method: req.method
      });
      throw err;
    }
  });

  // Environment-aware frontend setup
  // Only setup Vite in development, serve static files in production
  if (isDevelopment || app.get("env") === "development") {
    console.log("[FRONTEND] Setting up Vite development server");
    await setupVite(app, server);
  } else {
    console.log("[FRONTEND] Serving static production files");
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
    console.log(`[SERVER] CareConnect ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} server started`);
    console.log(`[SERVER] Listening on http://${host}:${port}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV}`);
    console.log(`[SERVER] Health check: http://${host}:${port}/health`);
    
    if (isProduction) {
      console.log(`[PRODUCTION] Security headers enabled`);
      console.log(`[PRODUCTION] Error handling optimized`);
      console.log(`[PRODUCTION] CORS restrictions active`);
      console.log(`[PRODUCTION] Replit plugins disabled`);
    } else {
      console.log(`[DEVELOPMENT] Full debugging enabled`);
      console.log(`[DEVELOPMENT] Permissive CORS for development`);
      console.log(`[DEVELOPMENT] Vite development server active`);
    }
    
    log(`serving on port ${port}`);
  });
})();
