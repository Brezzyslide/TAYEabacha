import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Session configuration optimized for Replit development environment
  const isReplit = !!process.env.REPLIT_CLUSTER;
  
  console.log('[AUTH] Setting up session configuration...');
  console.log('[AUTH] Replit environment detected:', isReplit);
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'careconnect-session-secret-dev-2025',
    resave: false, // Don't force session save - let it be saved when changed
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: false, // Always false for development
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax', // Compatible with Replit
      path: '/' // Ensure cookie works for all paths
    },
    rolling: true, // Reset expiration on each request
    name: 'connect.sid', // Use standard name for better compatibility
    proxy: isReplit // Trust proxy when on Replit
  };
  
  console.log('[AUTH] Session cookie settings:', sessionSettings.cookie);
  console.log('[AUTH] Session proxy trust:', sessionSettings.proxy);
  



  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // CRITICAL: Tenant-safe session validation middleware (DISABLED FOR DEVELOPMENT)
  app.use(async (req, res, next) => {
    try {
      // Skip validation for login/register endpoints to allow session establishment
      if (req.path === '/api/auth/login' || req.path === '/api/auth/register') {
        return next();
      }

      const userId = req.user?.id;
      const tenantId = req.user?.tenantId;

      if (userId && tenantId && req.user?.username) {
        // Only validate if user is fully authenticated
        const user = await storage.getUserByUsernameAndTenant(req.user.username, tenantId);
        if (!user || user.id !== userId) {
          console.log(`[SESSION SECURITY] Invalid session detected for user ${userId}, tenant ${tenantId} - destroying session`);
          req.session.destroy(() => {});
          req.user = undefined;
          return next();
        } else {
          console.log(`[SESSION VALIDATION] User ${user.username} session valid for tenant ${tenantId}`);
        }
      }
    } catch (error) {
      console.error(`[SESSION ERROR] Session validation failed:`, error);
      // Don't destroy session on validation errors, just log and continue
    }
    next();
  });

  // Add enhanced session logging with AWS debugging
  app.use((req, res, next) => {
    if (req.isAuthenticated() && req.user) {
      console.log(`[SESSION] User ${req.user.email || req.user.username} logged in under tenant ${req.user.tenantId}`);
      console.log(`[SESSION DEBUG] Session ID: ${req.sessionID}, Cookie: ${JSON.stringify(req.session.cookie)}`);
    } else if (req.session && req.sessionID) {
      console.log(`[SESSION DEBUG] Unauthenticated request with session ID: ${req.sessionID}`);
    }
    next();
  });

  passport.serializeUser((user, done) => {
    console.log(`[PASSPORT] Serializing user: ${user.id} (${user.username})`);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log(`[PASSPORT] Deserializing user ID: ${id}`);
      const user = await storage.getUser(id);
      if (user) {
        console.log(`[PASSPORT] Verified user: ${user.username} (ID: ${user.id}, Tenant: ${user.tenantId})`);
        done(null, user);
      } else {
        console.log(`[PASSPORT] User ${id} not found during deserialization`);
        done(null, false);
      }
    } catch (error: any) {
      console.error(`[PASSPORT] Deserialization error for user ${id}:`, error);
      // Handle database connection issues gracefully during startup
      if (error.code === '57P03' || error.message?.includes('database system is not yet accepting connections')) {
        console.log(`[PASSPORT] Database initializing, user ${id} will need to re-authenticate`);
        done(null, false);
      } else {
        done(error, null);
      }
    }
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error: any) {
        // Handle database connection issues gracefully during startup
        console.error('[AUTH ERROR] Database connection failed during login:', error.message);
        if (error.code === '57P03' || error.message?.includes('database system is not yet accepting connections')) {
          return done(null, false, { message: 'Database is initializing. Please try again in a moment.' });
        }
        return done(error);
      }
    }),
  );

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error: any) {
      console.error('[REGISTER ERROR] Database connection failed during registration:', error.message);
      if (error.code === '57P03' || error.message?.includes('database system is not yet accepting connections')) {
        return res.status(503).json({ message: 'Database is initializing. Please try again in a moment.' });
      }
      return next(error);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    console.log("[LOGIN] Login attempt:", {
      username: req.body.username,
      hasPassword: !!req.body.password,
      sessionID: req.sessionID,
      userAgent: req.get('User-Agent')
    });
    
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("[LOGIN] Authentication error:", err);
        return next(err);
      }
      
      if (!user) {
        console.log("[LOGIN] Authentication failed:", info);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      req.login(user, async (loginErr) => {
        if (loginErr) {
          console.error("[LOGIN] Login error:", loginErr);
          return next(loginErr);
        }
        
        // CRITICAL: Verify user belongs to claimed tenant before completing login
        const tenantVerification = await storage.getUserByUsernameAndTenant(user.username, user.tenantId);
        if (!tenantVerification || tenantVerification.id !== user.id) {
          console.error(`[LOGIN SECURITY] TENANT MISMATCH: User ${user.username} failed tenant verification`);
          req.session.destroy(() => {});
          return res.status(401).json({ error: "Authentication failed" });
        }
        
        console.log(`[LOGIN] ✅ Tenant verification passed for ${user.username} in tenant ${user.tenantId}`);
        console.log("[LOGIN] Login successful:", { userId: user.id, username: user.username, tenantId: user.tenantId });
        
        // Log session details for security monitoring
        await storage.createActivityLog({
          userId: user.id,
          tenantId: user.tenantId,
          action: 'login',
          resourceType: 'session',
          resourceId: user.id,
          description: `User ${user.username} logged in successfully`
        });
        
        // Save session explicitly to ensure persistence
        req.session.save((err) => {
          if (err) {
            console.error("[LOGIN] Session save error:", err);
            return res.status(500).json({ error: "Session save failed" });
          } else {
            console.log("[LOGIN] Session saved successfully");
          }
          
          res.status(200).json(user);
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    console.log(`[LOGOUT] User ${req.user?.id} logging out, Session ID: ${req.sessionID}`);
    
    req.logout((err) => {
      if (err) {
        console.error("[LOGOUT] Error during logout:", err);
        return next(err);
      }
      
      // Destroy session for complete logout
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("[LOGOUT] Session destruction error:", destroyErr);
        } else {
          console.log("[LOGOUT] Session destroyed successfully");
        }
        
        res.clearCookie('needscareai.sid', {
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'lax'
        });
        
        res.sendStatus(200);
      });
    });
  });

  app.get("/api/auth/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user as any;
      // Get company information for the user's tenant
      const company = await storage.getCompanyByTenantId(user.tenantId);
      
      const userWithCompany = {
        ...user,
        companyName: company?.name || 'CareConnect'
      };
      
      res.json(userWithCompany);
    } catch (error) {
      console.error('Error fetching user with company info:', error);
      res.json(req.user);
    }
  });

  // Add the /api/auth/user endpoint that the frontend expects
  app.get("/api/auth/user", async (req, res) => {
    console.log("[AUTH] User endpoint called:", {
      isAuthenticated: req.isAuthenticated(),
      sessionID: req.sessionID,
      hasUser: !!req.user,
      userAgent: req.get('User-Agent')
    });
    
    if (!req.isAuthenticated()) {
      console.log("[AUTH] User not authenticated");
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const user = req.user as any;
      console.log("[AUTH] User found:", { id: user.id, username: user.username, tenantId: user.tenantId });
      
      // Get company information for the user's tenant
      const company = await storage.getCompanyByTenantId(user.tenantId);
      
      const userWithCompany = {
        ...user,
        companyName: company?.name || 'NeedsCareAI+'
      };
      
      res.json(userWithCompany);
    } catch (error: any) {
      console.error('[AUTH] Error fetching user with company info:', {
        message: error.message,
        stack: error.stack
      });
      res.json(req.user);
    }
  });

  // AWS DEBUGGING: Session troubleshooting endpoint
  app.get("/api/debug/session", (req: any, res) => {
    console.log("[SESSION DEBUG] Full session troubleshooting:");
    console.log("  Session ID:", req.sessionID);
    console.log("  Is Authenticated:", req.isAuthenticated());
    console.log("  Session Data:", req.session);
    console.log("  User Object:", req.user);
    console.log("  Request Headers:", req.headers);
    console.log("  Cookies:", req.cookies);
    
    res.json({
      sessionId: req.sessionID,
      isAuthenticated: req.isAuthenticated(),
      hasUser: !!req.user,
      sessionKeys: Object.keys(req.session || {}),
      userAgent: req.get('User-Agent'),
      host: req.get('Host'),
      origin: req.get('Origin'),
      referer: req.get('Referer'),
      cookies: req.cookies,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        appBaseUrl: process.env.APP_BASE_URL,
        hasSessionSecret: !!process.env.SESSION_SECRET
      }
    });
  });
}
