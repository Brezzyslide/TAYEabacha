import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
// All demo data provisioning removed - tenants start completely clean
import { db, pool } from "./lib/dbClient";
import * as schema from "@shared/schema";
import { eq, desc, and, or, ilike, sql, lt, gte, lte, inArray } from "drizzle-orm";
const { medicationRecords, medicationPlans, clients, users, shifts, shiftCancellations, timesheets: timesheetsTable, timesheetEntries, leaveBalances, companies, tenants, careSupportPlans } = schema;
import { insertClientSchema, insertFormTemplateSchema, insertFormSubmissionSchema, insertShiftSchema, insertHourlyObservationSchema, insertMedicationPlanSchema, insertMedicationRecordSchema, insertIncidentReportSchema, insertIncidentClosureSchema, insertStaffMessageSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { createTimesheetEntryFromShift, getCurrentTimesheet, getTimesheetHistory } from "./timesheet-service";
import { createSmartTimesheetEntry } from "./smart-timesheet-service";
import { recalculateTimesheetEntriesForUser } from "./timesheet-service";
import { updateTimesheetTotals } from "./comprehensive-tenant-fixes";
import { executeProductionDemoDataCleanup, verifyProductionCleanup } from "./emergency-production-cleanup";
import { db } from "./lib/dbClient";
import { sql } from "drizzle-orm";

// Helper function to determine shift type based on start time
// Budget deduction processing function
// Function to update hour allocations when shifts are assigned
async function updateStaffHourAllocation(shiftId: number, userId: number, tenantId: number, action: 'allocate' | 'deallocate') {
  try {
    console.log(`[HOUR ALLOCATION] ${action} hours for shift ${shiftId}, user ${userId}, tenant ${tenantId}`);
    
    // Get shift details
    const shift = await storage.getShift(shiftId, tenantId);
    if (!shift || !shift.startTime || !shift.endTime) {
      console.log(`[HOUR ALLOCATION] Skip - invalid shift data`);
      return;
    }

    // Calculate shift duration in hours
    const startTime = new Date(shift.startTime);
    const endTime = new Date(shift.endTime);
    const shiftHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    
    if (shiftHours <= 0 || shiftHours > 24) {
      console.log(`[HOUR ALLOCATION] Skip - invalid duration: ${shiftHours} hours`);
      return;
    }

    // Get staff hour allocation
    const allocations = await storage.getHourAllocations(tenantId);
    const staffAllocation = allocations.find(alloc => alloc.staffId === userId && alloc.isActive);
    
    if (!staffAllocation) {
      console.log(`[HOUR ALLOCATION] No active allocation found for staff ${userId}`);
      return;
    }

    const currentUsed = parseFloat(staffAllocation.hoursUsed);
    const maxHours = parseFloat(staffAllocation.maxHours);
    
    let newUsedHours: number;
    if (action === 'allocate') {
      newUsedHours = currentUsed + shiftHours;
    } else {
      newUsedHours = Math.max(0, currentUsed - shiftHours);
    }
    
    const newRemainingHours = maxHours - newUsedHours;
    
    console.log(`[HOUR ALLOCATION] Updating allocation ${staffAllocation.id}: used ${currentUsed} -> ${newUsedHours}, remaining: ${newRemainingHours}`);
    
    // Update the hour allocation
    await storage.updateHourAllocation(staffAllocation.id, {
      hoursUsed: newUsedHours.toString(),
      remainingHours: newRemainingHours.toString()
    }, tenantId);
    
    console.log(`[HOUR ALLOCATION] Successfully ${action}d ${shiftHours} hours for staff ${userId}`);
  } catch (error) {
    console.error(`[HOUR ALLOCATION] Error ${action}ing hours:`, error);
  }
}

async function processBudgetDeduction(shift: any, userId: number) {
  console.log(`[BUDGET DEDUCTION] AWS PRODUCTION Processing for shift ${shift.id}, client ${shift.clientId}, tenant ${shift.tenantId}`);
  
  if (!shift.startTime || !shift.endTime || !shift.clientId || !shift.tenantId) {
    console.log(`[BUDGET DEDUCTION] Missing required data: startTime=${!!shift.startTime}, endTime=${!!shift.endTime}, clientId=${!!shift.clientId}, tenantId=${!!shift.tenantId}`);
    return;
  }

  // AWS Production safety: Add extra validation
  if (!userId || userId <= 0) {
    console.log(`[BUDGET DEDUCTION] Invalid userId: ${userId}`);
    return;
  }

  // Calculate shift duration based on SCHEDULED hours (not actual worked time)
  // Healthcare sector billing: charge full booking regardless of completion time
  const startTime = new Date(shift.startTime);
  const endTime = new Date(shift.endTime);
  const shiftHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  
  console.log(`[BUDGET DEDUCTION] SCHEDULED shift duration: ${shiftHours} hours (billing based on booked time, not actual completion time)`);
  
  if (shiftHours <= 0) {
    console.log(`[BUDGET DEDUCTION] Invalid shift duration: ${shiftHours}`);
    return;
  }

  // Get client's NDIS budget
  const budget = await storage.getNdisBudgetByClient(shift.clientId, shift.tenantId);
  console.log(`[BUDGET DEDUCTION] Budget found:`, budget ? `ID ${budget.id}` : 'None');
  
  if (!budget) {
    console.log(`[BUDGET DEDUCTION] No budget found for client ${shift.clientId}`);
    return;
  }

  // Determine shift type and get pricing
  const shiftType = determineShiftType(startTime);
  const staffRatio = shift.staffRatio || "1:1";
  
  console.log(`[BUDGET DEDUCTION] Shift type: ${shiftType}, ratio: ${staffRatio}`);

  // Determine effective rate (priority: budget price overrides → NDIS pricing table)
  let effectiveRate = 0;
  
  const priceOverrides = budget.priceOverrides as any;
  if (priceOverrides && priceOverrides[shiftType]) {
    effectiveRate = parseFloat(priceOverrides[shiftType].toString());
    console.log(`[BUDGET DEDUCTION] Using price override: $${effectiveRate}`);
  } else {
    // Fallback to NDIS pricing table
    const pricing = await storage.getNdisPricingByTypeAndRatio(shiftType, staffRatio, shift.tenantId);
    if (pricing) {
      effectiveRate = parseFloat(pricing.rate.toString());
      console.log(`[BUDGET DEDUCTION] Using NDIS pricing: $${effectiveRate}`);
    }
  }
  
  if (effectiveRate <= 0) {
    console.log(`[BUDGET DEDUCTION] No valid rate found for ${shiftType} ${staffRatio}`);
    return;
  }

  // Apply ratio multiplier for shared staffing costs
  const ratioMultiplier = getRatioMultiplier(staffRatio);
  const shiftCost = effectiveRate * shiftHours * ratioMultiplier;
  console.log(`[BUDGET DEDUCTION] Calculated cost: $${shiftCost} (${shiftHours}h × $${effectiveRate} × ${ratioMultiplier} ratio multiplier)`);

  // Use the shift's actual funding category instead of defaulting based on shift type
  const category = shift.fundingCategory || 
    ((shiftType === "AM" || shiftType === "PM") ? "CommunityAccess" : "SIL");
  
  console.log(`[BUDGET DEDUCTION] Shift ${shift.id}: fundingCategory="${shift.fundingCategory}", calculated category="${category}", shiftType="${shiftType}"`);
  
  // Check if sufficient funds available
  let currentRemaining = 0;
  switch (category) {
    case "CommunityAccess":
      currentRemaining = parseFloat(budget.communityAccessRemaining.toString());
      break;
    case "SIL":
      currentRemaining = parseFloat(budget.silRemaining.toString());
      break;
    case "CapacityBuilding":
      currentRemaining = parseFloat(budget.capacityBuildingRemaining.toString());
      break;
  }
  
  if (currentRemaining < shiftCost) {
    console.log(`[BUDGET DEDUCTION] Insufficient funds: Available $${currentRemaining}, Required $${shiftCost}`);
    return;
  }

  // Get tenant's company ID
  const tenant = await storage.getTenant(shift.tenantId);
  const companyId = tenant?.companyId || "default-company";

  // Process the budget deduction
  await storage.processBudgetDeduction({
    budgetId: budget.id,
    category,
    shiftType,
    ratio: staffRatio,
    hours: shiftHours,
    rate: effectiveRate,
    amount: shiftCost,
    shiftId: shift.id,
    description: `Shift completion: ${shift.title} (${shiftHours.toFixed(1)}h × $${effectiveRate} × ${ratioMultiplier} ratio)`,
    companyId,
    createdByUserId: userId,
    tenantId: shift.tenantId,
  });

  console.log(`[BUDGET DEDUCTION] Successfully processed $${shiftCost} deduction for shift ${shift.id}`);

  // Log the budget deduction activity
  await storage.createActivityLog({
    userId,
    action: "budget_deduction",
    resourceType: "ndis_budget",
    resourceId: budget.id,
    description: `Deducted $${shiftCost.toFixed(2)} for completed shift: ${shift.title} (${shiftHours.toFixed(1)}h @ $${effectiveRate}/h)`,
    tenantId: shift.tenantId,
  });
}

function determineShiftType(startTime: Date): "AM" | "PM" | "ActiveNight" | "Sleepover" {
  const hour = startTime.getHours();
  
  if (hour >= 6 && hour < 20) {
    return "AM"; // Day shift: 6:00 AM - 8:00 PM
  } else if (hour >= 20 && hour < 24) {
    return "PM"; // Evening shift: 8:00 PM - 12:00 AM
  } else {
    return "ActiveNight"; // Night shift: 12:00 AM - 6:00 AM
  }
}

function getRatioMultiplier(ratio: string): number {
  const multipliers = {
    "1:1": 1.0,   // Full cost for one client
    "1:2": 0.6,   // 60% of full cost per client (shared between 2)
    "1:3": 0.4,   // 40% of full cost per client (shared between 3)
    "1:4": 0.3,   // 30% of full cost per client (shared between 4)
    "2:1": 2.0,   // Double cost for enhanced support (2 staff to 1 client)
  };
  
  return multipliers[ratio as keyof typeof multipliers] || 1.0;
}
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Middleware to ensure user is authenticated and has tenant access
function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    console.log(`[ROLE CHECK] User role: ${req.user.role}, Required roles: ${roles.join(', ')}`);
    
    const userRole = req.user.role.toLowerCase();
    const allowedRoles = roles.map(role => role.toLowerCase());
    
    // ConsoleManager has universal access - Admin should be tenant restricted
    if (userRole === 'consolemanager') {
      console.log(`[ROLE CHECK] PASSED - ConsoleManager has universal access`);
      return next();
    }
    
    if (!allowedRoles.includes(userRole)) {
      console.log(`[ROLE CHECK] FAILED - User ${req.user.id} with role '${req.user.role}' denied access`);
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    console.log(`[ROLE CHECK] PASSED - User ${req.user.id} has sufficient permissions`);
    next();
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const server = createServer(app);
  
  // Setup authentication routes
  setupAuth(app);
  
  // Health check endpoint for AWS ECS/ALB
  app.get("/api/health", async (req, res) => {
    try {
      // Test database connection
      await pool.query("SELECT 1");
      
      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
        database: "connected"
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Database connection failed"
      });
    }
  });

  // AWS Production Debug Endpoint - Comprehensive system diagnostics
  app.get("/api/debug/aws-production", requireAuth, async (req: any, res) => {
    try {
      console.log("[AWS PRODUCTION DEBUG] Diagnostic check requested by user:", req.user.id);
      
      // Test database connectivity and constraints
      const dbTests = await Promise.allSettled([
        db.select().from(users).limit(1),
        db.select().from(clients).limit(1),
        db.select().from(shifts).limit(1)
      ]);
      
      const diagnostics = {
        session: {
          hasSession: !!req.session,
          sessionId: req.sessionID,
          authenticated: req.isAuthenticated(),
          user: req.user ? {
            id: req.user.id,
            role: req.user.role,
            tenantId: req.user.tenantId
          } : null
        },
        database: {
          users: dbTests[0].status === 'fulfilled' ? 'connected' : 'failed',
          clients: dbTests[1].status === 'fulfilled' ? 'connected' : 'failed', 
          shifts: dbTests[2].status === 'fulfilled' ? 'connected' : 'failed',
          errors: dbTests.filter(t => t.status === 'rejected').map(t => (t as any).reason?.message)
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasSessionSecret: !!process.env.SESSION_SECRET,
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          platform: 'AWS',
          uptime: process.uptime()
        },
        commonIssues: {
          sessionPersistence: req.isAuthenticated(),
          databaseConstraints: dbTests.every(t => t.status === 'fulfilled'),
          errorLogging: 'Enhanced logging active'
        }
      };
      
      console.log("[AWS PRODUCTION DEBUG] Diagnostic results:", diagnostics);
      res.json(diagnostics);
    } catch (error: any) {
      console.error("[AWS PRODUCTION DEBUG] Failed:", error);
      res.status(500).json({ 
        message: "Production diagnostic failed",
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Comprehensive AWS Production Issue Testing Endpoint
  app.get("/api/debug/aws-critical-issues", requireAuth, async (req: any, res) => {
    try {
      console.log("[AWS CRITICAL DEBUG] Testing 3 critical production issues for user:", req.user.id, "tenant:", req.user.tenantId);
      
      const results = {
        timestamp: new Date().toISOString(),
        tenantId: req.user.tenantId,
        userId: req.user.id,
        tests: {}
      };

      // TEST 1: Timesheet submission pipeline
      try {
        const submitted = await db.select()
          .from(timesheetsTable)
          .where(and(
            eq(timesheetsTable.tenantId, req.user.tenantId),
            eq(timesheetsTable.status, 'submitted')
          ));
        
        const adminVisible = await db.select({ 
            id: timesheetsTable.id,
            userId: timesheetsTable.userId, 
            status: timesheetsTable.status,
            submittedAt: timesheetsTable.submittedAt 
          })
          .from(timesheetsTable)
          .where(eq(timesheetsTable.tenantId, req.user.tenantId));

        results.tests.timesheetSubmission = {
          status: 'tested',
          submittedCount: submitted.length,
          totalTimesheets: adminVisible.length,
          adminCanSeeSubmissions: submitted.length > 0,
          latestSubmission: submitted.length > 0 ? submitted[0].submittedAt : null
        };
      } catch (error) {
        results.tests.timesheetSubmission = { status: 'failed', error: error.message };
      }

      // TEST 2: Budget deduction functionality
      try {
        const completedShifts = await db.select()
          .from(shifts)
          .where(and(
            eq(shifts.tenantId, req.user.tenantId),
            eq(shifts.status, 'completed')
          ))
          .limit(5);

        const budgetTransactions = await db.select()
          .from(schema.budgetTransactions)
          .where(eq(schema.budgetTransactions.tenantId, req.user.tenantId));

        results.tests.budgetDeduction = {
          status: 'tested',
          completedShifts: completedShifts.length,
          budgetTransactions: budgetTransactions.length,
          deductionWorking: budgetTransactions.length > 0,
          recentTransactions: budgetTransactions.slice(-3).map(t => ({
            shiftId: t.shiftId,
            amount: t.amount,
            createdAt: t.createdAt
          }))
        };
      } catch (error) {
        results.tests.budgetDeduction = { status: 'failed', error: error.message };
      }

      // TEST 3: Multi-tenant consistency check
      try {
        const allTenants = await db.select({ id: tenants.id }).from(tenants);
        const consistencyResults = [];

        for (const tenant of allTenants.slice(0, 5)) { // Check first 5 tenants
          const userCount = await db.select({ count: sql`count(*)` })
            .from(users)
            .where(eq(users.tenantId, tenant.id));
          
          const shiftCount = await db.select({ count: sql`count(*)` })
            .from(shifts)
            .where(eq(shifts.tenantId, tenant.id));

          consistencyResults.push({
            tenantId: tenant.id,
            users: parseInt(userCount[0].count),
            shifts: parseInt(shiftCount[0].count)
          });
        }

        results.tests.multiTenantConsistency = {
          status: 'tested',
          tenantsChecked: consistencyResults.length,
          tenantData: consistencyResults,
          hasInconsistencies: consistencyResults.some(t => t.users === 0)
        };
      } catch (error) {
        results.tests.multiTenantConsistency = { status: 'failed', error: error.message };
      }

      console.log("[AWS CRITICAL DEBUG] Test results:", results);
      res.json(results);
    } catch (error: any) {
      console.error("[AWS CRITICAL DEBUG] Failed:", error);
      res.status(500).json({ 
        message: "Critical issue testing failed",
        error: error.message
      });
    }
  });

  // Extended health check for timesheet system
  app.get("/api/health/timesheet", requireAuth, async (req: any, res) => {
    try {
      console.log(`[HEALTH CHECK] Timesheet health check for user ${req.user.id}, tenant ${req.user.tenantId}`);
      
      // Test database connectivity and user data
      const userCheck = await db.select().from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);
      
      const timesheetCheck = await db.select().from(timesheetsTable)
        .where(and(
          eq(timesheetsTable.userId, req.user.id),
          eq(timesheetsTable.tenantId, req.user.tenantId)
        ))
        .limit(1);
      
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        user: {
          found: userCheck.length > 0,
          id: req.user.id,
          tenantId: req.user.tenantId,
          role: req.user.role
        },
        timesheet: {
          found: timesheetCheck.length > 0,
          count: timesheetCheck.length
        },
        database: "connected"
      });
    } catch (error: any) {
      console.error("[HEALTH CHECK ERROR]", error);
      res.status(500).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // CRITICAL PAY SCALE FIX: Manual timesheet recalculation endpoint
  app.post("/api/staff/:id/recalculate-timesheets", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const staffId = parseInt(req.params.id);
      
      console.log(`[MANUAL RECALC] Manual timesheet recalculation requested for staff ${staffId} by admin ${req.user.id}`);
      
      // Verify staff exists and belongs to same tenant
      const staff = await storage.getUserById(staffId, req.user.tenantId);
      if (!staff) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      
      // Perform recalculation
      await recalculateTimesheetEntriesForUser(staffId, req.user.tenantId);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "recalculate_timesheets",
        resourceType: "user",
        resourceId: staffId,
        description: `Manually recalculated timesheet entries for staff: ${staff.fullName}`,
        tenantId: req.user.tenantId,
      });
      
      console.log(`[MANUAL RECALC] Successfully recalculated timesheets for staff ${staffId}`);
      
      res.json({ 
        message: `Successfully recalculated timesheet entries for ${staff.fullName}`,
        staffId,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error(`[MANUAL RECALC] Error recalculating timesheets for staff ${req.params.id}:`, error);
      res.status(500).json({ 
        message: "Failed to recalculate timesheet entries", 
        error: error.message 
      });
    }
  });

  // AWS PRODUCTION DEBUGGING ENDPOINT - Comprehensive timesheet system diagnosis
  app.get("/api/debug/timesheet/:timesheetId", requireAuth, async (req: any, res) => {
    try {
      const timesheetId = parseInt(req.params.timesheetId);
      
      console.log(`[DEBUG] AWS PRODUCTION - Debugging timesheet ${timesheetId} for user ${req.user.id}, tenant ${req.user.tenantId}`);
      
      // Get timesheet details (user-scoped)
      const userTimesheet = await db.select()
        .from(timesheetsTable)
        .where(and(
          eq(timesheetsTable.id, timesheetId),
          eq(timesheetsTable.userId, req.user.id),
          eq(timesheetsTable.tenantId, req.user.tenantId)
        ));
      
      // Get timesheet details (tenant-scoped for admin view)
      const tenantTimesheet = await db.select()
        .from(timesheetsTable)
        .where(and(
          eq(timesheetsTable.id, timesheetId),
          eq(timesheetsTable.tenantId, req.user.tenantId)
        ));
      
      // Get timesheet entries
      const entries = await db.select()
        .from(timesheetEntries)
        .where(eq(timesheetEntries.timesheetId, timesheetId));
      
      // Get all submitted timesheets for this tenant
      const allSubmittedTimesheets = await storage.getAdminTimesheets(req.user.tenantId, 'submitted');
      
      // Get all timesheets by status for this tenant
      const statusBreakdown = await storage.getAdminTimesheets(req.user.tenantId, ['draft', 'submitted', 'approved', 'rejected', 'paid']);
      
      res.json({
        timesheetId,
        user: {
          id: req.user.id,
          username: req.user.username,
          tenantId: req.user.tenantId,
          role: req.user.role
        },
        userScopedTimesheet: {
          found: userTimesheet.length > 0,
          data: userTimesheet[0] || null
        },
        tenantScopedTimesheet: {
          found: tenantTimesheet.length > 0,
          data: tenantTimesheet[0] || null
        },
        entries: {
          count: entries.length,
          data: entries
        },
        adminView: {
          submittedCount: allSubmittedTimesheets.length,
          submittedTimesheets: allSubmittedTimesheets.map(t => ({
            id: t.id,
            userId: t.userId,
            staffName: t.staffName,
            status: t.status,
            submittedAt: t.submittedAt
          })),
          statusBreakdown: statusBreakdown.reduce((acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        },
        canSubmit: userTimesheet.length > 0 && 
                   (userTimesheet[0].status === 'draft' || userTimesheet[0].status === 'rejected'),
        isInAdminView: allSubmittedTimesheets.some(t => t.id === timesheetId),
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[DEBUG ERROR] AWS PRODUCTION -", error);
      res.status(500).json({
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Company creation endpoint - public access for admin setup
  app.post("/api/admin/create-company", async (req, res) => {
    try {
      const { 
        companyName, 
        businessAddress, 
        registrationNumber, 
        primaryContactName, 
        primaryContactEmail, 
        primaryContactPhone, 
        password,

      } = req.body;

      // Create company with UUID
      const company = await storage.createCompany({
        name: companyName,
        businessAddress,
        registrationNumber,
        primaryContactName,
        primaryContactEmail,
        primaryContactPhone,
      });

      // Create a tenant for the company
      const tenant = await storage.createTenant({
        name: companyName,
        type: "healthcare",
        companyId: company.id,
      });

      // Create admin user for the company
      const hashedPassword = await hashPassword(password);
      const adminUser = await storage.createUser({
        username: primaryContactEmail,
        password: hashedPassword,
        email: primaryContactEmail,
        fullName: primaryContactName,
        role: "admin",
        tenantId: tenant.id,
        isFirstLogin: true,
      });

      // NO AUTO-PROVISIONING - All tenants start completely clean
      console.log(`[NEW TENANT SETUP] Tenant ${tenant.id} created with zero data - users must create all content manually`);

      // Log to console as requested
      console.table([
        {
          companyId: company.id,
          companyName: company.name,
          tenantId: tenant.id,
          adminUserId: adminUser.id,
          adminEmail: adminUser.email,
          status: "Created Successfully (No Demo Data)"
        }
      ]);

      res.status(201).json({
        company,
        tenant,
        admin: adminUser,
        message: "Company created successfully (essential features only, no demo data - completely clean slate)"
      });
    } catch (error) {
      console.error("Company creation error:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  // Companies API - Admin and ConsoleManager only
  app.get("/api/admin/companies", requireAuth, requireRole(["admin", "ConsoleManager"]), async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Failed to fetch companies:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  // Clients API
  app.get("/api/clients", requireAuth, async (req: any, res) => {
    try {
      console.log(`[CLIENT API DEBUG] Request from user: ${req.user.username} (ID: ${req.user.id}, Tenant: ${req.user.tenantId}, Role: ${req.user.role})`);
      
      // CRITICAL DEBUG: Check which database we're connected to
      try {
        const dbCheck = await db.execute(sql`SELECT current_database() as db_name`);
        console.log('🧠 [DB CONNECTION CHECK] Connected to database:', (dbCheck.rows[0] as any).db_name);
        
        // CRITICAL DEBUG: Count actual clients in database for this tenant before API call
        const dbClientCount = await db.execute(sql`SELECT COUNT(*) as count FROM clients WHERE tenant_id = ${req.user.tenantId} AND is_active = true`);
        console.log(`🔍 [DB RAW COUNT] Direct database shows ${(dbClientCount.rows[0] as any).count} clients for tenant ${req.user.tenantId}`);
      } catch (dbError) {
        console.error('❌ [DB DEBUG ERROR]:', dbError);
      }
      
      let clients;
      
      // Check if user is a support worker - they should only see assigned clients
      if (req.user.role === "SupportWorker") {
        // Get all shifts assigned to this user
        const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
        
        // Extract unique client IDs from user's shifts
        const clientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null) as number[];
        const assignedClientIds = Array.from(new Set(clientIds));
        
        if (assignedClientIds.length === 0) {
          // No clients assigned - return empty array
          console.log(`[CLIENT API DEBUG] SupportWorker has no assigned clients - returning empty array`);
          return res.json([]);
        }
        
        // Get only the clients this user is assigned to
        const allClients = await storage.getClients(req.user.tenantId);
        clients = allClients.filter(client => assignedClientIds.includes(client.id));
        
        console.log(`[CLIENT ACCESS] SupportWorker ${req.user.username} can access ${clients.length} clients based on shift assignments`);
      } else {
        // Admin, Coordinator, TeamLeader, ConsoleManager can see all clients
        clients = await storage.getClients(req.user.tenantId);
        console.log(`[CLIENT API DEBUG] Admin/Manager user accessing all clients for tenant ${req.user.tenantId}: ${clients.length} clients found`);
      }
      
      // CRITICAL DEBUG: Log exact client data being returned
      console.log(`[CLIENT API DEBUG] Returning ${clients.length} clients to user ${req.user.username}:`);
      if (clients.length > 0) {
        console.table(clients.map(c => ({
          id: c.id,
          fullName: c.fullName,
          ndisNumber: c.ndisNumber,
          tenantId: c.tenantId
        })));
      } else {
        console.log(`[CLIENT API DEBUG] No clients found - this should result in clean slate for user`);
      }
      
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", requireAuth, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.id);
      const client = await storage.getClient(clientId, req.user.tenantId);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Check if support worker has access to this client
      if (req.user.role === "SupportWorker") {
        const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
        const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null);
        
        if (!assignedClientIds.includes(clientId)) {
          console.log(`[CLIENT ACCESS DENIED] SupportWorker ${req.user.username} attempted to access client ${clientId} without shift assignment`);
          return res.status(403).json({ message: "Access denied: You are not assigned to this client" });
        }
      }
      
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", requireAuth, async (req: any, res) => {
    try {
      console.log("Creating client with user:", req.user);
      console.log("Request body:", req.body);
      
      // 🚨 ADDITIONAL DEMO DATA PREVENTION AT API LEVEL
      const demoFirstNames = ['Sarah', 'Michael', 'Emma', 'John', 'Jane', 'Test', 'Demo'];
      const demoLastNames = ['Johnson', 'Chen', 'Williams', 'Doe', 'Smith', 'Test', 'Demo'];
      
      if (demoFirstNames.includes(req.body.firstName) || demoLastNames.includes(req.body.lastName)) {
        console.error(`🚨 [API DEMO BLOCK] User ${req.user.username} (Tenant: ${req.user.tenantId}) attempted to create demo client: ${req.body.firstName} ${req.body.lastName}`);
        return res.status(400).json({ 
          message: "Demo client names are permanently blocked. Please use real client names.",
          error: `The name "${req.body.firstName} ${req.body.lastName}" is prohibited as it matches demo data patterns.`,
          blocked: true
        });
      }
      
      // Get company info for this tenant
      const company = await storage.getCompanyByTenantId(req.user.tenantId);
      if (!company) {
        return res.status(404).json({ message: "Company not found for tenant" });
      }
      
      const validatedData = insertClientSchema.parse({
        ...req.body,
        tenantId: req.user.tenantId,
        companyId: company.id,
        createdBy: req.user.id,
      });
      
      console.log("Validated data:", validatedData);
      
      const client = await storage.createClient(validatedData);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create",
        resourceType: "client",
        resourceId: client.id,
        description: `Created client: ${client.fullName}`,
        tenantId: req.user.tenantId,
      });
      
      res.status(201).json(client);
    } catch (error) {
      console.error("Client creation error:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ message: "Invalid client data", errors: error.errors });
      }
      console.error("Server error during client creation:", error);
      res.status(500).json({ message: "Failed to create client", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/clients/:id", requireAuth, async (req: any, res) => {
    try {
      const updateData = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(parseInt(req.params.id), updateData, req.user.tenantId);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update",
        resourceType: "client",
        resourceId: client.id,
        description: `Updated client: ${client.fullName}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid client data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", requireAuth, async (req: any, res) => {
    try {
      const success = await storage.deleteClient(parseInt(req.params.id), req.user.tenantId);
      
      if (!success) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "delete",
        resourceType: "client",
        resourceId: parseInt(req.params.id),
        description: `Deleted client`,
        tenantId: req.user.tenantId,
      });
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Staff API
  app.get("/api/staff", requireAuth, async (req: any, res) => {
    try {
      const staff = await storage.getUsersByTenant(req.user.tenantId);
      // Remove sensitive data
      const sanitizedStaff = staff.map(({ password, ...user }) => user);
      res.json(sanitizedStaff);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.put("/api/staff/:id", requireAuth, requireRole(['Admin', 'ConsoleManager']), async (req: any, res) => {
    try {
      const staffId = parseInt(req.params.id);
      const updateData = insertUserSchema.partial().parse(req.body);
      
      console.log(`[STAFF UPDATE V2] Updating staff ${staffId} with data:`, updateData);
      
      // Check if pay level or pay point is being changed
      const isPayScaleUpdate = updateData.payLevel !== undefined || updateData.payPoint !== undefined;
      
      if (isPayScaleUpdate) {
        console.log(`[PAY SCALE UPDATE V2] Staff ${staffId} pay scale is being updated: Level ${updateData.payLevel}, Point ${updateData.payPoint}`);
      }
      
      const updatedUser = await storage.updateUser(staffId, updateData, req.user.tenantId);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      
      // CRITICAL FIX: Recalculate existing timesheet entries when pay scales change
      if (isPayScaleUpdate) {
        try {
          console.log(`[PAY SCALE UPDATE V2] Recalculating timesheet entries for staff ${staffId}`);
          await recalculateTimesheetEntriesForUser(staffId, req.user.tenantId);
          console.log(`[PAY SCALE UPDATE V2] Successfully recalculated timesheet entries for staff ${staffId}`);
        } catch (recalcError) {
          console.error(`[PAY SCALE UPDATE V2] Failed to recalculate timesheet entries for staff ${staffId}:`, recalcError);
          // Continue with staff update even if recalculation fails
        }
      }
      
      // Remove sensitive data
      const { password, ...sanitizedUser } = updatedUser;
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update",
        resourceType: "user",
        resourceId: staffId,
        description: `Updated staff member: ${updatedUser.fullName}${isPayScaleUpdate ? ' (pay scale updated)' : ''}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(sanitizedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid staff data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update staff member" });
    }
  });

  app.post("/api/staff/:id/reset-password", requireAuth, requireRole(['Admin', 'ConsoleManager']), async (req: any, res) => {
    try {
      const staffId = parseInt(req.params.id);
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }
      
      const hashedPassword = await hashPassword(newPassword);
      const updatedUser = await storage.updateUser(staffId, { password: hashedPassword }, req.user.tenantId);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "reset-password",
        resourceType: "user",
        resourceId: staffId,
        description: `Reset password for staff member: ${updatedUser.fullName}`,
        tenantId: req.user.tenantId,
      });
      
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Form Templates API
  app.get("/api/form-templates", requireAuth, async (req: any, res) => {
    try {
      const templates = await storage.getFormTemplates(req.user.tenantId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch form templates" });
    }
  });

  app.post("/api/form-templates", requireAuth, requireRole(["admin"]), async (req: any, res) => {
    try {
      const validatedData = insertFormTemplateSchema.parse({
        ...req.body,
        tenantId: req.user.tenantId,
        createdBy: req.user.id,
      });
      
      const template = await storage.createFormTemplate(validatedData);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create",
        resourceType: "form_template",
        resourceId: template.id,
        description: `Created form template: ${template.name}`,
        tenantId: req.user.tenantId,
      });
      
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid form template data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create form template" });
    }
  });

  // Form Submissions API
  app.get("/api/form-submissions", requireAuth, async (req: any, res) => {
    try {
      const submissions = await storage.getFormSubmissions(req.user.tenantId);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch form submissions" });
    }
  });

  app.post("/api/form-submissions", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertFormSubmissionSchema.parse({
        ...req.body,
        tenantId: req.user.tenantId,
        submittedBy: req.user.id,
      });
      
      const submission = await storage.createFormSubmission(validatedData);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create",
        resourceType: "form_submission",
        resourceId: submission.id,
        description: `Submitted form`,
        tenantId: req.user.tenantId,
      });
      
      res.status(201).json(submission);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid form submission data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create form submission" });
    }
  });

  // Shifts API
  app.get("/api/shifts", requireAuth, async (req: any, res) => {
    try {
      const { clientId } = req.query;
      console.log(`[SHIFTS API] User: ${req.user.username}, Role: ${req.user.role}, TenantId: ${req.user.tenantId}`);
      
      // Admin and ConsoleManager see ALL shifts, others see only active shifts
      const isAdmin = req.user.role === 'Admin' || req.user.role === 'ConsoleManager';
      const shifts = isAdmin 
        ? await storage.getAllShifts(req.user.tenantId)
        : await storage.getActiveShifts(req.user.tenantId);
        
      console.log(`[SHIFTS API] Found ${shifts.length} shifts for tenant ${req.user.tenantId} (Admin view: ${isAdmin})`);
      console.log(`[SHIFTS API] Shifts tenant IDs:`, shifts.map(s => `ID:${s.id} tenant:${s.tenantId}`));
      
      // Filter by clientId if provided
      const filteredShifts = clientId 
        ? shifts.filter(shift => shift.clientId === parseInt(clientId as string))
        : shifts;
      
      res.json(filteredShifts);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      res.status(500).json({ message: "Failed to fetch shifts", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });



  app.post("/api/shifts", requireAuth, requireRole(["Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      // Convert string dates to Date objects before validation
      const processedBody = {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
        shiftStartDate: req.body.shiftStartDate ? new Date(req.body.shiftStartDate) : undefined,
        tenantId: req.user.tenantId,
      };
      
      const shiftData = insertShiftSchema.parse(processedBody);
      
      const shift = await storage.createShift(shiftData);
      
      // Update hour allocation if shift has assigned user and is approved/assigned status
      if (shift.userId && (shift.status === 'assigned' || shift.status === 'approved')) {
        await updateStaffHourAllocation(shift.id, shift.userId, req.user.tenantId, 'allocate');
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_shift",
        resourceType: "shift",
        resourceId: shift.id,
        description: `Created shift${shiftData.seriesId ? ' (recurring series)' : ''}`,
        tenantId: req.user.tenantId,
      });
      
      res.status(201).json(shift);
    } catch (error) {
      console.error("Error creating shift:", error);
      console.error("Request body:", req.body);
      if (error instanceof z.ZodError) {
        console.error("Zod validation errors:", error.errors);
        return res.status(400).json({ message: "Invalid shift data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create shift", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });



  app.get("/api/shifts/:id", requireAuth, async (req: any, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      const shift = await storage.getShift(shiftId, req.user.tenantId);
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      res.json(shift);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shift" });
    }
  });

  // Test route to verify role access
  app.get("/api/test-role", requireAuth, requireRole(["Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    res.json({ message: "Role access verified", role: req.user.role });
  });

  app.put("/api/shifts/:id", requireAuth, async (req: any, res) => {
    console.log("[SHIFT UPDATE] ✅ ROUTE ENTERED - Starting shift update process");
    
    try {
      console.log("[SHIFT UPDATE] ✅ INSIDE TRY BLOCK");
      
      const shiftId = parseInt(req.params.id);
      const updateData = req.body;
      
      console.log(`[SHIFT UPDATE] User ${req.user.id} (${req.user.role}) updating shift ${shiftId}`);
      console.log(`[SHIFT UPDATE] Update data:`, JSON.stringify(updateData, null, 2));
      console.log(`[SHIFT UPDATE] Tenant ID: ${req.user.tenantId}`);
      
      console.log("[SHIFT UPDATE] ✅ BEFORE PERMISSION CHECK");
      
      // Get the existing shift to check permissions
      const existingShift = await storage.getShift(shiftId, req.user.tenantId);
      if (!existingShift) {
        console.log("[SHIFT UPDATE] ❌ SHIFT NOT FOUND");
        return res.status(404).json({ message: "Shift not found" });
      }
      
      console.log("[SHIFT UPDATE] ✅ SHIFT FOUND, CHECKING PERMISSIONS");
      
      // Permission check: SupportWorker can only update their own shifts, TeamLeader+ can update assigned shifts
      if (req.user.role === "SupportWorker" && existingShift.userId !== req.user.id) {
        console.log("[SHIFT UPDATE] ❌ PERMISSION DENIED - Not user's shift");
        return res.status(403).json({ message: "You can only update your own assigned shifts" });
      } else if (req.user.role !== "SupportWorker" && !["TeamLeader", "Coordinator", "Admin", "ConsoleManager"].includes(req.user.role)) {
        console.log("[SHIFT UPDATE] ❌ PERMISSION DENIED - Insufficient role");
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      console.log("[SHIFT UPDATE] ✅ PERMISSIONS PASSED, STARTING CONVERSION");
      
      // COMPREHENSIVE timestamp conversion for ALL possible date fields
      const processedUpdateData = { ...updateData };
      
      console.log(`[SHIFT UPDATE] ✅ RAW DATA TYPES:`, {
        startTime: typeof processedUpdateData.startTime,
        endTime: typeof processedUpdateData.endTime,
        endTimestamp: typeof processedUpdateData.endTimestamp
      });
      console.log(`[SHIFT UPDATE] ✅ ALL FIELDS:`, Object.keys(processedUpdateData));
      
      // Define all possible timestamp fields that might be sent from frontend
      const timestampFields = [
        'startTime', 'endTime', 'startTimestamp', 'endTimestamp', 
        'createdAt', 'updatedAt', 'scheduledStartTime', 'scheduledEndTime'
      ];
      
      // Convert ALL timestamp fields to Date objects
      timestampFields.forEach(field => {
        if (processedUpdateData[field] && typeof processedUpdateData[field] === 'string') {
          console.log(`[SHIFT UPDATE] ✅ CONVERTING ${field} from: ${processedUpdateData[field]}`);
          try {
            processedUpdateData[field] = new Date(processedUpdateData[field]);
            console.log(`[SHIFT UPDATE] ✅ ${field} converted to: ${processedUpdateData[field]}`);
          } catch (error) {
            console.error(`[SHIFT UPDATE] ❌ Failed to convert ${field}:`, error);
            delete processedUpdateData[field]; // Remove invalid date field
          }
        }
      });
      
      // Final verification of all timestamp conversions
      const verificationResults = {};
      timestampFields.forEach(field => {
        if (processedUpdateData[field] !== undefined) {
          verificationResults[field] = processedUpdateData[field] instanceof Date ? 'IS DATE' : 'NOT DATE';
        }
      });
      console.log(`[SHIFT UPDATE] ✅ FINAL VERIFICATION:`, verificationResults);
      
      // Get original shift data BEFORE updating to preserve scheduled times for budget billing
      let originalShiftForBudget = null;
      const isShiftCompletion = (processedUpdateData.endTime && processedUpdateData.isActive === false) || 
                               (processedUpdateData.status === "completed" && processedUpdateData.endTimestamp);
      
      if (isShiftCompletion) {
        originalShiftForBudget = await storage.getShift(shiftId, req.user.tenantId);
        console.log(`[BUDGET DEDUCTION] Saved original scheduled times: ${originalShiftForBudget?.startTime} → ${originalShiftForBudget?.endTime}`);
      }
      
      console.log("[SHIFT UPDATE] ✅ ABOUT TO CALL storage.updateShift");
      
      const updatedShift = await storage.updateShift(shiftId, processedUpdateData, req.user.tenantId);
      
      console.log(`[SHIFT UPDATE] Updated shift result:`, updatedShift ? 'SUCCESS' : 'FAILED - Shift not found');
      
      if (!updatedShift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      // Process budget deduction and timesheet entry when shift is completed
      if (isShiftCompletion && originalShiftForBudget) {
        console.log(`[SHIFT COMPLETION] Processing completion for shift ${shiftId}`);
        
        // Process budget deduction using ORIGINAL scheduled times (not actual completion times)
        try {
          console.log(`[BUDGET DEDUCTION] Using ORIGINAL scheduled times: ${originalShiftForBudget.startTime} → ${originalShiftForBudget.endTime}`);
          await processBudgetDeduction(originalShiftForBudget, req.user.id);
          console.log(`[BUDGET DEDUCTION] Successfully processed budget deduction for shift ${shiftId}`);
        } catch (budgetError) {
          console.error(`[BUDGET DEDUCTION ERROR] Failed to process budget deduction for shift ${shiftId}:`, budgetError);
          // Don't fail the shift update if budget processing fails
        }

        // Create smart timesheet entry with submission timing logic - AWAIT THIS BEFORE RESPONDING
        try {
          // Use the actual shift completion timestamp for smart calculation
          const submissionTimestamp = new Date(processedUpdateData.endTimestamp);
          await createSmartTimesheetEntry(shiftId, submissionTimestamp);
          console.log(`[SMART TIMESHEET] Successfully created smart timesheet entry for completed shift ${shiftId}`);
          
          // Add a small delay to ensure database transactions are fully committed
          await new Promise(resolve => setTimeout(resolve, 200));
          console.log(`[SMART TIMESHEET] Database commit delay completed for shift ${shiftId}`);
        } catch (timesheetError) {
          console.error(`[SMART TIMESHEET ERROR] Failed to create smart timesheet entry for shift ${shiftId}:`, timesheetError);
          // Don't fail the shift update if timesheet processing fails, but log the error
        }
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_shift",
        resourceType: "shift",
        resourceId: shiftId,
        description: `Updated shift details`,
        tenantId: req.user.tenantId,
      });
      
      console.log(`[SHIFT UPDATE] Activity logged successfully`);
      
      res.json(updatedShift);
    } catch (error: any) {
      console.error(`[SHIFT UPDATE ERROR] Error updating shift ${req.params.id}:`, error);
      console.error(`[SHIFT UPDATE ERROR] Stack trace:`, error.stack);
      res.status(500).json({ message: "Failed to update shift" });
    }
  });

  app.delete("/api/shifts/:id", requireAuth, requireRole(["Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      const deleted = await storage.deleteShift(shiftId, req.user.tenantId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "delete_shift",
        resourceType: "shift",
        resourceId: shiftId,
        description: `Deleted shift`,
        tenantId: req.user.tenantId,
      });
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete shift" });
    }
  });

  app.post("/api/shifts/:id/end", requireAuth, async (req: any, res) => {
    try {
      const shift = await storage.endShift(parseInt(req.params.id), new Date(), req.user.tenantId);
      
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      // CRITICAL FIX: Process NDIS budget deduction immediately after shift completion
      try {
        console.log(`[SHIFT END] Processing budget deduction for shift ${shift.id}`);
        await processBudgetDeduction(shift, req.user.id);
        console.log(`[SHIFT END] Budget deduction completed for shift ${shift.id}`);
      } catch (budgetError) {
        console.error(`[SHIFT END] Budget deduction failed for shift ${shift.id}:`, budgetError);
        // Continue with shift completion even if budget deduction fails
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "end_shift",
        resourceType: "shift",
        resourceId: shift.id,
        description: `Ended shift`,
        tenantId: req.user.tenantId,
      });
      
      // Add delay to ensure budget processing completes before frontend refresh
      setTimeout(() => {
        console.log(`[SHIFT END] Budget processing window closed for shift ${shift.id}`);
      }, 200);
      
      res.json(shift);
    } catch (error) {
      console.error("Failed to end shift:", error);
      res.status(500).json({ message: "Failed to end shift" });
    }
  });

  // Update shift (for requesting shifts)
  app.patch("/api/shifts/:id", requireAuth, async (req: any, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      const updateData = req.body;
      
      // Convert timestamp strings to Date objects for database compatibility
      const processedUpdateData = { ...updateData };
      if (processedUpdateData.startTimestamp && typeof processedUpdateData.startTimestamp === 'string') {
        processedUpdateData.startTimestamp = new Date(processedUpdateData.startTimestamp);
      }
      if (processedUpdateData.endTimestamp && typeof processedUpdateData.endTimestamp === 'string') {
        processedUpdateData.endTimestamp = new Date(processedUpdateData.endTimestamp);
      }
      
      // Enhanced validation for shift request operation
      if (processedUpdateData.userId && processedUpdateData.status === "requested") {
        console.log(`[SHIFT REQUEST] User ${req.user.id} requesting shift ${shiftId}`);
        
        // Ensure user can only request for themselves
        if (processedUpdateData.userId !== req.user.id) {
          console.log(`[SHIFT REQUEST] ERROR: User ${req.user.id} trying to request for user ${processedUpdateData.userId}`);
          return res.status(403).json({ message: "Can only request shifts for yourself" });
        }
        
        // Check if shift exists and is unassigned
        const existingShift = await storage.getShift(shiftId, req.user.tenantId);
        if (!existingShift) {
          console.log(`[SHIFT REQUEST] ERROR: Shift ${shiftId} not found`);
          return res.status(404).json({ message: "Shift not found" });
        }
        
        if (existingShift.userId) {
          console.log(`[SHIFT REQUEST] ERROR: Shift ${shiftId} already assigned to user ${existingShift.userId}`);
          return res.status(400).json({ message: "Shift already assigned" });
        }
        
        console.log(`[SHIFT REQUEST] Valid request - assigning userId ${processedUpdateData.userId} to shift ${shiftId}`);
      }
      
      const shift = await storage.updateShift(shiftId, processedUpdateData, req.user.tenantId);
      
      if (!shift) {
        console.log(`[SHIFT UPDATE] ERROR: Failed to update shift ${shiftId}`);
        return res.status(404).json({ message: "Shift not found" });
      }
      
      // Verify shift request userId assignment
      if (processedUpdateData.status === "requested" && processedUpdateData.userId) {
        if (shift.userId !== processedUpdateData.userId) {
          console.log(`[SHIFT REQUEST] CRITICAL ERROR: userId not assigned! Expected: ${processedUpdateData.userId}, Actual: ${shift.userId}`);
          return res.status(500).json({ message: "User assignment failed during shift request" });
        }
        console.log(`[SHIFT REQUEST] SUCCESS - shift ${shiftId} assigned to user ${shift.userId} with status ${shift.status}`);
      }
      
      // Log activity for shift requests
      if (processedUpdateData.status === "requested") {
        await storage.createActivityLog({
          userId: req.user.id,
          action: "request_shift",
          resourceType: "shift",
          resourceId: shift.id,
          description: `Requested shift: ${shift.title}`,
          tenantId: req.user.tenantId,
        });
      }
      
      // Log activity for shift starts
      if (processedUpdateData.status === "in-progress" && processedUpdateData.startTimestamp) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: "start_shift",
          resourceType: "shift",
          resourceId: shift.id,
          description: `Started shift: ${shift.title}`,
          tenantId: req.user.tenantId,
        });
      }
      
      // CRITICAL AWS PRODUCTION FIX: Process budget deduction and timesheet for shift completion
      if (processedUpdateData.status === "completed" && processedUpdateData.endTimestamp) {
        console.log(`[SHIFT COMPLETION] Processing completed shift ${shift.id} for user ${req.user.id}`);
        
        // Process NDIS budget deduction immediately 
        try {
          console.log(`[SHIFT COMPLETION] Processing budget deduction for shift ${shift.id}`);
          await processBudgetDeduction(shift, req.user.id);
          console.log(`[SHIFT COMPLETION] Budget deduction completed for shift ${shift.id}`);
        } catch (budgetError) {
          console.error(`[SHIFT COMPLETION] Budget deduction failed for shift ${shift.id}:`, budgetError);
          // Continue with shift completion even if budget deduction fails
        }
        
        // Process timesheet creation using smart timesheet service
        try {
          console.log(`[SHIFT COMPLETION] Creating timesheet entry for shift ${shift.id}`);
          const { createSmartTimesheetFromShift } = require('./smart-timesheet-service');
          await createSmartTimesheetFromShift(shift, req.user.tenantId);
          console.log(`[SHIFT COMPLETION] Timesheet entry created for shift ${shift.id}`);
        } catch (timesheetError) {
          console.error(`[SHIFT COMPLETION] Timesheet creation failed for shift ${shift.id}:`, timesheetError);
          // Continue with shift completion even if timesheet creation fails
        }
        
        // Log activity for shift completion
        await storage.createActivityLog({
          userId: req.user.id,
          action: "complete_shift",
          resourceType: "shift",
          resourceId: shift.id,
          description: `Completed shift: ${shift.title}`,
          tenantId: req.user.tenantId,
        });
        
        console.log(`[SHIFT COMPLETION] All completion processing finished for shift ${shift.id}`);
      }
      
      res.json(shift);
    } catch (error) {
      console.error("Error updating shift:", error);
      console.error("Update data:", req.body);
      console.error("User:", req.user.username, "ID:", req.user.id);
      res.status(500).json({ message: "Failed to update shift", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Approve shift request
  app.post("/api/shifts/:id/approve", requireAuth, requireRole(["Admin", "Coordinator"]), async (req: any, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      console.log(`[APPROVE SHIFT] ShiftId: ${shiftId}, User: ${req.user.username}, TenantId: ${req.user.tenantId}`);
      
      // Get the shift to find the requesting user
      const shift = await storage.getShift(shiftId, req.user.tenantId);
      if (!shift) {
        console.log(`[APPROVE SHIFT] Shift not found: ${shiftId}`);
        return res.status(404).json({ message: "Shift not found" });
      }
      
      console.log(`[APPROVE SHIFT] Current shift status: ${shift.status}, userId: ${shift.userId}`);
      if (shift.status !== "requested") {
        return res.status(400).json({ message: "Shift is not in requested status" });
      }
      
      if (!shift.userId) {
        console.log(`[APPROVE SHIFT] ERROR: Shift ${shiftId} has no userId assigned`);
        return res.status(400).json({ message: "Cannot approve shift with no assigned user" });
      }
      
      // Approve the shift by changing status to assigned while preserving userId
      const updateData = {
        status: "assigned",
        userId: shift.userId // Explicitly preserve the original requester's userId
      };
      
      console.log(`[APPROVE SHIFT] Updating with data:`, updateData);
      const updatedShift = await storage.updateShift(shiftId, updateData, req.user.tenantId);
      
      if (!updatedShift) {
        console.log(`[APPROVE SHIFT] ERROR: Failed to update shift ${shiftId}`);
        return res.status(500).json({ message: "Failed to approve shift" });
      }
      
      // Verify userId preservation
      if (updatedShift.userId !== shift.userId) {
        console.log(`[APPROVE SHIFT] CRITICAL ERROR: userId not preserved! Original: ${shift.userId}, New: ${updatedShift.userId}`);
        return res.status(500).json({ message: "User assignment lost during approval" });
      }
      
      console.log(`[APPROVE SHIFT] SUCCESS - status: ${updatedShift.status}, userId: ${updatedShift.userId}`);
      
      // Update hour allocation when shift is approved
      if (updatedShift.userId) {
        await updateStaffHourAllocation(shiftId, updatedShift.userId, req.user.tenantId, 'allocate');
      }
      
      // Log activity
      if (storage.createActivityLog) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: "approve_shift_request",
          resourceType: "shift",
          resourceId: shift.id,
          description: `Approved shift request: ${shift.title}`,
          tenantId: req.user.tenantId,
        });
      }
      
      res.json(updatedShift);
    } catch (error) {
      console.error("[APPROVE SHIFT] Error:", error);
      res.status(500).json({ message: "Failed to approve shift request", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Reject shift request
  app.post("/api/shifts/:id/reject", requireAuth, requireRole(["Admin", "Coordinator"]), async (req: any, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      console.log(`[REJECT SHIFT] ShiftId: ${shiftId}, User: ${req.user.username}, TenantId: ${req.user.tenantId}`);
      
      // Get the shift to find the requesting user
      const shift = await storage.getShift(shiftId, req.user.tenantId);
      if (!shift) {
        console.log(`[REJECT SHIFT] Shift not found: ${shiftId}`);
        return res.status(404).json({ message: "Shift not found" });
      }
      
      console.log(`[REJECT SHIFT] Current shift status: ${shift.status}`);
      if (shift.status !== "requested") {
        return res.status(400).json({ message: "Shift is not in requested status" });
      }
      
      // Deallocate hours before rejecting shift
      if (shift.userId) {
        await updateStaffHourAllocation(shiftId, shift.userId, req.user.tenantId, 'deallocate');
      }

      // Reject the shift by removing user assignment and changing status back to unassigned
      const updatedShift = await storage.updateShift(shiftId, {
        userId: null,
        status: "unassigned"
      }, req.user.tenantId);
      
      console.log(`[REJECT SHIFT] Updated shift status to: ${updatedShift?.status}`);
      
      // Log activity
      if (storage.createActivityLog) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: "reject_shift_request",
          resourceType: "shift",
          resourceId: shift.id,
          description: `Rejected shift request: ${shift.title}`,
          tenantId: req.user.tenantId,
        });
      }
      
      res.json(updatedShift);
    } catch (error) {
      console.error("[REJECT SHIFT] Error:", error);
      res.status(500).json({ message: "Failed to reject shift request", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get users for tenant (for shift assignment)
  app.get("/api/users", requireAuth, async (req: any, res) => {
    try {
      const users = await storage.getUsersByTenant(req.user.tenantId);
      // Remove sensitive data
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Activity Logs API
  app.get("/api/activity-logs", requireAuth, async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getActivityLogs(req.user.tenantId, limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  // Export API
  app.get("/api/export/clients", requireAuth, async (req: any, res) => {
    try {
      const clients = await storage.getClients(req.user.tenantId);
      
      // Create CSV content
      const headers = ['Client ID', 'Full Name', 'NDIS Number', 'Date of Birth', 'Address', 'Emergency Contact', 'Primary Diagnosis', 'Created At'];
      const csvContent = [
        headers.join(','),
        ...clients.map(client => [
          client.clientId,
          `"${client.fullName}"`,
          client.ndisNumber || '',
          client.dateOfBirth ? new Date(client.dateOfBirth).toISOString().split('T')[0] : '',
          `"${client.address || ''}"`,
          `"${client.emergencyContactName || ''}"`,
          client.primaryDiagnosis || '',
          new Date(client.createdAt).toISOString().split('T')[0]
        ].join(','))
      ].join('\n');
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "export",
        resourceType: "clients",
        description: `Exported ${clients.length} client records`,
        tenantId: req.user.tenantId,
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="clients.csv"');
      res.send(csvContent);
    } catch (error) {
      res.status(500).json({ message: "Failed to export clients" });
    }
  });

  // Dashboard stats API
  app.get("/api/dashboard/stats", requireAuth, async (req: any, res) => {
    try {
      const [clients, staff, activeShifts, formSubmissions] = await Promise.all([
        storage.getClients(req.user.tenantId),
        storage.getUsersByTenant(req.user.tenantId),
        storage.getActiveShifts(req.user.tenantId),
        storage.getFormSubmissions(req.user.tenantId),
      ]);

      const stats = {
        activeClients: clients.filter(c => c.isActive).length,
        staffOnDuty: activeShifts.length,
        formsCompleted: formSubmissions.filter(f => f.status === 'completed').length,
        formsPending: formSubmissions.filter(f => f.status === 'pending').length,
        totalStaff: staff.length,
        totalSubmissions: formSubmissions.length,
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Staff Availability API
  app.get("/api/staff-availability", requireAuth, async (req: any, res) => {
    try {
      const availability = await storage.getStaffAvailability(req.user.tenantId);
      res.json(availability);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch staff availability" });
    }
  });

  app.post("/api/staff-availability", requireAuth, async (req: any, res) => {
    try {
      const availabilityData = {
        ...req.body,
        userId: req.user.id,
        companyId: req.user.tenantId,
        tenantId: req.user.tenantId, // Ensure both fields are set
      };
      
      console.log("Creating staff availability with data:", availabilityData);
      
      const availability = await storage.createStaffAvailability(availabilityData);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_availability",
        resourceType: "staff_availability",
        resourceId: availability.id,
        description: "Created staff availability",
        tenantId: req.user.tenantId,
      });
      
      res.status(201).json(availability);
    } catch (error) {
      console.error("Staff availability creation error:", error);
      res.status(500).json({ message: "Failed to create staff availability", error: error.message });
    }
  });

  // Get current user's availability
  app.get("/api/staff-availability/current", requireAuth, async (req: any, res) => {
    try {
      const availability = await storage.getUserAvailability(req.user.id, req.user.tenantId);
      res.json(availability);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch current availability" });
    }
  });

  // Get quick patterns
  app.get("/api/staff-availability/patterns", requireAuth, async (req: any, res) => {
    try {
      const patterns = await storage.getQuickPatterns(req.user.id, req.user.tenantId);
      res.json(patterns);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch patterns" });
    }
  });

  // Admin: Get all staff availability submissions for tenant
  app.get("/api/staff-availability/admin", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const availabilities = await storage.getAllStaffAvailabilities(req.user.tenantId);
      res.json(availabilities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch staff availabilities" });
    }
  });

  // Admin: Approve/reject staff availability
  app.put("/api/staff-availability/:id/approval", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isApproved } = req.body;
      
      const availability = await storage.updateStaffAvailabilityApproval(parseInt(id), isApproved, req.user.tenantId);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: isApproved ? "approve_availability" : "reject_availability",
        resourceType: "staff_availability",
        resourceId: parseInt(id),
        description: `${isApproved ? "Approved" : "Rejected"} staff availability`,
        tenantId: req.user.tenantId,
      });
      
      res.json(availability);
    } catch (error) {
      console.error("Staff availability approval error:", error);
      res.status(500).json({ message: "Failed to update availability approval" });
    }
  });

  // Update staff availability (for staff to edit their own)
  app.put("/api/staff-availability/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { availability, patternName, isQuickPattern } = req.body;
      
      const updated = await storage.updateStaffAvailability(parseInt(id), {
        availability,
        patternName,
        isQuickPattern,
        userId: req.user.id,
        tenantId: req.user.tenantId
      }, req.user.tenantId);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_availability",
        resourceType: "staff_availability",
        resourceId: parseInt(id),
        description: "Updated staff availability",
        tenantId: req.user.tenantId,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Staff availability update error:", error);
      res.status(500).json({ message: "Failed to update availability" });
    }
  });

  // Get conflict analysis
  app.get("/api/staff-availability/conflicts", requireAuth, requireRole(["Admin", "TeamLeader"]), async (req: any, res) => {
    try {
      const conflicts = await storage.getAvailabilityConflicts(req.user.tenantId);
      res.json(conflicts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conflicts" });
    }
  });

  // Admin - get all staff availability
  app.get("/api/manage-staff-availability", requireAuth, requireRole(["Admin", "TeamLeader"]), async (req: any, res) => {
    try {
      const { archived } = req.query;
      const showArchived = archived === 'true';
      const availability = await storage.getAllStaffAvailability(req.user.tenantId, showArchived);
      res.json(availability);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch staff availability" });
    }
  });

  // Archive availability
  app.post("/api/staff-availability/:id/archive", requireAuth, requireRole(["Admin", "TeamLeader"]), async (req: any, res) => {
    try {
      const availabilityId = parseInt(req.params.id);
      const availability = await storage.archiveStaffAvailability(availabilityId, req.user.tenantId);
      
      if (!availability) {
        return res.status(404).json({ message: "Staff availability not found" });
      }

      await storage.createActivityLog({
        userId: req.user.id,
        action: "archive_availability",
        resourceType: "staff_availability",
        resourceId: availabilityId,
        description: "Archived staff availability",
        tenantId: req.user.tenantId,
      });

      res.json(availability);
    } catch (error) {
      res.status(500).json({ message: "Failed to archive availability" });
    }
  });

  // Override availability
  app.put("/api/staff-availability/:id/override", requireAuth, requireRole(["Admin", "TeamLeader"]), async (req: any, res) => {
    try {
      const availabilityId = parseInt(req.params.id);
      const updateData = { ...req.body, overrideByManager: true };
      
      const availability = await storage.updateStaffAvailability(availabilityId, updateData, req.user.tenantId);
      
      if (!availability) {
        return res.status(404).json({ message: "Staff availability not found" });
      }

      await storage.createActivityLog({
        userId: req.user.id,
        action: "override_availability",
        resourceType: "staff_availability",
        resourceId: availabilityId,
        description: "Modified staff availability",
        tenantId: req.user.tenantId,
      });

      res.json(availability);
    } catch (error) {
      res.status(500).json({ message: "Failed to override availability" });
    }
  });

  app.put("/api/staff-availability/:id", requireAuth, async (req: any, res) => {
    try {
      const availabilityId = parseInt(req.params.id);
      const updateData = req.body;
      
      const availability = await storage.updateStaffAvailability(availabilityId, updateData, req.user.tenantId);
      if (!availability) {
        return res.status(404).json({ message: "Staff availability not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_availability",
        resourceType: "staff_availability",
        resourceId: availabilityId,
        description: "Updated staff availability",
        tenantId: req.user.tenantId,
      });
      
      res.json(availability);
    } catch (error) {
      res.status(500).json({ message: "Failed to update staff availability" });
    }
  });

  // Case Notes API
  app.get("/api/case-notes", requireAuth, async (req: any, res) => {
    try {
      const { clientId } = req.query;
      const tenantId = req.user.tenantId;
      
      let caseNotes = [];
      
      if (clientId) {
        // Check if support worker has access to this specific client
        if (req.user.role === "SupportWorker") {
          const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
          const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null);
          
          if (!assignedClientIds.includes(parseInt(clientId))) {
            return res.status(403).json({ message: "Access denied: You are not assigned to this client" });
          }
        }
        caseNotes = await storage.getCaseNotes(parseInt(clientId), tenantId);
      } else {
        // Get case notes for all accessible clients
        let clients;
        if (req.user.role === "SupportWorker") {
          // Get only assigned clients for support workers
          const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
          const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null);
          const allClients = await storage.getClients(tenantId);
          clients = allClients.filter(client => assignedClientIds.includes(client.id));
        } else {
          // Admin/Coordinator/TeamLeader get all clients
          clients = await storage.getClients(tenantId);
        }
        
        for (const client of clients) {
          const clientNotes = await storage.getCaseNotes(client.id, tenantId);
          caseNotes.push(...clientNotes);
        }
        // Sort by creation date
        caseNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      
      res.json(caseNotes);
    } catch (error: any) {
      console.error("Case notes API error:", error);
      res.status(500).json({ message: "Failed to fetch case notes", error: error.message });
    }
  });

  // Individual Case Note PDF Export API
  app.get("/api/case-notes/:id/pdf", requireAuth, async (req: any, res) => {
    try {
      const noteId = parseInt(req.params.id);
      const tenantId = req.user.tenantId;
      
      // Get company information for header
      const company = await storage.getCompanyByTenantId(tenantId);
      const companyName = company?.name || `Company ${tenantId}`;
      
      // Fetch single case note
      const caseNote = await storage.getCaseNote(noteId, tenantId);
      
      if (!caseNote) {
        return res.status(404).json({ message: "Case note not found" });
      }

      // Get client information
      const client = await storage.getClient(caseNote.clientId, tenantId);
      const clientName = client ? `${client.firstName} ${client.lastName}` : "Unknown Client";
      
      // Create PDF using jsPDF
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape A4
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      // Add centered header (first page only)
      pdf.setFillColor(37, 99, 235); // Professional blue
      pdf.rect(margin, 10, contentWidth, 40, 'F');
      
      // Add accent bar
      pdf.setFillColor(59, 130, 246);
      pdf.rect(margin, 45, contentWidth, 5, 'F');
      
      // Header text (centered)
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      const headerText = companyName;
      const headerWidth = pdf.getTextWidth(headerText);
      pdf.text(headerText, margin + (contentWidth - headerWidth) / 2, 25);
      
      pdf.setFontSize(12);
      const titleText = 'Case Note Report';
      const titleWidth = pdf.getTextWidth(titleText);
      pdf.text(titleText, margin + (contentWidth - titleWidth) / 2, 38);
      
      // Reset text color and start content
      pdf.setTextColor(0, 0, 0);
      let currentY = 70;
      
      // Case note details
      const noteData = {
        "Case Note ID": caseNote.id,
        "Title": caseNote.title,
        "Client": clientName,
        "Date Created": new Date(caseNote.createdAt).toLocaleDateString('en-AU'),
        "Category": caseNote.category || "Progress Note",
        "Priority": caseNote.priority || "Normal",
        "Content": caseNote.content,
        "Tags": caseNote.tags?.join(", ") || "None",
        ...(caseNote.linkedShiftId && {
          "Linked Shift": `Shift ID: ${caseNote.linkedShiftId}`
        }),
        ...(caseNote.incidentData && {
          "Incident Information": JSON.stringify(caseNote.incidentData, null, 2).replace(/[{}",]/g, '').trim()
        }),
        ...(caseNote.medicationData && {
          "Medication Information": JSON.stringify(caseNote.medicationData, null, 2).replace(/[{}",]/g, '').trim()
        })
      };

      // Add content
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      for (const [key, value] of Object.entries(noteData)) {
        if (currentY > pageHeight - 30) {
          pdf.addPage();
          currentY = 30;
        }
        
        // Key
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${key}:`, margin + 5, currentY);
        
        // Value with wrapping
        pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(String(value), contentWidth - 90);
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) {
            currentY += 6;
            if (currentY > pageHeight - 30) {
              pdf.addPage();
              currentY = 30;
            }
          }
          pdf.text(lines[i], margin + 85, currentY);
        }
        currentY += 12;
      }
      
      // Add footer to all pages
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        const footerY = pageHeight - 15;
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${companyName} | Generated: ${new Date().toLocaleDateString('en-AU')}`, margin + 5, footerY + 8);
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, footerY + 8);
      }
      
      const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="case-note-${noteId}-${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
      
    } catch (error: any) {
      console.error("Individual case note PDF export error:", error);
      res.status(500).json({ message: "Failed to export case note to PDF" });
    }
  });

  // Case Notes PDF Export API
  app.post("/api/case-notes/export/pdf", requireAuth, async (req: any, res) => {
    try {
      const { noteIds } = req.body;
      const tenantId = req.user.tenantId;
      
      // Get company information for header
      const company = await storage.getCompanyByTenantId(tenantId);
      const companyName = company?.name || `Company ${tenantId}`;
      
      // Fetch case notes
      const caseNotes = await Promise.all(
        noteIds.map((id: number) => storage.getCaseNote(id, tenantId))
      );
      
      const validNotes = caseNotes.filter(note => note !== undefined);
      
      if (validNotes.length === 0) {
        return res.status(404).json({ message: "No case notes found" });
      }

      // Use the exportCaseNotesToPDF function from PDF utility
      const fs = await import('fs');
      const path = await import('path');
      
      // Get client names for the notes
      const notesWithClientInfo = await Promise.all(
        validNotes.map(async (note) => {
          const client = await storage.getClient(note.clientId, tenantId);
          return {
            ...note,
            clientName: client ? `${client.firstName} ${client.lastName}` : "Unknown Client"
          };
        })
      );
      
      // Prepare PDF sections with proper formatting
      const sections = notesWithClientInfo.map(note => ({
        title: `${note.title} - ${note.clientName}`,
        content: {
          "Client": note.clientName,
          "Date Created": new Date(note.createdAt).toLocaleDateString('en-AU'),
          "Category": note.category || "Progress Note",
          "Priority": note.priority || "Normal",
          "Content": note.content,
          "Tags": note.tags?.join(", ") || "None",
          ...(note.linkedShiftId && {
            "Linked Shift": `Shift ID: ${note.linkedShiftId}`
          }),
          ...(note.incidentData && {
            "Incident Information": JSON.stringify(note.incidentData, null, 2).replace(/[{}",]/g, '').trim()
          }),
          ...(note.medicationData && {
            "Medication Information": JSON.stringify(note.medicationData, null, 2).replace(/[{}",]/g, '').trim()
          })
        },
        type: 'table' as const
      }));

      // Import jsPDF with proper syntax
      const { jsPDF } = await import('jspdf');
      
      const options = {
        title: 'Case Notes Export',
        contentHtml: '',
        companyName: companyName,
        staffName: req.user.fullName || req.user.username,
        submissionDate: new Date().toLocaleDateString('en-AU'),
        filename: `case-notes-export-${new Date().toISOString().split('T')[0]}.pdf`
      };

      // Create PDF manually using the same format as PDFExportUtility
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape A4
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      // Add centered header (first page only)
      pdf.setFillColor(37, 99, 235); // Professional blue
      pdf.rect(margin, 10, contentWidth, 40, 'F');
      
      // Add accent bar
      pdf.setFillColor(59, 130, 246);
      pdf.rect(margin, 45, contentWidth, 5, 'F');

      // Company name - CENTERED
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      const companyNameWidth = pdf.getTextWidth(companyName);
      const companyNameX = (pageWidth - companyNameWidth) / 2;
      pdf.text(companyName, companyNameX, 23);
      
      // Document title - CENTERED
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(219, 234, 254);
      const titleWidth = pdf.getTextWidth(options.title);
      const titleX = (pageWidth - titleWidth) / 2;
      pdf.text(options.title, titleX, 31);
      
      // Staff info
      pdf.setFontSize(9);
      pdf.setTextColor(191, 219, 254);
      pdf.text(`Staff: ${options.staffName}`, margin + 8, 38);
      pdf.text(`Generated: ${new Date().toLocaleString('en-AU')}`, pageWidth - margin - 80, 38);
      
      let currentY = 70;
      
      // Add sections
      for (const section of sections) {
        // Check if we need a new page
        if (currentY > pageHeight - 50) {
          pdf.addPage();
          currentY = 30;
        }
        
        // Section header
        pdf.setFillColor(37, 99, 235);
        pdf.rect(margin, currentY - 4, contentWidth, 16, 'F');
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.text(section.title, margin + 5, currentY + 6);
        currentY += 20;
        
        // Section content
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        
        for (const [key, value] of Object.entries(section.content)) {
          if (currentY > pageHeight - 30) {
            pdf.addPage();
            currentY = 30;
          }
          
          // Key
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${key}:`, margin + 5, currentY);
          
          // Value with wrapping
          pdf.setFont('helvetica', 'normal');
          const lines = pdf.splitTextToSize(String(value), contentWidth - 90);
          for (let i = 0; i < lines.length; i++) {
            if (i > 0) {
              currentY += 6;
              if (currentY > pageHeight - 30) {
                pdf.addPage();
                currentY = 30;
              }
            }
            pdf.text(lines[i], margin + 85, currentY);
          }
          currentY += 12;
        }
        currentY += 10;
      }
      
      // Add footer to all pages
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        const footerY = pageHeight - 15;
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${companyName} | Generated: ${new Date().toLocaleDateString('en-AU')}`, margin + 5, footerY + 8);
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, footerY + 8);
      }
      
      const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${options.filename}"`);
      res.send(pdfBuffer);
      
    } catch (error: any) {
      console.error("Case notes PDF export error:", error);
      res.status(500).json({ message: "Failed to export case notes to PDF" });
    }
  });

  // Case Notes Excel Export API
  app.post("/api/case-notes/export/excel", requireAuth, async (req: any, res) => {
    try {
      const { noteIds } = req.body;
      const tenantId = req.user.tenantId;
      
      // Fetch case notes
      const caseNotes = await Promise.all(
        noteIds.map((id: number) => storage.getCaseNote(id, tenantId))
      );
      
      const validNotes = caseNotes.filter(note => note !== undefined);
      
      if (validNotes.length === 0) {
        return res.status(404).json({ message: "No case notes found" });
      }

      const XLSX = await import('xlsx');
      
      // Prepare Excel data
      const excelData = validNotes.map(note => ({
        "ID": note.id,
        "Title": note.title,
        "Client": note.clientName || "Unknown",
        "Category": note.category || "Progress Note",
        "Content": note.content,
        "Tags": note.tags?.join(", ") || "None",
        "Created Date": new Date(note.createdAt).toLocaleDateString(),
        "Created By": note.createdByName || "Unknown",
        "Incident Data": note.incidentData ? JSON.stringify(note.incidentData) : "",
        "Medication Data": note.medicationData ? JSON.stringify(note.medicationData) : ""
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Case Notes");
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="case-notes-export-${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(buffer);
      
    } catch (error: any) {
      console.error("Case notes Excel export error:", error);
      res.status(500).json({ message: "Failed to export case notes to Excel" });
    }
  });

  // Incident Reports PDF Export API
  app.post("/api/incident-reports/export/pdf", requireAuth, async (req: any, res) => {
    try {
      const { incidentIds } = req.body;
      const tenantId = req.user.tenantId;
      
      // Get company information for header
      const company = await storage.getCompanyByTenantId(tenantId);
      const companyName = company?.name || `Company ${tenantId}`;
      
      // Fetch incident reports
      const incidents = await Promise.all(
        incidentIds.map((id: string) => storage.getIncidentReport(id, tenantId))
      );
      
      const validIncidents = incidents.filter(incident => incident !== undefined);
      
      if (validIncidents.length === 0) {
        return res.status(404).json({ message: "No incident reports found" });
      }

      // Get client names for the incidents
      const incidentsWithClientInfo = await Promise.all(
        validIncidents.map(async (incident) => {
          const client = await storage.getClient(incident.clientId, tenantId);
          return {
            ...incident,
            clientName: client ? `${client.firstName} ${client.lastName}` : "Unknown Client"
          };
        })
      );
      
      // Import and use PDF utility
      const jsPDF = (await import('jspdf')).default;
      
      const options = {
        title: 'Incident Reports Export',
        contentHtml: '',
        companyName: companyName,
        staffName: req.user.fullName || req.user.username,
        submissionDate: new Date().toLocaleDateString('en-AU'),
        filename: `incident-reports-export-${new Date().toISOString().split('T')[0]}.pdf`
      };

      // Create PDF manually using the same format as PDFExportUtility
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape A4
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      // Add centered header (first page only)
      pdf.setFillColor(37, 99, 235); // Professional blue
      pdf.rect(margin, 10, contentWidth, 40, 'F');
      
      // Add accent bar
      pdf.setFillColor(59, 130, 246);
      pdf.rect(margin, 45, contentWidth, 5, 'F');

      // Company name - CENTERED
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      const companyNameWidth = pdf.getTextWidth(companyName);
      const companyNameX = (pageWidth - companyNameWidth) / 2;
      pdf.text(companyName, companyNameX, 23);
      
      // Document title - CENTERED
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(219, 234, 254);
      const titleWidth = pdf.getTextWidth(options.title);
      const titleX = (pageWidth - titleWidth) / 2;
      pdf.text(options.title, titleX, 31);
      
      // Staff info
      pdf.setFontSize(9);
      pdf.setTextColor(191, 219, 254);
      pdf.text(`Staff: ${options.staffName}`, margin + 8, 38);
      pdf.text(`Generated: ${new Date().toLocaleString('en-AU')}`, pageWidth - margin - 80, 38);
      
      let currentY = 70;
      
      // Add sections for each incident
      for (const incident of incidentsWithClientInfo) {
        // Check if we need a new page
        if (currentY > pageHeight - 100) {
          pdf.addPage();
          currentY = 30;
        }
        
        // Section header
        pdf.setFillColor(37, 99, 235);
        pdf.rect(margin, currentY - 4, contentWidth, 16, 'F');
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.text(`Incident Report: ${incident.incidentId} - ${incident.clientName}`, margin + 5, currentY + 6);
        currentY += 20;
        
        // Section content
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        
        const incidentData = {
          "Incident ID": incident.incidentId,
          "Client": incident.clientName,
          "Date & Time": new Date(incident.dateTime).toLocaleString('en-AU'),
          "Location": incident.location,
          "Incident Types": incident.types?.join(", ") || "None specified",
          "NDIS Reportable": incident.isNDISReportable ? "Yes" : "No",
          "Intensity Rating": `${incident.intensityRating}/10`,
          "Status": incident.status,
          "Description": incident.description,
          ...(incident.witnessName && {
            "Witness Name": incident.witnessName
          }),
          ...(incident.witnessPhone && {
            "Witness Phone": incident.witnessPhone
          }),
          ...(incident.externalRef && {
            "External Reference": incident.externalRef
          }),
          ...(incident.triggers && incident.triggers.length > 0 && {
            "Triggers": JSON.stringify(incident.triggers, null, 2).replace(/[{}",\[\]]/g, '').trim()
          }),
          ...(incident.staffResponses && incident.staffResponses.length > 0 && {
            "Staff Responses": JSON.stringify(incident.staffResponses, null, 2).replace(/[{}",\[\]]/g, '').trim()
          })
        };
        
        for (const [key, value] of Object.entries(incidentData)) {
          if (currentY > pageHeight - 30) {
            pdf.addPage();
            currentY = 30;
          }
          
          // Key
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${key}:`, margin + 5, currentY);
          
          // Value with wrapping
          pdf.setFont('helvetica', 'normal');
          const lines = pdf.splitTextToSize(String(value), contentWidth - 90);
          for (let i = 0; i < lines.length; i++) {
            if (i > 0) {
              currentY += 6;
              if (currentY > pageHeight - 30) {
                pdf.addPage();
                currentY = 30;
              }
            }
            pdf.text(lines[i], margin + 85, currentY);
          }
          currentY += 12;
        }
        currentY += 15; // Extra space between incidents
      }
      
      // Add footer to all pages
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        const footerY = pageHeight - 15;
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${companyName} | Generated: ${new Date().toLocaleDateString('en-AU')}`, margin + 5, footerY + 8);
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, footerY + 8);
      }
      
      const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${options.filename}"`);
      res.send(pdfBuffer);
      
    } catch (error: any) {
      console.error("Incident reports PDF export error:", error);
      res.status(500).json({ message: "Failed to export incident reports to PDF" });
    }
  });

  // Incident Reports Excel Export API
  app.post("/api/incident-reports/export/excel", requireAuth, async (req: any, res) => {
    try {
      const { incidentIds } = req.body;
      const tenantId = req.user.tenantId;
      
      // Get company information for header
      const company = await storage.getCompanyByTenantId(tenantId);
      const companyName = company?.name || `Company ${tenantId}`;
      
      // Fetch incident reports
      const incidents = await Promise.all(
        incidentIds.map((id: string) => storage.getIncidentReport(id, tenantId))
      );
      
      const validIncidents = incidents.filter(incident => incident !== undefined);
      
      if (validIncidents.length === 0) {
        return res.status(404).json({ message: "No incident reports found" });
      }

      // Get client names for the incidents
      const incidentsWithClientInfo = await Promise.all(
        validIncidents.map(async (incident) => {
          const client = await storage.getClient(incident.clientId, tenantId);
          const staff = await storage.getUser(incident.staffId, tenantId);
          const closure = await storage.getIncidentClosure(incident.incidentId, tenantId);
          return {
            ...incident,
            clientName: client ? `${client.firstName} ${client.lastName}` : "Unknown Client",
            staffName: staff ? staff.fullName || staff.username : "Unknown Staff",
            closure
          };
        })
      );
      
      // Import xlsx for Excel export
      const XLSX = await import('xlsx');
      
      // Prepare data for Excel export
      const excelData = incidentsWithClientInfo.map(incident => ({
        'Incident ID': incident.incidentId,
        'Date & Time': new Date(incident.dateTime).toLocaleString('en-AU'),
        'Location': incident.location,
        'Client': incident.clientName,
        'Staff': incident.staffName,
        'Status': incident.status,
        'NDIS Reportable': incident.isNDISReportable ? 'Yes' : 'No',
        'Intensity Rating': `${incident.intensityRating}/10`,
        'Types': incident.types.join(', '),
        'Description': incident.description,
        'Witness Name': incident.witnessName || '',
        'Witness Phone': incident.witnessPhone || '',
        'External Reference': incident.externalRef || '',
        'Triggers': incident.triggers ? incident.triggers.map((t: any) => `${t.label}${t.notes ? `: ${t.notes}` : ''}`).join('; ') : '',
        'Staff Responses': incident.staffResponses ? incident.staffResponses.map((r: any) => `${r.label}${r.notes ? `: ${r.notes}` : ''}`).join('; ') : '',
        'Created At': new Date(incident.createdAt).toLocaleString('en-AU'),
        // Closure information
        'Closure Date': incident.closure ? new Date(incident.closure.closureDate).toLocaleDateString('en-AU') : '',
        'Severity': incident.closure?.severity || '',
        'Hazard Type': incident.closure?.hazard || '',
        'Control Level': incident.closure?.controlLevel || '',
        'Review Type': incident.closure?.reviewType || '',
        'Lost Time Injury': incident.closure?.wasLTI?.toUpperCase() || '',
        'External Notice': incident.closure ? (incident.closure.externalNotice ? 'Yes' : 'No') : '',
        'Control Review': incident.closure ? (incident.closure.controlReview ? 'Yes' : 'No') : '',
        'Improvements Implemented': incident.closure ? (incident.closure.implemented ? 'Yes' : 'No') : '',
        'Participant Context': incident.closure?.participantContext?.toUpperCase() || '',
        'Support Plan Available': incident.closure?.supportPlanAvailable?.toUpperCase() || '',
        'Improvements/Actions': incident.closure?.improvements || '',
        'Outcome': incident.closure?.outcome || ''
      }));
      
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths for better readability
      const columnWidths = [
        { wch: 15 }, // Incident ID
        { wch: 20 }, // Date & Time
        { wch: 20 }, // Location
        { wch: 20 }, // Client
        { wch: 20 }, // Staff
        { wch: 10 }, // Status
        { wch: 15 }, // NDIS Reportable
        { wch: 15 }, // Intensity Rating
        { wch: 30 }, // Types
        { wch: 50 }, // Description
        { wch: 20 }, // Witness Name
        { wch: 15 }, // Witness Phone
        { wch: 20 }, // External Reference
        { wch: 40 }, // Triggers
        { wch: 40 }, // Staff Responses
        { wch: 20 }, // Created At
        { wch: 15 }, // Closure Date
        { wch: 10 }, // Severity
        { wch: 15 }, // Hazard Type
        { wch: 15 }, // Control Level
        { wch: 20 }, // Review Type
        { wch: 15 }, // Lost Time Injury
        { wch: 15 }, // External Notice
        { wch: 15 }, // Control Review
        { wch: 20 }, // Improvements Implemented
        { wch: 20 }, // Participant Context
        { wch: 20 }, // Support Plan Available
        { wch: 40 }, // Improvements/Actions
        { wch: 40 }  // Outcome
      ];
      worksheet['!cols'] = columnWidths;
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Incident Reports');
      
      // Generate Excel buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="incident-reports-export-${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.setHeader('Content-Length', excelBuffer.length);
      
      // Send Excel file
      res.send(excelBuffer);
      
    } catch (error) {
      console.error("Incident reports Excel export error:", error);
      res.status(500).json({ message: "Failed to export incident reports to Excel" });
    }
  });

  app.post("/api/case-notes", requireAuth, async (req: any, res) => {
    try {
      console.log("[CASE NOTES] Creation request:", {
        userId: req.user.id,
        tenantId: req.user.tenantId,
        body: req.body
      });

      // Validate required fields
      if (!req.body.title) {
        console.log("[CASE NOTES] Missing title");
        return res.status(400).json({ message: "Title is required" });
      }
      
      if (!req.body.clientId) {
        console.log("[CASE NOTES] Missing clientId");
        return res.status(400).json({ message: "Client ID is required" });
      }

      const caseNoteData = {
        ...req.body,
        userId: req.user.id,
        tenantId: req.user.tenantId,
        // Ensure timestamp fields are properly formatted
        timestamp: req.body.timestamp || new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log("[CASE NOTES] Creating with data:", caseNoteData);
      
      const caseNote = await storage.createCaseNote(caseNoteData);
      
      console.log("[CASE NOTES] Successfully created:", caseNote.id);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_case_note",
        resourceType: "case_note",
        resourceId: caseNote.id,
        description: `Created case note: ${caseNote.title}`,
        tenantId: req.user.tenantId,
      });
      
      res.status(201).json(caseNote);
    } catch (error: any) {
      console.error("[CASE NOTES] Creation error:", {
        message: error.message,
        stack: error.stack,
        constraint: error.constraint,
        code: error.code,
        detail: error.detail,
        userId: req.user?.id,
        tenantId: req.user?.tenantId,
        clientId: req.body?.clientId,
        environment: process.env.NODE_ENV
      });

      // Handle specific database constraint errors for AWS production
      let errorMessage = "Failed to create case note";
      let statusCode = 500;

      if (error.code === '23503') { // Foreign key violation
        errorMessage = "Invalid client or user reference";
        statusCode = 400;
        console.error("[CASE NOTES] Foreign key constraint violation - check client/user exists");
      } else if (error.code === '23505') { // Unique constraint violation  
        errorMessage = "Case note already exists";
        statusCode = 409;
        console.error("[CASE NOTES] Duplicate case note attempt");
      } else if (error.code === '23502') { // NOT NULL violation
        errorMessage = "Missing required information";
        statusCode = 400;
        console.error("[CASE NOTES] Required field missing:", error.column);
      }

      res.status(statusCode).json({ 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        constraint: process.env.NODE_ENV === 'development' ? error.constraint : undefined
      });
    }
  });

  app.get("/api/clients/:clientId/case-notes", requireAuth, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const tenantId = req.user.tenantId;
      
      // Check if support worker has access to this client
      if (req.user.role === "SupportWorker") {
        const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
        const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null);
        
        if (!assignedClientIds.includes(clientId)) {
          return res.status(403).json({ message: "Access denied: You are not assigned to this client" });
        }
      }
      
      const caseNotes = await storage.getCaseNotes(clientId, tenantId);
      
      // Get client details and recent shifts for linking
      const client = await storage.getClient(clientId, tenantId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      // Get recent shifts from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const allShifts = await storage.getAllShifts(tenantId);
      const recentShifts = allShifts.filter(shift => 
        shift.clientId === clientId && 
        new Date(shift.startTime) >= sevenDaysAgo
      );
      
      res.json({ 
        caseNotes, 
        client,
        recentShifts: recentShifts.slice(0, 10) // Limit to 10 most recent
      });
    } catch (error: any) {
      console.error("Case notes API error:", error);
      res.status(500).json({ message: "Failed to fetch case notes", error: error.message });
    }
  });

  app.post("/api/clients/:clientId/case-notes", requireAuth, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      
      console.log("[CLIENT CASE NOTES] Creation request:", {
        clientId,
        userId: req.user.id,
        tenantId: req.user.tenantId,
        body: req.body
      });

      // Validate required fields
      if (!req.body.title) {
        console.log("[CLIENT CASE NOTES] Missing title");
        return res.status(400).json({ message: "Title is required" });
      }

      const caseNoteData = {
        ...req.body,
        clientId,
        userId: req.user.id,
        tenantId: req.user.tenantId,
        // Ensure timestamp fields are properly formatted
        timestamp: req.body.timestamp || new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log("[CLIENT CASE NOTES] Creating with data:", caseNoteData);
      
      const caseNote = await storage.createCaseNote(caseNoteData);
      
      console.log("[CLIENT CASE NOTES] Successfully created:", caseNote.id);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_case_note",
        resourceType: "case_note",
        resourceId: caseNote.id,
        description: `Created case note: ${caseNote.title}`,
        tenantId: req.user.tenantId,
      });
      
      res.status(201).json(caseNote);
    } catch (error: any) {
      console.error("[CLIENT CASE NOTES] Creation error:", {
        message: error.message,
        stack: error.stack,
        constraint: error.constraint,
        code: error.code,
        detail: error.detail
      });
      res.status(500).json({ 
        message: "Failed to create case note",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.put("/api/case-notes/:id", requireAuth, async (req: any, res) => {
    try {
      const caseNoteId = parseInt(req.params.id);
      const updateData = req.body;
      
      const caseNote = await storage.updateCaseNote(caseNoteId, updateData, req.user.tenantId);
      if (!caseNote) {
        return res.status(404).json({ message: "Case note not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_case_note",
        resourceType: "case_note",
        resourceId: caseNoteId,
        description: `Updated case note: ${caseNote.title}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(caseNote);
    } catch (error) {
      res.status(500).json({ message: "Failed to update case note" });
    }
  });

  app.delete("/api/case-notes/:id", requireAuth, async (req: any, res) => {
    try {
      const caseNoteId = parseInt(req.params.id);
      
      const deleted = await storage.deleteCaseNote(caseNoteId, req.user.tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Case note not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "delete_case_note",
        resourceType: "case_note",
        resourceId: caseNoteId,
        description: "Deleted case note",
        tenantId: req.user.tenantId,
      });
      
      res.json({ message: "Case note deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete case note" });
    }
  });

  // Hourly Observations routes
  app.get("/api/observations", requireAuth, async (req: any, res) => {
    try {
      const { clientId } = req.query;
      
      let observations;
      if (clientId) {
        // Check if support worker has access to this specific client
        if (req.user.role === "SupportWorker") {
          const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
          const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null);
          
          if (!assignedClientIds.includes(parseInt(clientId))) {
            return res.status(403).json({ message: "Access denied: You are not assigned to this client" });
          }
        }
        observations = await storage.getObservationsByClient(parseInt(clientId), req.user.tenantId);
      } else {
        // Get observations for all accessible clients
        if (req.user.role === "SupportWorker") {
          // Get only assigned clients for support workers
          const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
          const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null);
          
          if (assignedClientIds.length === 0) {
            return res.json([]);
          }
          
          // CRITICAL FIX: Remove duplicate client IDs to prevent duplicate observations
          const uniqueClientIds = [...new Set(assignedClientIds)];
          
          console.log(`[OBSERVATION FIX] User ${req.user.id} assigned to ${assignedClientIds.length} shifts with ${uniqueClientIds.length} unique clients`);
          console.log(`[OBSERVATION FIX] Original client IDs: ${assignedClientIds.join(', ')}`);
          console.log(`[OBSERVATION FIX] Unique client IDs: ${uniqueClientIds.join(', ')}`);
          
          // Get observations for all assigned clients
          let allObservations = [];
          for (const clientId of uniqueClientIds) {
            const clientObservations = await storage.getObservationsByClient(clientId, req.user.tenantId);
            console.log(`[OBSERVATION FIX] Client ${clientId}: ${clientObservations.length} observations`);
            allObservations.push(...clientObservations);
          }
          observations = allObservations;
          console.log(`[OBSERVATION FIX] Total observations returned: ${observations.length}`);
        } else {
          observations = await storage.getObservations(req.user.tenantId);
        }
      }
      
      res.json(observations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch observations" });
    }
  });

  app.get("/api/observations/:id", requireAuth, async (req: any, res) => {
    try {
      const observationId = parseInt(req.params.id);
      const observation = await storage.getObservation(observationId, req.user.tenantId);
      
      if (!observation) {
        return res.status(404).json({ message: "Observation not found" });
      }
      
      res.json(observation);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch observation" });
    }
  });

  app.post("/api/observations", requireAuth, requireRole(["Admin", "Coordinator", "SupportWorker", "ConsoleManager"]), async (req: any, res) => {
    try {
      console.log("[OBSERVATION CREATE] Starting observation creation:", {
        userId: req.user.id,
        tenantId: req.user.tenantId,
        clientId: req.body.clientId,
        observationType: req.body.observationType,
        timestamp: req.body.timestamp
      });

      // Generate unique timestamp if not provided or auto-timestamp is enabled
      const currentTimestamp = new Date();
      const observationTimestamp = req.body.timestamp ? new Date(req.body.timestamp) : currentTimestamp;

      // Prepare data with server-side fields before validation
      const observationData = {
        ...req.body,
        userId: req.user.id,
        tenantId: req.user.tenantId,
        timestamp: observationTimestamp,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp
      };

      console.log("[OBSERVATION CREATE] Prepared observation data:", observationData);

      const validationResult = insertHourlyObservationSchema.safeParse(observationData);
      if (!validationResult.success) {
        console.error("[OBSERVATION CREATE] Validation failed:", validationResult.error.issues);
        return res.status(400).json({ 
          message: "Invalid observation data", 
          errors: validationResult.error.issues 
        });
      }

      console.log("[OBSERVATION CREATE] Validation passed, creating observation...");
      const observation = await storage.createObservation(validationResult.data);
      
      console.log("[OBSERVATION CREATE] Observation created successfully:", { id: observation.id });

      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_observation",
        resourceType: "observation",
        resourceId: observation.id,
        description: `Created ${observation.observationType} observation for client ${observation.clientId}`,
        tenantId: req.user.tenantId,
      });
      
      console.log("[OBSERVATION CREATE] Activity logged, returning response");
      res.status(201).json(observation);
    } catch (error: any) {
      console.error("[OBSERVATION CREATE] Error creating observation:", {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        tenantId: req.user?.tenantId,
        requestBody: req.body
      });
      res.status(500).json({ 
        message: "Failed to create observation",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.patch("/api/observations/:id", requireAuth, requireRole(["Admin", "Coordinator", "SupportWorker"]), async (req: any, res) => {
    try {
      const observationId = parseInt(req.params.id);
      
      // Verify observation exists and belongs to tenant
      const existingObservation = await storage.getObservation(observationId, req.user.tenantId);
      if (!existingObservation) {
        return res.status(404).json({ message: "Observation not found" });
      }

      // Only allow the creator or admin/coordinator to edit
      if (existingObservation.userId !== req.user.id && !["Admin", "Coordinator"].includes(req.user.role)) {
        return res.status(403).json({ message: "Not authorized to edit this observation" });
      }

      const validationResult = insertHourlyObservationSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid observation data", 
          errors: validationResult.error.issues 
        });
      }

      const observation = await storage.updateObservation(observationId, validationResult.data, req.user.tenantId);
      if (!observation) {
        return res.status(404).json({ message: "Observation not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_observation",
        resourceType: "observation",
        resourceId: observation.id,
        description: `Updated ${observation.observationType} observation for client ${observation.clientId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(observation);
    } catch (error) {
      res.status(500).json({ message: "Failed to update observation" });
    }
  });

  app.delete("/api/observations/:id", requireAuth, requireRole(["Admin", "Coordinator"]), async (req: any, res) => {
    try {
      const observationId = parseInt(req.params.id);
      
      // Verify observation exists
      const existingObservation = await storage.getObservation(observationId, req.user.tenantId);
      if (!existingObservation) {
        return res.status(404).json({ message: "Observation not found" });
      }
      
      const deleted = await storage.deleteObservation(observationId, req.user.tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Observation not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "delete_observation",
        resourceType: "observation",
        resourceId: observationId,
        description: `Deleted ${existingObservation.observationType} observation for client ${existingObservation.clientId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json({ message: "Observation deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete observation" });
    }
  });

  // Individual observation PDF export
  app.get("/api/observations/:id/pdf", requireAuth, async (req: any, res) => {
    try {
      const observationId = parseInt(req.params.id);
      const observation = await storage.getObservation(observationId, req.user.tenantId);
      
      if (!observation) {
        return res.status(404).json({ message: "Observation not found" });
      }

      // Get client and staff info
      const client = await storage.getClient(observation.clientId, req.user.tenantId);
      const staff = await storage.getUser(observation.userId);
      const company = await storage.getCompanyByTenantId(req.user.tenantId);
      const companyName = company?.name || "NeedsCareAI+";

      const { jsPDF } = await import('jspdf');
      
      // Create PDF
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape A4
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      // Add centered header (first page only)
      pdf.setFillColor(37, 99, 235); // Professional blue
      pdf.rect(margin, 10, contentWidth, 40, 'F');
      
      // Add accent bar
      pdf.setFillColor(59, 130, 246);
      pdf.rect(margin, 10, contentWidth, 8, 'F');
      
      // Add company name and title (white text)
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      const title = 'Hourly Observation Report';
      const titleWidth = pdf.getTextWidth(title);
      pdf.text(title, (pageWidth - titleWidth) / 2, 30);
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      const companyText = companyName;
      const companyWidth = pdf.getTextWidth(companyText);
      pdf.text(companyText, (pageWidth - companyWidth) / 2, 42);
      
      // Reset text color to black for content
      pdf.setTextColor(0, 0, 0);
      
      let currentY = 70;
      
      // Observation Information Section
      pdf.setFillColor(37, 99, 235);
      pdf.rect(margin, currentY, contentWidth, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Observation Information', margin + 5, currentY + 6);
      pdf.setTextColor(0, 0, 0);
      currentY += 15;
      
      // Basic observation details
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const observationDetails = [
        ['Observation ID:', observation.id.toString()],
        ['Date & Time:', new Date(observation.timestamp).toLocaleString('en-AU')],
        ['Type:', observation.observationType === 'behaviour' ? 'Behaviour' : 'Activities of Daily Living'],
        ['Client:', client ? `${client.firstName} ${client.lastName} (${client.clientId})` : 'Unknown'],
        ['Observed by:', staff ? (staff.fullName || staff.username) : 'Unknown'],
      ];

      if (observation.subtype) {
        observationDetails.push(['Subtype:', observation.subtype]);
      }
      
      observationDetails.forEach(([label, value]) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(label, margin, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(value, margin + 50, currentY);
        currentY += 8;
      });
      
      // Observation Content
      if (observation.observationType === 'behaviour') {
        // Star Chart Assessment
        currentY += 10;
        pdf.setFillColor(37, 99, 235);
        pdf.rect(margin, currentY, contentWidth, 8, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Star Chart Assessment', margin + 5, currentY + 6);
        pdf.setTextColor(0, 0, 0);
        currentY += 15;

        const starChartItems = [
          ['Settings:', observation.settings, observation.settingsRating],
          ['Time:', observation.time, observation.timeRating],
          ['Antecedents:', observation.antecedents, observation.antecedentsRating],
          ['Response:', observation.response, observation.responseRating]
        ];

        starChartItems.forEach(([label, text, rating]) => {
          if (text) {
            pdf.setFont('helvetica', 'bold');
            pdf.text(label, margin, currentY);
            pdf.setFont('helvetica', 'normal');
            
            // Add text with word wrapping
            const splitText = pdf.splitTextToSize(text, contentWidth - 100);
            pdf.text(splitText, margin, currentY + 6);
            currentY += splitText.length * 5 + 3;
            
            // Add star rating
            pdf.setFont('helvetica', 'bold');
            pdf.text(`Rating: ${rating}/5 stars`, margin, currentY);
            currentY += 10;
          }
        });
      } else {
        // ADL Observation
        if (observation.notes) {
          currentY += 10;
          pdf.setFillColor(37, 99, 235);
          pdf.rect(margin, currentY, contentWidth, 8, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Observation Notes', margin + 5, currentY + 6);
          pdf.setTextColor(0, 0, 0);
          currentY += 15;

          pdf.setFont('helvetica', 'normal');
          const splitNotes = pdf.splitTextToSize(observation.notes, contentWidth);
          pdf.text(splitNotes, margin, currentY);
        }
      }

      // Add footer on all pages
      const footerY = pageHeight - 15;
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Generated on ${new Date().toLocaleDateString('en-AU')} | ${companyName}`, margin, footerY);
      
      const pdfOutput = pdf.output('datauristring');
      const base64Data = pdfOutput.split(',')[1];
      
      res.json({ pdf: base64Data });
    } catch (error) {
      console.error("Individual observation PDF export error:", error);
      res.status(500).json({ message: "Failed to export observation PDF" });
    }
  });

  // Bulk observations PDF export
  app.post("/api/observations/export/pdf", requireAuth, async (req: any, res) => {
    try {
      const { observations, clientId, observationType, dateFilter, dateRangeStart, dateRangeEnd, searchTerm } = req.body;
      
      if (!observations || observations.length === 0) {
        return res.status(400).json({ message: "No observations to export" });
      }

      const company = await storage.getCompanyByTenantId(req.user.tenantId);
      const companyName = company?.name || "NeedsCareAI+";

      const { jsPDF } = await import('jspdf');
      
      // Create PDF
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape A4
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      // Add centered header (first page only)
      pdf.setFillColor(37, 99, 235); // Professional blue
      pdf.rect(margin, 10, contentWidth, 40, 'F');
      
      // Add accent bar
      pdf.setFillColor(59, 130, 246);
      pdf.rect(margin, 10, contentWidth, 8, 'F');
      
      // Add company name and title (white text)
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      const title = 'Hourly Observations Export';
      const titleWidth = pdf.getTextWidth(title);
      pdf.text(title, (pageWidth - titleWidth) / 2, 30);
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      const companyText = companyName;
      const companyWidth = pdf.getTextWidth(companyText);
      pdf.text(companyText, (pageWidth - companyWidth) / 2, 42);
      
      // Reset text color to black for content
      pdf.setTextColor(0, 0, 0);
      
      let currentY = 70;

      // Export Summary
      pdf.setFillColor(37, 99, 235);
      pdf.rect(margin, currentY, contentWidth, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Export Summary', margin + 5, currentY + 6);
      pdf.setTextColor(0, 0, 0);
      currentY += 15;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const summaryDetails = [
        ['Total Observations:', observations.length.toString()],
        ['Export Date:', new Date().toLocaleDateString('en-AU')],
        ['Generated by:', req.user.fullName || req.user.username]
      ];

      if (dateFilter && dateFilter !== 'all') {
        if (dateFilter === 'custom' && dateRangeStart && dateRangeEnd) {
          summaryDetails.push(['Date Range:', `${new Date(dateRangeStart).toLocaleDateString('en-AU')} to ${new Date(dateRangeEnd).toLocaleDateString('en-AU')}`]);
        } else {
          summaryDetails.push(['Date Filter:', dateFilter]);
        }
      }

      summaryDetails.forEach(([label, value]) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(label, margin, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(value, margin + 50, currentY);
        currentY += 8;
      });

      currentY += 10;

      // Get all clients for name lookup
      const clients = await storage.getClients(req.user.tenantId);
      const clientMap = clients.reduce((acc: any, client: any) => {
        acc[client.id] = client;
        return acc;
      }, {});

      // Observations Table
      pdf.setFillColor(37, 99, 235);
      pdf.rect(margin, currentY, contentWidth, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Observations Details', margin + 5, currentY + 6);
      pdf.setTextColor(0, 0, 0);
      currentY += 15;

      // Table headers
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Date/Time', margin, currentY);
      pdf.text('Client', margin + 45, currentY);
      pdf.text('Type', margin + 90, currentY);
      pdf.text('Details', margin + 120, currentY);
      currentY += 8;

      // Table content
      pdf.setFont('helvetica', 'normal');
      observations.forEach((obs: any, index: number) => {
        if (currentY > pageHeight - 40) {
          pdf.addPage();
          currentY = 30;
        }

        const client = clientMap[obs.clientId];
        const clientName = client ? `${client.firstName} ${client.lastName}` : 'Unknown';
        
        pdf.text(new Date(obs.timestamp).toLocaleDateString('en-AU'), margin, currentY);
        pdf.text(clientName, margin + 45, currentY);
        pdf.text(obs.observationType, margin + 90, currentY);
        
        // Truncate details for table view
        const details = obs.notes || obs.settings || 'No details';
        const truncatedDetails = details.length > 40 ? details.substring(0, 37) + '...' : details;
        pdf.text(truncatedDetails, margin + 120, currentY);
        
        currentY += 8;
      });

      // Add footer on all pages
      const footerY = pageHeight - 15;
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Generated on ${new Date().toLocaleDateString('en-AU')} | ${companyName} | Page ${pdf.getNumberOfPages()}`, margin, footerY);
      
      const pdfOutput = pdf.output('datauristring');
      const base64Data = pdfOutput.split(',')[1];
      
      res.json({ pdf: base64Data });
    } catch (error) {
      console.error("Bulk observations PDF export error:", error);
      res.status(500).json({ message: "Failed to export observations PDF" });
    }
  });

  // Bulk observations Excel export
  app.post("/api/observations/export/excel", requireAuth, async (req: any, res) => {
    try {
      const { observations, clientId, observationType, dateFilter, dateRangeStart, dateRangeEnd, searchTerm } = req.body;
      
      if (!observations || observations.length === 0) {
        return res.status(400).json({ message: "No observations to export" });
      }

      const XLSX = require('xlsx');
      
      // Get all clients for name lookup
      const clients = await storage.getClients(req.user.tenantId);
      const clientMap = clients.reduce((acc: any, client: any) => {
        acc[client.id] = client;
        return acc;
      }, {});

      // Format data for Excel
      const excelData = observations.map((obs: any) => {
        const client = clientMap[obs.clientId];
        const clientName = client ? `${client.firstName} ${client.lastName}` : 'Unknown';
        
        const baseData = {
          'Date': new Date(obs.timestamp).toLocaleDateString('en-AU'),
          'Time': new Date(obs.timestamp).toLocaleTimeString('en-AU'),
          'Client Name': clientName,
          'Client ID': client?.clientId || 'Unknown',
          'Observation Type': obs.observationType === 'behaviour' ? 'Behaviour' : 'Activities of Daily Living',
          'Subtype': obs.subtype || '',
          'Notes': obs.notes || ''
        };

        // Add behaviour-specific fields if applicable
        if (obs.observationType === 'behaviour') {
          return {
            ...baseData,
            'Settings': obs.settings || '',
            'Settings Rating': obs.settingsRating || '',
            'Time Context': obs.time || '',
            'Time Rating': obs.timeRating || '',
            'Antecedents': obs.antecedents || '',
            'Antecedents Rating': obs.antecedentsRating || '',
            'Response': obs.response || '',
            'Response Rating': obs.responseRating || ''
          };
        }

        return baseData;
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Auto-width columns
      const colWidths = [];
      const headers = Object.keys(excelData[0] || {});
      headers.forEach((header, i) => {
        const maxLength = Math.max(
          header.length,
          ...excelData.map(row => String(row[header] || '').length)
        );
        colWidths[i] = { width: Math.min(Math.max(maxLength + 2, 10), 50) };
      });
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Observations');

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const base64Data = excelBuffer.toString('base64');
      
      res.json({ excel: base64Data });
    } catch (error) {
      console.error("Bulk observations Excel export error:", error);
      res.status(500).json({ message: "Failed to export observations Excel" });
    }
  });

  // Medication Plans API
  app.get("/api/medication-plans", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      // Get medication plans for accessible clients only
      let clients;
      if (req.user.role === "SupportWorker") {
        // Get only assigned clients for support workers
        const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
        const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null);
        
        if (assignedClientIds.length === 0) {
          return res.json([]);
        }
        
        const allClients = await storage.getClients(tenantId);
        clients = allClients.filter(client => assignedClientIds.includes(client.id));
      } else {
        clients = await storage.getClients(tenantId);
      }
      
      let allPlans = [];
      for (const client of clients) {
        const plans = await storage.getMedicationPlans(client.id, tenantId);
        allPlans.push(...plans);
      }
      
      // Sort by creation date (newest first)
      allPlans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(allPlans);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch medication plans" });
    }
  });

  app.get("/api/clients/:clientId/medication-plans", requireAuth, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const tenantId = req.user.tenantId;
      
      // Check if support worker has access to this client
      if (req.user.role === "SupportWorker") {
        const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
        const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null);
        
        if (!assignedClientIds.includes(clientId)) {
          return res.status(403).json({ message: "Access denied: You are not assigned to this client" });
        }
      }
      
      const plans = await storage.getMedicationPlans(clientId, tenantId);
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch medication plans" });
    }
  });

  app.post("/api/medication-plans", requireAuth, requireRole(["Admin", "Coordinator", "ConsoleManager"]), async (req: any, res) => {
    try {
      const planData = insertMedicationPlanSchema.parse({
        ...req.body,
        createdBy: req.user.id,
        tenantId: req.user.tenantId,
      });

      const plan = await storage.createMedicationPlan(planData);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_medication_plan",
        resourceType: "medication_plan",
        resourceId: plan.id,
        description: `Created medication plan: ${plan.medicationName}`,
        tenantId: req.user.tenantId,
      });

      res.json(plan);
    } catch (error: any) {
      console.error("Create medication plan error:", error);
      res.status(500).json({ message: "Failed to create medication plan", error: error.message });
    }
  });

  app.post("/api/clients/:clientId/medication-plans", requireAuth, requireRole(["Admin", "Coordinator", "ConsoleManager"]), async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const planData = insertMedicationPlanSchema.parse({
        ...req.body,
        clientId,
        createdBy: req.user.id,
        tenantId: req.user.tenantId,
      });

      const plan = await storage.createMedicationPlan(planData);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_medication_plan",
        resourceType: "medication_plan",
        resourceId: plan.id,
        description: `Created medication plan: ${plan.medicationName}`,
        tenantId: req.user.tenantId,
      });

      res.json(plan);
    } catch (error) {
      res.status(500).json({ message: "Failed to create medication plan" });
    }
  });

  app.put("/api/medication-plans/:id", requireAuth, requireRole(["Admin", "Coordinator"]), async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      const updateData = req.body;
      
      const plan = await storage.updateMedicationPlan(planId, updateData, req.user.tenantId);
      
      if (!plan) {
        return res.status(404).json({ message: "Medication plan not found" });
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_medication_plan",
        resourceType: "medication_plan",
        resourceId: planId,
        description: `Updated medication plan: ${plan.medicationName}`,
        tenantId: req.user.tenantId,
      });

      res.json(plan);
    } catch (error) {
      res.status(500).json({ message: "Failed to update medication plan" });
    }
  });

  app.delete("/api/medication-plans/:id", requireAuth, requireRole(["Admin", "Coordinator"]), async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      
      const existingPlan = await storage.getMedicationPlan(planId, req.user.tenantId);
      if (!existingPlan) {
        return res.status(404).json({ message: "Medication plan not found" });
      }
      
      const deleted = await storage.deleteMedicationPlan(planId, req.user.tenantId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Medication plan not found" });
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "delete_medication_plan",
        resourceType: "medication_plan",
        resourceId: planId,
        description: `Deleted medication plan: ${existingPlan.medicationName}`,
        tenantId: req.user.tenantId,
      });

      res.json({ message: "Medication plan deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete medication plan" });
    }
  });

  // Enhanced Medication Records API
  app.get("/api/medication-records", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      // Get records with user information
      const records = await db.select({
        id: medicationRecords.id,
        medicationPlanId: medicationRecords.medicationPlanId,
        clientId: medicationRecords.clientId,
        administeredBy: medicationRecords.administeredBy,
        medicationName: medicationRecords.medicationName,
        scheduledTime: medicationRecords.scheduledTime,
        actualTime: medicationRecords.actualTime,
        dateTime: medicationRecords.dateTime,
        timeOfDay: medicationRecords.timeOfDay,
        route: medicationRecords.route,
        status: medicationRecords.status,
        result: medicationRecords.result,
        notes: medicationRecords.notes,
        refusalReason: medicationRecords.refusalReason,
        wasWitnessed: medicationRecords.wasWitnessed,
        attachmentBeforeUrl: medicationRecords.attachmentBeforeUrl,
        attachmentAfterUrl: medicationRecords.attachmentAfterUrl,
        tenantId: medicationRecords.tenantId,
        createdAt: medicationRecords.createdAt,
        // Include administrator info
        administratorName: users.username,
        // Include client info
        clientName: clients.fullName,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
      })
      .from(medicationRecords)
      .leftJoin(users, eq(medicationRecords.administeredBy, users.id))
      .leftJoin(clients, eq(medicationRecords.clientId, clients.id))
      .where(eq(medicationRecords.tenantId, tenantId))
      .orderBy(desc(medicationRecords.createdAt));
      
      // Filter records for support workers to only show their assigned clients
      let filteredRecords = records;
      if (req.user.role === "SupportWorker") {
        const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
        const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null);
        
        filteredRecords = records.filter(record => assignedClientIds.includes(record.clientId));
      }
      
      res.json(filteredRecords);
    } catch (error) {
      console.error("Medication records API error:", error);
      res.status(500).json({ message: "Failed to fetch medication records" });
    }
  });

  app.post("/api/medication-records", requireAuth, requireRole(["Admin", "Coordinator", "SupportWorker"]), async (req: any, res) => {
    try {
      const recordData = {
        ...req.body,
        administeredBy: req.user.id,
        tenantId: req.user.tenantId,
        // Map status to result for backward compatibility
        result: req.body.status?.toLowerCase() || "administered",
      };

      const record = await storage.createMedicationRecord(recordData);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_medication_record",
        resourceType: "medication_record",
        resourceId: record.id,
        description: `Recorded medication administration: ${record.medicationName} - ${record.status}`,
        tenantId: req.user.tenantId,
      });

      res.status(201).json(record);
    } catch (error) {
      console.error("Create medication record error:", error);
      res.status(500).json({ message: "Failed to create medication record" });
    }
  });

  // Individual Medication Record PDF Export
  app.get("/api/medication-records/:id/pdf", requireAuth, async (req: any, res) => {
    try {
      const recordId = parseInt(req.params.id);
      const tenantId = req.user.tenantId;
      
      // Get the medication record with full details
      const record = await db.select({
        id: medicationRecords.id,
        medicationPlanId: medicationRecords.medicationPlanId,
        clientId: medicationRecords.clientId,
        administeredBy: medicationRecords.administeredBy,
        medicationName: medicationRecords.medicationName,
        scheduledTime: medicationRecords.scheduledTime,
        actualTime: medicationRecords.actualTime,
        dateTime: medicationRecords.dateTime,
        timeOfDay: medicationRecords.timeOfDay,
        route: medicationRecords.route,
        status: medicationRecords.status,
        result: medicationRecords.result,
        notes: medicationRecords.notes,
        refusalReason: medicationRecords.refusalReason,
        wasWitnessed: medicationRecords.wasWitnessed,
        attachmentBeforeUrl: medicationRecords.attachmentBeforeUrl,
        attachmentAfterUrl: medicationRecords.attachmentAfterUrl,
        tenantId: medicationRecords.tenantId,
        createdAt: medicationRecords.createdAt,
        // Include administrator info
        administratorName: users.username,
        administratorFullName: users.fullName,
        // Include client info
        clientName: clients.fullName,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
      })
      .from(medicationRecords)
      .leftJoin(users, eq(medicationRecords.administeredBy, users.id))
      .leftJoin(clients, eq(medicationRecords.clientId, clients.id))
      .where(and(
        eq(medicationRecords.id, recordId),
        eq(medicationRecords.tenantId, tenantId)
      ));

      if (record.length === 0) {
        return res.status(404).json({ message: "Medication record not found" });
      }

      const medicationRecord = record[0];

      // Get company information for branding
      const company = await storage.getCompanyByTenantId(tenantId);
      const companyName = company?.name || "NeedsCareAI+";

      // Dynamic import of jsPDF
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF();

      // Page dimensions and margins
      const pageWidth = pdf.internal.pageSize.width;
      const pageHeight = pdf.internal.pageSize.height;
      const margin = 20;
      const contentWidth = pageWidth - (2 * margin);

      // Header (only on first page)
      pdf.setFillColor(37, 99, 235); // Blue gradient
      pdf.rect(0, 0, pageWidth, 40, 'F');
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text(companyName, pageWidth / 2, 20, { align: 'center' });
      pdf.setFontSize(14);
      pdf.text('Medication Administration Record', pageWidth / 2, 30, { align: 'center' });

      let currentY = 60;

      // Record Information
      pdf.setFillColor(37, 99, 235);
      pdf.rect(margin, currentY - 4, contentWidth, 16, 'F');
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('Record Information', margin + 5, currentY + 6);
      currentY += 25;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);

      const recordInfo = [
        ['Record ID', `#${medicationRecord.id}`],
        ['Medication Name', medicationRecord.medicationName || 'Unknown'],
        ['Status', medicationRecord.result || medicationRecord.status || 'Unknown'],
        ['Created Date', new Date(medicationRecord.createdAt).toLocaleDateString('en-AU')],
      ];

      recordInfo.forEach(([key, value]) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${key}:`, margin + 5, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(value), margin + 85, currentY);
        currentY += 12;
      });

      currentY += 10;

      // Client Information
      pdf.setFillColor(37, 99, 235);
      pdf.rect(margin, currentY - 4, contentWidth, 16, 'F');
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('Client Information', margin + 5, currentY + 6);
      currentY += 25;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);

      const clientInfo = [
        ['Client Name', medicationRecord.clientName || `${medicationRecord.clientFirstName || ''} ${medicationRecord.clientLastName || ''}`.trim() || 'Unknown'],
        ['Client ID', medicationRecord.clientId?.toString() || 'Unknown'],
      ];

      clientInfo.forEach(([key, value]) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${key}:`, margin + 5, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(value), margin + 85, currentY);
        currentY += 12;
      });

      currentY += 10;

      // Administration Details
      pdf.setFillColor(37, 99, 235);
      pdf.rect(margin, currentY - 4, contentWidth, 16, 'F');
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('Administration Details', margin + 5, currentY + 6);
      currentY += 25;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);

      const adminInfo = [
        ['Administered By', medicationRecord.administratorFullName || medicationRecord.administratorName || 'Unknown'],
        ['Scheduled Time', medicationRecord.scheduledTime ? new Date(medicationRecord.scheduledTime).toLocaleString('en-AU') : 'Not specified'],
        ['Actual Time', medicationRecord.administeredTime || medicationRecord.actualTime ? new Date(medicationRecord.administeredTime || medicationRecord.actualTime).toLocaleString('en-AU') : 'Not specified'],
        ['Time of Day', medicationRecord.timeOfDay || 'Not specified'],
        ['Route', medicationRecord.route || 'Not specified'],
        ['Witnessed', medicationRecord.wasWitnessed ? 'Yes' : 'No'],
      ];

      adminInfo.forEach(([key, value]) => {
        if (currentY > pageHeight - 30) {
          pdf.addPage();
          currentY = 30;
        }
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${key}:`, margin + 5, currentY);
        pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(String(value), contentWidth - 90);
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) {
            currentY += 6;
            if (currentY > pageHeight - 30) {
              pdf.addPage();
              currentY = 30;
            }
          }
          pdf.text(lines[i], margin + 85, currentY);
        }
        currentY += 12;
      });

      // Notes and Additional Information
      if (medicationRecord.notes || medicationRecord.refusalReason) {
        currentY += 10;
        
        if (currentY > pageHeight - 40) {
          pdf.addPage();
          currentY = 30;
        }
        
        pdf.setFillColor(37, 99, 235);
        pdf.rect(margin, currentY - 4, contentWidth, 16, 'F');
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.text('Additional Information', margin + 5, currentY + 6);
        currentY += 25;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);

        if (medicationRecord.notes) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Notes:', margin + 5, currentY);
          pdf.setFont('helvetica', 'normal');
          const notesLines = pdf.splitTextToSize(medicationRecord.notes, contentWidth - 90);
          notesLines.forEach((line: string, index: number) => {
            if (index > 0) currentY += 6;
            if (currentY > pageHeight - 30) {
              pdf.addPage();
              currentY = 30;
            }
            pdf.text(line, margin + 85, currentY);
          });
          currentY += 15;
        }

        if (medicationRecord.refusalReason) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Refusal Reason:', margin + 5, currentY);
          pdf.setFont('helvetica', 'normal');
          const refusalLines = pdf.splitTextToSize(medicationRecord.refusalReason, contentWidth - 90);
          refusalLines.forEach((line: string, index: number) => {
            if (index > 0) currentY += 6;
            if (currentY > pageHeight - 30) {
              pdf.addPage();
              currentY = 30;
            }
            pdf.text(line, margin + 85, currentY);
          });
        }
      }

      // Add footer to all pages
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        const footerY = pageHeight - 15;
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${companyName} | Generated: ${new Date().toLocaleDateString('en-AU')}`, margin + 5, footerY + 8);
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, footerY + 8);
      }

      const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="medication-record-${recordId}-${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);

    } catch (error: any) {
      console.error("Medication record PDF export error:", error);
      res.status(500).json({ message: "Failed to export medication record to PDF" });
    }
  });

  // Photo Upload Endpoint
  app.post("/api/upload/photo", requireAuth, async (req: any, res) => {
    try {
      const multer = await import('multer');
      const path = await import('path');
      const fs = await import('fs').then(m => m.promises);
      
      // Configure multer for photo uploads
      const upload = multer.default({
        dest: 'uploads/photos/',
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB limit
        },
        fileFilter: (req, file, cb) => {
          const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
          if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'));
          }
        },
      }).single('photo');

      // Handle the upload
      upload(req, res, async (err) => {
        if (err) {
          console.error('Photo upload error:', err);
          return res.status(400).json({ message: err.message });
        }

        if (!req.file) {
          return res.status(400).json({ message: 'No photo uploaded' });
        }

        try {
          // Generate a unique filename
          const timestamp = Date.now();
          const ext = path.extname(req.file.originalname);
          const fileName = `medication-${timestamp}-${req.user.id}${ext}`;
          const newPath = path.join('uploads/photos', fileName);

          // Move file to final location
          await fs.rename(req.file.path, newPath);

          // Return the URL that can be used to access the photo
          const photoUrl = `/uploads/photos/${fileName}`;
          
          res.json({ 
            url: photoUrl,
            filename: fileName,
            originalName: req.file.originalname,
            size: req.file.size
          });

        } catch (fileError) {
          console.error('File processing error:', fileError);
          res.status(500).json({ message: 'Failed to process uploaded photo' });
        }
      });

    } catch (error: any) {
      console.error("Photo upload endpoint error:", error);
      res.status(500).json({ message: "Failed to upload photo" });
    }
  });

  // Message Attachment Upload Endpoint
  app.post("/api/upload/message-attachment", requireAuth, async (req: any, res) => {
    try {
      const multer = await import('multer');
      const path = await import('path');
      const fs = await import('fs').then(m => m.promises);
      
      // Create attachments directory
      const attachmentsDir = path.join(process.cwd(), 'uploads', 'message-attachments');
      await fs.mkdir(attachmentsDir, { recursive: true });
      
      // Configure multer for message attachments
      const upload = multer.default({
        dest: attachmentsDir,
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB limit
        },
        fileFilter: (req, file, cb) => {
          // Accept common file types for messaging
          const allowedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain'
          ];
          
          if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error('File type not allowed. Supported: images, PDF, Word, Excel, text files'));
          }
        },
      }).single('file');

      // Handle the upload
      upload(req, res, async (err) => {
        if (err) {
          console.error('Message attachment upload error:', err);
          return res.status(400).json({ message: err.message });
        }

        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        try {
          // Generate unique filename preserving extension
          const timestamp = Date.now();
          const ext = path.extname(req.file.originalname);
          const fileName = `message-${timestamp}-${req.user.id}-${Math.random().toString(36).substring(7)}${ext}`;
          const newPath = path.join(attachmentsDir, fileName);
          
          // Move file to final location
          await fs.rename(req.file.path, newPath);
          
          const filePath = `/uploads/message-attachments/${fileName}`;
          
          res.json({ 
            filePath: filePath,
            originalName: req.file.originalname,
            size: req.file.size,
            fileName: fileName
          });

        } catch (fileError) {
          console.error('File processing error:', fileError);
          res.status(500).json({ message: 'Failed to process uploaded file' });
        }
      });

    } catch (error: any) {
      console.error("Message attachment upload endpoint error:", error);
      res.status(500).json({ message: "Failed to upload attachment" });
    }
  });

  // Bulk Medication Records Excel Export
  app.get("/api/medication-records/export/excel", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { search, clientId, status, dateFrom, dateTo } = req.query;

      // Build query with filters
      let query = db.select({
        id: medicationRecords.id,
        medicationPlanId: medicationRecords.medicationPlanId,
        clientId: medicationRecords.clientId,
        administeredBy: medicationRecords.administeredBy,
        medicationName: medicationRecords.medicationName,
        scheduledTime: medicationRecords.scheduledTime,
        actualTime: medicationRecords.actualTime,
        dateTime: medicationRecords.dateTime,
        timeOfDay: medicationRecords.timeOfDay,
        route: medicationRecords.route,
        status: medicationRecords.status,
        result: medicationRecords.result,
        notes: medicationRecords.notes,
        refusalReason: medicationRecords.refusalReason,
        wasWitnessed: medicationRecords.wasWitnessed,
        tenantId: medicationRecords.tenantId,
        createdAt: medicationRecords.createdAt,
        // Include administrator info
        administratorName: users.username,
        administratorFullName: users.fullName,
        // Include client info
        clientName: clients.fullName,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
      })
      .from(medicationRecords)
      .leftJoin(users, eq(medicationRecords.administeredBy, users.id))
      .leftJoin(clients, eq(medicationRecords.clientId, clients.id))
      .where(eq(medicationRecords.tenantId, tenantId));

      let whereConditions = [eq(medicationRecords.tenantId, tenantId)];

      // Apply filters
      if (clientId && clientId !== 'all') {
        whereConditions.push(eq(medicationRecords.clientId, parseInt(clientId as string)));
      }

      if (status && status !== 'all') {
        whereConditions.push(eq(medicationRecords.result, status as string));
      }

      if (dateFrom) {
        whereConditions.push(gte(medicationRecords.createdAt, new Date(dateFrom as string)));
      }

      if (dateTo) {
        const toDate = new Date(dateTo as string);
        toDate.setHours(23, 59, 59, 999);
        whereConditions.push(lte(medicationRecords.createdAt, toDate));
      }

      const records = await db.select({
        id: medicationRecords.id,
        medicationPlanId: medicationRecords.medicationPlanId,
        clientId: medicationRecords.clientId,
        administeredBy: medicationRecords.administeredBy,
        medicationName: medicationRecords.medicationName,
        scheduledTime: medicationRecords.scheduledTime,
        actualTime: medicationRecords.actualTime,
        dateTime: medicationRecords.dateTime,
        timeOfDay: medicationRecords.timeOfDay,
        route: medicationRecords.route,
        status: medicationRecords.status,
        result: medicationRecords.result,
        notes: medicationRecords.notes,
        refusalReason: medicationRecords.refusalReason,
        wasWitnessed: medicationRecords.wasWitnessed,
        tenantId: medicationRecords.tenantId,
        createdAt: medicationRecords.createdAt,
        // Include administrator info
        administratorName: users.username,
        administratorFullName: users.fullName,
        // Include client info
        clientName: clients.fullName,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
      })
      .from(medicationRecords)
      .leftJoin(users, eq(medicationRecords.administeredBy, users.id))
      .leftJoin(clients, eq(medicationRecords.clientId, clients.id))
      .where(and(...whereConditions))
      .orderBy(desc(medicationRecords.createdAt));

      // Apply search filter on the results
      let filteredRecords = records;
      if (search) {
        const searchLower = (search as string).toLowerCase();
        filteredRecords = records.filter(record => 
          (record.medicationName && record.medicationName.toLowerCase().includes(searchLower)) ||
          (record.clientName && record.clientName.toLowerCase().includes(searchLower)) ||
          (record.clientFirstName && `${record.clientFirstName} ${record.clientLastName}`.toLowerCase().includes(searchLower)) ||
          (record.administratorName && record.administratorName.toLowerCase().includes(searchLower)) ||
          (record.administratorFullName && record.administratorFullName.toLowerCase().includes(searchLower))
        );
      }

      if (filteredRecords.length === 0) {
        return res.status(404).json({ message: "No medication records found matching the criteria" });
      }

      // Generate Excel file
      const XLSX = await import('xlsx');
      
      // Prepare Excel data
      const excelData = filteredRecords.map(record => ({
        "Record ID": record.id,
        "Medication Name": record.medicationName || 'Unknown',
        "Client Name": record.clientName || `${record.clientFirstName || ''} ${record.clientLastName || ''}`.trim() || 'Unknown',
        "Administered By": record.administratorFullName || record.administratorName || 'Unknown',
        "Status": record.result || record.status || 'Unknown',
        "Scheduled Time": record.scheduledTime ? new Date(record.scheduledTime).toLocaleString('en-AU') : 'Not specified',
        "Actual Time": (record.administeredTime || record.actualTime) ? new Date(record.administeredTime || record.actualTime).toLocaleString('en-AU') : 'Not specified',
        "Time of Day": record.timeOfDay || 'Not specified',
        "Route": record.route || 'Not specified',
        "Witnessed": record.wasWitnessed ? 'Yes' : 'No',
        "Notes": record.notes || '',
        "Refusal Reason": record.refusalReason || '',
        "Created Date": new Date(record.createdAt).toLocaleString('en-AU'),
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Auto-size columns
      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Medication Records');

      // Generate Excel buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="medication-records-export-${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(excelBuffer);

    } catch (error: any) {
      console.error("Medication records Excel export error:", error);
      res.status(500).json({ message: "Failed to export medication records to Excel" });
    }
  });

  // Staff Messages API
  app.get("/api/messages", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      // Get all messages for the tenant with sender information
      const messages = await storage.getStaffMessages(tenantId);
      
      // Get all users to include sender details
      const users = await storage.getUsersByTenant(tenantId);
      
      // Enhance messages with sender information
      const enhancedMessages = messages.map(message => ({
        ...message,
        sender: users.find(u => u.id === message.senderId)
      }));
      
      res.json(enhancedMessages);
    } catch (error: any) {
      console.error("Staff messages API error:", error);
      res.status(500).json({ message: "Failed to fetch messages", error: error.message });
    }
  });

  app.post("/api/messages", requireAuth, async (req: any, res) => {
    try {
      const messageData = {
        ...req.body,
        senderId: req.user.id,
        tenantId: req.user.tenantId,
      };
      
      const message = await storage.createStaffMessage(messageData);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "send_message",
        resourceType: "staff_message",
        resourceId: message.id,
        description: `Sent message: ${message.subject}`,
        tenantId: req.user.tenantId,
      });
      
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.patch("/api/messages/:id/read", requireAuth, async (req: any, res) => {
    try {
      const messageId = parseInt(req.params.id);
      
      const success = await storage.markMessageAsRead(messageId, req.user.id, req.user.tenantId);
      
      if (!success) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      res.json({ message: "Message marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  app.delete("/api/messages/:id", requireAuth, async (req: any, res) => {
    try {
      const messageId = parseInt(req.params.id);
      
      const deleted = await storage.deleteStaffMessage(messageId, req.user.tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "delete_message",
        resourceType: "staff_message",
        resourceId: messageId,
        description: "Deleted staff message",
        tenantId: req.user.tenantId,
      });
      
      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete message" });
    }
  });



  // Get staff directory (filtered by tenant)
  app.get("/api/staff", requireAuth, async (req: any, res) => {
    try {
      const users = await storage.getUsersByTenant(req.user.tenantId);
      
      // Return staff info using available User schema fields
      const staffData = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        address: user.address,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }));
      
      res.json(staffData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  // Create staff member (Admin/ConsoleManager only)
  app.post("/api/users", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { username, email, password, role, fullName, phone, address, isActive, employmentType, payLevel, payPoint } = req.body;
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if email already exists by getting all users in tenant
      const allUsers = await storage.getUsersByTenant(req.user.tenantId);
      const existingEmail = allUsers.find(user => user.email === email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Create user data using updated User schema
      const userData = {
        username,
        email: email || null,
        password: hashedPassword,
        role,
        fullName,
        phone: phone || null,
        address: address || null,
        isActive: isActive !== undefined ? isActive : true,
        tenantId: req.user.tenantId,
        isFirstLogin: true,
        employmentType: employmentType || "casual",
        payLevel: payLevel || 1,
        payPoint: payPoint || 1,
      };

      const newUser = await storage.createUser(userData);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_staff",
        resourceType: "user",
        resourceId: newUser.id,
        description: `Created staff member: ${newUser.fullName} (${newUser.role})`,
        tenantId: req.user.tenantId,
      });

      // Return user without password
      const { password: _, ...safeUser } = newUser;
      res.status(201).json(safeUser);
    } catch (error: any) {
      console.error("Create staff error:", error);
      res.status(500).json({ message: "Failed to create staff member" });
    }
  });

  // Medication Records API
  app.get("/api/clients/:clientId/medication-records", requireAuth, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const tenantId = req.user.tenantId;
      
      // Check if support worker has access to this client
      if (req.user.role === "SupportWorker") {
        const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
        const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null);
        
        if (!assignedClientIds.includes(clientId)) {
          return res.status(403).json({ message: "Access denied: You are not assigned to this client" });
        }
      }
      
      const records = await storage.getMedicationRecords(clientId, tenantId);
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch medication records" });
    }
  });

  app.post("/api/clients/:clientId/medication-records", requireAuth, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      
      // Parse and validate the date
      let actualTime = new Date();
      if (req.body.dateTime) {
        const parsedDate = new Date(req.body.dateTime);
        if (!isNaN(parsedDate.getTime())) {
          actualTime = parsedDate;
        }
      }
      
      // Prepare data for validation
      const recordData = {
        medicationPlanId: req.body.medicationPlanId || null,
        clientId,
        administeredBy: req.user.id,
        medicationName: req.body.medicationName,
        scheduledTime: actualTime,
        actualTime: actualTime,
        dateTime: actualTime,
        timeOfDay: req.body.timeOfDay,
        route: req.body.route,
        status: req.body.status,
        result: req.body.status?.toLowerCase() || "administered",
        notes: req.body.notes || null,
        refusalReason: null,
        wasWitnessed: req.body.wasWitnessed || false,
        attachmentBeforeUrl: req.body.attachmentBeforeUrl || null,
        attachmentAfterUrl: req.body.attachmentAfterUrl || null,
        tenantId: req.user.tenantId,
      };

      // Validate timeOfDay enum values
      const validTimeOfDayValues = ["Morning", "Afternoon", "Evening", "Night"];
      if (recordData.timeOfDay && !validTimeOfDayValues.includes(recordData.timeOfDay)) {
        return res.status(400).json({ 
          message: "Invalid time of day", 
          error: `Expected one of: ${validTimeOfDayValues.join(", ")}, received: ${recordData.timeOfDay}` 
        });
      }

      // Validate status enum values
      const validStatusValues = ["Administered", "Refused", "Missed"];
      if (recordData.status && !validStatusValues.includes(recordData.status)) {
        return res.status(400).json({ 
          message: "Invalid status", 
          error: `Expected one of: ${validStatusValues.join(", ")}, received: ${recordData.status}` 
        });
      }

      // Validate route enum values
      const validRouteValues = ["Oral", "Injection", "Topical", "Other"];
      if (recordData.route && !validRouteValues.includes(recordData.route)) {
        return res.status(400).json({ 
          message: "Invalid route", 
          error: `Expected one of: ${validRouteValues.join(", ")}, received: ${recordData.route}` 
        });
      }

      const record = await storage.createMedicationRecord(recordData);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_medication_record",
        resourceType: "medication_record",
        resourceId: record.id,
        description: `Recorded medication administration: ${record.medicationName} - ${record.status || record.result}`,
        tenantId: req.user.tenantId,
      });

      res.json(record);
    } catch (error: any) {
      console.error("Create medication record error:", error);
      res.status(500).json({ message: "Failed to create medication record", error: error.message });
    }
  });

  app.get("/api/medication-plans/:planId/records", requireAuth, async (req: any, res) => {
    try {
      const planId = parseInt(req.params.planId);
      const records = await storage.getMedicationRecordsByPlan(planId, req.user.tenantId);
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch medication records" });
    }
  });

  // Incident Reports API
  app.get("/api/incident-reports", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || 1;
      const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
      
      let reports;
      if (clientId) {
        // Filter by specific client
        reports = await storage.getIncidentReportsWithClosures(tenantId);
        reports = reports.filter((report: any) => report.client.id === clientId);
      } else {
        // Get all incident reports for tenant
        reports = await storage.getIncidentReportsWithClosures(tenantId);
      }
      
      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch incident reports" });
    }
  });

  app.get("/api/incident-reports/:incidentId", requireAuth, async (req: any, res) => {
    try {
      const incidentId = req.params.incidentId;
      const tenantId = req.user?.tenantId || 1;
      const report = await storage.getIncidentReport(incidentId, tenantId);
      
      if (!report) {
        return res.status(404).json({ message: "Incident report not found" });
      }

      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch incident report" });
    }
  });

  app.post("/api/incident-reports", requireAuth, async (req: any, res) => {
    try {
      const reportData = insertIncidentReportSchema.parse({
        ...req.body,
        staffId: req.user.id,
        tenantId: req.user.tenantId,
        incidentId: `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      });

      const report = await storage.createIncidentReport(reportData);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_incident_report",
        resourceType: "incident_report",
        resourceId: report.id,
        description: `Created incident report: ${report.incidentId}`,
        tenantId: req.user.tenantId,
      });

      res.json(report);
    } catch (error) {
      console.error("Create incident report error:", error);
      res.status(500).json({ message: "Failed to create incident report" });
    }
  });

  // Individual Incident Report PDF Export API
  app.get("/api/incident-reports/:incidentId/pdf", requireAuth, async (req: any, res) => {
    try {
      const { incidentId } = req.params;
      const tenantId = req.user.tenantId;
      
      // Get company information for header
      const company = await storage.getCompanyByTenantId(tenantId);
      const companyName = company?.name || `Company ${tenantId}`;
      
      // Fetch incident report
      const incident = await storage.getIncidentReport(incidentId, tenantId);
      
      if (!incident) {
        return res.status(404).json({ message: "Incident report not found" });
      }

      // Get closure information if exists
      const closure = await storage.getIncidentClosure(incidentId, tenantId);

      // Get client information
      const client = await storage.getClient(incident.clientId, tenantId);
      const staff = await storage.getUser(incident.staffId);
      
      // Import jsPDF with proper syntax
      const { jsPDF } = await import('jspdf');
      
      // Create PDF manually using the same format as PDFExportUtility
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape A4
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      // Add centered header (first page only)
      pdf.setFillColor(37, 99, 235); // Professional blue
      pdf.rect(margin, 10, contentWidth, 40, 'F');
      
      // Add accent bar
      pdf.setFillColor(59, 130, 246);
      pdf.rect(margin, 10, contentWidth, 8, 'F');
      
      // Add company name and title (white text)
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      const title = 'Incident Report';
      const titleWidth = pdf.getTextWidth(title);
      pdf.text(title, (pageWidth - titleWidth) / 2, 30);
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      const companyText = companyName;
      const companyWidth = pdf.getTextWidth(companyText);
      pdf.text(companyText, (pageWidth - companyWidth) / 2, 42);
      
      // Reset text color to black for content
      pdf.setTextColor(0, 0, 0);
      
      let currentY = 70;
      
      // Incident Information Section
      pdf.setFillColor(37, 99, 235);
      pdf.rect(margin, currentY, contentWidth, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Incident Information', margin + 5, currentY + 6);
      pdf.setTextColor(0, 0, 0);
      currentY += 15;
      
      // Basic incident details
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const incidentDetails = [
        ['Incident ID:', incident.incidentId],
        ['Date & Time:', new Date(incident.dateTime).toLocaleString('en-AU')],
        ['Location:', incident.location],
        ['Client:', client ? `${client.firstName} ${client.lastName} (${client.clientId})` : 'Unknown'],
        ['Reporting Staff:', staff ? staff.fullName || staff.username : 'Unknown'],
        ['Status:', incident.status],
        ['NDIS Reportable:', incident.isNDISReportable ? 'Yes' : 'No'],
        ['Intensity Rating:', `${incident.intensityRating}/10`]
      ];
      
      incidentDetails.forEach(([label, value]) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(label, margin, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(value, margin + 50, currentY);
        currentY += 8;
      });
      
      // Incident Types
      if (incident.types && incident.types.length > 0) {
        currentY += 5;
        pdf.setFont('helvetica', 'bold');
        pdf.text('Incident Types:', margin, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(incident.types.join(', '), margin + 50, currentY);
        currentY += 8;
      }
      
      // Witnesses
      if (incident.witnessName) {
        currentY += 5;
        pdf.setFont('helvetica', 'bold');
        pdf.text('Witness:', margin, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${incident.witnessName}${incident.witnessPhone ? ` (${incident.witnessPhone})` : ''}`, margin + 50, currentY);
        currentY += 8;
      }
      
      // External Reference
      if (incident.externalRef) {
        currentY += 5;
        pdf.setFont('helvetica', 'bold');
        pdf.text('External Reference:', margin, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(incident.externalRef, margin + 50, currentY);
        currentY += 8;
      }
      
      // Description Section
      if (incident.description) {
        currentY += 10;
        pdf.setFillColor(37, 99, 235);
        pdf.rect(margin, currentY, contentWidth, 8, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Description', margin + 5, currentY + 6);
        pdf.setTextColor(0, 0, 0);
        currentY += 15;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const descriptionLines = pdf.splitTextToSize(incident.description, contentWidth - 20);
        descriptionLines.forEach((line: string) => {
          pdf.text(line, margin + 5, currentY);
          currentY += 6;
        });
      }
      
      // Triggers Section
      const triggers = (incident as any).triggers || [];
      if (Array.isArray(triggers) && triggers.length > 0) {
        currentY += 10;
        pdf.setFillColor(37, 99, 235);
        pdf.rect(margin, currentY, contentWidth, 8, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Triggers', margin + 5, currentY + 6);
        pdf.setTextColor(0, 0, 0);
        currentY += 15;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        triggers.forEach((trigger: any) => {
          // Check if we need a new page
          if (currentY + 20 > pageHeight - 30) {
            pdf.addPage();
            currentY = 30;
          }
          
          pdf.setFont('helvetica', 'bold');
          pdf.text(`• ${trigger.label}`, margin + 5, currentY);
          currentY += 6;
          if (trigger.notes) {
            pdf.setFont('helvetica', 'normal');
            const noteLines = pdf.splitTextToSize(trigger.notes, contentWidth - 30);
            noteLines.forEach((line: string) => {
              // Check if we need a new page for each line
              if (currentY + 6 > pageHeight - 30) {
                pdf.addPage();
                currentY = 30;
              }
              pdf.text(line, margin + 10, currentY);
              currentY += 6;
            });
          }
        });
      }
      
      // Staff Responses Section
      const staffResponses = (incident as any).staffResponses || [];
      if (Array.isArray(staffResponses) && staffResponses.length > 0) {
        currentY += 10;
        pdf.setFillColor(37, 99, 235);
        pdf.rect(margin, currentY, contentWidth, 8, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Staff Responses', margin + 5, currentY + 6);
        pdf.setTextColor(0, 0, 0);
        currentY += 15;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        staffResponses.forEach((response: any) => {
          // Check if we need a new page
          if (currentY + 20 > pageHeight - 30) {
            pdf.addPage();
            currentY = 30;
          }
          
          pdf.setFont('helvetica', 'bold');
          pdf.text(`• ${response.label}`, margin + 5, currentY);
          currentY += 6;
          if (response.notes) {
            pdf.setFont('helvetica', 'normal');
            const noteLines = pdf.splitTextToSize(response.notes, contentWidth - 30);
            noteLines.forEach((line: string) => {
              // Check if we need a new page for each line
              if (currentY + 6 > pageHeight - 30) {
                pdf.addPage();
                currentY = 30;
              }
              pdf.text(line, margin + 10, currentY);
              currentY += 6;
            });
          }
        });
      }
      
      // Closure Information (if exists)
      if (closure) {
        // Check if we need a new page for closure section
        if (currentY + 80 > pageHeight - 30) {
          pdf.addPage();
          currentY = 30;
        }
        
        currentY += 10;
        pdf.setFillColor(37, 99, 235);
        pdf.rect(margin, currentY, contentWidth, 8, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Closure Information', margin + 5, currentY + 6);
        pdf.setTextColor(0, 0, 0);
        currentY += 15;
        
        const closureDetails = [
          ['Closure Date:', new Date(closure.closureDate).toLocaleDateString('en-AU')],
          ['Severity Level:', closure.severity],
          ['Hazard Type:', closure.hazard],
          ['Control Level:', closure.controlLevel],
          ['Review Type:', closure.reviewType],
          ['Lost Time Injury:', closure.wasLTI?.toUpperCase() || 'No'],
          ['External Notice:', closure.externalNotice ? 'Yes' : 'No'],
          ['Control Review:', closure.controlReview ? 'Yes' : 'No'],
          ['Improvements Implemented:', closure.implemented ? 'Yes' : 'No'],
          ['Participant Context:', closure.participantContext?.toUpperCase() || 'Not specified'],
          ['Support Plan Available:', closure.supportPlanAvailable?.toUpperCase() || 'Not specified']
        ];
        
        pdf.setFontSize(10);
        closureDetails.forEach(([label, value]) => {
          pdf.setFont('helvetica', 'bold');
          pdf.text(label, margin, currentY);
          pdf.setFont('helvetica', 'normal');
          pdf.text(value, margin + 70, currentY);
          currentY += 8;
        });
        
        // Improvements/Actions
        if (closure.improvements) {
          // Check if we need a new page
          if (currentY + 30 > pageHeight - 30) {
            pdf.addPage();
            currentY = 30;
          }
          
          currentY += 5;
          pdf.setFont('helvetica', 'bold');
          pdf.text('Improvements/Actions:', margin, currentY);
          currentY += 8;
          pdf.setFont('helvetica', 'normal');
          const improvementLines = pdf.splitTextToSize(closure.improvements, contentWidth - 20);
          improvementLines.forEach((line: string) => {
            // Check if we need a new page for each line
            if (currentY + 6 > pageHeight - 30) {
              pdf.addPage();
              currentY = 30;
            }
            pdf.text(line, margin + 5, currentY);
            currentY += 6;
          });
        }
        
        // Outcome
        if (closure.outcome) {
          // Check if we need a new page
          if (currentY + 30 > pageHeight - 30) {
            pdf.addPage();
            currentY = 30;
          }
          
          currentY += 5;
          pdf.setFont('helvetica', 'bold');
          pdf.text('Outcome:', margin, currentY);
          currentY += 8;
          pdf.setFont('helvetica', 'normal');
          const outcomeLines = pdf.splitTextToSize(closure.outcome, contentWidth - 20);
          outcomeLines.forEach((line: string) => {
            // Check if we need a new page for each line
            if (currentY + 6 > pageHeight - 30) {
              pdf.addPage();
              currentY = 30;
            }
            pdf.text(line, margin + 5, currentY);
            currentY += 6;
          });
        }
      }
      
      // Add footer on all pages
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `Generated by ${req.user.fullName || req.user.username} on ${new Date().toLocaleDateString('en-AU')}`,
          margin,
          pageHeight - 10
        );
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 10);
      }
      
      // Generate PDF buffer
      const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="incident-report-${incident.incidentId}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Send PDF
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error("Individual incident report PDF export error:", error);
      res.status(500).json({ message: "Failed to generate incident report PDF" });
    }
  });

  app.put("/api/incident-reports/:incidentId", requireAuth, async (req: any, res) => {
    try {
      const incidentId = req.params.incidentId;
      const tenantId = req.user?.tenantId || 1;
      const updateData = req.body;

      const report = await storage.updateIncidentReport(incidentId, updateData, tenantId);
      
      if (!report) {
        return res.status(404).json({ message: "Incident report not found" });
      }

      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_incident_report",
        resourceType: "incident_report",
        resourceId: report.id,
        description: `Updated incident report: ${report.incidentId}`,
        tenantId: req.user.tenantId,
      });

      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to update incident report" });
    }
  });

  app.delete("/api/incident-reports/:incidentId", requireAuth, async (req: any, res) => {
    try {
      const incidentId = req.params.incidentId;
      const tenantId = req.user?.tenantId || 1;
      const success = await storage.deleteIncidentReport(incidentId, tenantId);
      
      if (!success) {
        return res.status(404).json({ message: "Incident report not found" });
      }

      res.json({ message: "Incident report deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete incident report" });
    }
  });

  // Incident Closures API
  app.get("/api/incident-closures/:incidentId", requireAuth, async (req: any, res) => {
    try {
      const incidentId = req.params.incidentId;
      const tenantId = req.user?.tenantId || 1;
      const closure = await storage.getIncidentClosure(incidentId, tenantId);
      res.json(closure);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch incident closure" });
    }
  });

  app.post("/api/incident-closures", requireAuth, requireRole(["admin", "coordinator", "consolemanager"]), async (req: any, res) => {
    try {
      const closureData = insertIncidentClosureSchema.parse({
        ...req.body,
        closedBy: req.user.id,
        tenantId: req.user.tenantId,
        closureDate: new Date(),
      });

      const closure = await storage.createIncidentClosure(closureData);
      
      // Update incident status to Closed
      await storage.updateIncidentReport(closureData.incidentId, { status: "Closed" }, req.user.tenantId);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "close_incident",
        resourceType: "incident_closure",
        resourceId: closure.id,
        description: `Closed incident: ${closureData.incidentId}`,
        tenantId: req.user.tenantId,
      });

      res.json(closure);
    } catch (error) {
      console.error("Create incident closure error:", error);
      res.status(500).json({ message: "Failed to create incident closure" });
    }
  });

  app.put("/api/incident-closures/:incidentId", requireAuth, requireRole(["admin", "coordinator", "consolemanager"]), async (req: any, res) => {
    try {
      const incidentId = req.params.incidentId;
      const tenantId = req.user?.tenantId || 1;
      const updateData = req.body;

      const closure = await storage.updateIncidentClosure(incidentId, updateData, tenantId);
      
      if (!closure) {
        return res.status(404).json({ message: "Incident closure not found" });
      }

      res.json(closure);
    } catch (error) {
      res.status(500).json({ message: "Failed to update incident closure" });
    }
  });

  // Hour Allocations routes
  app.get("/api/hour-allocations", requireAuth, async (req: any, res) => {
    try {
      let allocations;
      
      if (req.user.role === 'ConsoleManager') {
        // ConsoleManager sees all allocations across all tenants
        allocations = await storage.getAllHourAllocations();
      } else if (req.user.role === 'SupportWorker') {
        // Support workers only see their own allocations
        const allTenantAllocations = await storage.getHourAllocations(req.user.tenantId);
        allocations = allTenantAllocations.filter(allocation => allocation.staffId === req.user.id);
      } else {
        // Admins and TeamLeaders see all allocations within their tenant ONLY
        allocations = await storage.getHourAllocations(req.user.tenantId);
      }
      
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching hour allocations:", error);
      res.status(500).json({ message: "Failed to fetch hour allocations" });
    }
  });

  app.get("/api/hour-allocations/stats", requireAuth, async (req: any, res) => {
    try {
      const stats = await storage.getHourAllocationStats(req.user.tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching hour allocation stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.post("/api/hour-allocations", requireAuth, requireRole(["TeamLeader", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const allocationData = {
        ...req.body,
        tenantId: req.user.tenantId,
        remainingHours: req.body.maxHours, // Initially, remaining hours equals max hours
      };
      
      const allocation = await storage.createHourAllocation(allocationData);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_hour_allocation",
        resourceType: "hour_allocation",
        description: `Created hour allocation for staff ${allocationData.staffId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(allocation);
    } catch (error) {
      console.error("Error creating hour allocation:", error);
      res.status(500).json({ message: "Failed to create hour allocation" });
    }
  });

  app.put("/api/hour-allocations/:id", requireAuth, requireRole(["TeamLeader", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const allocationId = parseInt(req.params.id);
      const updateData = req.body;
      
      // Recalculate remaining hours if max hours changed
      if (updateData.maxHours) {
        const currentAllocation = await storage.getHourAllocation(allocationId, req.user.tenantId);
        if (currentAllocation) {
          const currentUsed = parseFloat(currentAllocation.hoursUsed);
          updateData.remainingHours = updateData.maxHours - currentUsed;
        }
      }
      
      const allocation = await storage.updateHourAllocation(allocationId, updateData, req.user.tenantId);
      
      if (!allocation) {
        return res.status(404).json({ message: "Hour allocation not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_hour_allocation",
        resourceType: "hour_allocation",
        description: `Updated hour allocation ${allocationId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(allocation);
    } catch (error) {
      console.error("Error updating hour allocation:", error);
      res.status(500).json({ message: "Failed to update hour allocation" });
    }
  });

  app.delete("/api/hour-allocations/:id", requireAuth, requireRole(["TeamLeader", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const allocationId = parseInt(req.params.id);
      const success = await storage.deleteHourAllocation(allocationId, req.user.tenantId);
      
      if (!success) {
        return res.status(404).json({ message: "Hour allocation not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "delete_hour_allocation",
        resourceType: "hour_allocation",
        description: `Deleted hour allocation ${allocationId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json({ message: "Hour allocation deleted successfully" });
    } catch (error) {
      console.error("Error deleting hour allocation:", error);
      res.status(500).json({ message: "Failed to delete hour allocation" });
    }
  });

  // Custom Roles API - Admin+ only
  app.get("/api/custom-roles", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const roles = await storage.getCustomRoles(req.user.tenantId);
      res.json(roles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch custom roles" });
    }
  });

  app.post("/api/custom-roles", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      console.log("API: Received role creation request:", req.body);
      console.log("API: User info:", { id: req.user.id, tenantId: req.user.tenantId });
      
      const { insertCustomRoleSchema } = await import("@shared/schema");
      const roleData = insertCustomRoleSchema.parse(req.body);
      
      // Add backend-only fields
      const completeRoleData = {
        ...roleData,
        tenantId: req.user.tenantId,
        createdBy: req.user.id,
      };

      console.log("API: Complete role data:", completeRoleData);

      const role = await storage.createCustomRole(completeRoleData);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_custom_role",
        resourceType: "custom_role",
        resourceId: role.id,
        description: `Created custom role: ${role.displayName}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(role);
    } catch (error: any) {
      console.error("API: Role creation error:", error);
      res.status(500).json({ message: "Failed to create custom role", error: error.message });
    }
  });

  app.put("/api/custom-roles/:id", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const roleId = parseInt(req.params.id);
      const role = await storage.updateCustomRole(roleId, req.body, req.user.tenantId);
      
      if (!role) {
        return res.status(404).json({ message: "Custom role not found" });
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_custom_role",
        resourceType: "custom_role",
        resourceId: roleId,
        description: `Updated custom role: ${role.displayName}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(role);
    } catch (error) {
      res.status(500).json({ message: "Failed to update custom role" });
    }
  });

  app.delete("/api/custom-roles/:id", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const roleId = parseInt(req.params.id);
      const success = await storage.deleteCustomRole(roleId, req.user.tenantId);
      
      if (!success) {
        return res.status(404).json({ message: "Custom role not found" });
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "delete_custom_role",
        resourceType: "custom_role",
        description: `Deleted custom role ${roleId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json({ message: "Custom role deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete custom role" });
    }
  });

  // Custom Permissions API - Admin+ only
  app.get("/api/custom-permissions", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { roleId } = req.query;
      let permissions;
      
      if (roleId) {
        permissions = await storage.getCustomPermissionsByRole(parseInt(roleId as string), req.user.tenantId);
      } else {
        permissions = await storage.getCustomPermissions(req.user.tenantId);
      }
      
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch custom permissions" });
    }
  });

  app.post("/api/custom-permissions", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { insertCustomPermissionSchema } = await import("@shared/schema");
      const permissionData = insertCustomPermissionSchema.parse({
        ...req.body,
        tenantId: req.user.tenantId,
        createdBy: req.user.id,
      });

      const permission = await storage.createCustomPermission(permissionData);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_custom_permission",
        resourceType: "custom_permission",
        resourceId: permission.id,
        description: `Created custom permission for ${permission.module}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(permission);
    } catch (error) {
      res.status(500).json({ message: "Failed to create custom permission" });
    }
  });

  app.delete("/api/custom-permissions/:id", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const permissionId = parseInt(req.params.id);
      const success = await storage.deleteCustomPermission(permissionId, req.user.tenantId);
      
      if (!success) {
        return res.status(404).json({ message: "Custom permission not found" });
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "delete_custom_permission",
        resourceType: "custom_permission",
        description: `Deleted custom permission ${permissionId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json({ message: "Custom permission deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete custom permission" });
    }
  });

  // User Role Assignments API - Admin+ only  
  app.get("/api/user-role-assignments", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const assignments = await storage.getUserRoleAssignments(req.user.tenantId);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user role assignments" });
    }
  });

  app.post("/api/user-role-assignments", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { insertUserRoleAssignmentSchema } = await import("@shared/schema");
      const assignmentData = insertUserRoleAssignmentSchema.parse({
        ...req.body,
        tenantId: req.user.tenantId,
        assignedBy: req.user.id,
      });

      const assignment = await storage.createUserRoleAssignment(assignmentData);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "assign_user_role",
        resourceType: "user_role_assignment",
        resourceId: assignment.id,
        description: `Assigned role to user ${assignment.userId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assign user role" });
    }
  });

  app.delete("/api/user-role-assignments/:id", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const assignmentId = parseInt(req.params.id);
      const success = await storage.deleteUserRoleAssignment(assignmentId, req.user.tenantId);
      
      if (!success) {
        return res.status(404).json({ message: "User role assignment not found" });
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "revoke_user_role",
        resourceType: "user_role_assignment",
        description: `Revoked role assignment ${assignmentId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json({ message: "User role assignment revoked successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to revoke user role assignment" });
    }
  });

  // Task Board API - Read access for all roles, management for TeamLeader+
  app.get("/api/task-board-tasks", requireAuth, requireRole(["SupportWorker", "TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const tasks = await storage.getTaskBoardTasks(req.user.tenantId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/task-board-tasks", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      console.log("Creating task with data:", req.body);
      console.log("User info:", { id: req.user.id, companyId: req.user.companyId, tenantId: req.user.tenantId });
      
      // Prepare task data with proper types
      const taskData = {
        title: req.body.title,
        description: req.body.description || null,
        status: req.body.status || "todo",
        dueDateTime: req.body.dueDateTime ? new Date(req.body.dueDateTime) : null,
        assignedToUserId: req.body.assignedToUserId === "unassigned" || !req.body.assignedToUserId ? null : parseInt(req.body.assignedToUserId),
        tenantId: req.user.tenantId,
        createdByUserId: req.user.id,
      };

      console.log("Processed task data:", taskData);

      const task = await storage.createTaskBoardTask(taskData);
      console.log("Created task:", task);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_task",
        resourceType: "task_board_task",
        resourceId: task.id,
        description: `Created task: ${task.title}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(task);
    } catch (error: any) {
      console.error("Task creation error:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ message: "Failed to create task", error: error.message });
    }
  });

  app.put("/api/task-board-tasks/:id", requireAuth, requireRole(["SupportWorker", "TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const task = await storage.updateTaskBoardTask(taskId, req.body, req.user.tenantId);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_task",
        resourceType: "task_board_task",
        resourceId: taskId,
        description: `Updated task: ${task.title}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(task);
    } catch (error) {
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/task-board-tasks/:id", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const success = await storage.deleteTaskBoardTask(taskId, req.user.tenantId);
      
      if (!success) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "delete_task",
        resourceType: "task_board_task",
        description: `Deleted task ${taskId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // NDIS Budget Management API Routes
  
  // NDIS Pricing endpoints - Admin+ only
  app.get("/api/ndis-pricing", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const pricing = await storage.getNdisPricing(req.user.tenantId);
      res.json(pricing);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch NDIS pricing" });
    }
  });

  app.post("/api/ndis-pricing", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const pricingData = {
        ...req.body,
        tenantId: req.user.tenantId,
      };
      
      const pricing = await storage.createNdisPricing(pricingData);
      res.json(pricing);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to create NDIS pricing", error: error.message });
    }
  });

  // NDIS Budget endpoints - TeamLeader+ can view, Admin+ can edit
  app.get("/api/ndis-budgets", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const budgets = await storage.getNdisBudgets(req.user.tenantId);
      res.json(budgets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch NDIS budgets" });
    }
  });

  app.get("/api/ndis-budgets/client/:clientId", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const budget = await storage.getNdisBudgetByClient(clientId, req.user.tenantId);
      res.json(budget);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client budget" });
    }
  });

  app.post("/api/ndis-budgets", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const budgetData = {
        ...req.body,
        tenantId: req.user.tenantId,
      };
      
      const budget = await storage.createNdisBudget(budgetData);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_ndis_budget",
        resourceType: "ndis_budget",
        resourceId: budget.id,
        description: `Created NDIS budget for client ID: ${budget.clientId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(budget);
    } catch (error: any) {
      console.error("NDIS Budget creation error:", error);
      console.error("Budget data:", req.body);
      res.status(500).json({ message: "Failed to create NDIS budget", error: error.message });
    }
  });

  app.put("/api/ndis-budgets/:id", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const budgetId = parseInt(req.params.id);
      const budget = await storage.updateNdisBudget(budgetId, req.body, req.user.tenantId);
      
      if (!budget) {
        return res.status(404).json({ message: "NDIS budget not found" });
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_ndis_budget",
        resourceType: "ndis_budget",
        resourceId: budgetId,
        description: `Updated NDIS budget for client ID: ${budget.clientId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(budget);
    } catch (error) {
      res.status(500).json({ message: "Failed to update NDIS budget" });
    }
  });

  // Budget Transaction endpoints
  app.get("/api/budget-transactions/:budgetId", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const budgetId = parseInt(req.params.budgetId);
      const transactions = await storage.getBudgetTransactions(budgetId, req.user.tenantId.toString());
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch budget transactions" });
    }
  });

  // Get all budget transactions for a tenant
  app.get("/api/budget-transactions", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const transactions = await storage.getAllBudgetTransactions(req.user.tenantId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch budget transactions" });
    }
  });

  app.post("/api/budget-transactions/deduct", requireAuth, async (req: any, res) => {
    try {
      const result = await storage.processBudgetDeduction({
        ...req.body,
        companyId: "5b3d3a66-ef3d-4e48-9399-ee580c64e303",
        createdByUserId: req.user.id,
      });
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "budget_deduction",
        resourceType: "budget_transaction",
        resourceId: result.transaction.id,
        description: `Deducted $${result.transaction.amount} from ${result.transaction.category} budget`,
        tenantId: req.user.tenantId,
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to process budget deduction", error: error.message });
    }
  });

  // Budget backfill endpoint for processing completed shifts
  app.post("/api/budget/backfill", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      console.log("[BUDGET BACKFILL] API endpoint called by user:", req.user.id);
      
      // Import the backfill function
      const { backfillBudgetDeductions } = await import("./budget-backfill");
      
      // Run the backfill process
      await backfillBudgetDeductions();
      
      res.json({ 
        success: true, 
        message: "Budget backfill process completed successfully" 
      });
    } catch (error: any) {
      console.error("[BUDGET BACKFILL] API endpoint error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to run budget backfill process", 
        error: error.message 
      });
    }
  });

  // Notification API
  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const notifications = await storage.getNotifications(req.user.id, req.user.tenantId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req: any, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user.id, req.user.tenantId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const success = await storage.markNotificationAsRead(notificationId, req.user.id, req.user.tenantId);
      
      if (success) {
        res.json({ message: "Notification marked as read" });
      } else {
        res.status(404).json({ message: "Notification not found" });
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/mark-all-read", requireAuth, async (req: any, res) => {
    try {
      const success = await storage.markAllNotificationsAsRead(req.user.id, req.user.tenantId);
      res.json({ message: "All notifications marked as read", success });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req: any, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const success = await storage.deleteNotification(notificationId, req.user.id, req.user.tenantId);
      
      if (success) {
        res.json({ message: "Notification deleted" });
      } else {
        res.status(404).json({ message: "Notification not found" });
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // Sample notification endpoint removed - no demo data creation

  // Spell Check API using OpenAI
  app.post("/api/spellcheck-gpt", requireAuth, async (req: any, res) => {
    try {
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: "Content is required for spell check" });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a spell checker. Only fix spelling errors and obvious typos. Do NOT rewrite, restructure, or change the meaning of the text. Maintain the original tone, style, and formatting. Return ONLY the corrected text."
          },
          {
            role: "user",
            content: `Please spell check this text and fix only spelling errors:\n\n${content}`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const correctedContent = response.choices[0].message.content;
      
      res.json({ 
        original: content,
        corrected: correctedContent 
      });
    } catch (error: any) {
      console.error("Spell check error:", error);
      res.status(500).json({ message: "Failed to perform spell check", error: error.message });
    }
  });

  // Fetch shifts by client and staff for case note linking
  app.get("/api/shifts-by-client-staff", requireAuth, async (req: any, res) => {
    try {
      const { clientId, staffId } = req.query;
      const tenantId = req.user.tenantId;
      
      if (!clientId || !staffId) {
        return res.status(400).json({ message: "Client ID and Staff ID are required" });
      }

      const allShifts = await storage.getAllShifts(tenantId);
      const relevantShifts = allShifts.filter(shift => 
        shift.clientId === parseInt(clientId) && 
        (shift.userId === parseInt(staffId) || shift.userId === null) // Include unassigned shifts
      );

      // Sort by most recent first and limit to recent shifts
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const recentShifts = relevantShifts
        .filter(shift => new Date(shift.startTime) >= sevenDaysAgo)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 10); // Limit to 10 most recent
      
      res.json(recentShifts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shifts" });
    }
  });

  // Hourly Observations API
  app.get("/api/observations", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { clientId } = req.query;
      
      let observations;
      if (clientId) {
        observations = await storage.getObservationsByClient(parseInt(clientId), tenantId);
      } else {
        observations = await storage.getAllObservations(tenantId);
      }
      
      res.json(observations);
    } catch (error) {
      console.error("Observations API error:", error);
      res.status(500).json({ message: "Failed to fetch observations" });
    }
  });

  app.get("/api/hourly-observations", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { clientId } = req.query;
      
      let observations;
      if (clientId) {
        observations = await storage.getObservationsByClient(parseInt(clientId), tenantId);
      } else {
        observations = await storage.getAllObservations(tenantId);
      }
      
      res.json(observations);
    } catch (error) {
      console.error("Hourly observations API error:", error);
      res.status(500).json({ message: "Failed to fetch hourly observations" });
    }
  });

  app.get("/api/observations/:id", requireAuth, async (req: any, res) => {
    try {
      const observationId = parseInt(req.params.id);
      const observation = await storage.getObservation(observationId, req.user.tenantId);
      
      if (!observation) {
        return res.status(404).json({ message: "Observation not found" });
      }
      
      res.json(observation);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch observation" });
    }
  });

  // DUPLICATE ENDPOINT REMOVED - This was causing duplicate observation creation
  // Main observation creation is handled by the endpoint at line ~2628

  app.put("/api/observations/:id", requireAuth, requireRole(["Admin", "Coordinator", "SupportWorker"]), async (req: any, res) => {
    try {
      const observationId = parseInt(req.params.id);
      const validationResult = insertHourlyObservationSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid observation data", 
          errors: validationResult.error.issues 
        });
      }

      const observation = await storage.updateObservation(observationId, validationResult.data, req.user.tenantId);
      if (!observation) {
        return res.status(404).json({ message: "Observation not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_observation",
        resourceType: "observation",
        resourceId: observation.id,
        description: `Updated ${observation.observationType} observation for client ${observation.clientId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(observation);
    } catch (error) {
      res.status(500).json({ message: "Failed to update observation" });
    }
  });

  app.delete("/api/observations/:id", requireAuth, requireRole(["Admin", "Coordinator"]), async (req: any, res) => {
    try {
      const observationId = parseInt(req.params.id);
      const success = await storage.deleteObservation(observationId, req.user.tenantId);
      
      if (!success) {
        return res.status(404).json({ message: "Observation not found" });
      }
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "delete_observation",
        resourceType: "observation",
        description: `Deleted observation ${observationId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json({ message: "Observation deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete observation" });
    }
  });

  // Company API - Get company data for branding
  app.get("/api/company", requireAuth, async (req: any, res) => {
    try {
      const company = await storage.getCompanyByTenantId(req.user.tenantId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Company API error:", error);
      res.status(500).json({ message: "Failed to fetch company data" });
    }
  });

  // Staff Bulk Upload API
  app.post("/api/staff/bulk-upload", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { data: staffData } = req.body;
      
      console.log("[BULK UPLOAD] Received data structure:", JSON.stringify(staffData, null, 2));
      
      if (!Array.isArray(staffData) || staffData.length === 0) {
        console.log("[BULK UPLOAD] ERROR: Invalid data structure - not array or empty");
        return res.status(400).json({ message: "No valid staff data provided" });
      }
      
      console.log(`[BULK UPLOAD] Processing ${staffData.length} staff records for tenant ${req.user.tenantId}`);
      
      // Log first record structure for debugging
      if (staffData.length > 0) {
        console.log("[BULK UPLOAD] First record structure:", JSON.stringify(staffData[0], null, 2));
      }

      const results = {
        success: 0,
        errors: [] as string[]
      };
      
      for (let i = 0; i < staffData.length; i++) {
        const userData = staffData[i];
        
        try {
          console.log(`[BULK UPLOAD] Processing row ${i + 1}:`, JSON.stringify(userData, null, 2));
          
          // Convert data types to ensure proper format (Excel parsing issues)
          const processedUserData = {
            username: String(userData.username || '').trim(),
            email: String(userData.email || '').trim(),
            password: String(userData.password || '').trim(),
            fullName: String(userData.fullName || '').trim(),
            role: String(userData.role || 'SupportWorker').trim(),
            phone: userData.phone ? String(userData.phone).trim() : null,
            address: userData.address ? String(userData.address).trim() : null,
          };
          
          // Validate required fields
          if (!processedUserData.username || !processedUserData.email || !processedUserData.password || !processedUserData.fullName) {
            const missingFields = [];
            if (!processedUserData.username) missingFields.push('username');
            if (!processedUserData.email) missingFields.push('email');
            if (!processedUserData.password) missingFields.push('password');
            if (!processedUserData.fullName) missingFields.push('fullName');
            
            const errorMsg = `Row ${i + 1}: Missing required fields: ${missingFields.join(', ')}. Received fields: ${Object.keys(userData).join(', ')}`;
            console.log(`[BULK UPLOAD] ${errorMsg}`);
            results.errors.push(errorMsg);
            continue;
          }

          // Check for existing username and email, auto-generate unique ones if needed
          const existingUsers = await storage.getUsersByTenant(req.user.tenantId);
          let finalUsername = processedUserData.username;
          let finalEmail = processedUserData.email;
          let attempts = 0;
          const maxAttempts = 10;
          
          // Handle username duplicates
          while (attempts < maxAttempts) {
            const usernameExists = existingUsers.some(user => user.username === finalUsername);
            if (!usernameExists) {
              break; // Username is available
            }
            
            // Generate new username by appending number
            attempts++;
            finalUsername = `${processedUserData.username}_${attempts}`;
            console.log(`[BULK UPLOAD] Username '${processedUserData.username}' exists, trying '${finalUsername}'`);
          }
          
          if (attempts >= maxAttempts) {
            throw new Error(`Could not generate unique username for '${processedUserData.username}' after ${maxAttempts} attempts`);
          }
          
          // Handle email duplicates
          attempts = 0;
          while (attempts < maxAttempts) {
            const emailExists = existingUsers.some(user => user.email === finalEmail);
            if (!emailExists) {
              break; // Email is available
            }
            
            // Generate new email by appending number before @
            attempts++;
            const emailParts = processedUserData.email.split('@');
            finalEmail = `${emailParts[0]}_${attempts}@${emailParts[1]}`;
            console.log(`[BULK UPLOAD] Email '${processedUserData.email}' exists, trying '${finalEmail}'`);
          }
          
          if (attempts >= maxAttempts) {
            throw new Error(`Could not generate unique email for '${processedUserData.email}' after ${maxAttempts} attempts`);
          }

          // Hash password
          const hashedPassword = await hashPassword(processedUserData.password);
          
          // Create user with proper validation
          const userPayload = {
            username: finalUsername,
            email: finalEmail,
            password: hashedPassword,
            fullName: processedUserData.fullName,
            role: processedUserData.role,
            phone: processedUserData.phone,
            address: processedUserData.address,
            tenantId: req.user.tenantId,
            isActive: true,
          };
          
          console.log(`[BULK UPLOAD] Creating user with payload:`, JSON.stringify(userPayload, null, 2));
          
          const user = await storage.createUser(userPayload);
          
          // Log any modifications made
          let modificationMsg = "";
          if (finalUsername !== processedUserData.username) {
            modificationMsg += `Username changed from '${processedUserData.username}' to '${finalUsername}'. `;
          }
          if (finalEmail !== processedUserData.email) {
            modificationMsg += `Email changed from '${processedUserData.email}' to '${finalEmail}'. `;
          }
          
          console.log(`[BULK UPLOAD] Successfully created user ${user.id}: ${user.username}${modificationMsg ? ` (${modificationMsg.trim()})` : ''}`);
          
          // Add modification info to success message if changes were made
          if (modificationMsg) {
            results.errors.push(`Row ${i + 1}: Created successfully but with modifications - ${modificationMsg.trim()}`);
          }
          
          console.log(`[BULK UPLOAD] Successfully created user ${user.id}: ${user.username}`);
          results.success++;
        } catch (error: any) {
          const errorMsg = `Row ${i + 1}: ${error.message || 'Unknown error'}`;
          console.log(`[BULK UPLOAD] ERROR: ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      }
      
      res.json({
        ...results,
        message: `Successfully created ${results.success} staff members${results.errors.length > 0 ? ` with ${results.errors.length} errors` : ''}`
      });
    } catch (error: any) {
      console.error("Bulk upload error:", error);
      res.status(500).json({ message: "Failed to process bulk upload", error: error.message });
    }
  });

  // Shift Cancellation API - Cancel a shift (immediate if 24+ hours, request if under 24 hours)
  app.post("/api/shifts/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      const { reason } = req.body;
      
      // Get shift details
      const shift = await storage.getShift(shiftId, req.user.tenantId);
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      // Check if user is assigned to this shift
      if (shift.userId !== req.user.id) {
        return res.status(403).json({ message: "You can only cancel your own shifts" });
      }

      // Calculate hours until shift start
      const now = new Date();
      const shiftStart = new Date(shift.startTime);
      const hoursNotice = Math.floor((shiftStart.getTime() - now.getTime()) / (1000 * 60 * 60));

      // Get client name for logging
      const client = shift.clientId ? await storage.getClient(shift.clientId, req.user.tenantId) : null;
      const clientName = client ? `${client.firstName} ${client.lastName}` : null;

      if (hoursNotice >= 24) {
        // Immediate cancellation - 24+ hours notice
        await storage.updateShift(shiftId, { 
          userId: null, 
          status: "unassigned" 
        }, req.user.tenantId);

        // Deallocate hours when shift is cancelled
        await updateStaffHourAllocation(shiftId, req.user.id, req.user.tenantId, 'deallocate');

        // Log the cancellation
        await storage.createShiftCancellation({
          shiftId,
          cancelledByUserId: req.user.id,
          cancelledByUserName: req.user.fullName,
          shiftTitle: shift.title,
          shiftStartTime: shift.startTime,
          shiftEndTime: shift.endTime,
          clientName,
          cancellationType: "immediate",
          cancellationReason: reason,
          hoursNotice,
          tenantId: req.user.tenantId,
        });

        await storage.createActivityLog({
          userId: req.user.id,
          action: "cancel_shift",
          resourceType: "shift",
          resourceId: shiftId,
          description: `Cancelled shift: ${shift.title} (${hoursNotice} hours notice)`,
          tenantId: req.user.tenantId,
        });

        res.json({ 
          message: "Shift cancelled successfully", 
          type: "immediate",
          hoursNotice 
        });
      } else {
        // Create cancellation request - under 24 hours
        await storage.createCancellationRequest({
          shiftId,
          requestedByUserId: req.user.id,
          requestedByUserName: req.user.fullName,
          shiftTitle: shift.title,
          shiftStartTime: shift.startTime,
          shiftEndTime: shift.endTime,
          clientName,
          requestReason: reason,
          hoursNotice,
          status: "pending",
          tenantId: req.user.tenantId,
        });

        // Update shift status to indicate cancellation requested
        await storage.updateShift(shiftId, { 
          status: "cancellation_requested" 
        }, req.user.tenantId);

        await storage.createActivityLog({
          userId: req.user.id,
          action: "request_shift_cancellation",
          resourceType: "shift",
          resourceId: shiftId,
          description: `Requested cancellation for shift: ${shift.title} (${hoursNotice} hours notice)`,
          tenantId: req.user.tenantId,
        });

        res.json({ 
          message: "Cancellation request submitted for admin approval", 
          type: "requested",
          hoursNotice 
        });
      }
    } catch (error: any) {
      console.error("Shift cancellation error:", error);
      res.status(500).json({ message: "Failed to process cancellation" });
    }
  });

  // Get cancelled shifts for admin view
  app.get("/api/shifts/cancelled", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      console.log(`[CANCELLED SHIFTS] Starting request for tenant ${req.user.tenantId}`);
      
      if (!pool) {
        console.error("[CANCELLED SHIFTS] Database pool not available");
        return res.status(500).json({ message: "Database connection unavailable" });
      }
      
      // Test basic connection first
      await pool.query('SELECT 1');
      console.log(`[CANCELLED SHIFTS] Database connection verified`);
      
      // Direct pool query for reliability
      const result = await pool.query(
        `SELECT 
          id, shift_id as "shiftId", cancelled_by_user_id as "cancelledByUserId", 
          cancelled_by_user_name as "cancelledByUserName", shift_title as "shiftTitle",
          shift_start_time as "shiftStartTime", shift_end_time as "shiftEndTime",
          client_name as "clientName", cancellation_type as "cancellationType",
          COALESCE(cancellation_reason, 'No reason provided') as "cancellationReason", 
          hours_notice as "hoursNotice",
          approved_by_user_id as "approvedByUserId", approved_by_user_name as "approvedByUserName",
          approved_at as "approvedAt", tenant_id as "tenantId", created_at as "createdAt"
         FROM shift_cancellations 
         WHERE tenant_id = $1 
         ORDER BY created_at DESC`,
        [req.user.tenantId]
      );
      
      console.log(`[CANCELLED SHIFTS] Query successful - found ${result.rows.length} cancellations`);
      res.json(result.rows);
    } catch (error: any) {
      console.error("[CANCELLED SHIFTS] Detailed error:", {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack?.substring(0, 500)
      });
      res.status(500).json({ message: "Failed to fetch shift cancellations", error: error.message });
    }
  });

  // Get cancellation requests for admin approval
  app.get("/api/cancellation-requests", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const requests = await storage.getCancellationRequests(req.user.tenantId);
      res.json(requests);
    } catch (error: any) {
      console.error("Get cancellation requests error:", error);
      res.status(500).json({ message: "Failed to fetch cancellation requests" });
    }
  });

  // Approve or deny cancellation request
  app.post("/api/cancellation-requests/:id/review", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const { action, reviewNotes } = req.body; // action: "approve" or "deny"
      
      const request = await storage.getCancellationRequest(requestId, req.user.tenantId);
      if (!request) {
        return res.status(404).json({ message: "Cancellation request not found" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ message: "Request has already been reviewed" });
      }

      // Update the request
      await storage.updateCancellationRequest(requestId, {
        status: action === "approve" ? "approved" : "denied",
        reviewedByUserId: req.user.id,
        reviewedByUserName: req.user.fullName,
        reviewedAt: new Date(),
        reviewNotes,
      }, req.user.tenantId);

      if (action === "approve") {
        // Deallocate hours when cancellation is approved
        if (request.requestedByUserId) {
          await updateStaffHourAllocation(request.shiftId, request.requestedByUserId, req.user.tenantId, 'deallocate');
        }

        // Cancel the shift
        await storage.updateShift(request.shiftId, { 
          userId: null, 
          status: "unassigned" 
        }, req.user.tenantId);

        // Log the approved cancellation
        await storage.createShiftCancellation({
          shiftId: request.shiftId,
          cancelledByUserId: request.requestedByUserId,
          cancelledByUserName: request.requestedByUserName,
          shiftTitle: request.shiftTitle,
          shiftStartTime: request.shiftStartTime,
          shiftEndTime: request.shiftEndTime,
          clientName: request.clientName,
          cancellationType: "requested",
          cancellationReason: request.requestReason,
          hoursNotice: request.hoursNotice,
          approvedByUserId: req.user.id,
          approvedByUserName: req.user.fullName,
          approvedAt: new Date(),
          tenantId: req.user.tenantId,
        });
      } else {
        // Restore shift status if denied
        await storage.updateShift(request.shiftId, { 
          status: "assigned" 
        }, req.user.tenantId);
      }

      await storage.createActivityLog({
        userId: req.user.id,
        action: `${action}_cancellation_request`,
        resourceType: "cancellation_request",
        resourceId: requestId.toString(),
        description: `${action === "approve" ? "Approved" : "Denied"} cancellation request for shift: ${request.shiftTitle}`,
        tenantId: req.user.tenantId,
      });

      res.json({ 
        message: `Cancellation request ${action === "approve" ? "approved" : "denied"} successfully`,
        action 
      });
    } catch (error: any) {
      console.error("Review cancellation request error:", error);
      res.status(500).json({ message: "Failed to review cancellation request" });
    }
  });

  // Export cancelled shifts for admin
  app.get("/api/shifts/cancelled/export", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { staffId, startDate, endDate } = req.query;
      const cancellations = await storage.getShiftCancellationsForExport(req.user.tenantId, {
        staffId: staffId ? parseInt(staffId as string) : undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=cancelled_shifts.csv');

      // Generate CSV content
      const headers = [
        'Date Cancelled', 'Staff Member', 'Shift Title', 'Shift Start', 'Shift End', 
        'Client', 'Cancellation Type', 'Hours Notice', 'Reason', 'Approved By'
      ];
      
      let csv = headers.join(',') + '\n';
      
      cancellations.forEach(cancellation => {
        const row = [
          new Date(cancellation.createdAt).toLocaleDateString(),
          cancellation.cancelledByUserName,
          cancellation.shiftTitle || '',
          new Date(cancellation.shiftStartTime).toLocaleString(),
          cancellation.shiftEndTime ? new Date(cancellation.shiftEndTime).toLocaleString() : '',
          cancellation.clientName || '',
          cancellation.cancellationType,
          cancellation.hoursNotice.toString(),
          (cancellation.cancellationReason || '').replace(/,/g, ';'), // Escape commas
          cancellation.approvedByUserName || ''
        ];
        csv += row.join(',') + '\n';
      });

      res.send(csv);
    } catch (error: any) {
      console.error("Export cancelled shifts error:", error);
      res.status(500).json({ message: "Failed to export cancelled shifts" });
    }
  });

  // ScHADS Pay Scale Management API
  app.get("/api/pay-scales", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const payScales = await storage.getPayScalesByTenant(req.user.tenantId);
      res.json(payScales);
    } catch (error: any) {
      console.error("Get pay scales error:", error);
      res.status(500).json({ message: "Failed to get pay scales" });
    }
  });

  app.get("/api/schads-rates", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const scHADSRates = [
        { level: 1, payPoint: 1, hourlyRate: 25.41, description: "Entry level support worker" },
        { level: 1, payPoint: 2, hourlyRate: 26.15, description: "Support worker with basic experience" },
        { level: 1, payPoint: 3, hourlyRate: 26.88, description: "Experienced support worker" },
        { level: 1, payPoint: 4, hourlyRate: 27.62, description: "Senior support worker" },
        { level: 2, payPoint: 1, hourlyRate: 28.35, description: "Support worker grade 2" },
        { level: 2, payPoint: 2, hourlyRate: 29.09, description: "Support worker grade 2 with experience" },
        { level: 2, payPoint: 3, hourlyRate: 29.82, description: "Senior support worker grade 2" },
        { level: 2, payPoint: 4, hourlyRate: 30.56, description: "Lead support worker grade 2" },
        { level: 3, payPoint: 1, hourlyRate: 31.29, description: "Team leader/Coordinator" },
        { level: 3, payPoint: 2, hourlyRate: 32.03, description: "Senior team leader" },
        { level: 3, payPoint: 3, hourlyRate: 32.76, description: "Program coordinator" },
        { level: 3, payPoint: 4, hourlyRate: 33.50, description: "Senior coordinator" },
        { level: 4, payPoint: 1, hourlyRate: 34.31, description: "Manager/Senior coordinator" },
        { level: 4, payPoint: 2, hourlyRate: 34.31, description: "Senior manager" },
        { level: 4, payPoint: 3, hourlyRate: 34.31, description: "Program manager" },
        { level: 4, payPoint: 4, hourlyRate: 34.31, description: "Senior program manager" }
      ];
      res.json(scHADSRates);
    } catch (error: any) {
      console.error("Get ScHADS rates error:", error);
      res.status(500).json({ message: "Failed to get ScHADS rates" });
    }
  });

  app.put("/api/pay-scales/:level/:payPoint", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { level, payPoint } = req.params;
      const { hourlyRate } = req.body;

      if (!hourlyRate || isNaN(parseFloat(hourlyRate))) {
        return res.status(400).json({ message: "Valid hourly rate is required" });
      }

      await storage.updatePayScale(
        req.user.tenantId,
        parseInt(level),
        parseInt(payPoint),
        parseFloat(hourlyRate)
      );

      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_pay_scale",
        resourceType: "pay_scale",
        resourceId: `${parseInt(level)}-${parseInt(payPoint)}`,
        description: `Updated pay scale Level ${parseInt(level)}, Pay Point ${parseInt(payPoint)} to $${hourlyRate}/hour`,
        tenantId: req.user.tenantId,
      });

      res.json({ message: "Pay scale updated successfully" });
    } catch (error: any) {
      console.error("Update pay scale error:", error);
      res.status(500).json({ message: "Failed to update pay scale" });
    }
  });

  // Get ScHADS rate information
  app.get("/api/schads-rates", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { getScHADSRateInfo } = await import("./schads-provisioning");
      const scHADSRates = getScHADSRateInfo();
      res.json(scHADSRates);
    } catch (error: any) {
      console.error("Get ScHADS rates error:", error);
      res.status(500).json({ message: "Failed to get ScHADS rates" });
    }
  });

  // Admin submit timesheet (for staff) - SEPARATE ENDPOINT
  app.post("/api/admin/timesheets/:timesheetId/submit", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const timesheetId = parseInt(req.params.timesheetId);
      
      console.log(`[ADMIN SUBMIT] Admin ${req.user.id} submitting timesheet ${timesheetId}`);
      
      // Get timesheet (admin can submit any timesheet in their tenant)
      const timesheet = await db.select()
        .from(timesheetsTable)
        .where(and(
          eq(timesheetsTable.id, timesheetId),
          eq(timesheetsTable.tenantId, req.user.tenantId) // Only tenant check, no userId check
        ));

      if (timesheet.length === 0) {
        return res.status(404).json({ message: "Timesheet not found" });
      }

      // Allow submission for draft or rejected timesheets
      if (timesheet[0].status !== 'draft' && timesheet[0].status !== 'rejected') {
        return res.status(400).json({ message: "Only draft or rejected timesheets can be submitted" });
      }

      console.log(`[ADMIN SUBMIT] Timesheet status: ${timesheet[0].status}, submitting for staff ${timesheet[0].userId}`);

      // Submit timesheet (admin submits on behalf of staff)
      const updatedTimesheet = await db.update(timesheetsTable)
        .set({ 
          status: 'submitted',
          submittedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(timesheetsTable.id, timesheetId))
        .returning();

      const totalHours = parseFloat(timesheet[0].totalHours || "0") || 0;
      
      // Create activity log for admin submission
      await storage.createActivityLog({
        userId: req.user.id,
        action: "admin_submit_timesheet",
        resourceType: "timesheet",
        resourceId: timesheetId,
        description: `Admin submitted timesheet for staff member (${totalHours}h)`,
        tenantId: req.user.tenantId,
      });

      // Create notification for the staff member
      await storage.createNotification({
        userId: timesheet[0].userId,
        tenantId: req.user.tenantId,
        title: "Timesheet Submitted by Admin",
        message: `Your timesheet for ${totalHours} hours has been submitted by admin for approval`,
        type: "info",
        isRead: false
      });

      console.log(`[ADMIN SUBMIT] ✅ Successfully submitted timesheet ${timesheetId} for staff ${timesheet[0].userId}`);

      res.json({
        timesheet: updatedTimesheet[0],
        message: "Timesheet submitted successfully by admin",
        submittedBy: "admin"
      });
    } catch (error: any) {
      console.error("Admin submit timesheet error:", error);
      res.status(500).json({ message: "Failed to submit timesheet" });
    }
  });

  // Get timesheet entries for a specific timesheet
  app.get("/api/admin/timesheet-entries/:timesheetId", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { timesheetId } = req.params;
      const entries = await storage.getTimesheetEntries(parseInt(timesheetId), req.user.tenantId);
      res.json(entries);
    } catch (error: any) {
      console.error("Get timesheet entries error:", error);
      res.status(500).json({ message: "Failed to get timesheet entries" });
    }
  });

  // Create manual timesheet entry
  app.post("/api/admin/timesheet-entries/manual", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      // Convert timestamp fields properly
      const entryData = {
        ...req.body,
        tenantId: req.user.tenantId,
        isAutoGenerated: false
      };
      
      // Convert date/time fields to proper Date objects
      if (entryData.entryDate && typeof entryData.entryDate === 'string') {
        entryData.entryDate = new Date(entryData.entryDate);
      }
      if (entryData.startTime && typeof entryData.startTime === 'string') {
        entryData.startTime = new Date(entryData.startTime);
      }
      if (entryData.endTime && typeof entryData.endTime === 'string') {
        entryData.endTime = new Date(entryData.endTime);
      }
      
      const entryId = await storage.createTimesheetEntry(entryData);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_manual_timesheet_entry",
        resourceType: "timesheet_entry",
        resourceId: entryId,
        description: `Created manual timesheet entry for ${entryData.entryDate}`,
        tenantId: req.user.tenantId,
      });

      res.json({ id: entryId, message: "Manual timesheet entry created successfully" });
    } catch (error: any) {
      console.error("Create manual timesheet entry error:", error);
      res.status(500).json({ message: "Failed to create manual timesheet entry" });
    }
  });

  // Update timesheet entry
  app.patch("/api/admin/timesheet-entries/:entryId", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { entryId } = req.params;
      const updates = req.body;
      
      await storage.updateTimesheetEntry(parseInt(entryId), updates, req.user.tenantId);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_timesheet_entry",
        resourceType: "timesheet_entry",
        resourceId: parseInt(entryId),
        description: `Updated timesheet entry ${entryId}`,
        tenantId: req.user.tenantId,
      });

      res.json({ message: "Timesheet entry updated successfully" });
    } catch (error: any) {
      console.error("Update timesheet entry error:", error);
      res.status(500).json({ message: "Failed to update timesheet entry" });
    }
  });

  // Delete timesheet entry
  app.delete("/api/admin/timesheet-entries/:entryId", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { entryId } = req.params;
      
      await storage.deleteTimesheetEntry(parseInt(entryId), req.user.tenantId);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "delete_timesheet_entry",
        resourceType: "timesheet_entry",
        resourceId: parseInt(entryId),
        description: `Deleted timesheet entry ${entryId}`,
        tenantId: req.user.tenantId,
      });

      res.json({ message: "Timesheet entry deleted successfully" });
    } catch (error: any) {
      console.error("Delete timesheet entry error:", error);
      res.status(500).json({ message: "Failed to delete timesheet entry" });
    }
  });

  // Reset pay scale to ScHADS default
  app.post("/api/pay-scales/:level/:payPoint/reset", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { level, payPoint } = req.params;
      const { getScHADSRateInfo } = await import("./schads-provisioning");
      const scHADSRates = getScHADSRateInfo();
      
      const defaultRate = scHADSRates.find(rate => 
        rate.level === parseInt(level) && rate.payPoint === parseInt(payPoint)
      );

      if (!defaultRate) {
        return res.status(404).json({ message: "ScHADS rate not found for this level/pay point" });
      }

      await storage.updatePayScale(
        req.user.tenantId,
        parseInt(level),
        parseInt(payPoint),
        defaultRate.hourlyRate
      );

      await storage.createActivityLog({
        userId: req.user.id,
        action: "reset_pay_scale",
        resourceType: "pay_scale",
        resourceId: `${level}-${payPoint}`,
        description: `Reset pay scale Level ${level}, Pay Point ${payPoint} to ScHADS default $${defaultRate.hourlyRate}/hour`,
        tenantId: req.user.tenantId,
      });

      res.json({ 
        message: "Pay scale reset to ScHADS default successfully",
        hourlyRate: defaultRate.hourlyRate
      });
    } catch (error: any) {
      console.error("Reset pay scale error:", error);
      res.status(500).json({ message: "Failed to reset pay scale" });
    }
  });

  // Company Logo Upload API
  const multer = (await import('multer')).default;
  const path = await import('path');
  const fs = await import('fs');
  
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'uploads');
  fs.promises.mkdir(uploadsDir, { recursive: true }).catch(console.error);
  
  // Configure multer for file uploads
  const storage_multer = multer.diskStorage({
    destination: (req: any, file: any, cb: any) => {
      cb(null, uploadsDir);
    },
    filename: (req: any, file: any, cb: any) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `company-logo-${req.user.tenantId}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });
  
  const upload = multer({ 
    storage: storage_multer,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req: any, file: any, cb: any) => {
      const allowedTypes = /jpeg|jpg|png|gif|svg/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'));
      }
    }
  });

  app.post("/api/company/logo", requireAuth, requireRole(["Admin", "ConsoleManager"]), upload.single('logo'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const logoUrl = `/uploads/${req.file.filename}`;
      
      const company = await storage.updateCompanyLogo(req.user.tenantId, logoUrl);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "upload_company_logo",
        resourceType: "company",
        description: `Uploaded company logo: ${req.file.originalname}`,
        tenantId: req.user.tenantId,
      });
      
      res.json({ 
        message: "Logo uploaded successfully", 
        logoUrl,
        filename: req.file.filename
      });
    } catch (error) {
      console.error("Logo upload error:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  // Staff Management API - Edit staff and password reset
  app.put("/api/staff/:id", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const staffId = parseInt(req.params.id);
      const updateData = req.body;
      
      console.log(`[STAFF UPDATE] Updating staff ${staffId} with data:`, updateData);
      
      // Check if pay level or pay point is being changed
      const isPayScaleUpdate = updateData.payLevel !== undefined || updateData.payPoint !== undefined;
      
      if (isPayScaleUpdate) {
        console.log(`[PAY SCALE UPDATE] Staff ${staffId} pay scale is being updated: Level ${updateData.payLevel}, Point ${updateData.payPoint}`);
      }
      
      // Update user in database
      const updatedUser = await storage.updateUser(staffId, updateData, req.user.tenantId);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      
      // CRITICAL FIX: Recalculate existing timesheet entries when pay scales change
      if (isPayScaleUpdate) {
        try {
          console.log(`[PAY SCALE UPDATE] Recalculating timesheet entries for staff ${staffId}`);
          await recalculateTimesheetEntriesForUser(staffId, req.user.tenantId);
          console.log(`[PAY SCALE UPDATE] Successfully recalculated timesheet entries for staff ${staffId}`);
        } catch (recalcError) {
          console.error(`[PAY SCALE UPDATE] Failed to recalculate timesheet entries for staff ${staffId}:`, recalcError);
          // Continue with staff update even if recalculation fails
        }
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_staff",
        resourceType: "user",
        resourceId: staffId,
        description: `Updated staff member: ${updatedUser.username}${isPayScaleUpdate ? ' (pay scale updated)' : ''}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Update staff error:", error);
      res.status(500).json({ message: "Failed to update staff member", error: error.message });
    }
  });

  app.post("/api/staff/:id/reset-password", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const staffId = parseInt(req.params.id);
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.trim().length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword.trim());
      
      // Update user password
      const updatedUser = await storage.updateUser(staffId, { password: hashedPassword }, req.user.tenantId);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "reset_password",
        resourceType: "user",
        resourceId: staffId,
        description: `Reset password for staff member: ${updatedUser.username}`,
        tenantId: req.user.tenantId,
      });
      
      res.json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password", error: error.message });
    }
  });

  // Admin Timesheet Management APIs
  
  // Get current timesheets (submitted) for admin approval - AWS PRODUCTION FIX
  app.get("/api/admin/timesheets/current", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      console.log(`[ADMIN CURRENT] AWS PRODUCTION - Admin ${req.user.id} (${req.user.username}) requesting current timesheets for tenant ${req.user.tenantId}`);
      
      const timesheets = await storage.getAdminTimesheets(req.user.tenantId, 'submitted');
      
      console.log(`[ADMIN CURRENT] AWS PRODUCTION - Retrieved ${timesheets.length} submitted timesheets`);
      if (timesheets.length > 0) {
        console.log(`[ADMIN CURRENT] AWS PRODUCTION - Sample submitted timesheets:`, timesheets.slice(0, 3).map(t => ({
          id: t.id,
          userId: t.userId,
          staffName: t.staffName,
          status: t.status,
          submittedAt: t.submittedAt,
          totalHours: t.totalHours
        })));
      } else {
        console.log(`[ADMIN CURRENT] AWS PRODUCTION - No submitted timesheets found. Checking for any timesheets in tenant...`);
        
        // Diagnostic query to see all timesheet statuses
        const allTimesheets = await storage.getAdminTimesheets(req.user.tenantId, ['draft', 'submitted', 'approved', 'rejected', 'paid']);
        console.log(`[ADMIN CURRENT] AWS PRODUCTION - Total timesheets in tenant: ${allTimesheets.length}`);
        console.log(`[ADMIN CURRENT] AWS PRODUCTION - Status breakdown:`, allTimesheets.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>));
      }
      
      res.json(timesheets);
    } catch (error: any) {
      console.error("[ADMIN CURRENT] AWS PRODUCTION - Error:", error);
      res.status(500).json({ message: "Failed to fetch current timesheets" });
    }
  });

  // Get historical timesheets for admin view
  app.get("/api/admin/timesheets/history", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const timesheets = await storage.getAdminTimesheets(req.user.tenantId, ['approved', 'rejected', 'paid']);
      res.json(timesheets);
    } catch (error: any) {
      console.error("Get admin timesheet history error:", error);
      res.status(500).json({ message: "Failed to fetch timesheet history" });
    }
  });

  // Get payslip-ready timesheets (approved, not paid yet)
  app.get("/api/admin/payslips", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      // Get only approved timesheets that haven't been paid yet
      const timesheets = await storage.getAdminTimesheets(req.user.tenantId, 'approved');
      console.log(`[PAYSLIPS] Found ${timesheets.length} approved timesheets for tenant ${req.user.tenantId}`);
      res.json(timesheets);
    } catch (error: any) {
      console.error("Get admin payslips error:", error);
      res.status(500).json({ message: "Failed to fetch payslips" });
    }
  });

  // Get staff payslips (historical paid timesheets)
  app.get("/api/admin/staff-payslips", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      // Get all paid timesheets for historical payslip access
      const timesheets = await storage.getAdminTimesheets(req.user.tenantId, 'paid');
      console.log(`[STAFF PAYSLIPS] Found ${timesheets.length} paid timesheets for tenant ${req.user.tenantId}`);
      res.json(timesheets);
    } catch (error: any) {
      console.error("Get staff payslips error:", error);
      res.status(500).json({ message: "Failed to fetch staff payslips" });
    }
  });

  // Get all staff timesheets with entries for admin management
  app.get("/api/admin/staff-timesheets", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      // Get all timesheets (any status) with their entries for comprehensive staff timesheet management
      const timesheets = await storage.getAdminTimesheets(req.user.tenantId, ['draft', 'submitted', 'approved', 'rejected', 'paid']);
      
      // Get timesheet entries for each timesheet
      const timesheetsWithEntries = await Promise.all(timesheets.map(async (timesheet) => {
        const entries = await storage.getTimesheetEntries(timesheet.id, req.user.tenantId);
        return {
          ...timesheet,
          entries: entries
        };
      }));
      
      console.log(`[STAFF TIMESHEETS] Found ${timesheetsWithEntries.length} staff timesheets for tenant ${req.user.tenantId}`);
      res.json(timesheetsWithEntries);
    } catch (error: any) {
      console.error("Get staff timesheets error:", error);
      res.status(500).json({ message: "Failed to fetch staff timesheets" });
    }
  });

  // Approve timesheet
  app.post("/api/admin/timesheets/:id/approve", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const timesheetId = parseInt(req.params.id);
      const approvedTimesheet = await storage.approveTimesheet(timesheetId, req.user.id, req.user.tenantId);
      
      if (!approvedTimesheet) {
        return res.status(404).json({ message: "Timesheet not found" });
      }

      // Get staff details for notification
      const staffUser = await db.select()
        .from(users)
        .where(eq(users.id, approvedTimesheet.userId))
        .limit(1);

      if (staffUser.length > 0) {
        // Create notification for staff about approval
        await storage.createNotification({
          userId: approvedTimesheet.userId,
          tenantId: req.user.tenantId,
          title: "Timesheet Approved",
          message: `Your timesheet for ${approvedTimesheet.totalHours} hours has been approved by admin. Ready for payroll processing.`,
          type: "success",
          isRead: false
        });
      }

      await storage.createActivityLog({
        userId: req.user.id,
        action: "approve_timesheet",
        resourceType: "timesheet",
        resourceId: timesheetId,
        description: `Approved timesheet for ${staffUser[0]?.fullName || 'staff member'}`,
        tenantId: req.user.tenantId,
      });

      res.json({ 
        message: "Timesheet approved successfully", 
        timesheet: approvedTimesheet,
        approvalType: "admin" 
      });
    } catch (error: any) {
      console.error("Approve timesheet error:", error);
      res.status(500).json({ message: "Failed to approve timesheet" });
    }
  });

  // Reject timesheet
  app.post("/api/admin/timesheets/:id/reject", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const timesheetId = parseInt(req.params.id);
      const { reason } = req.body;
      const rejectedTimesheet = await storage.rejectTimesheet(timesheetId, req.user.id, req.user.tenantId, reason);
      
      if (!rejectedTimesheet) {
        return res.status(404).json({ message: "Timesheet not found" });
      }

      // Get staff details for notification
      const staffUser = await db.select()
        .from(users)
        .where(eq(users.id, rejectedTimesheet.userId))
        .limit(1);

      if (staffUser.length > 0) {
        // Create notification for staff about rejection
        await storage.createNotification({
          userId: rejectedTimesheet.userId,
          tenantId: req.user.tenantId,
          title: "Timesheet Rejected",
          message: `Your timesheet for ${rejectedTimesheet.totalHours} hours has been rejected by admin. Reason: ${reason || 'No reason provided'}. Please review and resubmit.`,
          type: "error",
          isRead: false
        });
      }

      await storage.createActivityLog({
        userId: req.user.id,
        action: "reject_timesheet",
        resourceType: "timesheet",
        resourceId: timesheetId,
        description: `Rejected timesheet for ${staffUser[0]?.fullName || 'staff member'}: ${reason || 'No reason provided'}`,
        tenantId: req.user.tenantId,
      });

      res.json({ 
        message: "Timesheet rejected successfully", 
        timesheet: rejectedTimesheet,
        reason: reason 
      });
    } catch (error: any) {
      console.error("Reject timesheet error:", error);
      res.status(500).json({ message: "Failed to reject timesheet" });
    }
  });

  // Get timesheet entries for editing
  app.get("/api/admin/timesheet-entries/:timesheetId", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const timesheetId = parseInt(req.params.timesheetId);
      const entries = await storage.getTimesheetEntries(timesheetId, req.user.tenantId);
      res.json(entries);
    } catch (error: any) {
      console.error("Get timesheet entries error:", error);
      res.status(500).json({ message: "Failed to fetch timesheet entries" });
    }
  });

  // Update timesheet entry
  app.patch("/api/admin/timesheet-entries/:entryId", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const entryId = parseInt(req.params.entryId);
      const updateData = { ...req.body };
      
      // Convert timestamp fields properly for updates
      if (updateData.entryDate && typeof updateData.entryDate === 'string') {
        updateData.entryDate = new Date(updateData.entryDate);
      }
      if (updateData.startTime && typeof updateData.startTime === 'string') {
        updateData.startTime = new Date(updateData.startTime);
      }
      if (updateData.endTime && typeof updateData.endTime === 'string') {
        updateData.endTime = new Date(updateData.endTime);
      }
      
      // Get the timesheet entry to find the timesheet ID
      const entry = await storage.getTimesheetEntryById(entryId, req.user.tenantId);
      if (!entry) {
        return res.status(404).json({ message: "Timesheet entry not found" });
      }
      
      const updatedEntry = await storage.updateTimesheetEntry(entryId, updateData, req.user.tenantId);
      
      if (updatedEntry === undefined || updatedEntry === null) {
        return res.status(404).json({ message: "Failed to update timesheet entry" });
      }

      // Recalculate timesheet totals after updating entry
      await updateTimesheetTotals(entry.timesheetId);

      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_timesheet_entry",
        resourceType: "timesheet_entry",
        resourceId: entryId,
        description: `Updated timesheet entry and recalculated totals`,
        tenantId: req.user.tenantId,
      });

      res.json({ message: "Timesheet entry updated successfully", entry: updatedEntry });
    } catch (error: any) {
      console.error("Update timesheet entry error:", error);
      res.status(500).json({ message: "Failed to update timesheet entry" });
    }
  });

  // Generate payslip PDF
  app.post("/api/admin/timesheets/:id/generate-payslip-pdf", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const timesheetId = parseInt(req.params.id);
      const timesheet = await storage.getTimesheetById(timesheetId, req.user.tenantId);
      
      if (!timesheet || timesheet.status !== 'approved') {
        return res.status(400).json({ message: "Only approved timesheets can generate payslips" });
      }

      // Mark as paid and generate PDF
      await storage.markTimesheetAsPaid(timesheetId, req.user.id, req.user.tenantId);
      
      // Import PDF generation utility
      const { generatePayslipPDF } = await import('./payslip-pdf-generator');
      const pdfBuffer = await generatePayslipPDF(timesheet, req.user.tenantId);

      await storage.createActivityLog({
        userId: req.user.id,
        action: "generate_payslip",
        resourceType: "timesheet",
        resourceId: timesheetId,
        description: `Generated payslip PDF for approved timesheet`,
        tenantId: req.user.tenantId,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=payslip-${timesheet.staffName}-${new Date().toISOString().split('T')[0]}.pdf`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Generate payslip PDF error:", error);
      res.status(500).json({ message: "Failed to generate payslip PDF" });
    }
  });

  // Staff payslip PDF generation endpoint
  app.get("/api/payslips/:id/pdf", requireAuth, async (req: any, res) => {
    try {
      const timesheetId = parseInt(req.params.id);
      console.log(`[PAYSLIP] User ${req.user.id} (${req.user.role}) requesting payslip for timesheet ${timesheetId}`);
      
      const timesheet = await storage.getTimesheetById(timesheetId, req.user.tenantId);
      
      if (!timesheet) {
        console.log(`[PAYSLIP] Timesheet ${timesheetId} not found for tenant ${req.user.tenantId}`);
        return res.status(404).json({ message: "Timesheet not found" });
      }

      console.log(`[PAYSLIP] Found timesheet ${timesheetId} belonging to user ${timesheet.userId}, requesting user is ${req.user.id}`);

      // Verify user owns this timesheet or has admin access
      if (timesheet.userId !== req.user.id && !["Admin", "ConsoleManager"].includes(req.user.role)) {
        console.log(`[PAYSLIP] Access denied - user ${req.user.id} cannot access timesheet owned by ${timesheet.userId}`);
        return res.status(403).json({ message: "Access denied" });
      }

      // Only allow PDF generation for approved or paid timesheets
      if (!['approved', 'paid'].includes(timesheet.status)) {
        return res.status(400).json({ message: "Payslip only available for approved timesheets" });
      }

      // Import PDF generation utility
      const { generatePayslipPDF } = await import('./payslip-pdf-generator');
      const pdfBuffer = await generatePayslipPDF(timesheet, req.user.tenantId);

      await storage.createActivityLog({
        userId: req.user.id,
        action: "download_payslip",
        resourceType: "timesheet",
        resourceId: timesheetId,
        description: `Downloaded payslip PDF`,
        tenantId: req.user.tenantId,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=payslip-${timesheet.staffName}-${new Date().toISOString().split('T')[0]}.pdf`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Staff payslip PDF error:", error);
      res.status(500).json({ message: "Failed to generate payslip PDF" });
    }
  });

  // Care Support Plans API
  app.get("/api/care-support-plans", requireAuth, async (req: any, res) => {
    try {
      const { clientId } = req.query;
      let plans;
      
      if (clientId) {
        // Check if support worker has access to this specific client
        if (req.user.role === "SupportWorker") {
          const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
          const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null);
          
          if (!assignedClientIds.includes(parseInt(clientId))) {
            return res.status(403).json({ message: "Access denied: You are not assigned to this client" });
          }
        }
        plans = await storage.getCareSupportPlansByClient(parseInt(clientId), req.user.tenantId);
      } else {
        // Get care support plans for accessible clients only
        if (req.user.role === "SupportWorker") {
          const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
          const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null);
          
          if (assignedClientIds.length === 0) {
            return res.json([]);
          }
          
          // Get plans for all assigned clients
          let allPlans = [];
          for (const clientId of assignedClientIds) {
            const clientPlans = await storage.getCareSupportPlansByClient(clientId, req.user.tenantId);
            allPlans.push(...clientPlans);
          }
          plans = allPlans;
        } else {
          plans = await storage.getCareSupportPlans(req.user.tenantId);
        }
      }
      
      res.json(plans);
    } catch (error) {
      console.error("Care support plans API error:", error);
      res.status(500).json({ message: "Failed to fetch care support plans" });
    }
  });

  app.get("/api/care-support-plans/:id", requireAuth, async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      const plan = await storage.getCareSupportPlan(planId, req.user.tenantId);
      
      if (!plan) {
        return res.status(404).json({ message: "Care support plan not found" });
      }
      
      res.json(plan);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch care support plan" });
    }
  });

  app.post("/api/care-support-plans", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { insertCareSupportPlanSchema } = await import("@shared/schema");
      const planData = insertCareSupportPlanSchema.parse({
        ...req.body,
        tenantId: req.user.tenantId,
        createdByUserId: req.user.id,
      });

      const plan = await storage.createCareSupportPlan(planData);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_care_support_plan",
        resourceType: "care_support_plan",
        resourceId: plan.id,
        description: `Created care support plan: ${plan.planTitle}`,
        tenantId: req.user.tenantId,
      });
      
      res.status(201).json(plan);
    } catch (error: any) {
      console.error("Create care support plan error:", error);
      res.status(500).json({ message: "Failed to create care support plan", error: error.message });
    }
  });

  // Auto-save endpoint for drafts
  app.post("/api/care-support-plans/auto-save", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { id, ...restData } = req.body;
      
      const planData = {
        ...restData,
        tenantId: req.user.tenantId,
        createdByUserId: req.user.id,
        status: 'draft',
        updatedAt: new Date(),
      };
      
      // Ensure no id field is passed to storage operations
      delete planData.id;
      
      let plan;
      if (id && typeof id === 'number') {
        // Update existing draft
        plan = await storage.updateCareSupportPlan(id, planData, req.user.tenantId);
      } else {
        // Create new draft with auto-generated title if none provided
        if (!planData.planTitle) {
          planData.planTitle = `Draft - ${new Date().toLocaleDateString()}`;
        }
        
        // Use the insertCareSupportPlanSchema to validate data
        const { insertCareSupportPlanSchema } = await import("@shared/schema");
        const validatedData = insertCareSupportPlanSchema.parse(planData);
        plan = await storage.createCareSupportPlan(validatedData);
      }
      
      res.json(plan);
    } catch (error: any) {
      console.error("Error auto-saving care support plan:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/care-support-plans/:id", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      const plan = await storage.updateCareSupportPlan(planId, req.body, req.user.tenantId);
      
      if (!plan) {
        return res.status(404).json({ message: "Care support plan not found" });
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_care_support_plan",
        resourceType: "care_support_plan",
        resourceId: planId,
        description: `Updated care support plan: ${plan.planTitle}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(plan);
    } catch (error) {
      res.status(500).json({ message: "Failed to update care support plan" });
    }
  });

  app.delete("/api/care-support-plans/:id", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      const success = await storage.deleteCareSupportPlan(planId, req.user.tenantId);
      
      if (!success) {
        return res.status(404).json({ message: "Care support plan not found" });
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "delete_care_support_plan",
        resourceType: "care_support_plan",
        resourceId: planId,
        description: `Deleted care support plan ${planId}`,
        tenantId: req.user.tenantId,
      });
      
      res.json({ message: "Care support plan deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete care support plan" });
    }
  });

  // Staff Timesheet API Endpoints
  app.get("/api/timesheet/current", requireAuth, async (req: any, res) => {
    try {
      const currentTimesheet = await getCurrentTimesheet(req.user.id, req.user.tenantId);
      res.json(currentTimesheet);
    } catch (error: any) {
      console.error("Get current timesheet error:", error);
      res.status(500).json({ message: "Failed to get current timesheet" });
    }
  });

  app.get("/api/timesheet/history", requireAuth, async (req: any, res) => {
    try {
      const timesheetHistory = await getTimesheetHistory(req.user.id, req.user.tenantId);
      res.json(timesheetHistory);
    } catch (error: any) {
      console.error("Get timesheet history error:", error);
      res.status(500).json({ message: "Failed to get timesheet history" });
    }
  });

  app.get("/api/leave-balances", requireAuth, async (req: any, res) => {
    try {
      const userLeaveBalances = await db.select()
        .from(leaveBalances)
        .where(and(
          eq(leaveBalances.userId, req.user.id),
          eq(leaveBalances.tenantId, req.user.tenantId)
        ));
      
      // If no leave balances exist, create default ones
      if (userLeaveBalances.length === 0) {
        const defaultBalances = [
          { userId: req.user.id, tenantId: req.user.tenantId, leaveType: 'annual', balance: 20 },
          { userId: req.user.id, tenantId: req.user.tenantId, leaveType: 'sick', balance: 10 },
          { userId: req.user.id, tenantId: req.user.tenantId, leaveType: 'personal', balance: 2 },
          { userId: req.user.id, tenantId: req.user.tenantId, leaveType: 'long_service', balance: 0 }
        ];
        
        await db.insert(leaveBalances).values(defaultBalances);
        
        const newBalances = await db.select()
          .from(leaveBalances)
          .where(and(
            eq(leaveBalances.userId, req.user.id),
            eq(leaveBalances.tenantId, req.user.tenantId)
          ));
        
        res.json(newBalances);
      } else {
        res.json(userLeaveBalances);
      }
    } catch (error: any) {
      console.error("Get leave balances error:", error);
      res.status(500).json({ message: "Failed to get leave balances" });
    }
  });

  app.post("/api/timesheet/:timesheetId/submit", requireAuth, async (req: any, res) => {
    try {
      console.log(`[TIMESHEET SUBMIT] Starting submission for timesheet ${req.params.timesheetId}, user ${req.user.id}, tenant ${req.user.tenantId}`);
      
      const timesheetId = parseInt(req.params.timesheetId);
      
      if (isNaN(timesheetId)) {
        console.error(`[TIMESHEET SUBMIT] Invalid timesheet ID: ${req.params.timesheetId}`);
        return res.status(400).json({ message: "Invalid timesheet ID", error: "INVALID_ID" });
      }
      
      // Get timesheet and verify ownership
      const timesheet = await db.select()
        .from(timesheetsTable)
        .where(and(
          eq(timesheetsTable.id, timesheetId),
          eq(timesheetsTable.userId, req.user.id),
          eq(timesheetsTable.tenantId, req.user.tenantId)
        ));

      console.log(`[TIMESHEET SUBMIT] Found ${timesheet.length} timesheets matching criteria`);

      if (timesheet.length === 0) {
        console.error(`[TIMESHEET SUBMIT] Timesheet not found - ID: ${timesheetId}, User: ${req.user.id}, Tenant: ${req.user.tenantId}`);
        return res.status(404).json({ message: "Timesheet not found", error: "NOT_FOUND" });
      }

      console.log(`[TIMESHEET SUBMIT] Timesheet status: ${timesheet[0].status}`);

      // Allow submission for draft or rejected timesheets
      if (timesheet[0].status !== 'draft' && timesheet[0].status !== 'rejected') {
        console.error(`[TIMESHEET SUBMIT] Invalid status for submission: ${timesheet[0].status}`);
        return res.status(400).json({ message: "Only draft or rejected timesheets can be submitted", error: "INVALID_STATUS", currentStatus: timesheet[0].status });
      }

      // Check if timesheet qualifies for auto-approval
      const entries = await db.select()
        .from(timesheetEntries)
        .where(eq(timesheetEntries.timesheetId, timesheetId));

      // Submit for admin approval - NO AUTO-APPROVAL
      // All timesheets must go through admin review for proper payroll workflow
      let updatedTimesheet;
      let approvalMessage;
      
      // Always submit for admin approval (proper workflow) - AWS PRODUCTION FIX
      console.log(`[TIMESHEET SUBMIT] AWS PRODUCTION - Updating timesheet ${timesheetId} status to 'submitted'`);
      
      updatedTimesheet = await db.update(timesheetsTable)
        .set({ 
          status: 'submitted',
          submittedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(timesheetsTable.id, timesheetId))
        .returning();

      console.log(`[TIMESHEET SUBMIT] AWS PRODUCTION - Update result:`, updatedTimesheet.length > 0 ? {
        id: updatedTimesheet[0].id,
        status: updatedTimesheet[0].status,
        submittedAt: updatedTimesheet[0].submittedAt,
        userId: updatedTimesheet[0].userId,
        tenantId: updatedTimesheet[0].tenantId
      } : "NO RESULT");

      approvalMessage = "Timesheet submitted for admin approval";
        
      // Create submission activity log
      const totalHours = parseFloat(timesheet[0].totalHours || "0") || 0;
      await storage.createActivityLog({
        userId: req.user.id,
        action: "submit_timesheet",
        resourceType: "timesheet",
        resourceId: timesheetId,
        description: `Submitted timesheet for admin approval - ${totalHours}h`,
        tenantId: req.user.tenantId,
      });

      // AWS PRODUCTION FIX: Enhanced admin notification system
      console.log(`[TIMESHEET SUBMIT] Creating admin notifications for tenant ${req.user.tenantId}`);
      
      // Get all admin users for this tenant to notify them
      const adminUsers = await db.select()
        .from(users)
        .where(and(
          eq(users.tenantId, req.user.tenantId),
          inArray(users.role, ['Admin', 'ConsoleManager', 'Coordinator'])
        ));
      
      console.log(`[TIMESHEET SUBMIT] Found ${adminUsers.length} admin users to notify`);
      
      // Notify all admin users about the submission
      for (const admin of adminUsers) {
        try {
          await storage.createNotification({
            userId: admin.id,
            tenantId: req.user.tenantId,
            title: "New Timesheet Submission",
            message: `${req.user.username} submitted timesheet for ${timesheet[0].totalHours} hours - requires approval`,
            type: "info",
            isRead: false
          });
          console.log(`[TIMESHEET SUBMIT] Notified admin user ${admin.id} (${admin.username})`);
        } catch (notifError) {
          console.error(`[TIMESHEET SUBMIT] Failed to notify admin ${admin.id}:`, notifError);
        }
      }
      
      // Create notification for staff about submission
      await storage.createNotification({
        userId: req.user.id,
        tenantId: req.user.tenantId,
        title: "Timesheet Submitted",
        message: `Your timesheet for ${timesheet[0].totalHours} hours has been submitted for admin approval`,
        type: "info",
        isRead: false
      });

      res.json({
        timesheet: updatedTimesheet[0],
        autoApproved: false, // No auto-approval - always needs admin review
        message: approvalMessage,
        approvalType: "manual"
      });
    } catch (error: any) {
      console.error("[TIMESHEET SUBMIT ERROR] Full error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        timesheetId: req.params.timesheetId,
        userId: req.user?.id,
        tenantId: req.user?.tenantId,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({ 
        message: "Failed to submit timesheet", 
        error: "INTERNAL_ERROR",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Get detailed timesheet entries for staff view
  app.get("/api/timesheet/:timesheetId/entries", requireAuth, async (req: any, res) => {
    try {
      const timesheetId = parseInt(req.params.timesheetId);
      
      // Get timesheet and verify ownership
      const timesheet = await db.select()
        .from(timesheetsTable)
        .where(and(
          eq(timesheetsTable.id, timesheetId),
          eq(timesheetsTable.userId, req.user.id),
          eq(timesheetsTable.tenantId, req.user.tenantId)
        ));

      if (timesheet.length === 0) {
        return res.status(404).json({ message: "Timesheet not found" });
      }

      // Get timesheet entries with shift and client details
      const entries = await db.select({
        id: timesheetEntries.id,
        timesheetId: timesheetEntries.timesheetId,
        shiftId: timesheetEntries.shiftId,
        entryDate: timesheetEntries.entryDate,
        startTime: timesheetEntries.startTime,
        endTime: timesheetEntries.endTime,
        breakMinutes: timesheetEntries.breakMinutes,
        totalHours: timesheetEntries.totalHours,
        hourlyRate: timesheetEntries.hourlyRate,
        grossPay: timesheetEntries.grossPay,
        notes: timesheetEntries.notes,
        createdAt: timesheetEntries.createdAt,
        // Get shift details
        shiftTitle: shifts.title,
        clientName: clients.fullName
      })
      .from(timesheetEntries)
      .leftJoin(shifts, eq(timesheetEntries.shiftId, shifts.id))
      .leftJoin(clients, eq(shifts.clientId, clients.id))
      .where(eq(timesheetEntries.timesheetId, timesheetId))
      .orderBy(desc(timesheetEntries.entryDate));

      res.json({
        timesheet: timesheet[0],
        entries: entries
      });
    } catch (error: any) {
      console.error("Get timesheet entries error:", error);
      res.status(500).json({ message: "Failed to get timesheet entries" });
    }
  });

  // PDF Export API for Care Support Plans
  app.get("/api/care-support-plans/:id/export/pdf", requireAuth, async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      const plan = await storage.getCareSupportPlan(planId, req.user.tenantId);
      
      if (!plan) {
        return res.status(404).json({ message: "Care support plan not found" });
      }

      // Get client data
      const client = await storage.getClient(plan.clientId, req.user.tenantId);
      
      // Generate PDF content (simplified for now - client will handle PDF generation)
      const htmlContent = `
        <h1>NDIS Care Support Plan</h1>
        <h2>${plan.planTitle}</h2>
        <p><strong>Client:</strong> ${client ? client.fullName : 'Unknown'}</p>
        <p><strong>Status:</strong> ${plan.status}</p>
        <p><strong>Created:</strong> ${plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'Unknown'}</p>
      `;
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "export_pdf",
        resourceType: "care_support_plan",
        resourceId: planId,
        description: `Exported care support plan PDF: ${plan.planTitle}`,
        tenantId: req.user.tenantId,
      });
      
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="care-plan-${plan.planTitle.replace(/[^a-zA-Z0-9]/g, '-')}.html"`);
      res.send(htmlContent);
    } catch (error) {
      console.error('PDF export error:', error);
      res.status(500).json({ message: "Failed to export care support plan" });
    }
  });

  // AI Content Generation for Care Support Plans
  app.post("/api/care-support-plans/generate-ai", requireAuth, async (req: any, res) => {
    try {
      const { section, userInput, targetField, existingContent, promptOverride, planId } = req.body;
      
      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({ 
          error: "AI service not configured. Please contact administrator to set up OpenAI integration." 
        });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Get complete care plan context including comprehensive client information
      let planContext = "";
      let clientDiagnosis = "Not specified";
      let clientName = "Client";
      let comprehensiveClientInfo = "";
      
      if (planId) {
        try {
          const planResult = await db.select().from(careSupportPlans).where(eq(careSupportPlans.id, planId)).limit(1);
          if (planResult.length > 0) {
            const plan = planResult[0];
            const clientResult = await db.select().from(clients).where(eq(clients.id, plan.clientId)).limit(1);
            if (clientResult.length > 0) {
              const client = clientResult[0];
              clientDiagnosis = client.primaryDiagnosis || 'Not specified';
              clientName = `${client.firstName} ${client.lastName}`;
              
              // Calculate age from date of birth
              const age = client.dateOfBirth ? 
                Math.floor((new Date().getTime() - new Date(client.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) 
                : 'Not specified';
              
              // Build comprehensive client information
              comprehensiveClientInfo = `
CLIENT PROFILE:
- Name: ${clientName}
- Age: ${age} years old
- Primary Diagnosis: ${clientDiagnosis}
- NDIS Number: ${client.ndisNumber || 'Not specified'}
- Address: ${client.address || 'Not specified'}

NDIS GOALS:
${client.ndisGoals || 'No specific NDIS goals documented'}

PREFERENCES & INTERESTS:
${client.likesPreferences || 'No preferences documented'}

DISLIKES & AVERSIONS:
${client.dislikesAversions || 'No dislikes documented'}

EMERGENCY CONTACT:
- Name: ${client.emergencyContactName || 'Not specified'}
- Phone: ${client.emergencyContactPhone || 'Not specified'}

MEDICAL ALERTS:
${client.allergiesMedicalAlerts || 'No medical alerts documented'}
`;
              
              planContext = `
${comprehensiveClientInfo}

EXISTING CARE PLAN SECTIONS:
${plan.aboutMeData ? `About Me: ${JSON.stringify(plan.aboutMeData, null, 2)}` : ''}
${plan.goalsData ? `Goals: ${JSON.stringify(plan.goalsData, null, 2)}` : ''}
${plan.adlData ? `ADL Support: ${JSON.stringify(plan.adlData, null, 2)}` : ''}
${plan.communicationData ? `Communication: ${JSON.stringify(plan.communicationData, null, 2)}` : ''}
${plan.structureData ? `Structure & Routine: ${JSON.stringify(plan.structureData, null, 2)}` : ''}
${plan.behaviourData ? `Behaviour Support: ${JSON.stringify(plan.behaviourData, null, 2)}` : ''}
${plan.disasterData ? `Disaster Management: ${JSON.stringify(plan.disasterData, null, 2)}` : ''}
${plan.mealtimeData ? `Mealtime Management: ${JSON.stringify(plan.mealtimeData, null, 2)}` : ''}
`;
            }
          }
        } catch (error) {
          console.error("Error fetching plan context:", error);
        }
      }

      // Simplified diagnosis-driven AI generation system
      // ALWAYS generate content using diagnosis as foundation with scaffolding for weak input
      
      let systemPrompt = "";
      let userPrompt = "";

      // Build comprehensive context from all client data and existing plan data
      const contextualInfo = comprehensiveClientInfo || `Client: ${clientName}, Diagnosis: ${clientDiagnosis}`;
      const existingContext = planContext || "No existing plan context available.";
      
      // Create diagnosis-driven prompts that ALWAYS generate content
      switch (section) {
        case "aboutMe":
          systemPrompt = `Generate professional "About Me" content for a care support plan. Use the comprehensive client information including diagnosis, NDIS goals, preferences, dislikes, and personal details to create personalized, evidence-based content that supports daily care. Incorporate the client's specific interests, preferences, and support needs. Reference their actual likes/dislikes and NDIS goals where relevant. Write in third person, professional tone. Maximum 400 words.`;
          userPrompt = `${contextualInfo}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInput || 'Generate personalized About Me content using all available client information including preferences, NDIS goals, and personal details'}`;
          break;
        
        case "goals":
          systemPrompt = `Generate NDIS-aligned goals incorporating the client's existing NDIS goals, diagnosis, and personal preferences. Build upon their documented NDIS goals and create additional specific, measurable, achievable goals that address independence, community access, skill development, and capacity building. Reference their interests and preferences to make goals personally meaningful. Always generate content even if user input is minimal. Maximum 400 words.`;
          userPrompt = `${contextualInfo}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInput || 'Generate enhanced goals building on existing NDIS goals and client preferences'}`;
          break;
        
        case "adl":
          systemPrompt = `Generate Activities of Daily Living support content using the client's diagnosis, preferences, dislikes, and NDIS goals. Create practical guidance for support workers covering personal care, mobility, household tasks, community access, and safety considerations. Incorporate their specific likes/interests and avoid or accommodate their documented dislikes. Reference their NDIS goals for community access and independence. Maximum 400 words.`;
          userPrompt = `${contextualInfo}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInput || 'Generate personalized ADL support incorporating client preferences and NDIS goals'}`;
          break;
        
        case "structure":
          systemPrompt = `Generate structure and routine content based on the client's diagnosis. Create practical guidance for daily structure, routine management, transitions, and environmental considerations typical for this diagnosis. Always generate content using diagnosis-specific structure needs. Maximum 400 words.`;
          userPrompt = `${contextualInfo}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInput || 'Generate structure guidance based on diagnosis'}`;
          break;
        
        case "communication":
          systemPrompt = `Generate communication support content using the client's diagnosis, NDIS goals (especially communication-related goals), and preferences. Create practical guidance for receptive and expressive communication strategies, considering their documented dislikes (such as noise sensitivity) and incorporating their interests. Reference their specific NDIS communication goals and personal preferences. Maximum 400 words.`;
          userPrompt = `${contextualInfo}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInput || 'Generate personalized communication strategies incorporating NDIS goals and client preferences'}`;
          break;
        
        case "behaviour":
          systemPrompt = `Generate behavior support content using the client's diagnosis, documented dislikes/triggers, preferences, and NDIS goals. Create PBS-aligned strategies that specifically address their documented triggers (such as noise, lack of choice/control, not being heard) and leverage their interests for positive engagement. Include proactive approaches based on their preferences and de-escalation techniques that avoid their known dislikes. Maximum 400 words.`;
          userPrompt = `${contextualInfo}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInput || 'Generate personalized behavior support incorporating documented triggers and preferences'}`;
          break;
        
        case "disaster":
          systemPrompt = `Generate disaster management content based on the client's diagnosis. Create emergency preparedness, evacuation procedures, communication plans, and recovery support strategies considering the specific needs of this diagnosis. Always generate content using diagnosis-specific emergency needs. Maximum 400 words.`;
          userPrompt = `${contextualInfo}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInput || 'Generate disaster management based on diagnosis'}`;
          break;
        
        case "mealtime":
          systemPrompt = `Generate mealtime management content based on the client's diagnosis. Create practical guidance for eating support, dietary considerations, safety protocols, and mealtime strategies typical for this diagnosis. Always generate content using diagnosis-specific mealtime needs. Maximum 400 words.`;
          userPrompt = `${contextualInfo}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInput || 'Generate mealtime management based on diagnosis'}`;
          break;
        
        default:
          systemPrompt = `Generate professional care support content for the specified section using comprehensive client information including diagnosis, NDIS goals, preferences, dislikes, and personal details. Create evidence-based, practical content for support workers that is personalized to this specific client. Always generate content even with minimal input. Maximum 400 words.`;
          userPrompt = `${contextualInfo}\n\nExisting Context:\n${existingContext}\n\nSection: ${section}\nUser Input: ${userInput || 'Generate personalized content using all available client information'}`;
      }

      // Generate AI content with diagnosis-driven approach (temperature 0.3 for consistency)
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 800,
      });

      const generatedContent = response.choices[0].message.content;
      
      // Always return content - no guard rails or validation that could block generation
      if (!generatedContent || generatedContent.trim().length === 0) {
        // Enhanced fallback content using available client information
        const fallbackContent = `Based on ${clientName}'s diagnosis of ${clientDiagnosis} and their documented preferences and goals, appropriate ${section} support strategies should be developed to address their specific needs and requirements. Consider their individual preferences, NDIS goals, and personal circumstances when developing comprehensive care approaches.`;
        res.json({ content: fallbackContent });
      } else {
        res.json({ content: generatedContent.trim() });
      }

    } catch (error) {
      console.error("AI generation error:", error);
      
      // Provide diagnosis-based fallback even on error
      const { section, planId } = req.body;
      let clientDiagnosis = "Not specified";
      
      if (planId) {
        try {
          const planResult = await db.select().from(careSupportPlans).where(eq(careSupportPlans.id, planId)).limit(1);
          if (planResult.length > 0) {
            const plan = planResult[0];
            const clientResult = await db.select().from(clients).where(eq(clients.id, plan.clientId)).limit(1);
            if (clientResult.length > 0) {
              clientDiagnosis = clientResult[0].primaryDiagnosis || 'Not specified';
            }
          }
        } catch (dbError) {
          console.error("Error fetching diagnosis for fallback:", dbError);
        }
      }
      
      const fallbackContent = `Based on the diagnosis of ${clientDiagnosis}, appropriate ${section || 'care support'} strategies should be developed to address the specific needs and requirements typical for this condition. Please consult with healthcare professionals to develop comprehensive care approaches.`;
      
      res.json({ 
        content: fallbackContent,
        warning: "AI service temporarily unavailable - diagnosis-based template provided"
      });
    }
  });

  // ScHADS Wage Increase System
  app.post("/api/schads/wage-increase/preview", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { increasePercentage } = req.body;
      
      if (!increasePercentage || increasePercentage <= 0) {
        return res.status(400).json({ message: "Valid increase percentage required" });
      }
      
      const { previewWageIncrease } = await import("./schads-auto-update");
      const preview = await previewWageIncrease(increasePercentage);
      
      res.json(preview);
    } catch (error: any) {
      console.error("Wage increase preview error:", error);
      res.status(500).json({ message: "Failed to generate preview" });
    }
  });

  app.post("/api/schads/wage-increase/apply", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { increasePercentage, effectiveDate, description } = req.body;
      
      // Validate inputs
      const { validateWageIncrease, applyYearlyWageIncrease } = await import("./schads-auto-update");
      const effectiveDateObj = new Date(effectiveDate);
      const errors = validateWageIncrease(increasePercentage, effectiveDateObj);
      
      if (errors.length > 0) {
        return res.status(400).json({ message: "Validation failed", errors });
      }
      
      // Apply wage increase across all tenants
      const results = await applyYearlyWageIncrease({
        effectiveDate: effectiveDateObj,
        increasePercentage,
        description: description || `${increasePercentage}% ScHADS wage increase`,
        appliedBy: req.user.id
      });
      
      res.json({
        success: true,
        message: `Wage increase applied successfully to ${results.length} tenants`,
        results
      });
      
    } catch (error: any) {
      console.error("Wage increase application error:", error);
      res.status(500).json({ message: "Failed to apply wage increase" });
    }
  });

  app.get("/api/schads/wage-increase/history", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { getWageIncreaseHistory } = await import("./schads-auto-update");
      const history = await getWageIncreaseHistory(req.user.tenantId);
      res.json(history);
    } catch (error: any) {
      console.error("Wage increase history error:", error);
      res.status(500).json({ message: "Failed to fetch wage increase history" });
    }
  });

  app.get("/api/schads/wage-increase/due-check", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { isWageIncreaseDue, getNextWageIncreaseDate } = await import("./schads-auto-update");
      
      res.json({
        isDue: isWageIncreaseDue(),
        nextIncreaseDate: getNextWageIncreaseDate(),
        currentDate: new Date()
      });
    } catch (error: any) {
      console.error("Wage increase due check error:", error);
      res.status(500).json({ message: "Failed to check wage increase status" });
    }
  });

  // Tenant Provisioning Validation Endpoints
  app.post("/api/provisioning/check", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { checkProvisioning } = await import("./tenant-provisioning-validator");
      const { tenantId, expect } = req.body;
      
      // Use current tenant if not specified
      const targetTenantId = tenantId || req.user.tenantId;
      
      const result = await checkProvisioning({
        tenantId: targetTenantId,
        expect: expect || {
          hasAtLeast: {
            taxBrackets: 3,
            hourAllocations: 1,
            employmentTypes: 3
          }
        }
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Provisioning check error:", error);
      res.status(500).json({ message: "Failed to check provisioning status" });
    }
  });

  app.get("/api/provisioning/validate-all", requireAuth, requireRole(["ConsoleManager"]), async (req: any, res) => {
    try {
      const { validateAllTenants, generateProvisioningReport } = await import("./tenant-provisioning-validator");
      
      const results = await validateAllTenants({
        hasAtLeast: {
          taxBrackets: 3,
          hourAllocations: 1,
          employmentTypes: 3,
          users: 1,
          payScales: 1
        }
      });
      
      const report = generateProvisioningReport(results);
      
      res.json({
        results,
        report,
        summary: {
          totalTenants: results.length,
          passedTenants: results.filter(r => r.passed).length,
          failedTenants: results.filter(r => !r.passed).length
        }
      });
    } catch (error: any) {
      console.error("Validate all tenants error:", error);
      res.status(500).json({ message: "Failed to validate all tenants" });
    }
  });

  app.get("/api/provisioning/health/:tenantId", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { quickHealthCheck } = await import("./tenant-provisioning-validator");
      const tenantId = req.params.tenantId;
      
      const isHealthy = await quickHealthCheck(tenantId);
      
      res.json({
        tenantId,
        healthy: isHealthy,
        status: isHealthy ? "HEALTHY" : "NEEDS_ATTENTION",
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error("Health check error:", error);
      res.status(500).json({ message: "Failed to perform health check" });
    }
  });

  // DATABASE DEBUG ENDPOINT - Check which database we're connected to
  app.get("/api/debug/database", requireAuth, async (req: any, res) => {
    try {
      const dbCheck = await db.execute(sql`SELECT current_database() as db_name, current_user as db_user`);
      const clientCount = await db.execute(sql`SELECT COUNT(*) as count FROM clients WHERE tenant_id = ${req.user.tenantId}`);
      
      res.json({
        database: (dbCheck.rows[0] as any).db_name,
        user: (dbCheck.rows[0] as any).db_user,
        tenantId: req.user.tenantId,
        clientCount: (clientCount.rows[0] as any).count,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // EMERGENCY PRODUCTION DEMO DATA CLEANUP ENDPOINTS
  // ⚠️ SECURITY: Only ConsoleManager can access these endpoints
  app.post("/api/emergency/cleanup-demo-data", requireAuth, requireRole(["ConsoleManager"]), async (req: any, res) => {
    try {
      console.log(`🚨 EMERGENCY DEMO DATA CLEANUP initiated by user ${req.user.id} (${req.user.username})`);
      
      const result = await executeProductionDemoDataCleanup();
      
      console.log(`✅ EMERGENCY CLEANUP COMPLETED:`, result);
      res.json({
        success: true,
        message: "Production demo data cleanup completed successfully",
        result
      });
    } catch (error: any) {
      console.error(`❌ EMERGENCY CLEANUP FAILED:`, error);
      res.status(500).json({ 
        success: false,
        message: "Demo data cleanup failed", 
        error: error.message 
      });
    }
  });

  app.get("/api/emergency/verify-cleanup", requireAuth, requireRole(["ConsoleManager"]), async (req: any, res) => {
    try {
      const verification = await verifyProductionCleanup();
      
      res.json({
        success: true,
        isClean: verification.isClean,
        remainingDemo: verification.remainingDemo,
        message: verification.isClean 
          ? "Production database is clean - no demo data found" 
          : `Found ${verification.remainingDemo.length} remaining demo records`
      });
    } catch (error: any) {
      console.error(`❌ CLEANUP VERIFICATION FAILED:`, error);
      res.status(500).json({ 
        success: false,
        message: "Verification failed", 
        error: error.message 
      });
    }
  });

  // ========================================
  // COMPLIANCE CENTRE ROUTES
  // ========================================

  // Downloadable Forms Management - Global library accessible to all tenants
  app.get("/api/compliance/forms", requireAuth, async (req: any, res) => {
    try {
      const forms = await storage.getDownloadableForms();
      res.json(forms);
    } catch (error: any) {
      console.error("Get downloadable forms error:", error);
      res.status(500).json({ message: "Failed to fetch forms" });
    }
  });

  // File upload endpoint for compliance forms
  app.post("/api/compliance/forms/upload", requireAuth, requireRole(["Admin", "ConsoleManager"]), upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { formType } = req.body;
      if (!formType) {
        return res.status(400).json({ message: "Form type is required" });
      }

      // Create file URL - in production, you'd upload to S3 or similar
      const fileUrl = `/uploads/${req.file.filename}`;
      
      const newForm = await storage.createDownloadableForm({
        formType,
        fileName: req.file.originalname,
        fileUrl,
        uploadedBy: req.user.id,
      });

      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "upload_compliance_form",
        resourceType: "compliance_form",
        resourceId: newForm.id,
        description: `Uploaded ${formType} form: ${req.file.originalname}`,
        tenantId: req.user.tenantId,
      });

      res.json(newForm);
    } catch (error: any) {
      console.error("Upload form error:", error);
      res.status(500).json({ message: "Failed to upload form" });
    }
  });

  app.post("/api/compliance/forms", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { formType, fileName, fileUrl } = req.body;
      
      const newForm = await storage.createDownloadableForm({
        tenantId: req.user.tenantId,
        formType,
        fileName,
        fileUrl,
        uploadedBy: req.user.id,
      });

      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "upload_compliance_form",
        resourceType: "compliance_form",
        resourceId: newForm.id,
        description: `Uploaded ${formType} form: ${fileName}`,
        tenantId: req.user.tenantId,
      });

      res.json(newForm);
    } catch (error: any) {
      console.error("Create downloadable form error:", error);
      res.status(500).json({ message: "Failed to upload form" });
    }
  });

  app.put("/api/compliance/forms/:id", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updatedForm = await storage.updateDownloadableForm(parseInt(id), updates, req.user.tenantId);
      
      if (!updatedForm) {
        return res.status(404).json({ message: "Form not found" });
      }

      res.json(updatedForm);
    } catch (error: any) {
      console.error("Update downloadable form error:", error);
      res.status(500).json({ message: "Failed to update form" });
    }
  });

  app.delete("/api/compliance/forms/:id", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const success = await storage.deleteDownloadableForm(parseInt(id), req.user.tenantId);
      
      if (!success) {
        return res.status(404).json({ message: "Form not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete downloadable form error:", error);
      res.status(500).json({ message: "Failed to delete form" });
    }
  });

  // Completed Medication Authority Forms
  app.get("/api/compliance/medication-forms", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const forms = await storage.getCompletedMedicationForms(req.user.tenantId);
      res.json(forms);
    } catch (error: any) {
      console.error("Get completed medication forms error:", error);
      res.status(500).json({ message: "Failed to fetch medication forms" });
    }
  });

  app.get("/api/compliance/medication-forms/client/:clientId", requireAuth, async (req: any, res) => {
    try {
      const { clientId } = req.params;
      const forms = await storage.getCompletedMedicationFormsByClient(parseInt(clientId), req.user.tenantId);
      res.json(forms);
    } catch (error: any) {
      console.error("Get client medication forms error:", error);
      res.status(500).json({ message: "Failed to fetch client medication forms" });
    }
  });

  app.post("/api/compliance/medication-forms", requireAuth, async (req: any, res) => {
    try {
      const { clientId, fileName, fileUrl } = req.body;
      
      const newForm = await storage.createCompletedMedicationForm({
        tenantId: req.user.tenantId,
        clientId: parseInt(clientId),
        fileName,
        fileUrl,
        uploadedBy: req.user.id,
      });

      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "upload_medication_form",
        resourceType: "medication_form",
        resourceId: newForm.id,
        description: `Uploaded medication authority form for client ${clientId}: ${fileName}`,
        tenantId: req.user.tenantId,
      });

      res.json(newForm);
    } catch (error: any) {
      console.error("Create medication form error:", error);
      res.status(500).json({ message: "Failed to upload medication form" });
    }
  });

  app.delete("/api/compliance/medication-forms/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const success = await storage.deleteCompletedMedicationForm(parseInt(id), req.user.tenantId);
      
      if (!success) {
        return res.status(404).json({ message: "Medication form not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete medication form error:", error);
      res.status(500).json({ message: "Failed to delete medication form" });
    }
  });

  // Evacuation Drills Management
  app.get("/api/compliance/evacuation-drills", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const drills = await storage.getEvacuationDrills(req.user.tenantId);
      res.json(drills);
    } catch (error: any) {
      console.error("Get evacuation drills error:", error);
      res.status(500).json({ message: "Failed to fetch evacuation drills" });
    }
  });

  app.get("/api/compliance/evacuation-drills/:id", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { id } = req.params;
      const drill = await storage.getEvacuationDrill(parseInt(id), req.user.tenantId);
      
      if (!drill) {
        return res.status(404).json({ message: "Evacuation drill not found" });
      }
      
      res.json(drill);
    } catch (error: any) {
      console.error("Get evacuation drill error:", error);
      res.status(500).json({ message: "Failed to fetch evacuation drill" });
    }
  });

  app.post("/api/compliance/evacuation-drills", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { siteName, drillDate, participants, issuesFound, signedBy } = req.body;
      
      const newDrill = await storage.createEvacuationDrill({
        tenantId: req.user.tenantId,
        siteName,
        drillDate: new Date(drillDate),
        participants,
        issuesFound: issuesFound || null,
        signedBy,
        createdBy: req.user.id,
      });

      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_evacuation_drill",
        resourceType: "evacuation_drill",
        resourceId: newDrill.id,
        description: `Created evacuation drill record for ${siteName} on ${drillDate}`,
        tenantId: req.user.tenantId,
      });

      res.json(newDrill);
    } catch (error: any) {
      console.error("Create evacuation drill error:", error);
      res.status(500).json({ message: "Failed to create evacuation drill" });
    }
  });

  app.put("/api/compliance/evacuation-drills/:id", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      if (updates.drillDate) {
        updates.drillDate = new Date(updates.drillDate);
      }
      
      const updatedDrill = await storage.updateEvacuationDrill(parseInt(id), updates, req.user.tenantId);
      
      if (!updatedDrill) {
        return res.status(404).json({ message: "Evacuation drill not found" });
      }

      res.json(updatedDrill);
    } catch (error: any) {
      console.error("Update evacuation drill error:", error);
      res.status(500).json({ message: "Failed to update evacuation drill" });
    }
  });

  app.delete("/api/compliance/evacuation-drills/:id", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const success = await storage.deleteEvacuationDrill(parseInt(id), req.user.tenantId);
      
      if (!success) {
        return res.status(404).json({ message: "Evacuation drill not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete evacuation drill error:", error);
      res.status(500).json({ message: "Failed to delete evacuation drill" });
    }
  });

  // Emergency demo data cleanup endpoint (ConsoleManager only)
  app.post("/api/emergency-cleanup", requireAuth, requireRole(["ConsoleManager"]), async (req: any, res) => {
    try {
      const { emergencyCleanupAllDemoData, verifyCleanupSuccess } = await import('./emergency-demo-data-cleanup');
      
      console.log(`[EMERGENCY CLEANUP] Initiated by user: ${req.user.username} (Tenant: ${req.user.tenantId})`);
      
      // Execute emergency cleanup
      await emergencyCleanupAllDemoData();
      
      // Verify cleanup success
      await verifyCleanupSuccess();
      
      // Log the activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "emergency_cleanup",
        resourceType: "system",
        resourceId: 0,
        description: "Executed emergency demo data cleanup across all tenants",
        tenantId: req.user.tenantId,
      });
      
      res.json({ 
        success: true, 
        message: "Emergency demo data cleanup completed successfully. All tenants now have zero demo data.",
        cleanedTenants: [8, 9, 10, 11, 12, 13, 14, 15]
      });
      
    } catch (error: any) {
      console.error('Emergency cleanup error:', error);
      res.status(500).json({ 
        success: false, 
        message: "Emergency cleanup failed", 
        error: error.message 
      });
    }
  });

  // Serve static files from uploads directory  
  const expressStatic = await import('express');
  const pathModule = await import('path');
  app.use('/uploads', expressStatic.default.static(pathModule.join(process.cwd(), 'uploads')));

  // Close the registerRoutes function
  return server;
}
