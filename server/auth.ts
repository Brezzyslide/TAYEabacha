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
  // AWS Production Session Configuration
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log(`[AUTH CONFIG] Environment: ${process.env.NODE_ENV}`);
  console.log(`[AUTH CONFIG] Session store type: ${storage.sessionStore.constructor.name}`);
  console.log(`[AUTH CONFIG] Production mode: ${isProduction}`);
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'fallback-session-secret-for-dev',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore, // Using PostgreSQL session store
    cookie: {
      secure: isProduction, // HTTPS only in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: isProduction ? 'none' : 'lax', // 'none' required for cross-origin in production
      domain: undefined // Let browser determine domain
    },
    rolling: true, // Extends session on activity
    name: 'needscareai.sid', // Custom session name
    proxy: isProduction // Trust proxy headers in production (AWS ALB)
  };
  
  console.log(`[AUTH CONFIG] Cookie settings:`, {
    secure: sessionSettings.cookie?.secure,
    sameSite: sessionSettings.cookie?.sameSite,
    httpOnly: sessionSettings.cookie?.httpOnly,
    maxAge: sessionSettings.cookie?.maxAge
  });

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // CRITICAL: Tenant-safe session validation middleware
  app.use(async (req, res, next) => {
    const userId = req.session?.userId || req.user?.id;
    const tenantId = req.session?.tenantId || req.user?.tenantId;

    if (userId && tenantId) {
      // Verify user still exists and belongs to correct tenant  
      const user = await storage.getUserByUsernameAndTenant(req.user?.username || '', tenantId);
      if (!user || user.id !== userId) {
        console.log(`[SESSION SECURITY] Invalid session detected for user ${userId}, tenant ${tenantId} - destroying session`);
        req.session.destroy(() => {});
        return next();
      } else {
        req.user = user;
      }
    }
    next();
  });

  // Add enhanced session logging
  app.use((req, res, next) => {
    if (req.isAuthenticated() && req.user) {
      console.log(`[SESSION] User ${req.user.email} logged in under tenant ${req.user.tenantId}`);
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
    } catch (error) {
      console.error(`[PASSPORT] Deserialization error for user ${id}:`, error);
      done(error, null);
    }
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  app.post("/api/register", async (req, res, next) => {
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
  });

  app.post("/api/login", (req, res, next) => {
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
          description: `User ${user.username} logged in successfully`,
          timestamp: new Date()
        });
        
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
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
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });
        
        res.sendStatus(200);
      });
    });
  });

  app.get("/api/user", async (req, res) => {
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
}
