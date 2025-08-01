import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
// All demo data provisioning removed - tenants start completely clean
import { db, pool } from "./lib/dbClient";
import * as schema from "@shared/schema";
import { eq, desc, and, or, ilike, sql, lt, gte, lte, inArray, count, sum, avg } from "drizzle-orm";
const { medicationRecords, medicationPlans, clients, users, shifts, shiftCancellations, timesheets: timesheetsTable, timesheetEntries, leaveBalances, companies, tenants, careSupportPlans } = schema;
import { insertClientSchema, insertFormTemplateSchema, insertFormSubmissionSchema, insertShiftSchema, insertHourlyObservationSchema, insertMedicationPlanSchema, insertMedicationRecordSchema, insertIncidentReportSchema, insertIncidentClosureSchema, insertStaffMessageSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { createTimesheetEntryFromShift, getCurrentTimesheet, getTimesheetHistory } from "./timesheet-service";
import { createSmartTimesheetEntry } from "./smart-timesheet-service";
import { recalculateTimesheetEntriesForUser } from "./timesheet-service";
import { updateTimesheetTotals } from "./comprehensive-tenant-fixes";
import { executeProductionDemoDataCleanup, verifyProductionCleanup } from "./emergency-production-cleanup";
import { sendCompanyWelcomeEmail, sendUserWelcomeEmail, sendPasswordResetEmail, sendIncidentReportNotification, sendShiftAssignmentNotification, sendClientCreationNotification } from "./lib/email-service";

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
  console.log("[AUTH MIDDLEWARE] Checking authentication...");
  console.log("[AUTH MIDDLEWARE] Session ID:", req.sessionID);
  console.log("[AUTH MIDDLEWARE] User:", req.user ? `${req.user.username} (ID: ${req.user.id}, Tenant: ${req.user.tenantId})` : 'None');
  console.log("[AUTH MIDDLEWARE] Is authenticated:", req.isAuthenticated());
  
  if (!req.isAuthenticated()) {
    console.log("[AUTH MIDDLEWARE] Authentication failed - user not authenticated");
    return res.status(401).json({ message: "Authentication required" });
  }
  
  console.log("[AUTH MIDDLEWARE] Authentication successful, proceeding...");
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

  // Environment debug endpoint (no auth required)
  app.get("/api/debug/env", (req, res) => {
    res.json({
      NODE_ENV: process.env.NODE_ENV,
      GMAIL_EMAIL: process.env.GMAIL_EMAIL,
      GMAIL_APP_PASSWORD_SET: !!process.env.GMAIL_APP_PASSWORD,
      GMAIL_APP_PASSWORD_LENGTH: process.env.GMAIL_APP_PASSWORD?.length || 0,
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      SESSION_SECRET_SET: !!process.env.SESSION_SECRET
    });
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

      // Send welcome email to company admin
      try {
        const emailSent = await sendCompanyWelcomeEmail(companyName, primaryContactEmail);
        if (emailSent) {
          console.log(`[EMAIL] Welcome email sent to ${primaryContactEmail} for company ${companyName}`);
        } else {
          console.warn(`[EMAIL] Failed to send welcome email to ${primaryContactEmail}`);
        }
      } catch (emailError) {
        console.error(`[EMAIL] Error sending welcome email:`, emailError);
        // Don't fail company creation if email fails
      }

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

  // Clients API with ABSOLUTE SECURITY ENFORCEMENT
  app.get("/api/clients", requireAuth, async (req: any, res) => {
    try {
      console.log(`[CLIENT API DEBUG] Request from user: ${req.user.username} (ID: ${req.user.id}, Tenant: ${req.user.tenantId}, Role: ${req.user.role})`);
      
      // 🚨 CRITICAL SECURITY CHECKPOINT: Re-verify user in database to prevent session hijacking
      const currentUser = await storage.getUser(req.user.id);
      if (!currentUser || currentUser.tenantId !== req.user.tenantId || !currentUser.isActive) {
        console.log(`🚨 [SECURITY BREACH] User verification failed for ${req.user.username} - session may be compromised`);
        return res.status(401).json({ message: "Session invalid - please login again" });
      }
      
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
      
      // STRICT ROLE-BASED ACCESS CONTROL
      const userRole = req.user.role?.toLowerCase().replace(/\s+/g, '');
      console.log(`[SECURITY CHECK] Normalized user role: "${userRole}" for user ${req.user.username}`);
      
      if (userRole === "supportworker") {
        // 🔒 CRITICAL SECURITY: SupportWorkers can ONLY see clients they are assigned to via shifts
        console.log(`🔒 [SECURITY AUDIT] Checking shift assignments for SupportWorker ${req.user.username} (ID: ${req.user.id})`);
        
        const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
        console.log(`[SUPPORT WORKER ACCESS] Found ${userShifts.length} shifts for user ${req.user.username}`);
        
        // Log each shift for debugging
        if (userShifts.length > 0) {
          console.log(`[SHIFT DETAILS] User ${req.user.username} shifts:`, userShifts.map(s => ({
            id: s.id,
            clientId: s.clientId,
            status: s.status,
            startTime: s.startTime,
            endTime: s.endTime
          })));
        } else {
          console.log(`🔒 [SECURITY ALERT] SupportWorker ${req.user.username} has ZERO shifts assigned`);
        }
        
        // Extract unique client IDs from user's shifts - MUST HAVE VALID CLIENT ID
        const clientIds = userShifts
          .map(shift => shift.clientId)
          .filter(id => id !== null && id !== undefined && typeof id === 'number') as number[];
        const assignedClientIds = Array.from(new Set(clientIds));
        
        console.log(`[SUPPORT WORKER ACCESS] Valid assigned client IDs: [${assignedClientIds.join(', ')}]`);
        
        // 🚨 ABSOLUTE SECURITY ENFORCEMENT
        if (assignedClientIds.length === 0) {
          console.log(`🔒 [SECURITY ENFORCED] SupportWorker ${req.user.username} has NO VALID SHIFT ASSIGNMENTS - returning empty array`);
          console.log(`🔒 [AUDIT TRAIL] User ${req.user.username} (ID: ${req.user.id}, Tenant: ${req.user.tenantId}) denied client access due to no shift assignments`);
          return res.json([]);
        }
        
        // Double-check: Get all clients first, then strictly filter
        const allClients = await storage.getClients(req.user.tenantId);
        console.log(`[SECURITY DEBUG] Total clients in tenant ${req.user.tenantId}: ${allClients.length}`);
        
        clients = allClients.filter(client => {
          const hasAccess = assignedClientIds.includes(client.id);
          if (!hasAccess) {
            console.log(`🔒 [ACCESS DENIED] SupportWorker ${req.user.username} denied access to client ${client.id} (${client.fullName})`);
          }
          return hasAccess;
        });
        
        console.log(`🔒 [SECURITY ENFORCED] SupportWorker ${req.user.username} authorized for ${clients.length} clients out of ${allClients.length} total clients`);
        
        // Final security audit log
        if (clients.length > 0) {
          console.log(`🔒 [AUTHORIZED ACCESS] SupportWorker ${req.user.username} granted access to clients:`, clients.map(c => `${c.id}:${c.fullName}`));
        }
        
          // 🔒 FINAL SECURITY ENFORCEMENT: Clear any cached data from frontend
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        // 🚨 ABSOLUTE ENFORCEMENT: Log final security state
        console.log(`🔒 [FINAL SECURITY STATE] SupportWorker ${req.user.username}: Authorized for ${clients.length} clients only`);
        
      } else if (userRole === "teamleader" || userRole === "coordinator" || userRole === "admin" || userRole === "consolemanager") {
        // Management roles can see all clients in their tenant
        clients = await storage.getClients(req.user.tenantId);
        console.log(`[MANAGEMENT ACCESS] ${userRole} ${req.user.username} accessing all ${clients.length} clients for tenant ${req.user.tenantId}`);
      } else {
        // Unknown/invalid role - deny access
        console.log(`🚨 [SECURITY ALERT] Unknown role "${req.user.role}" for user ${req.user.username} - denying access`);
        return res.status(403).json({ message: "Access denied: Invalid role" });
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
      
      // Send password reset notification email
      try {
        if (updatedUser.email) {
          const company = await storage.getCompanyByTenantId(req.user.tenantId);
          const companyName = company?.name || 'Your Organization';
          
          const emailSent = await sendPasswordResetEmail(
            updatedUser.email,
            updatedUser.fullName || updatedUser.username,
            companyName,
            newPassword
          );
          
          if (emailSent) {
            console.log(`[EMAIL] Password reset notification sent to ${updatedUser.email}`);
          } else {
            console.warn(`[EMAIL] Failed to send password reset notification to ${updatedUser.email}`);
          }
        }
      } catch (emailError) {
        console.error(`[EMAIL] Error sending password reset notification:`, emailError);
        // Don't fail password reset if email fails
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
    console.log("[SHIFT CREATE] ===== CREATING SHIFT =====");
    console.log("[SHIFT CREATE] User:", req.user.username, "Tenant:", req.user.tenantId);
    console.log("[SHIFT CREATE] Request body:", JSON.stringify(req.body, null, 2));
    
    try {
      // Convert string dates to Date objects before validation
      const processedBody = {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
        shiftStartDate: req.body.shiftStartDate ? new Date(req.body.shiftStartDate) : undefined,
        tenantId: req.user.tenantId,
      };
      
      console.log("[SHIFT CREATE] Processed body:", JSON.stringify(processedBody, null, 2));
      
      const shiftData = insertShiftSchema.parse(processedBody);
      console.log("[SHIFT CREATE] Validated shift data:", JSON.stringify(shiftData, null, 2));
      
      const shift = await storage.createShift(shiftData);
      console.log("[SHIFT CREATE] ✅ CREATED SHIFT:", JSON.stringify(shift, null, 2));
      
      // Verify the shift was actually saved by querying it back
      const verifyShift = await storage.getShift(shift.id, req.user.tenantId);
      console.log("[SHIFT CREATE] ✅ VERIFICATION QUERY:", verifyShift ? "FOUND" : "NOT FOUND");
      
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
      
      console.log("[SHIFT CREATE] ===== SHIFT CREATION COMPLETE =====");
      res.status(201).json(shift);
    } catch (error) {
      console.error("[SHIFT CREATE] ❌ ERROR creating shift:", error);
      console.error("[SHIFT CREATE] Request body:", req.body);
      if (error instanceof z.ZodError) {
        console.error("[SHIFT CREATE] Zod validation errors:", error.errors);
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

  // Test email endpoint (admin only)
  app.post("/api/test-email", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { to, subject, message } = req.body;
      
      if (!to || !subject || !message) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required fields: to, subject, message" 
        });
      }

      console.log('[EMAIL TEST] Attempting to send test email...');
      console.log('[EMAIL TEST] To:', to);
      console.log('[EMAIL TEST] Subject:', subject);
      console.log('[EMAIL TEST] Environment check in route:');
      console.log('[EMAIL TEST] GMAIL_EMAIL:', process.env.GMAIL_EMAIL);
      console.log('[EMAIL TEST] GMAIL_APP_PASSWORD length:', process.env.GMAIL_APP_PASSWORD?.length || 0);

      const { sendEmail } = await import('./lib/email-service');
      
      const result = await sendEmail({
        to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2B4B73;">Email Test from NeedsCareAI+</h2>
            <p>${message}</p>
            <p><em>This is a test email sent from the NeedsCareAI+ platform.</em></p>
          </div>
        `,
        text: message
      });

      if (result) {
        console.log('[EMAIL TEST] ✅ Test email sent successfully');
        res.json({ success: true, message: 'Test email sent successfully' });
      } else {
        console.log('[EMAIL TEST] ❌ Test email failed - sendEmail returned false');
        res.status(500).json({ success: false, error: 'Failed to send test email - sendEmail returned false' });
      }
    } catch (error: any) {
      console.error('[EMAIL TEST] ❌ Test email error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Unknown error occurred' 
      });
    }
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
      const userRole = req.user.role.toLowerCase();
      
      if (userRole === "supportworker" && existingShift.userId !== req.user.id) {
        console.log("[SHIFT UPDATE] ❌ PERMISSION DENIED - Not user's shift");
        return res.status(403).json({ message: "You can only update your own assigned shifts" });
      }
      
      // Allow SupportWorkers to update their own shifts, and higher roles to update any shifts
      const allowedRoles = ["supportworker", "teamleader", "coordinator", "admin", "consolemanager"];
      if (!allowedRoles.includes(userRole)) {
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

  // Update entire recurring shift series
  app.put("/api/shifts/series/:seriesId", requireAuth, async (req: any, res) => {
    console.log("[SERIES UPDATE] Starting recurring shift series update");
    
    try {
      const seriesId = req.params.seriesId;
      const updateData = req.body;
      
      console.log(`[SERIES UPDATE] User ${req.user.id} (${req.user.role}) updating series ${seriesId}`);
      console.log(`[SERIES UPDATE] Update data:`, JSON.stringify(updateData, null, 2));
      
      // Get all shifts in the series
      const seriesShifts = await storage.getShiftsBySeries(seriesId, req.user.tenantId);
      
      if (!seriesShifts || seriesShifts.length === 0) {
        console.log(`[SERIES UPDATE] No shifts found for series ${seriesId}`);
        return res.status(404).json({ message: "Shift series not found" });
      }
      
      console.log(`[SERIES UPDATE] Found ${seriesShifts.length} shifts in series`);
      
      // Check if this is a full recreation request (from recurring edit modal)
      if (updateData.updateType === "full" && updateData.shifts) {
        console.log(`[SERIES UPDATE] Full recreation requested with editType: ${updateData.editType}`);
        console.log(`[SERIES UPDATE] Deleting ${seriesShifts.length} existing shifts and creating ${updateData.shifts.length} new ones`);
        
        // Determine cutoff date based on editType
        let cutoffDate;
        if (updateData.editType === "future" && updateData.fromShiftId) {
          // Find the shift that was clicked and use its date as cutoff
          const targetShift = seriesShifts.find(s => s.id === updateData.fromShiftId);
          if (targetShift) {
            cutoffDate = new Date(targetShift.startTime);
            console.log(`[SERIES UPDATE] Edit Future: Using cutoff date ${cutoffDate.toDateString()} from shift ID ${updateData.fromShiftId}`);
            console.log(`[SERIES UPDATE] Total shifts in series: ${seriesShifts.length}`);
            console.log(`[SERIES UPDATE] Shifts before cutoff:`, seriesShifts.filter(s => new Date(s.startTime) < cutoffDate).map(s => `${s.id}(${new Date(s.startTime).toDateString()})`));
            console.log(`[SERIES UPDATE] Shifts at/after cutoff:`, seriesShifts.filter(s => new Date(s.startTime) >= cutoffDate).map(s => `${s.id}(${new Date(s.startTime).toDateString()})`));
          } else {
            console.log(`[SERIES UPDATE] Target shift ${updateData.fromShiftId} not found, falling back to today`);
            cutoffDate = new Date();
            cutoffDate.setHours(0, 0, 0, 0);
          }
        } else {
          // For "series" editType, delete all shifts in the series (except completed)
          cutoffDate = new Date('1900-01-01'); // Very old date to include all shifts
          console.log(`[SERIES UPDATE] Edit Series: Using minimum cutoff to delete all non-completed shifts`);
        }
        
        // Delete shifts based on the cutoff date and preserve completed shifts
        for (const shift of seriesShifts) {
          const shiftDate = new Date(shift.startTime);
          const shouldDelete = shiftDate >= cutoffDate && shift.status !== "completed";
          
          if (shouldDelete) {
            try {
              console.log(`[SERIES UPDATE] Deleting shift ${shift.id} (${shiftDate.toDateString()}) - ${updateData.editType} edit`);
              await storage.deleteShift(shift.id, req.user.tenantId);
            } catch (deleteError) {
              console.error(`[SERIES UPDATE] Failed to delete shift ${shift.id}:`, deleteError);
            }
          } else {
            console.log(`[SERIES UPDATE] Preserving shift ${shift.id} (${shiftDate.toDateString()}) - before cutoff or completed`);
          }
        }
        
        // For future edits, filter the generated shifts to only include those >= cutoff date
        const shiftsToCreate = updateData.editType === "future" 
          ? updateData.shifts.filter(shiftData => {
              const shiftStartTime = new Date(shiftData.startTime);
              return shiftStartTime >= cutoffDate;
            })
          : updateData.shifts;

        console.log(`[SERIES UPDATE] Original shifts generated: ${updateData.shifts.length}, Shifts to create after cutoff filter: ${shiftsToCreate.length}`);
        if (updateData.editType === "future") {
          console.log(`[SERIES UPDATE] Cutoff date: ${cutoffDate.toDateString()}`);
          console.log(`[SERIES UPDATE] Generated shifts before cutoff (will be skipped):`, 
            updateData.shifts.filter(s => new Date(s.startTime) < cutoffDate).map(s => new Date(s.startTime).toDateString()));
          console.log(`[SERIES UPDATE] Generated shifts at/after cutoff (will be created):`, 
            shiftsToCreate.map(s => new Date(s.startTime).toDateString()));
        }

        // Create new shifts based on the filtered list
        const newShifts = [];
        for (const shiftData of shiftsToCreate) {
          try {
            const shiftStartTime = new Date(shiftData.startTime);
            
            console.log(`[SERIES UPDATE] Creating new shift:`, {
              title: shiftData.title,
              startTime: shiftData.startTime,
              endTime: shiftData.endTime,
              recurring: shiftData.isRecurring
            });
            
            // Clean and transform the data to match database schema
            const newShiftData = {
              title: shiftData.title,
              description: shiftData.description || null,
              startTime: shiftStartTime, // Already converted to Date object
              endTime: shiftData.endTime ? new Date(shiftData.endTime) : null,
              userId: shiftData.userId || null,
              clientId: shiftData.clientId || null,
              status: shiftData.status || (shiftData.userId ? "assigned" : "unassigned"),
              location: shiftData.location || null,
              latitude: shiftData.latitude || null,
              longitude: shiftData.longitude || null,
              building: shiftData.building || null,
              floor: shiftData.floor || null,
              fundingCategory: shiftData.fundingCategory || null,
              staffRatio: shiftData.staffRatio || null,
              isActive: true,
              seriesId: seriesId, // Preserve the original series ID
              isRecurring: true,
              recurringPattern: shiftData.recurringPattern || null,
              recurringDays: shiftData.recurringDays || null,
              shiftStartDate: shiftData.shiftStartDate ? new Date(shiftData.shiftStartDate) : null,
              shiftStartTime: shiftData.shiftStartTime || null,
              shiftEndTime: shiftData.shiftEndTime || null,
              tenantId: req.user.tenantId,
              createdAt: new Date(),
            };
            
            console.log(`[SERIES UPDATE] Attempting to create shift for ${shiftStartTime.toDateString()}`);
            
            const createdShift = await storage.createShift(newShiftData);
            console.log(`[SERIES UPDATE] Created shift result:`, createdShift ? `Success - ID: ${createdShift.id}` : 'Failed - null returned');
            if (createdShift) {
              newShifts.push(createdShift);
            } else {
              console.error(`[SERIES UPDATE] createShift returned null for data:`, newShiftData);
            }
          } catch (createError) {
            console.error(`[SERIES UPDATE] Failed to create new shift:`, createError);
            console.error(`[SERIES UPDATE] Error stack:`, createError.stack);
          }
        }
        
        console.log(`[SERIES UPDATE] Successfully created ${newShifts.length} new shifts for series ${seriesId}`);
        
        // Log activity for series recreation
        if (newShifts.length > 0) {
          const editTypeDescription = updateData.editType === "future" ? "future shifts" : "entire series";
          await storage.createActivityLog({
            userId: req.user.id,
            action: "recreate_shift_series",
            resourceType: "shift",
            resourceId: newShifts[0].id,
            description: `Updated recurring shift ${editTypeDescription} "${seriesId}" with new pattern (${newShifts.length} shifts): ${updateData.shifts[0]?.title || 'Recurring shift'}`,
            tenantId: req.user.tenantId,
          });
        }
        
        res.json({ 
          success: true, 
          created: newShifts.length, 
          shifts: newShifts,
          count: newShifts.length 
        });
        return;
      }
      
      // Original update logic for simple field updates
      const updatedShifts = [];
      for (const shift of seriesShifts) {
        try {
          // Calculate new date/time for this shift if date/time fields are being updated
          let shiftUpdateData = { ...updateData };
          
          // Convert timestamp strings to Date objects for database compatibility
          if (shiftUpdateData.startTime && typeof shiftUpdateData.startTime === 'string') {
            shiftUpdateData.startTime = new Date(shiftUpdateData.startTime);
          }
          if (shiftUpdateData.endTime && typeof shiftUpdateData.endTime === 'string') {
            shiftUpdateData.endTime = new Date(shiftUpdateData.endTime);
          }
          
          // If start time is being updated, calculate new startTime for this shift
          if (updateData.startTime && shiftUpdateData.startTime instanceof Date) {
            const originalShiftDate = new Date(shift.startTime);
            const newDateTime = shiftUpdateData.startTime;
            
            // Preserve the original date but use new time
            const updatedStartTime = new Date(originalShiftDate);
            updatedStartTime.setHours(newDateTime.getHours(), newDateTime.getMinutes(), 0, 0);
            
            shiftUpdateData.startTime = updatedStartTime;
          }
          
          // If end time is being updated, calculate new endTime for this shift
          if (updateData.endTime && shiftUpdateData.endTime instanceof Date) {
            const originalShiftDate = new Date(shift.startTime);
            const newEndDateTime = shiftUpdateData.endTime;
            
            // Preserve the original date but use new time
            const updatedEndTime = new Date(originalShiftDate);
            updatedEndTime.setHours(newEndDateTime.getHours(), newEndDateTime.getMinutes(), 0, 0);
            
            shiftUpdateData.endTime = updatedEndTime;
          }
          
          // Remove editType and updateType from the data sent to storage
          delete shiftUpdateData.editType;
          delete shiftUpdateData.updateType;
          delete shiftUpdateData.shifts;
          
          console.log(`[SERIES UPDATE] Updating shift ${shift.id} with data:`, shiftUpdateData);
          
          const updatedShift = await storage.updateShift(shift.id, shiftUpdateData, req.user.tenantId);
          if (updatedShift) {
            updatedShifts.push(updatedShift);
          }
        } catch (shiftError) {
          console.error(`[SERIES UPDATE] Failed to update shift ${shift.id}:`, shiftError);
          console.error(`[SERIES UPDATE] Shift error details:`, shiftError.message);
          // Continue with other shifts even if one fails
        }
      }
      
      console.log(`[SERIES UPDATE] Successfully updated ${updatedShifts.length} shifts`);
      
      // Log activity for series update - use first shift ID as resource ID since series ID is a string
      const firstShiftId = updatedShifts.length > 0 ? updatedShifts[0].id : null;
      if (firstShiftId) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: "update_shift_series",
          resourceType: "shift",
          resourceId: firstShiftId,
          description: `Updated recurring shift series "${seriesId}" (${updatedShifts.length} shifts): ${updateData.title || 'Shift series'}`,
          tenantId: req.user.tenantId,
        });
      }
      
      res.json(updatedShifts);
    } catch (error) {
      console.error("[SERIES UPDATE] Error updating shift series:", error);
      console.error("[SERIES UPDATE] Error stack:", error.stack);
      console.error("[SERIES UPDATE] Update data:", req.body);
      console.error("[SERIES UPDATE] User:", req.user?.username, "ID:", req.user?.id);
      res.status(500).json({ 
        message: "Failed to update shift series", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Edit existing recurring shifts in place (preserves all shifts, only modifies their properties)
  app.put("/api/shifts/series/:seriesId/edit-existing", requireAuth, async (req: any, res) => {
    console.log("[SERIES EDIT-EXISTING] Starting in-place recurring shift edit");
    
    try {
      const seriesId = req.params.seriesId;
      const { updateData, editType, fromShiftId } = req.body;
      
      console.log(`[SERIES EDIT-EXISTING] User ${req.user.id} (${req.user.role}) editing series ${seriesId}`);
      console.log(`[SERIES EDIT-EXISTING] EditType: ${editType}, FromShiftId: ${fromShiftId}`);
      console.log(`[SERIES EDIT-EXISTING] Update data:`, JSON.stringify(updateData, null, 2));
      
      // Get all shifts in the series
      const seriesShifts = await storage.getShiftsBySeries(seriesId, req.user.tenantId);
      
      if (!seriesShifts || seriesShifts.length === 0) {
        console.log(`[SERIES EDIT-EXISTING] No shifts found for series ${seriesId}`);
        return res.status(404).json({ message: "Shift series not found" });
      }
      
      console.log(`[SERIES EDIT-EXISTING] Found ${seriesShifts.length} shifts in series`);
      
      // Determine which shifts to edit
      let shiftsToEdit = seriesShifts;
      
      if (editType === "future" && fromShiftId) {
        // Get the fromShift to get its date
        const fromShift = seriesShifts.find(s => s.id === fromShiftId);
        if (fromShift && fromShift.startTime) {
          const cutoffDate = new Date(fromShift.startTime);
          // Include the clicked shift and all future shifts 
          shiftsToEdit = seriesShifts.filter(shift => {
            if (!shift.startTime) return false;
            const shiftDate = new Date(shift.startTime);
            return shiftDate >= cutoffDate;
          });
          console.log(`[SERIES EDIT-EXISTING] Editing ${shiftsToEdit.length} future shifts from ${cutoffDate}`);
        }
      } else {
        console.log(`[SERIES EDIT-EXISTING] Editing entire series (${shiftsToEdit.length} shifts)`);
      }
      
      const updatedShifts = [];
      
      // Update each shift in place
      for (const shift of shiftsToEdit) {
        try {
          // Build update data for this specific shift
          const shiftUpdateData: any = {};
          
          // Update basic properties
          if (updateData.title) shiftUpdateData.title = updateData.title;
          if (updateData.userId !== undefined) shiftUpdateData.userId = updateData.userId;
          if (updateData.clientId !== undefined) shiftUpdateData.clientId = updateData.clientId;
          if (updateData.fundingCategory) shiftUpdateData.fundingCategory = updateData.fundingCategory;
          if (updateData.staffRatio) shiftUpdateData.staffRatio = updateData.staffRatio;
          
          // Update recurring pattern properties
          if (updateData.recurrenceType) shiftUpdateData.recurringPattern = updateData.recurrenceType;
          if (updateData.selectedWeekdays) shiftUpdateData.recurringDays = updateData.selectedWeekdays;
          
          // Handle time updates (preserve original date, update times)
          if (updateData.shiftStartTime || updateData.shiftEndTime) {
            const originalShiftDate = new Date(shift.startTime);
            
            if (updateData.shiftStartTime) {
              const [startHours, startMinutes] = updateData.shiftStartTime.split(':').map(Number);
              const newStartTime = new Date(originalShiftDate);
              newStartTime.setHours(startHours, startMinutes, 0, 0);
              shiftUpdateData.startTime = newStartTime;
              shiftUpdateData.shiftStartTime = updateData.shiftStartTime;
            }
            
            if (updateData.shiftEndTime) {
              const [endHours, endMinutes] = updateData.shiftEndTime.split(':').map(Number);
              const newEndTime = new Date(originalShiftDate);
              newEndTime.setHours(endHours, endMinutes, 0, 0);
              
              // Handle overnight shifts
              if (updateData.shiftStartTime) {
                const [startHours] = updateData.shiftStartTime.split(':').map(Number);
                if (endHours < startHours || (endHours === startHours && endMinutes <= startMinutes)) {
                  newEndTime.setDate(newEndTime.getDate() + 1);
                }
              }
              
              shiftUpdateData.endTime = newEndTime;
              shiftUpdateData.shiftEndTime = updateData.shiftEndTime;
            }
          }
          
          console.log(`[SERIES EDIT-EXISTING] Updating shift ${shift.id} with:`, shiftUpdateData);
          
          const updatedShift = await storage.updateShift(shift.id, shiftUpdateData, req.user.tenantId);
          if (updatedShift) {
            updatedShifts.push(updatedShift);
          }
        } catch (shiftError) {
          console.error(`[SERIES EDIT-EXISTING] Failed to update shift ${shift.id}:`, shiftError);
          // Continue with other shifts even if one fails
        }
      }
      
      console.log(`[SERIES EDIT-EXISTING] Successfully updated ${updatedShifts.length} shifts in place`);
      
      // Log activity for in-place edit
      if (updatedShifts.length > 0) {
        const editTypeDescription = editType === "future" ? "future shifts" : "entire series";
        await storage.createActivityLog({
          userId: req.user.id,
          action: "edit_shift_series_in_place",
          resourceType: "shift",
          resourceId: updatedShifts[0].id,
          description: `Edited recurring shift ${editTypeDescription} "${seriesId}" in place (${updatedShifts.length} shifts): ${updateData.title || 'Recurring shift'}`,
          tenantId: req.user.tenantId,
        });
      }
      
      res.json({ 
        success: true, 
        updated: updatedShifts.length, 
        shifts: updatedShifts,
        count: updatedShifts.length 
      });
      
    } catch (error) {
      console.error("[SERIES EDIT-EXISTING] Error updating shift series:", error);
      console.error("[SERIES EDIT-EXISTING] Error stack:", error.stack);
      res.status(500).json({ 
        message: "Failed to edit recurring shifts in place", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
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
      console.log(`[DEBUG /api/users] Request from user ${req.user.id}, tenant ${req.user.tenantId}`);
      const users = await storage.getUsersByTenant(req.user.tenantId);
      console.log(`[DEBUG /api/users] Found ${users.length} users for tenant ${req.user.tenantId}`);
      console.log(`[DEBUG /api/users] User IDs: ${users.map(u => u.id).join(', ')}`);
      // Remove sensitive data
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error(`[ERROR /api/users]`, error);
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

  // Get current user's availability - ALL USERS CAN ACCESS THEIR OWN
  app.get("/api/staff-availability/current", requireAuth, async (req: any, res) => {
    try {
      const availability = await storage.getUserAvailability(req.user.id, req.user.tenantId);
      console.log(`[AVAILABILITY] User ${req.user.username} fetching their current availability`);
      res.json(availability);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch current availability" });
    }
  });

  // Get ALL user's own availability submissions - SUPPORTWORKERS CAN SEE ALL THEIR SUBMISSIONS
  app.get("/api/staff-availability/mine", requireAuth, async (req: any, res) => {
    try {
      const userAvailabilities = await storage.getUserAllAvailabilities(req.user.id, req.user.tenantId);
      console.log(`[AVAILABILITY] User ${req.user.username} fetching ${userAvailabilities.length} of their availability submissions`);
      res.json(userAvailabilities);
    } catch (error) {
      console.error("Failed to fetch user availabilities:", error);
      res.status(500).json({ message: "Failed to fetch your availability submissions" });
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
      
      // Check if user owns this availability or is admin
      const existingAvailability = await storage.getStaffAvailabilityById(parseInt(id), req.user.tenantId);
      if (!existingAvailability) {
        return res.status(404).json({ message: "Availability not found" });
      }
      
      const userRole = req.user.role?.toLowerCase().replace(/\s+/g, '');
      const isOwner = existingAvailability.userId === req.user.id;
      const isAdmin = userRole === "admin" || userRole === "coordinator" || userRole === "teamleader" || userRole === "consolemanager";
      
      if (!isOwner && !isAdmin) {
        console.log(`🚨 [SECURITY] User ${req.user.username} denied access to edit availability ${id} (not owner)`);
        return res.status(403).json({ message: "Access denied: You can only edit your own availability" });
      }
      
      const updated = await storage.updateStaffAvailability(parseInt(id), {
        availability,
        patternName,
        isQuickPattern,
        userId: existingAvailability.userId, // Preserve original owner
        tenantId: req.user.tenantId
      }, req.user.tenantId);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_availability",
        resourceType: "staff_availability",
        resourceId: parseInt(id),
        description: isOwner ? "Updated own availability" : `Admin updated availability for user ${existingAvailability.userId}`,
        tenantId: req.user.tenantId,
      });
      
      console.log(`[AVAILABILITY] ${isOwner ? 'User' : 'Admin'} ${req.user.username} updated availability ${id}`);
      res.json(updated);
    } catch (error) {
      console.error("Staff availability update error:", error);
      res.status(500).json({ message: "Failed to update availability" });
    }
  });

  // Delete staff availability (for staff to delete their own)
  app.delete("/api/staff-availability/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if user owns this availability or is admin
      const existingAvailability = await storage.getStaffAvailabilityById(parseInt(id), req.user.tenantId);
      if (!existingAvailability) {
        return res.status(404).json({ message: "Availability not found" });
      }
      
      const userRole = req.user.role?.toLowerCase().replace(/\s+/g, '');
      const isOwner = existingAvailability.userId === req.user.id;
      const isAdmin = userRole === "admin" || userRole === "coordinator" || userRole === "teamleader" || userRole === "consolemanager";
      
      if (!isOwner && !isAdmin) {
        console.log(`🚨 [SECURITY] User ${req.user.username} denied access to delete availability ${id} (not owner)`);
        return res.status(403).json({ message: "Access denied: You can only delete your own availability" });
      }
      
      const deleted = await storage.deleteStaffAvailability(parseInt(id), req.user.tenantId);
      
      if (deleted) {
        // Log activity
        await storage.createActivityLog({
          userId: req.user.id,
          action: "delete_availability",
          resourceType: "staff_availability",
          resourceId: parseInt(id),
          description: isOwner ? "Deleted own availability" : `Admin deleted availability for user ${existingAvailability.userId}`,
          tenantId: req.user.tenantId,
        });
        
        console.log(`[AVAILABILITY] ${isOwner ? 'User' : 'Admin'} ${req.user.username} deleted availability ${id}`);
        res.json({ message: "Availability deleted successfully" });
      } else {
        res.status(404).json({ message: "Availability not found" });
      }
    } catch (error) {
      console.error("Staff availability deletion error:", error);
      res.status(500).json({ message: "Failed to delete availability" });
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
      
      const addPageBreakIfNeeded = (additionalHeight: number = 15) => {
        if (currentY > pageHeight - additionalHeight) {
          pdf.addPage('l', 'a4'); // Landscape A4
          currentY = 30;
          return true;
        }
        return false;
      };

      for (const [key, value] of Object.entries(noteData)) {
        addPageBreakIfNeeded(30);
        
        // Key
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${key}:`, margin + 5, currentY);
        
        // Value with wrapping and proper page breaks
        pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(String(value || 'Not specified'), contentWidth - 90);
        
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) {
            currentY += 6;
            addPageBreakIfNeeded();
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

  // Get pending case notes for validation
  app.get("/api/case-notes/pending/:clientId", requireAuth, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const tenantId = req.user.tenantId;
      
      // Get case notes that are associated with shifts but considered incomplete
      const allCaseNotes = await storage.getCaseNotes(clientId, tenantId);
      const shifts = await storage.getAllShifts(tenantId);
      
      // Find shifts that need case notes but don't have them
      const clientShifts = shifts.filter(shift => 
        shift.clientId === clientId && 
        shift.status === 'completed' &&
        new Date(shift.endTime) < new Date() // Past shifts only
      );
      
      const pendingCaseNotes = clientShifts.filter(shift => {
        // Check if this shift has a case note
        const hasProgressNote = allCaseNotes.some(note => 
          note.linkedShiftId === shift.id && 
          note.category === 'Progress Note'
        );
        return !hasProgressNote;
      });
      
      res.json(pendingCaseNotes);
    } catch (error: any) {
      console.error("Pending case notes API error:", error);
      res.status(500).json({ message: "Failed to fetch pending case notes", error: error.message });
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

      // Enhanced debugging for behavior observations
      if (observationData.observationType === "behaviour") {
        console.log("[OBSERVATION CREATE] Behavior validation debug:", {
          settings: { value: observationData.settings, length: observationData.settings?.length },
          settingsRating: { value: observationData.settingsRating, type: typeof observationData.settingsRating },
          time: { value: observationData.time, length: observationData.time?.length },
          timeRating: { value: observationData.timeRating, type: typeof observationData.timeRating },
          antecedents: { value: observationData.antecedents, length: observationData.antecedents?.length },
          antecedentsRating: { value: observationData.antecedentsRating, type: typeof observationData.antecedentsRating },
          response: { value: observationData.response, length: observationData.response?.length },
          responseRating: { value: observationData.responseRating, type: typeof observationData.responseRating }
        });
      }

      const validationResult = insertHourlyObservationSchema.safeParse(observationData);
      if (!validationResult.success) {
        console.error("[OBSERVATION CREATE] Validation failed:", validationResult.error.issues);
        console.error("[OBSERVATION CREATE] Failed data:", JSON.stringify(observationData, null, 2));
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
            // Create a section box for each star chart item
            pdf.setFillColor(248, 250, 252); // Light gray background
            pdf.rect(margin, currentY - 2, contentWidth, 25, 'F');
            pdf.setDrawColor(229, 231, 235); // Border
            pdf.rect(margin, currentY - 2, contentWidth, 25, 'S');
            
            // Label header
            pdf.setFillColor(37, 99, 235);
            pdf.rect(margin, currentY - 2, contentWidth, 8, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text(label, margin + 3, currentY + 4);
            
            // Content area
            pdf.setTextColor(0, 0, 0);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            
            // Clean and format text
            const cleanText = String(text || '').replace(/\s+/g, ' ').trim();
            const splitText = pdf.splitTextToSize(cleanText, contentWidth - 10);
            pdf.text(splitText, margin + 3, currentY + 12);
            
            // Rating in bottom right
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            pdf.text(`★ ${rating}/5`, margin + contentWidth - 30, currentY + 20);
            
            currentY += 30;
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
      
      // Return PDF as binary buffer for proper download
      const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="observation-${observationId}-${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Individual observation PDF export error:", error);
      res.status(500).json({ message: "Failed to export observation PDF" });
    }
  });

  // Bulk observations PDF export
  app.post("/api/observations/export/pdf", requireAuth, async (req: any, res) => {
    try {
      console.log("[OBSERVATIONS PDF EXPORT] Starting bulk PDF export...");
      console.log("[OBSERVATIONS PDF EXPORT] User:", req.user?.username, "Tenant:", req.user?.tenantId);
      console.log("[OBSERVATIONS PDF EXPORT] Session ID:", req.sessionID);
      console.log("[OBSERVATIONS PDF EXPORT] Request body keys:", Object.keys(req.body));
      console.log("[OBSERVATIONS PDF EXPORT] Auth check passed, proceeding with export");
      
      const { observations, clientId, observationType, dateFilter, dateRangeStart, dateRangeEnd, searchTerm } = req.body;
      
      console.log("[OBSERVATIONS PDF EXPORT] Request payload:", {
        observationsCount: observations?.length || 0,
        clientId,
        observationType,
        dateFilter
      });
      
      if (!observations || observations.length === 0) {
        console.error("[OBSERVATIONS PDF EXPORT] No observations provided for export");
        return res.status(400).json({ message: "No observations to export" });
      }

      const company = await storage.getCompanyByTenantId(req.user.tenantId);
      const companyName = company?.name || "NeedsCareAI+";

      // Use require instead of dynamic import for better production compatibility
      const { jsPDF } = require('jspdf');
      
      // Create PDF with correct parameters for jsPDF 3.x
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
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
      pdf.text(`Generated on ${new Date().toLocaleDateString('en-AU')} | ${companyName} | Page ${pdf.internal.getNumberOfPages()}`, margin, footerY);
      
      console.log("[OBSERVATIONS PDF EXPORT] Generating PDF output...");
      const pdfOutput = pdf.output('datauristring');
      const base64Data = pdfOutput.split(',')[1];
      
      console.log("[OBSERVATIONS PDF EXPORT] PDF generated successfully, size:", base64Data.length);
      res.json({ pdf: base64Data });
    } catch (error) {
      console.error("[OBSERVATIONS PDF EXPORT] Bulk observations PDF export error:", error);
      res.status(500).json({ message: "Failed to export observations PDF", error: error.message });
    }
  });

  // Bulk observations Excel export  
  app.post("/api/observations/export/excel", requireAuth, async (req: any, res) => {
    try {
      console.log("[OBSERVATIONS EXCEL EXPORT] Starting bulk Excel export...");
      console.log("[OBSERVATIONS EXCEL EXPORT] User:", req.user?.username, "Tenant:", req.user?.tenantId);
      
      const { observations, clientId, observationType, dateFilter, dateRangeStart, dateRangeEnd, searchTerm } = req.body;
      
      console.log("[OBSERVATIONS EXCEL EXPORT] Request payload:", {
        observationsCount: observations?.length || 0,
        clientId,
        observationType,
        dateFilter,
        hasObservations: !!observations,
        userTenant: req.user?.tenantId
      });
      
      if (!observations || observations.length === 0) {
        console.error("[OBSERVATIONS EXCEL EXPORT] No observations provided for export");
        return res.status(400).json({ 
          message: "No observations to export",
          debug: "Observations array is empty or not provided"
        });
      }

      // Import XLSX with error handling
      let XLSX;
      try {
        XLSX = require('xlsx');
        console.log("[OBSERVATIONS EXCEL EXPORT] XLSX library loaded successfully");
      } catch (xlsxError) {
        console.error("[OBSERVATIONS EXCEL EXPORT] Failed to load XLSX library:", xlsxError);
        return res.status(500).json({ message: "Excel library not available" });
      }
      
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
      const colWidths: any[] = [];
      const headers = Object.keys(excelData[0] || {});
      headers.forEach((header, i) => {
        const maxLength = Math.max(
          header.length,
          ...excelData.map((row: any) => String(row[header] || '').length)
        );
        colWidths[i] = { width: Math.min(Math.max(maxLength + 2, 10), 50) };
      });
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Observations');

      // Generate Excel file
      console.log("[OBSERVATIONS EXCEL EXPORT] Generating Excel workbook...");
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const base64Data = excelBuffer.toString('base64');
      
      console.log("[OBSERVATIONS EXCEL EXPORT] Excel generated successfully, size:", base64Data.length);
      res.json({ excel: base64Data });
    } catch (error) {
      console.error("[OBSERVATIONS EXCEL EXPORT] Bulk observations Excel export error:", error);
      res.status(500).json({ 
        message: "Failed to export observations to Excel",
        error: error.message
      });
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
      
      // Send welcome email to new user
      try {
        const company = await storage.getCompanyByTenantId(req.user.tenantId);
        const companyName = company?.name || 'Your Organization';
        
        const emailSent = await sendUserWelcomeEmail(
          fullName,
          email,
          username,
          password, // Send original password before hashing
          companyName
        );
        
        if (emailSent) {
          console.log(`[EMAIL] Welcome email sent to new user ${email}`);
        } else {
          console.warn(`[EMAIL] Failed to send welcome email to ${email}`);
        }
      } catch (emailError) {
        console.error(`[EMAIL] Error sending user welcome email:`, emailError);
        // Don't fail user creation if email fails
      }
      
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

  // Incident Reports API - SHIFT-BASED ACCESS CONTROL
  app.get("/api/incident-reports", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || 1;
      const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
      const userRole = req.user.role?.toLowerCase().replace(/\s+/g, '');
      
      let reports;
      
      if (userRole === "supportworker") {
        // SupportWorkers can only see incidents for their assigned clients
        reports = await storage.getIncidentReportsForSupportWorker(req.user.id, tenantId);
        console.log(`🔒 [SECURITY] SupportWorker ${req.user.username} accessing ${reports.length} incident reports for assigned clients only`);
      } else if (userRole === "teamleader" || userRole === "coordinator" || userRole === "admin" || userRole === "consolemanager") {
        // Management roles can see all incidents
        if (clientId) {
          reports = await storage.getIncidentReportsWithClosures(tenantId);
          reports = reports.filter((report: any) => report.client.id === clientId);
        } else {
          reports = await storage.getIncidentReportsWithClosures(tenantId);
        }
        console.log(`[MANAGEMENT ACCESS] ${userRole} ${req.user.username} accessing incident reports`);
      } else {
        console.log(`🚨 [SECURITY ALERT] Unknown role "${req.user.role}" attempting incident access - denying`);
        return res.status(403).json({ message: "Access denied: Invalid role" });
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
      
      // Send email notifications to administrators
      try {
        // Get all admin users for this tenant
        const allUsers = await storage.getUsersByTenant(req.user.tenantId);
        const adminUsers = allUsers.filter(user => 
          ['Admin', 'ConsoleManager', 'Coordinator'].includes(user.role) && user.email
        );
        const adminEmails = adminUsers.map(admin => admin.email).filter(email => email);

        if (adminEmails.length > 0) {
          // Get client information
          const client = await storage.getClient(reportData.clientId, req.user.tenantId);
          const clientName = client ? `${client.firstName} ${client.lastName}` : 'Unknown Client';
          
          // Get company information
          const company = await storage.getCompanyByTenantId(req.user.tenantId);
          const companyName = company?.name || 'Your Organization';
          
          // Get reporter information
          const reporterName = req.user.fullName || req.user.username;
          
          // Determine severity based on intensity rating
          const severity = reportData.intensityRating >= 8 ? 'High' : 
                          reportData.intensityRating >= 5 ? 'Medium' : 'Low';

          const emailSent = await sendIncidentReportNotification(
            adminEmails,
            report.incidentId,
            clientName,
            reporterName,
            reportData.types || [],
            severity,
            companyName,
            reportData.isNDISReportable || false
          );
          
          if (emailSent) {
            console.log(`[EMAIL] Incident notification sent to ${adminEmails.length} administrators`);
          } else {
            console.warn(`[EMAIL] Failed to send incident notifications`);
          }
        } else {
          console.log(`[EMAIL] No admin emails found for incident notification`);
        }
      } catch (emailError) {
        console.error(`[EMAIL] Error sending incident notification:`, emailError);
        // Don't fail incident creation if email fails
      }
      
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
      
      console.log(`[SHIFT FETCH] Client: ${clientId}, Staff: ${staffId}, Tenant: ${tenantId}`);
      
      if (!clientId || !staffId) {
        return res.status(400).json({ message: "Client ID and Staff ID are required" });
      }

      const allShifts = await storage.getAllShifts(tenantId);
      console.log(`[SHIFT FETCH] Total shifts in tenant ${tenantId}: ${allShifts.length}`);
      
      // Filter by client first
      const clientShifts = allShifts.filter(shift => shift.clientId === parseInt(clientId));
      console.log(`[SHIFT FETCH] Shifts for client ${clientId}: ${clientShifts.length}`);
      
      // Then filter by staff (assigned to this staff OR completed by this staff OR unassigned)
      const relevantShifts = clientShifts.filter(shift => 
        shift.userId === parseInt(staffId) || 
        shift.userId === null ||
        shift.status === 'completed' // Include completed shifts regardless of assignment
      );
      console.log(`[SHIFT FETCH] Relevant shifts for staff ${staffId}: ${relevantShifts.length}`);

      // For progress notes, we need a broader time range - last 30 days instead of 7
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const availableShifts = relevantShifts
        .filter(shift => {
          const shiftDate = new Date(shift.startTime);
          // Include today's shifts and past completed shifts within 30 days
          return shiftDate >= thirtyDaysAgo;
        })
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 20); // Increase limit to 20 for better selection
      
      console.log(`[SHIFT FETCH] Available shifts (last 30 days): ${availableShifts.length}`);
      console.log(`[SHIFT FETCH] Shift details:`, availableShifts.map(s => ({
        id: s.id,
        title: s.title,
        startTime: s.startTime,
        status: s.status,
        userId: s.userId
      })));
      
      res.json(availableShifts);
    } catch (error) {
      console.error("[SHIFT FETCH] Error:", error);
      res.status(500).json({ message: "Failed to fetch shifts" });
    }
  });

  // Hourly Observations API - SHIFT-BASED ACCESS CONTROL
  app.get("/api/observations", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { clientId } = req.query;
      const userRole = req.user.role?.toLowerCase().replace(/\s+/g, '');
      
      console.log(`[OBSERVATIONS API] User: ${req.user.username}, Role: ${userRole}, ClientId: ${clientId}`);
      
      let observations;
      
      if (userRole === "supportworker") {
        // SupportWorkers can ONLY see observations for their assigned clients
        const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
        const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null) as number[];
        const uniqueClientIds = Array.from(new Set(assignedClientIds));
        
        console.log(`🔒 [SECURITY] SupportWorker ${req.user.username} assigned to clients: [${uniqueClientIds.join(', ')}]`);
        
        if (clientId) {
          // Check access to specific client
          if (!uniqueClientIds.includes(parseInt(clientId))) {
            console.log(`🚨 [SECURITY ALERT] SupportWorker ${req.user.username} denied access to client ${clientId}`);
            return res.status(403).json({ message: "Access denied: You are not assigned to this client" });
          }
          observations = await storage.getObservationsByClient(parseInt(clientId), tenantId);
        } else {
          // Get observations for all assigned clients
          if (uniqueClientIds.length === 0) {
            console.log(`🔒 [SECURITY] SupportWorker ${req.user.username} has no assigned clients - returning empty array`);
            return res.json([]);
          }
          
          let allObservations = [];
          for (const assignedClientId of uniqueClientIds) {
            const clientObservations = await storage.getObservationsByClient(assignedClientId, tenantId);
            allObservations.push(...clientObservations);
          }
          observations = allObservations;
        }
        
        console.log(`🔒 [SECURITY ENFORCED] SupportWorker ${req.user.username} accessing ${observations.length} observations`);
      } else if (userRole === "teamleader" || userRole === "coordinator" || userRole === "admin" || userRole === "consolemanager") {
        // Management roles can see all observations
        if (clientId) {
          observations = await storage.getObservationsByClient(parseInt(clientId), tenantId);
        } else {
          observations = await storage.getAllObservations(tenantId);
        }
        console.log(`[MANAGEMENT ACCESS] ${userRole} ${req.user.username} accessing observations`);
      } else {
        console.log(`🚨 [SECURITY ALERT] Unknown role "${req.user.role}" attempting observations access - denying`);
        return res.status(403).json({ message: "Access denied: Invalid role" });
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
      const userRole = req.user.role?.toLowerCase().replace(/\s+/g, '');
      
      console.log(`[HOURLY OBSERVATIONS API] User: ${req.user.username}, Role: ${userRole}, ClientId: ${clientId}`);
      
      let observations;
      
      if (userRole === "supportworker") {
        // SupportWorkers can ONLY see observations for their assigned clients
        const userShifts = await storage.getShiftsByUser(req.user.id, req.user.tenantId);
        const assignedClientIds = userShifts.map(shift => shift.clientId).filter(id => id !== null) as number[];
        const uniqueClientIds = Array.from(new Set(assignedClientIds));
        
        console.log(`🔒 [SECURITY] SupportWorker ${req.user.username} assigned to clients: [${uniqueClientIds.join(', ')}]`);
        
        if (clientId) {
          // Check access to specific client
          if (!uniqueClientIds.includes(parseInt(clientId))) {
            console.log(`🚨 [SECURITY ALERT] SupportWorker ${req.user.username} denied access to client ${clientId}`);
            return res.status(403).json({ message: "Access denied: You are not assigned to this client" });
          }
          observations = await storage.getObservationsByClient(parseInt(clientId), tenantId);
        } else {
          // Get observations for all assigned clients
          if (uniqueClientIds.length === 0) {
            console.log(`🔒 [SECURITY] SupportWorker ${req.user.username} has no assigned clients - returning empty array`);
            return res.json([]);
          }
          
          let allObservations = [];
          for (const assignedClientId of uniqueClientIds) {
            const clientObservations = await storage.getObservationsByClient(assignedClientId, tenantId);
            allObservations.push(...clientObservations);
          }
          observations = allObservations;
        }
        
        console.log(`🔒 [SECURITY ENFORCED] SupportWorker ${req.user.username} accessing ${observations.length} hourly observations`);
      } else if (userRole === "teamleader" || userRole === "coordinator" || userRole === "admin" || userRole === "consolemanager") {
        // Management roles can see all observations
        if (clientId) {
          observations = await storage.getObservationsByClient(parseInt(clientId), tenantId);
        } else {
          observations = await storage.getAllObservations(tenantId);
        }
        console.log(`[MANAGEMENT ACCESS] ${userRole} ${req.user.username} accessing hourly observations`);
      } else {
        console.log(`🚨 [SECURITY ALERT] Unknown role "${req.user.role}" attempting hourly observations access - denying`);
        return res.status(403).json({ message: "Access denied: Invalid role" });
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
          
          // Auto-generate username from email if not provided
          if (!processedUserData.username && processedUserData.email) {
            processedUserData.username = processedUserData.email.split('@')[0];
            console.log(`[BULK UPLOAD] Auto-generated username '${processedUserData.username}' from email for row ${i + 1}`);
          }
          
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
  
  // Get current timesheets (submitted) for admin approval - ENHANCED DEBUG VERSION
  app.get("/api/admin/timesheets/current", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      console.log(`[ADMIN CURRENT] ENHANCED DEBUG - Admin ${req.user.id} (${req.user.username}) requesting current timesheets for tenant ${req.user.tenantId}`);
      console.log(`[ADMIN CURRENT] ENHANCED DEBUG - About to call storage.getAdminTimesheets with status 'submitted'`);
      
      const timesheets = await storage.getAdminTimesheets(req.user.tenantId, 'submitted');
      
      console.log(`[ADMIN CURRENT] ENHANCED DEBUG - Retrieved ${timesheets.length} submitted timesheets`);
      console.log(`[ADMIN CURRENT] ENHANCED DEBUG - Full results:`, JSON.stringify(timesheets, null, 2));
      
      if (timesheets.length > 0) {
        console.log(`[ADMIN CURRENT] ENHANCED DEBUG - Sample submitted timesheets:`, timesheets.slice(0, 3).map(t => ({
          id: t.id,
          userId: t.userId,
          staffName: t.staffName,
          status: t.status,
          submittedAt: t.submittedAt,
          totalHours: t.totalHours
        })));
      } else {
        console.log(`[ADMIN CURRENT] ENHANCED DEBUG - No submitted timesheets found. Running diagnostic queries...`);
        
        // Diagnostic query to see all timesheet statuses
        const allTimesheets = await storage.getAdminTimesheets(req.user.tenantId, ['draft', 'submitted', 'approved', 'rejected', 'paid']);
        console.log(`[ADMIN CURRENT] ENHANCED DEBUG - Total timesheets in tenant: ${allTimesheets.length}`);
        console.log(`[ADMIN CURRENT] ENHANCED DEBUG - Status breakdown:`, allTimesheets.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>));
        console.log(`[ADMIN CURRENT] ENHANCED DEBUG - Sample of all timesheets:`, allTimesheets.slice(0, 5).map(t => ({
          id: t.id,
          userId: t.userId,
          status: t.status,
          staffName: t.staffName
        })));
      }
      
      console.log(`[ADMIN CURRENT] ENHANCED DEBUG - Sending response with ${timesheets.length} timesheets`);
      res.json(timesheets);
    } catch (error: any) {
      console.error("[ADMIN CURRENT] ENHANCED DEBUG - Error:", error);
      console.error("[ADMIN CURRENT] ENHANCED DEBUG - Error stack:", error.stack);
      res.status(500).json({ message: "Failed to fetch current timesheets", error: error.message });
    }
  });

  // DEBUG: Test endpoint to trigger admin timesheet query manually
  app.get("/api/debug/test-admin-timesheets/:tenantId", async (req: any, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      console.log(`[DEBUG TEST] Manually triggering admin timesheet query for tenant ${tenantId}`);
      
      const submittedTimesheets = await storage.getAdminTimesheets(tenantId, 'submitted');
      
      res.json({
        tenantId,
        submittedCount: submittedTimesheets.length,
        submittedTimesheets: submittedTimesheets,
        debug: "Manual test successful"
      });
    } catch (error: any) {
      console.error("[DEBUG TEST] Error:", error);
      res.status(500).json({ message: "Debug test failed", error: error.message });
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

  // Function to extract diagnosis from AI-generated content
  function extractDiagnosis(content: string): string | null {
    if (!content) return null;
    
    // Common diagnosis patterns to look for
    const diagnosisPatterns = [
      /diagnosed with ([^,.]+)/i,
      /diagnosis of ([^,.]+)/i,
      /condition:?\s*([^,.]+)/i,
      /disorder:?\s*([^,.]+)/i,
      /syndrome:?\s*([^,.]+)/i,
      /(Borderline Personality Disorder|BPD)/i,
      /(Autism Spectrum Disorder|ASD)/i,
      /(Intellectual Disability|ID)/i,
      /(Schizophrenia)/i,
      /(Bipolar Disorder)/i,
      /(ADHD|Attention Deficit)/i,
      /(Depression)/i,
      /(Anxiety)/i
    ];
    
    for (const pattern of diagnosisPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    
    return null;
  }

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
      
      // Extract and store diagnosis separately if About Me content contains it
      if (planData.aboutMeData?.personalHistory) {
        const extractedDiagnosis = extractDiagnosis(planData.aboutMeData.personalHistory);
        if (extractedDiagnosis) {
          planData.aboutMeData = {
            ...planData.aboutMeData,
            diagnosis: extractedDiagnosis
          };
          console.log(`[AUTO-SAVE] Extracted diagnosis: ${extractedDiagnosis}`);
        }
      }
      
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
      
      // Log the status update attempt
      console.log(`[CARE PLAN UPDATE] Plan ID: ${planId}, User: ${req.user.id}, Tenant: ${req.user.tenantId}`);
      console.log(`[CARE PLAN UPDATE] Status update: ${req.body.status || 'no status change'}`);
      
      const plan = await storage.updateCareSupportPlan(planId, req.body, req.user.tenantId);
      
      if (!plan) {
        console.log(`[CARE PLAN UPDATE] Plan not found: ${planId}`);
        return res.status(404).json({ message: "Care support plan not found" });
      }
      
      console.log(`[CARE PLAN UPDATE] Successfully updated plan ${planId} with status: ${plan.status}`);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: req.body.status === 'completed' ? "complete_care_support_plan" : "update_care_support_plan",
        resourceType: "care_support_plan",
        resourceId: planId,
        description: req.body.status === 'completed' ? 
          `Completed care support plan: ${plan.planTitle}` : 
          `Updated care support plan: ${plan.planTitle}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(plan);
    } catch (error) {
      console.error(`[CARE PLAN UPDATE] Error updating plan:`, error);
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
      
      // ENHANCED VALIDATION: Verify user exists and is active in tenant
      const userExists = await db.select()
        .from(users)
        .where(and(
          eq(users.id, req.user.id),
          eq(users.tenantId, req.user.tenantId)
        ));
      
      if (userExists.length === 0) {
        console.error(`[TIMESHEET SUBMIT] CRITICAL ERROR: User ${req.user.id} not found in tenant ${req.user.tenantId} - session corruption detected`);
        return res.status(401).json({ message: "User account not found - please login again", error: "USER_NOT_FOUND" });
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
      
      // Always submit for admin approval (proper workflow) - ENHANCED WITH VALIDATION
      console.log(`[TIMESHEET SUBMIT] ENHANCED - Updating timesheet ${timesheetId} status to 'submitted'`);
      
      // Use more restrictive WHERE clause to prevent race conditions
      updatedTimesheet = await db.update(timesheetsTable)
        .set({ 
          status: 'submitted',
          submittedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(
          eq(timesheetsTable.id, timesheetId),
          eq(timesheetsTable.userId, req.user.id),
          eq(timesheetsTable.tenantId, req.user.tenantId),
          inArray(timesheetsTable.status, ['draft', 'rejected'])
        ))
        .returning();

      console.log(`[TIMESHEET SUBMIT] ENHANCED - Update result:`, updatedTimesheet.length > 0 ? {
        id: updatedTimesheet[0].id,
        status: updatedTimesheet[0].status,
        submittedAt: updatedTimesheet[0].submittedAt,
        userId: updatedTimesheet[0].userId,
        tenantId: updatedTimesheet[0].tenantId
      } : "NO RESULT - CRITICAL ERROR");

      // CRITICAL: Verify the update was successful
      if (!updatedTimesheet || updatedTimesheet.length === 0) {
        console.error(`[TIMESHEET SUBMIT] CRITICAL ERROR: Failed to update timesheet ${timesheetId}`);
        console.error(`[TIMESHEET SUBMIT] Debug: User ${req.user.id}, Tenant ${req.user.tenantId}, Status: ${timesheet[0].status}`);
        throw new Error("Failed to update timesheet status - this indicates a database constraint issue or race condition");
      }

      console.log(`[TIMESHEET SUBMIT] ✅ SUCCESS: Timesheet ${timesheetId} status updated to 'submitted' for user ${req.user.id}`);
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
      let client = null;
      let age = 'Not specified';
      let plan = null;
      
      // Determine correct pronouns function (available globally)
      const determinePronouns = (firstName) => {
        const name = firstName?.toLowerCase() || '';
        const commonFemaleNames = ['sarah', 'mary', 'emily', 'jessica', 'ashley', 'amanda', 'lisa', 'michelle', 'kimberly', 'jennifer', 'stephanie', 'nicole', 'laura', 'elizabeth', 'rebecca', 'rachel', 'samantha', 'heather', 'maria', 'anna'];
        
        if (commonFemaleNames.includes(name)) {
          return { subjective: 'she', objective: 'her', possessive: 'her' };
        } else {
          return { subjective: 'he', objective: 'him', possessive: 'his' };
        }
      };
      
      // Initialize default pronouns
      let pronouns = { subjective: 'they', objective: 'them', possessive: 'their' };
      
      if (planId) {
        try {
          const planResult = await db.select().from(careSupportPlans).where(eq(careSupportPlans.id, planId)).limit(1);
          if (planResult.length > 0) {
            plan = planResult[0];
            const clientResult = await db.select().from(clients).where(eq(clients.id, plan.clientId)).limit(1);
            if (clientResult.length > 0) {
              client = clientResult[0];
              clientDiagnosis = client.primaryDiagnosis || 'Not specified';
              clientName = `${client.firstName || 'Client'} ${client.lastName || ''}`.trim();
              
              // Calculate age from date of birth
              age = client.dateOfBirth ? 
                Math.floor((new Date().getTime() - new Date(client.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) 
                : 'Not specified';
              
              // Build comprehensive client information with debugging
              console.log(`[AI DEBUG] Client name components: firstName="${client.firstName}", lastName="${client.lastName}"`);
              console.log(`[AI DEBUG] Final clientName: "${clientName}"`);
              
              // Update pronouns based on client name
              pronouns = determinePronouns(client.firstName);
              console.log(`[AI DEBUG] Determined pronouns for ${clientName}:`, pronouns);
              
              comprehensiveClientInfo = `
CLIENT INFORMATION (USE EXACT NAME PROVIDED):
- Client Name: ${clientName}
- Age: ${age} years old
- Primary Diagnosis: ${clientDiagnosis}

DOCUMENTED NDIS GOALS:
${client.ndisGoals || 'No NDIS goals documented'}

DOCUMENTED PREFERENCES/INTERESTS:
${client.likesPreferences || 'No preferences documented'}

DOCUMENTED DISLIKES/TRIGGERS:
${client.dislikesAversions || 'No dislikes documented'}

DOCUMENTED MEDICAL INFORMATION:
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
      
      // Enhanced diagnosis lookup using extracted diagnosis from About Me section
      let finalDiagnosis = clientDiagnosis;
      if (plan?.aboutMeData?.diagnosis) {
        finalDiagnosis = plan.aboutMeData.diagnosis;
        console.log(`[GOALS NEW DEBUG] Using extracted diagnosis from About Me: ${finalDiagnosis}`);
      }
      
      // Enhanced debug logging for ALL sections
      console.log(`[AI DEBUG] Section: ${section}, Target: ${req.body.targetField || 'N/A'}`);
      console.log(`[AI DEBUG] Plan ID received: ${planId}`);
      console.log(`[AI DEBUG] Client name received: "${clientName}"`);
      console.log(`[AI DEBUG] Final diagnosis being used: "${finalDiagnosis}"`);
      console.log(`[AI DEBUG] Client object exists: ${!!client}`);
      console.log(`[AI DEBUG] Comprehensive info available: ${!!comprehensiveClientInfo}`);
      console.log(`[AI DEBUG] Plan context available: ${!!planContext}`);
      if (client) {
        console.log(`[AI DEBUG] Client object details:`, { 
          id: client.id, 
          fullName: client.fullName, 
          firstName: client.firstName, 
          lastName: client.lastName 
        });
      }
      
      // Create diagnosis-driven prompts that ALWAYS generate content
      switch (section) {
        case "aboutMe":
          // Check if this is a targeted field generation request
          if (req.body.targetField && req.body.targetField !== 'preview') {
            const targetField = req.body.targetField;
            
            // Get client-specific data for prompts
            const clientLikes = client?.likesPreferences || 'Enjoys music, Shopping, Making new friends, Dancing';
            const clientDislikes = client?.dislikesAversions || 'Hates noise, Lack of choice and control, Not being heard';
            const clientGoals = client?.ndisGoals || 'Improve distress tolerance, Improve speech clarity, Access community independently';
            const emergencyContact = client?.emergencyContactName || 'xyz';
            
            // Check if there's existing About Me content to build upon
            const existingAboutMe = plan?.aboutMeData || {};
            const hasExistingContent = (field) => existingAboutMe[field] && existingAboutMe[field].trim().length > 0;
            
            const fieldSpecificPrompts = {
              personalHistory: hasExistingContent('personalHistory') 
                ? `Build upon existing personal history: "${existingAboutMe.personalHistory}". Add relevant clinical details for ${clientName}, age ${age}, diagnosed with ${clientDiagnosis}. Based on ${pronouns.possessive} diagnosis, ${pronouns.subjective} will likely respond well to structured support approaches. Add complementary information using documented facts: birth year 1997, emergency contact ${emergencyContact}. Maximum 100 words.`
                : `Write clinical personal history for ${clientName}, age ${age}, diagnosed with ${clientDiagnosis}. Based on ${pronouns.possessive} diagnosis, ${pronouns.subjective} will likely respond well to structured support approaches. Use ONLY these documented facts: birth year 1997, emergency contact ${emergencyContact}. Keep factual and clinical. Maximum 100 words.`,
                
              interests: hasExistingContent('interests')
                ? `Build upon existing interests content: "${existingAboutMe.interests}". Add therapeutic explanations for ${clientName}'s documented preferences: ${clientLikes}. Based on ${pronouns.possessive} diagnosis of ${clientDiagnosis}, ${pronouns.subjective} will likely respond well to structured activities incorporating music, shopping, social connections, and dancing. Explain how these interests support ${pronouns.possessive} care goals. Maximum 100 words.`
                : `Write interests content for ${clientName} using ${pronouns.possessive} documented preferences: ${clientLikes}. Based on ${pronouns.possessive} diagnosis of ${clientDiagnosis}, ${pronouns.subjective} will likely respond well to these specific activities: music listening, shopping outings, social activities with friends, and dancing opportunities. Focus on how these interests can be therapeutic. Maximum 100 words.`,
                
              preferences: hasExistingContent('preferences')
                ? `Build upon existing preferences: "${existingAboutMe.preferences}". Add diagnosis-based insights for ${clientName}. ${pronouns.subjective} likes: ${clientLikes}. ${pronouns.subjective} dislikes: ${clientDislikes}. Based on ${pronouns.possessive} diagnosis of ${clientDiagnosis}, ${pronouns.subjective} will likely prefer quiet environments, choice-driven experiences, and structured social activities. Add therapeutic rationale for these preferences. Maximum 100 words.`
                : `Write preferences content for ${clientName}. ${pronouns.subjective} likes: ${clientLikes}. ${pronouns.subjective} dislikes: ${clientDislikes}. Based on ${pronouns.possessive} diagnosis of ${clientDiagnosis}, ${pronouns.subjective} will likely prefer quiet environments during music time, choice-driven shopping experiences, small friend groups, and structured dance activities. Avoid noisy settings and ensure ${pronouns.subjective} has control over decisions. Maximum 100 words.`,
                
              strengths: hasExistingContent('strengths')
                ? `Build upon existing strengths: "${existingAboutMe.strengths}". Add therapeutic perspective for ${clientName}'s abilities: social skills (making friends, dancing), creative interests (music), independence (shopping), and communication. Based on ${pronouns.possessive} diagnosis of ${clientDiagnosis}, ${pronouns.subjective} will likely respond well to strength-based approaches. Add clinical insights about leveraging these strengths. Maximum 100 words.`
                : `Write strengths for ${clientName} based on ${pronouns.possessive} social abilities (enjoys making friends, dancing), creative interests (music), independence skills (shopping), and clear communication of preferences. Based on ${pronouns.possessive} diagnosis of ${clientDiagnosis}, ${pronouns.subjective} will likely respond well to strength-based approaches using these social and expressive abilities. Maximum 100 words.`,
                
              challenges: hasExistingContent('challenges')
                ? `Build upon existing challenges: "${existingAboutMe.challenges}". Add diagnosis-based analysis for ${clientName}. Focus on: ${clientDislikes} and ${pronouns.possessive} NDIS goals: ${clientGoals}. Based on ${pronouns.possessive} diagnosis of ${clientDiagnosis}, ${pronouns.subjective} will likely struggle with noise sensitivity and lack of control. Connect these challenges to ${pronouns.possessive} therapeutic goals. Maximum 100 words.`
                : `Write challenges for ${clientName} focusing on: ${clientDislikes} and ${pronouns.possessive} NDIS goals: ${clientGoals}. Based on ${pronouns.possessive} diagnosis of ${clientDiagnosis}, ${pronouns.subjective} will likely struggle with noise sensitivity, situations lacking choice/control, and feeling unheard. These challenges connect to ${pronouns.possessive} goals of improving distress tolerance and speech clarity. Maximum 100 words.`,
                
              familyBackground: `Information about family background was not provided in ${clientName}'s profile. Only emergency contact information is available: ${emergencyContact}.`,
              
              culturalConsiderations: hasExistingContent('culturalConsiderations')
                ? `Build upon existing family and religious considerations: "${existingAboutMe.culturalConsiderations}". Add practical family dynamics, religious observances, or cultural traditions that impact ${clientName}'s care. Include: family involvement in decision-making, religious practices (prayer times, dietary requirements), cultural holidays, family communication patterns, or spiritual needs. Based on ${pronouns.possessive} diagnosis of ${clientDiagnosis}, consider how family structure and religious factors influence support delivery. Use only documented family/religious information. Maximum 100 words.`
                : `Write family and religious considerations for ${clientName}. Address practical aspects: family involvement in care decisions, religious observances (prayer times, dietary requirements, religious holidays), cultural traditions affecting daily routines, family communication preferences, or spiritual practices. Based on ${pronouns.possessive} diagnosis of ${clientDiagnosis}, explain how family dynamics and religious needs should be incorporated into support planning. If no specific family or religious information is documented, clearly state this. Focus on family structure and religious considerations only. Maximum 100 words.`
            };
            
            // Check if this is familyBackground and no family data exists
            if (targetField === 'familyBackground') {
              res.json({ content: fieldSpecificPrompts[targetField] });
              return;
            }
            
            systemPrompt = `You are writing additional care plan content for the ${targetField} field that builds upon existing content. CRITICAL RULES:
1. Use EXACT client name "${clientName}" - never write "Client" or "[Client Name]"
2. If existing content is provided, ADD TO IT rather than replacing it - expand, enhance, and provide additional insights
3. Start new content with diagnosis phrasing: "Based on ${pronouns.possessive} diagnosis of ${clientDiagnosis}, ${pronouns.subjective} will likely respond well to..." 
4. Generate SPECIFIC content related to ${targetField} using documented client information
5. Connect new content to existing information when available
6. Do NOT include disclaimers about consulting professionals or healthcare professionals
7. Do NOT mention employment, work, or make cultural/ethnic/religious assumptions
8. Focus on practical care planning content that complements what's already written
9. Write in clinical but accessible language
10. NEVER say "Please consult with healthcare professionals"
11. ALWAYS use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive} for ${clientName}`;
            userPrompt = fieldSpecificPrompts[targetField] || `Generate ${targetField} content using documented client information`;
          } else {
            // Enhanced About Me generation with comprehensive overview data
            const ndisGoals = client?.ndisGoals || "No NDIS goals documented";
            const preferences = client?.likesPreferences || "No preferences documented";
            const dislikes = client?.dislikesAversions || "No dislikes documented";
            
            // Extract overview information from plan data or fallback to "Not specified"
            const gender = plan?.aboutMeData?.gender || "Not specified";
            const communicationNotes = plan?.aboutMeData?.communicationNotes || "";
            const supportNeeds = (plan?.aboutMeData?.supportNeeds || []).join(", ") || "";
            
            // Get current medications (placeholder for now - would need medication plan query)
            const currentMeds = "";
            
            // Get pronouns (already determined at global scope)
            
            const universalPromptHeader = `You are writing a section of a formal Care Support Plan for a participant of the National Disability Insurance Scheme (NDIS).

This document will be viewed by health professionals, support workers, and NDIS reviewers. It must be written with clinical clarity, professional tone, and strict adherence to documented facts.

🛑 UNIVERSAL RESTRICTIONS (Apply to ALL Sections)

1. ALWAYS use the client's full name — never write "Client", "[Client Name]", or generic pronouns
2. NEVER mention: 
   - Employment, jobs, workplace, or career aspirations
   - Cultural background, race, religion, ethnicity, or heritage
   - Community involvement, social events, or location-specific references
   - Living arrangements, housing, family, or relationship history
   - Past experiences or speculative personal history
3. NEVER use adjectives like: resilient, strong, determined, independent, vibrant, brave, happy, or positive
4. ONLY use documented medical facts and support preferences
5. NEVER speculate, guess, or invent content
6. NEVER include legal language or professional disclaimers like "please consult a medical team"
7. DIAGNOSIS PHRASE FORMAT:
   - "Based on ${pronouns.possessive} diagnosis, ${pronouns.subjective} will likely respond well to..."
   - "Due to the nature of the diagnosis, staff are encouraged to..."
8. ALWAYS use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive} for ${clientName}

✍️ GENERAL WRITING STYLE
- Clinical
- Objective
- Direct
- No asterisks, emojis, or markdown
- Maximum: 400 words per section

This section must provide clear, practical support guidance for staff — with content tailored to the client's documented diagnosis and preferences.

---

🎯 ABOUT ME SECTION SPECIFIC REQUIREMENTS:
- Write a clinical summary of who the person is and their support needs
- Include their diagnosis and how it affects their daily life
- Reference documented NDIS goals and preferences only
- Use only documented information: ${finalDiagnosis}, preferences: ${preferences}, dislikes: ${dislikes}
- Overview data: Gender: ${gender}, Support Needs: ${supportNeeds}, Communication Notes: ${communicationNotes}

Return ONLY the generated about me content. Do not include headings, formatting, or extra explanation.`;
            
            systemPrompt = universalPromptHeader;
            
            userPrompt = `${contextualInfo}\n\n🧠 Additional Input from User (if any): ${userInput || 'Generate clinical About Me section using ONLY documented facts'}\n\nWrite clinical About Me content following the exact structure and restrictions above.`;
            
            console.log(`[ABOUT ME ENHANCED DEBUG] Enhanced system prompt being sent to AI:`, systemPrompt);
            console.log(`[ABOUT ME ENHANCED DEBUG] Final user prompt being sent to AI:`, userPrompt);
            console.log(`[ABOUT ME ENHANCED DEBUG] Client data extracted - Name: ${clientName}, Diagnosis: ${finalDiagnosis}`);
            console.log(`[ABOUT ME ENHANCED DEBUG] NDIS Goals: ${ndisGoals}`);
            console.log(`[ABOUT ME ENHANCED DEBUG] Preferences: ${preferences}`);
            console.log(`[ABOUT ME ENHANCED DEBUG] Dislikes: ${dislikes}`);
            console.log(`[ABOUT ME ENHANCED DEBUG] Overview data - Gender: ${gender}, Support Needs: ${supportNeeds}, Communication Notes: ${communicationNotes}`);
          }
          break;
        
        case "goals":
          // Simplified Goals generation with better error handling
          if (req.body.targetField && req.body.targetField !== 'preview') {
            const targetField = req.body.targetField;
            
            // Enhanced fallback: if no client context, try to fetch it directly
            if (!client && planId) {
              try {
                const planResult = await db.select().from(careSupportPlans).where(eq(careSupportPlans.id, planId)).limit(1);
                if (planResult.length > 0) {
                  plan = planResult[0];
                  const clientResult = await db.select().from(clients).where(eq(clients.id, plan.clientId)).limit(1);
                  if (clientResult.length > 0) {
                    client = clientResult[0];
                    clientDiagnosis = client.primaryDiagnosis || 'Not specified';
                    clientName = `${client.firstName || 'Client'} ${client.lastName || ''}`.trim();
                    console.log(`[GOALS FIX] Successfully fetched client: ${clientName}, diagnosis: ${clientDiagnosis}`);
                  }
                }
              } catch (error) {
                console.error("Error fetching client for Goals:", error);
              }
            }
            
            if (targetField === 'ndisGoals') {
              systemPrompt = `You are generating NDIS goals based on authentic, clinical information.

Client Name: ${clientName}
Diagnosis: ${clientDiagnosis}
About Me: ${plan?.aboutMeData ? JSON.stringify(plan.aboutMeData, null, 2) : 'No About Me content available'}

🎯 Your task:
1. Begin by generating **exactly five goals** that are **directly related to the client's diagnosis**. These must be therapeutic in nature and aligned with NDIS frameworks.
2. After that, review any previously documented goals and include them **only if they are not duplicates**.
3. Do not invent goals not supported by diagnosis, About Me, or existing content.
4. Maintain a clear, human-readable list structure.

Respond with a concise, bullet-point format. Do not include headers or labels.`;
              
              userPrompt = `Use documented NDIS goals: "${client?.ndisGoals || 'No NDIS goals documented'}"
              
Generate therapeutic NDIS goals for ${clientName} based on diagnosis: ${clientDiagnosis}`;
              
            } else if (targetField === 'personalAspirations') {
              // Build Personal Identity Context for aspirations
              const personalContext = `
Client: ${clientName}
Likes/Preferences: ${client?.likesPreferences || "Not provided"}
Dislikes/Aversions: ${client?.dislikesAversions || "Not provided"}
About Me Summary: ${plan?.aboutMeData?.content || "Not generated yet"}
Structure & Routine: ${plan?.structureData?.dailyActivities || "Not yet documented"}
Communication Notes: ${plan?.communicationData?.summary || "Not available"}
`.trim();

              systemPrompt = `You are generating a short list of **personal aspirations** for a person receiving NDIS support.

Client name: ${clientName}

Use only the information below to derive their individual hopes, interests, and preferences:

${personalContext}

🎯 Your task:
1. Extract personal aspirations based on About Me, preferences, and daily routine.
2. Focus on goals tied to identity, lifestyle, interests, enjoyment — not clinical outcomes.
3. Do NOT include anything medical or diagnostic.
4. Avoid assumptions about culture, employment, relationships, or past history.
5. Reflect how the person wants to live, grow, or engage — using only documented content.

📌 Output Format:
- Bullet point list
- Each item must be person-centred, specific, and written in a human tone
- Do not include headers or extra formatting`;
              
              userPrompt = `Generate personal aspirations for ${clientName} using the comprehensive personal context provided above.`;
              
              console.log(`[PERSONAL ASPIRATIONS DEBUG] Personal context being sent to AI:`, personalContext);
              console.log(`[PERSONAL ASPIRATIONS DEBUG] Enhanced prompt being sent to AI:`, systemPrompt);
              
            } else if (targetField === 'shortTermGoals') {
              systemPrompt = `You are generating specific, measurable short-term goals (3-6 months) for a client with NDIS support.

Client name: ${clientName}
Diagnosis: ${clientDiagnosis}

Generate 3-5 specific, achievable goals that can be accomplished in 3-6 months. These should be:
1. Directly related to the client's diagnosis and documented needs
2. Measurable and specific
3. Achievable within 3-6 months
4. Build towards independence and capacity building

Use clinical language and be specific about what the client will achieve.`;
              
              userPrompt = `Generate short-term goals for ${clientName} with ${clientDiagnosis}. Focus on specific, measurable outcomes achievable in 3-6 months.`;
              
            } else if (targetField === 'longTermGoals') {
              systemPrompt = `You are generating broader long-term goals (6+ months) for a client with NDIS support.

Client name: ${clientName}
Diagnosis: ${clientDiagnosis}

Generate 3-5 broader aspirational goals that can be worked towards over 6+ months. These should be:
1. Build upon short-term achievements
2. Related to the client's diagnosis and long-term independence
3. Support community participation and quality of life
4. Align with NDIS capacity building principles

Use clinical language and focus on long-term outcomes and aspirations.`;
              
              userPrompt = `Generate long-term goals for ${clientName} with ${clientDiagnosis}. Focus on broader aspirations achievable over 6+ months that build independence and community participation.`;
              
            } else if (targetField === 'overallObjective') {
              systemPrompt = `You are generating an overall objective statement summarizing the main aspirations for a client with NDIS support.

Client name: ${clientName}
Diagnosis: ${clientDiagnosis}

Generate a comprehensive objective statement (2-3 sentences) that summarizes:
1. The client's main life aspirations
2. How NDIS support will help achieve these
3. The overall vision for their independence and quality of life

Use clinical language and be person-centered.`;
              
              userPrompt = `Generate an overall objective statement for ${clientName} with ${clientDiagnosis} that summarizes their main life aspirations and how NDIS support will help achieve them.`;
            }
            
            // Handle the targeted field generation
            const response = await openai.chat.completions.create({
              model: "gpt-4o", 
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              temperature: 0.3,
              max_tokens: 400,
            });
            
            const generatedContent = response.choices[0].message.content;
            return res.json({ content: generatedContent?.trim() || `Information for ${targetField} was not available in the client's documented data.` });
          }
          
          // Original Goals section generation (for general "Generate Goals" button)
          // Ensure we have client context for Goals section
          if (!client && planId) {
            try {
              const planResult = await db.select().from(careSupportPlans).where(eq(careSupportPlans.id, planId)).limit(1);
              if (planResult.length > 0) {
                plan = planResult[0];
                const clientResult = await db.select().from(clients).where(eq(clients.id, plan.clientId)).limit(1);
                if (clientResult.length > 0) {
                  client = clientResult[0];
                  clientDiagnosis = client.primaryDiagnosis || 'Not specified';
                  clientName = `${client.firstName || 'Client'} ${client.lastName || ''}`.trim();
                  
                  // Calculate age from date of birth
                  age = client.dateOfBirth ? 
                    Math.floor((new Date().getTime() - new Date(client.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) 
                    : 'Not specified';
                  
                  comprehensiveClientInfo = `
CLIENT INFORMATION (USE EXACT NAME PROVIDED):
- Client Name: ${clientName}
- Age: ${age} years old
- Primary Diagnosis: ${clientDiagnosis}

DOCUMENTED NDIS GOALS:
${client.ndisGoals || 'No NDIS goals documented'}

DOCUMENTED PREFERENCES/INTERESTS:
${client.likesPreferences || 'No preferences documented'}

DOCUMENTED DISLIKES/TRIGGERS:
${client.dislikesAversions || 'No dislikes documented'}

DOCUMENTED MEDICAL INFORMATION:
${client.allergiesMedicalAlerts || 'No medical alerts documented'}
`;
                }
              }
            } catch (error) {
              console.error("Error fetching client context for Goals:", error);
            }
          }

          // Build pseudo-overview context for enhanced Goals generation
          const pseudoOverview = `
Client: ${clientName}
Diagnosis: ${plan?.aboutMeData?.diagnosis || finalDiagnosis}
Likes: ${client?.likesPreferences || "Not specified"}
Dislikes: ${client?.dislikesAversions || "Not specified"}
Medical Alerts: ${client?.allergiesMedicalAlerts || "None"}
About Me: ${plan?.aboutMeData?.content || "Not generated yet"}
Existing NDIS Goals: ${plan?.goalsData?.ndisGoals || "None"}
`.trim();

          const universalPromptHeaderGoals = `You are writing a section of a formal Care Support Plan for a participant of the National Disability Insurance Scheme (NDIS).

This document will be viewed by health professionals, support workers, and NDIS reviewers. It must be written with clinical clarity, professional tone, and strict adherence to documented facts.

🛑 UNIVERSAL RESTRICTIONS (Apply to ALL Sections)

1. ALWAYS use the client's full name — never write "Client", "[Client Name]", or generic pronouns
2. NEVER mention: 
   - Employment, jobs, workplace, or career aspirations
   - Cultural background, race, religion, ethnicity, or heritage
   - Community involvement, social events, or location-specific references
   - Living arrangements, housing, family, or relationship history
   - Past experiences or speculative personal history
3. NEVER use adjectives like: resilient, strong, determined, independent, vibrant, brave, happy, or positive
4. ONLY use documented medical facts and support preferences
5. NEVER speculate, guess, or invent content
6. NEVER include legal language or professional disclaimers like "please consult a medical team"
7. DIAGNOSIS PHRASE FORMAT:
   - "Based on his diagnosis, he will likely respond well to..."
   - "Based on her diagnosis, she may benefit from..."
   - "Due to the nature of the diagnosis, staff are encouraged to..."

✍️ GENERAL WRITING STYLE
- Clinical
- Objective
- Direct
- No asterisks, emojis, or markdown
- Maximum: 400 words per section

This section must provide clear, practical support guidance for staff — with content tailored to the client's documented diagnosis and preferences.

---

🎯 GOALS SECTION SPECIFIC REQUIREMENTS:
Client name: ${clientName}
Diagnosis: ${plan?.aboutMeData?.diagnosis || finalDiagnosis}
Data summary: ${pseudoOverview}

Generate exactly five therapeutic goals that are clearly linked to the client's diagnosis and support needs. Each goal must align with NDIS standards focusing on independence, capacity building, and functional outcomes. Review any existing NDIS goals and only include if not duplicates. Use only documented data above.

📌 Output Format: Bullet point list only, no asterisks, no extra commentary, no headings. Total list should be 5–10 goals max.`;
          
          systemPrompt = universalPromptHeaderGoals;
          
          userPrompt = `Generate NDIS goals using the comprehensive client context provided above. User input: ${userInput || 'Generate therapeutic goals based on diagnosis and documented client information'}`;
          
          console.log(`[GOALS ENHANCED DEBUG] Pseudo-overview context:`, pseudoOverview);
          console.log(`[GOALS ENHANCED DEBUG] Enhanced goals prompt being sent to AI:`, systemPrompt);
          console.log(`[GOALS ENHANCED DEBUG] About Me content available:`, plan?.aboutMeData?.content ? 'Yes' : 'No');
          console.log(`[GOALS ENHANCED DEBUG] Existing NDIS goals:`, plan?.goalsData?.ndisGoals || 'None');
          break;
        
        case "adl":
          // Field-specific generation for ADL sections
          if (req.body.targetField && req.body.targetField !== 'preview') {
            const targetField = req.body.targetField;
            
            // Enhanced fallback: if no client context, try to fetch it directly
            if (!client && planId) {
              try {
                const planResult = await db.select().from(careSupportPlans).where(eq(careSupportPlans.id, planId)).limit(1);
                if (planResult.length > 0) {
                  plan = planResult[0];
                  const clientResult = await db.select().from(clients).where(eq(clients.id, plan.clientId)).limit(1);
                  if (clientResult.length > 0) {
                    client = clientResult[0];
                    clientDiagnosis = client.primaryDiagnosis || 'Not specified';
                    clientName = `${client.firstName || 'Client'} ${client.lastName || ''}`.trim();
                    console.log(`[ADL FIX] Successfully fetched client: ${clientName}, diagnosis: ${clientDiagnosis}`);
                  }
                }
              } catch (error) {
                console.error("Error fetching client for ADL:", error);
              }
            }
            
            // Field-specific prompts for each ADL area
            if (targetField === 'personalCare') {
              systemPrompt = `You are generating specific content for the Personal Care section of an ADL assessment.

Client Name: ${clientName}
Diagnosis: ${clientDiagnosis}
User Assessment: ${userInput}

Focus specifically on:
- Bathing and showering abilities
- Oral hygiene and dental care
- Grooming and personal appearance
- Toileting and continence
- Dressing and undressing

Generate specific, clinical guidance about the client's personal care needs and required support strategies. Use clinical language and be specific about support requirements.`;
              
              userPrompt = `Generate personal care support guidance for ${clientName} with ${clientDiagnosis} based on: ${userInput}`;
              
            } else if (targetField === 'mobility') {
              systemPrompt = `You are generating specific content for the Mobility section of an ADL assessment.

Client Name: ${clientName}
Diagnosis: ${clientDiagnosis}
User Assessment: ${userInput}

Focus specifically on:
- Walking and balance
- Transfers (bed, chair, toilet, car)
- Wheelchair or mobility aid use
- Stairs and navigation
- Falls risk and prevention

Generate specific, clinical guidance about the client's mobility needs and required support strategies. Use clinical language and be specific about mobility assistance requirements.`;
              
              userPrompt = `Generate mobility support guidance for ${clientName} with ${clientDiagnosis} based on: ${userInput}`;
              
            } else if (targetField === 'household') {
              systemPrompt = `You are generating specific content for the Household Tasks section of an ADL assessment.

Client Name: ${clientName}
Diagnosis: ${clientDiagnosis}
User Assessment: ${userInput}

Focus specifically on:
- Meal preparation and cooking
- Cleaning and housekeeping
- Laundry and clothing care
- Shopping and errands
- Home maintenance tasks

Generate specific, clinical guidance about the client's household task abilities and required support strategies. Use clinical language and be specific about domestic support requirements.`;
              
              userPrompt = `Generate household tasks support guidance for ${clientName} with ${clientDiagnosis} based on: ${userInput}`;
              
            } else if (targetField === 'community') {
              systemPrompt = `You are generating specific content for the Community Access section of an ADL assessment.

Client Name: ${clientName}
Diagnosis: ${clientDiagnosis}
User Assessment: ${userInput}

Focus specifically on:
- Transportation and travel
- Social participation
- Community activities and venues
- Appointments and services
- Public facility access

Generate specific, clinical guidance about the client's community access needs and required support strategies. Use clinical language and be specific about community participation support.`;
              
              userPrompt = `Generate community access support guidance for ${clientName} with ${clientDiagnosis} based on: ${userInput}`;
              
            } else if (targetField === 'safety') {
              systemPrompt = `You are generating specific content for the Safety Awareness section of an ADL assessment.

Client Name: ${clientName}
Diagnosis: ${clientDiagnosis}
User Assessment: ${userInput}

Focus specifically on:
- Risk awareness and judgment
- Emergency response abilities
- Medication management safety
- Home and community safety
- Personal safety awareness

Generate specific, clinical guidance about the client's safety awareness and required supervision/support strategies. Use clinical language and be specific about safety support requirements.`;
              
              userPrompt = `Generate safety awareness support guidance for ${clientName} with ${clientDiagnosis} based on: ${userInput}`;
              
            } else if (targetField === 'independence') {
              systemPrompt = `You are generating specific content for the Independence Skills section of an ADL assessment.

Client Name: ${clientName}
Diagnosis: ${clientDiagnosis}
User Assessment: ${userInput}

Focus specifically on:
- Decision-making abilities
- Problem-solving skills
- Self-advocacy
- Goal setting and achievement
- Skill development potential

Generate specific, clinical guidance about the client's independence skills and capacity building strategies. Use clinical language and be specific about independence support requirements.`;
              
              userPrompt = `Generate independence skills support guidance for ${clientName} with ${clientDiagnosis} based on: ${userInput}`;
              
            } else if (targetField === 'assistiveTechnology') {
              systemPrompt = `You are generating specific content for the Assistive Technology section of an ADL assessment.

Client Name: ${clientName}
Diagnosis: ${clientDiagnosis}
User Assessment: ${userInput}

Focus specifically on:
- Current assistive devices and equipment
- Technology needs and recommendations
- Adaptive equipment for daily tasks
- Communication aids and devices
- Environmental modifications

Generate specific, clinical guidance about the client's assistive technology needs and recommendations. Use clinical language and be specific about equipment and technology support.`;
              
              userPrompt = `Generate assistive technology recommendations for ${clientName} with ${clientDiagnosis} based on: ${userInput}`;
              
            } else if (targetField === 'recommendations') {
              systemPrompt = `You are generating specific content for the ADL Recommendations section.

Client Name: ${clientName}
Diagnosis: ${clientDiagnosis}
User Assessment: ${userInput}

Focus specifically on:
- Overall ADL support strategies
- Staff training recommendations
- Environmental modifications
- Goal progression suggestions
- Review and monitoring plans

Generate specific, clinical recommendations for comprehensive ADL support. Use clinical language and be specific about implementation strategies.`;
              
              userPrompt = `Generate comprehensive ADL recommendations for ${clientName} with ${clientDiagnosis} based on: ${userInput}`;
            }
            
            // Handle the targeted field generation
            const response = await openai.chat.completions.create({
              model: "gpt-4o", 
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              temperature: 0.3,
              max_tokens: 400,
            });
            
            const generatedContent = response.choices[0].message.content;
            return res.json({ content: generatedContent?.trim() || `Information for ${targetField} was not available in the client's documented data.` });
          }
          
          // Original ADL section generation (for general "Generate ADL Content" button)
          // Build ADL context with comprehensive client data
          const adlContext = `
Client: ${clientName}
Diagnosis: ${plan?.aboutMeData?.diagnosis || finalDiagnosis}
About Me: ${plan?.aboutMeData?.content || "Not generated"}
User ADL Assessment: ${plan?.adlData?.assessment || "No user ADL assessment provided"}
Likes & Preferences: ${client?.likesPreferences || "N/A"}
Dislikes & Aversions: ${client?.dislikesAversions || "N/A"}
`.trim();

          const universalPromptHeaderADL = `You are writing a section of a formal Care Support Plan for a participant of the National Disability Insurance Scheme (NDIS).

This document will be viewed by health professionals, support workers, and NDIS reviewers. It must be written with clinical clarity, professional tone, and strict adherence to documented facts.

🛑 UNIVERSAL RESTRICTIONS (Apply to ALL Sections)

1. ALWAYS use the client's full name — never write "Client", "[Client Name]", or generic pronouns
2. NEVER mention: 
   - Employment, jobs, workplace, or career aspirations
   - Cultural background, race, religion, ethnicity, or heritage
   - Community involvement, social events, or location-specific references
   - Living arrangements, housing, family, or relationship history
   - Past experiences or speculative personal history
3. NEVER use adjectives like: resilient, strong, determined, independent, vibrant, brave, happy, or positive
4. ONLY use documented medical facts and support preferences
5. NEVER speculate, guess, or invent content
6. NEVER include legal language or professional disclaimers like "please consult a medical team"
7. DIAGNOSIS PHRASE FORMAT:
   - "Based on ${pronouns.possessive} diagnosis, ${pronouns.subjective} will likely respond well to..."
   - "Due to the nature of the diagnosis, staff are encouraged to..."
8. ALWAYS use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive} for ${clientName}

✍️ GENERAL WRITING STYLE
- Clinical
- Objective
- Direct
- No asterisks, emojis, or markdown
- Maximum: 400 words per section

This section must provide clear, practical support guidance for staff — with content tailored to the client's documented diagnosis and preferences.

---

🎯 ADL SECTION SPECIFIC REQUIREMENTS:
Client Name: ${clientName}
Diagnosis: ${plan?.aboutMeData?.diagnosis || finalDiagnosis}
Information Available: ${adlContext}

Generate structured ADL support description using ONLY the data provided. Clearly state specific ADL challenges based on user assessment. Highlight areas needing support (hygiene, meal prep, cleaning, motivation). Explain practical support strategies (prompting, visual cues, repetition). Write in paragraph form, clinical tone, do NOT invent challenges not mentioned in assessment.`;
          
          systemPrompt = universalPromptHeaderADL;
          
          userPrompt = `Generate structured ADL support content using the comprehensive ADL context provided above. User input: ${userInput || 'Generate ADL support based on documented assessment and client information'}`;
          
          console.log(`[ADL ENHANCED DEBUG] ADL context being sent to AI:`, adlContext);
          console.log(`[ADL ENHANCED DEBUG] Enhanced system prompt being sent to AI:`, systemPrompt);
          console.log(`[ADL ENHANCED DEBUG] User input extracted:`, userInput);
          console.log(`[ADL ENHANCED DEBUG] About Me content available:`, plan?.aboutMeData?.content ? 'Yes' : 'No');
          console.log(`[ADL ENHANCED DEBUG] ADL assessment available:`, plan?.adlData?.assessment ? 'Yes' : 'No');
          break;
        
        case "structure":
          // Build structure and routine context
          const structureContext = `
Client: ${clientName}
Diagnosis: ${plan?.aboutMeData?.diagnosis || finalDiagnosis}
About Me: ${plan?.aboutMeData?.content || "Not generated"}
Structure Data: ${plan?.structureData?.summary || "Not yet documented"}
Preferences: ${client?.likesPreferences || "Not documented"}
Dislikes: ${client?.dislikesAversions || "Not documented"}
`.trim();

          const universalPromptHeaderStructure = `You are writing a section of a formal Care Support Plan for a participant of the National Disability Insurance Scheme (NDIS).

This document will be viewed by health professionals, support workers, and NDIS reviewers. It must be written with clinical clarity, professional tone, and strict adherence to documented facts.

🛑 UNIVERSAL RESTRICTIONS (Apply to ALL Sections)

1. ALWAYS use the client's full name — never write "Client", "[Client Name]", or generic pronouns
2. NEVER mention: 
   - Employment, jobs, workplace, or career aspirations
   - Cultural background, race, religion, ethnicity, or heritage
   - Community involvement, social events, or location-specific references
   - Living arrangements, housing, family, or relationship history
   - Past experiences or speculative personal history
3. NEVER use adjectives like: resilient, strong, determined, independent, vibrant, brave, happy, or positive
4. ONLY use documented medical facts and support preferences
5. NEVER speculate, guess, or invent content
6. NEVER include legal language or professional disclaimers like "please consult a medical team"
7. DIAGNOSIS PHRASE FORMAT:
   - "Based on ${pronouns.possessive} diagnosis, ${pronouns.subjective} will likely respond well to..."
   - "Due to the nature of the diagnosis, staff are encouraged to..."
8. ALWAYS use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive} for ${clientName}

✍️ GENERAL WRITING STYLE
- Clinical
- Objective
- Direct
- No asterisks, emojis, or markdown
- Maximum: 400 words per section

This section must provide clear, practical support guidance for staff — with content tailored to the client's documented diagnosis and preferences.

---

🎯 STRUCTURE & ROUTINE SECTION SPECIFIC REQUIREMENTS:
Client Information Available: ${structureContext}

Use the diagnosis to describe structural and routine needs common to individuals with that condition. Provide practical guidance on: morning/evening routines, task transitions, predictability/visual cues/prompts, managing changes/disruptions, environmental adjustments (noise, lighting, space). Ensure recommendations are diagnosis-aligned for disability support workers. Do NOT invent lifestyle preferences or include personal interests, family references, or unsupported background.

Output only the generated content. No labels, headings, or explanation.`;
          
          systemPrompt = universalPromptHeaderStructure;
          
          userPrompt = `Generate structure and routine guidance using the comprehensive client context provided above. User input: ${userInput || 'Generate diagnosis-based structure and routine guidance for support workers'}`;
          
          console.log(`[STRUCTURE ENHANCED DEBUG] Structure context being sent to AI:`, structureContext);
          console.log(`[STRUCTURE ENHANCED DEBUG] Enhanced system prompt being sent to AI:`, systemPrompt);
          console.log(`[STRUCTURE ENHANCED DEBUG] About Me content available:`, plan?.aboutMeData?.content ? 'Yes' : 'No');
          console.log(`[STRUCTURE ENHANCED DEBUG] Structure data available:`, plan?.structureData?.summary ? 'Yes' : 'No');
          break;
        
        case "communication":
          // Field-specific generation for Communication sections
          if (req.body.targetField && req.body.targetField !== 'preview') {
            const targetField = req.body.targetField;
            
            // Enhanced fallback: if no client context, try to fetch it directly
            if (!client && planId) {
              try {
                const planResult = await db.select().from(careSupportPlans).where(eq(careSupportPlans.id, planId)).limit(1);
                if (planResult.length > 0) {
                  plan = planResult[0];
                  const clientResult = await db.select().from(clients).where(eq(clients.id, plan.clientId)).limit(1);
                  if (clientResult.length > 0) {
                    client = clientResult[0];
                    clientDiagnosis = client.primaryDiagnosis || 'Not specified';
                    clientName = `${client.firstName || 'Client'} ${client.lastName || ''}`.trim();
                    console.log(`[COMMUNICATION FIX] Successfully fetched client: ${clientName}, diagnosis: ${clientDiagnosis}`);
                  }
                }
              } catch (error) {
                console.error("Error fetching client for Communication:", error);
              }
            }
            
            // Field-specific prompts for each Communication area
            if (targetField === 'expressiveStrategies') {
              systemPrompt = `You are generating specific content for the Expressive Communication Strategies section.

Client Name: ${clientName}
Diagnosis: ${clientDiagnosis}
User Assessment: ${userInput}

Focus specifically on:
- How the client expresses wants, needs, and feelings
- Verbal and non-verbal expression methods
- Communication aids and devices for expression
- Staff strategies to support client's expression
- Techniques to encourage communication attempts

Generate specific, clinical guidance about supporting the client's expressive communication abilities. Use clinical language and be specific about expression support strategies.`;
              
              userPrompt = `Generate expressive communication support strategies for ${clientName} with ${clientDiagnosis} based on: ${userInput}`;
              
            } else if (targetField === 'receptiveStrategies') {
              systemPrompt = `You are generating specific content for the Receptive Communication Strategies section.

Client Name: ${clientName}
Diagnosis: ${clientDiagnosis}
User Assessment: ${userInput}

Focus specifically on:
- How the client processes and understands information
- Comprehension of verbal and non-verbal communication
- Information processing preferences and needs
- Staff strategies to improve understanding
- Environmental factors that affect comprehension

Generate specific, clinical guidance about supporting the client's receptive communication abilities. Use clinical language and be specific about comprehension support strategies.`;
              
              userPrompt = `Generate receptive communication support strategies for ${clientName} with ${clientDiagnosis} based on: ${userInput}`;
              
            } else if (targetField === 'staffApproaches') {
              systemPrompt = `You are generating specific content for the Staff Communication Approaches section.

Client Name: ${clientName}
Diagnosis: ${clientDiagnosis}
User Assessment: ${userInput}

Focus specifically on:
- Specific communication techniques for staff to use
- Tone, volume, and pacing considerations
- Visual and auditory presentation methods
- Cultural and personal communication preferences
- Effective interaction strategies

Generate specific, clinical guidance about how staff should communicate with the client. Use clinical language and be specific about staff communication approaches.`;
              
              userPrompt = `Generate staff communication approach strategies for ${clientName} with ${clientDiagnosis} based on: ${userInput}`;
              
            } else if (targetField === 'assistiveTechnology') {
              systemPrompt = `You are generating specific content for the Communication Assistive Technology section.

Client Name: ${clientName}
Diagnosis: ${clientDiagnosis}
User Assessment: ${userInput}

Focus specifically on:
- Communication devices and applications
- Assistive communication equipment
- Technology training and support needs
- Device maintenance and troubleshooting
- Technology integration into daily routines

Generate specific, clinical guidance about assistive communication technology needs and implementation. Use clinical language and be specific about technology support requirements.`;
              
              userPrompt = `Generate assistive communication technology recommendations for ${clientName} with ${clientDiagnosis} based on: ${userInput}`;
            }
            
            // Handle the targeted field generation
            const response = await openai.chat.completions.create({
              model: "gpt-4o", 
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              temperature: 0.3,
              max_tokens: 400,
            });
            
            const generatedContent = response.choices[0].message.content;
            return res.json({ content: generatedContent?.trim() || `Information for ${targetField} was not available in the client's documented data.` });
          }
          
          // Original Communication section generation (for general "Generate Communication Support Plan" button)
          // Build comprehensive communication context
          const communicationContext = `
Client: ${clientName}
Diagnosis: ${plan?.aboutMeData?.diagnosis || finalDiagnosis}
About Me: ${plan?.aboutMeData?.content || "Not generated"}
NDIS Goals: ${client?.ndisGoals || "No NDIS goals documented"}
Likes & Preferences: ${client?.likesPreferences || "Not documented"}
Dislikes & Aversions: ${client?.dislikesAversions || "Not documented"}
Communication Data: ${plan?.communicationData?.summary || "Not yet documented"}
`.trim();

          const universalPromptHeaderComm = `You are writing a section of a formal Care Support Plan for a participant of the National Disability Insurance Scheme (NDIS).

This document will be viewed by health professionals, support workers, and NDIS reviewers. It must be written with clinical clarity, professional tone, and strict adherence to documented facts.

🛑 UNIVERSAL RESTRICTIONS (Apply to ALL Sections)

1. ALWAYS use the client's full name — never write "Client", "[Client Name]", or generic pronouns
2. NEVER mention: 
   - Employment, jobs, workplace, or career aspirations
   - Cultural background, race, religion, ethnicity, or heritage
   - Community involvement, social events, or location-specific references
   - Living arrangements, housing, family, or relationship history
   - Past experiences or speculative personal history
3. NEVER use adjectives like: resilient, strong, determined, independent, vibrant, brave, happy, or positive
4. ONLY use documented medical facts and support preferences
5. NEVER speculate, guess, or invent content
6. NEVER include legal language or professional disclaimers like "please consult a medical team"
7. DIAGNOSIS PHRASE FORMAT:
   - "Based on ${pronouns.possessive} diagnosis, ${pronouns.subjective} will likely respond well to..."
   - "Due to the nature of the diagnosis, staff are encouraged to..."
8. ALWAYS use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive} for ${clientName}

✍️ GENERAL WRITING STYLE
- Clinical
- Objective
- Direct
- No asterisks, emojis, or markdown
- Maximum: 400 words per section

This section must provide clear, practical support guidance for staff — with content tailored to the client's documented diagnosis and preferences.

---

🎯 COMMUNICATION SECTION SPECIFIC REQUIREMENTS:
Client Information Available: ${communicationContext}

Write a clinical summary of the person's communication needs and recommended support strategies. Use ONLY documented sources: diagnosis, NDIS goals related to communication, documented sensitivities. Focus on evidence-based communication strategies appropriate to diagnosis and sensitivities. Tailor strategies to match diagnosis + goals + sensitivities. Do NOT make assumptions about communication abilities or invent content.

Return ONLY the generated communication section content. Do not include headings, formatting, or extra explanation.`;
          
          systemPrompt = universalPromptHeaderComm;
          
          userPrompt = `Generate clinical communication support content using the comprehensive client context provided above. User input: ${userInput || 'Generate evidence-based communication strategies using documented information only'}`;
          
          console.log(`[COMMUNICATION ENHANCED DEBUG] Communication context being sent to AI:`, communicationContext);
          console.log(`[COMMUNICATION ENHANCED DEBUG] Enhanced system prompt being sent to AI:`, systemPrompt);
          console.log(`[COMMUNICATION ENHANCED DEBUG] About Me content available:`, plan?.aboutMeData?.content ? 'Yes' : 'No');
          console.log(`[COMMUNICATION ENHANCED DEBUG] NDIS goals available:`, client?.ndisGoals ? 'Yes' : 'No');
          console.log(`[COMMUNICATION ENHANCED DEBUG] Communication data available:`, plan?.communicationData?.summary ? 'Yes' : 'No');
          break;
        
        case "behaviour":
          // Check if this is a field-specific strategy generation or bulk generation
          const targetField = req.body.targetField;
          if (targetField && (targetField.includes('strategy') || targetField.includes('_strategy') || targetField === 'deescalation_techniques' || targetField === 'pbs_tips')) {
            // Field-specific strategy generation
            const existingContent = req.body.existingContent || {};
            const behaviourDescription = existingContent.description || 'Behaviour not specified';
            const behaviourTriggers = existingContent.triggers || 'Triggers not specified';
            const existingStrategy = existingContent.existingStrategy || '';
            
            let strategyType = '';
            if (targetField.includes('proactive')) {
              strategyType = 'proactive/preventative';
            } else if (targetField.includes('reactive')) {
              strategyType = 'reactive/immediate response';
            } else if (targetField.includes('protective')) {
              strategyType = 'protective/post-behaviour';
            }
            
            systemPrompt = `You are writing field-specific behaviour support strategies for a formal Care Support Plan for a participant of the National Disability Insurance Scheme (NDIS).

🛑 UNIVERSAL RESTRICTIONS
1. ALWAYS use the client's exact name "${clientName}" — never write "Client" or "[Client Name]"
2. NEVER mention employment, cultural background, living arrangements, or speculative history
3. NEVER use adjectives like resilient, strong, determined, independent, vibrant
4. ONLY use documented medical facts and support preferences
5. NEVER speculate, guess, or invent content
6. ALWAYS use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive} for ${clientName}
7. DIAGNOSIS PHRASE FORMAT: "Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely respond well to..."

✍️ WRITING STYLE: Clinical, objective, direct. No asterisks, emojis, headers, or bullet points. 150-200 words of flowing text.

🎯 STRATEGY TYPE: ${strategyType}

Generate specific ${strategyType} strategies for the behaviour "${behaviourDescription}" with triggers "${behaviourTriggers}". Use the client's documented diagnosis "${finalDiagnosis}" to inform evidence-based strategies. ${existingStrategy ? `Build upon existing strategy: "${existingStrategy}"` : 'Create new strategy content.'} Focus on practical staff instructions specific to this behaviour and diagnosis.`;

            userPrompt = req.body.promptOverride || `Generate ${strategyType} strategies for ${clientName} based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}. Behaviour: ${behaviourDescription}. Triggers: ${behaviourTriggers}. Provide evidence-based staff instructions for this specific scenario.`;
            
            console.log(`[BEHAVIOUR STRATEGY DEBUG] Strategy type: ${strategyType}`);
            console.log(`[BEHAVIOUR STRATEGY DEBUG] Behaviour: ${behaviourDescription}`);
            console.log(`[BEHAVIOUR STRATEGY DEBUG] Triggers: ${behaviourTriggers}`);
            console.log(`[BEHAVIOUR STRATEGY DEBUG] Existing strategy: ${existingStrategy ? 'Yes' : 'No'}`);
            
          } else if (targetField === 'deescalation_techniques' || targetField === 'pbs_tips') {
            // Bulk generation for de-escalation techniques or PBS tips
            const allBehaviours = userInput || 'No behaviours specified';
            
            let bulkPromptType = '';
            if (targetField === 'deescalation_techniques') {
              bulkPromptType = 'comprehensive de-escalation techniques';
            } else if (targetField === 'pbs_tips') {
              bulkPromptType = 'positive behaviour support tips';
            }
            
            systemPrompt = `You are writing comprehensive ${bulkPromptType} for a formal Care Support Plan for a participant of the National Disability Insurance Scheme (NDIS).

🛑 UNIVERSAL RESTRICTIONS
1. ALWAYS use the client's exact name "${clientName}" — never write "Client" or "[Client Name]"
2. NEVER mention employment, cultural background, living arrangements, or speculative history
3. NEVER use adjectives like resilient, strong, determined, independent, vibrant
4. ONLY use documented medical facts and support preferences
5. NEVER speculate, guess, or invent content
6. ALWAYS use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive} for ${clientName}
7. DIAGNOSIS PHRASE FORMAT: "Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely respond well to..."

✍️ WRITING STYLE: Clinical, objective, direct. No asterisks, emojis, headers, or bullet points. 250-350 words of flowing text.

🎯 BULK GENERATION TYPE: ${bulkPromptType}

Generate ${bulkPromptType} that work across all behaviours documented for ${clientName}. Use ${pronouns.possessive} diagnosis of ${finalDiagnosis} to inform evidence-based strategies. Focus on universal techniques that staff can apply regardless of the specific behaviour type. Include general principles, communication approaches, and environmental considerations that support all behaviour management scenarios.

ALL DOCUMENTED BEHAVIOURS:
${allBehaviours}`;

            userPrompt = `Generate ${bulkPromptType} for ${clientName} based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}. Consider all documented behaviours and provide comprehensive guidance that applies universally across different behaviour scenarios.`;
            
            console.log(`[BEHAVIOUR BULK DEBUG] Generation type: ${bulkPromptType}`);
            console.log(`[BEHAVIOUR BULK DEBUG] All behaviours provided: ${allBehaviours ? 'Yes' : 'No'}`);
            
          } else {
            // General behaviour section generation (existing logic)
            const behaviourContext = `
Client: ${clientName}
Diagnosis: ${plan?.aboutMeData?.diagnosis || finalDiagnosis}
About Me: ${plan?.aboutMeData?.content || "Not generated"}
Documented Triggers/Dislikes: ${client?.dislikesAversions || "Not documented"}
Documented Preferences/Interests: ${client?.likesPreferences || "Not documented"}
Documented NDIS Goals: ${client?.ndisGoals || "Not documented"}
Behaviour Data: ${plan?.behaviourData?.summary || "Not yet documented"}
`.trim();

            const universalPromptHeaderBehaviour = `You are writing a section of a formal Care Support Plan for a participant of the National Disability Insurance Scheme (NDIS).

This document will be viewed by health professionals, support workers, and NDIS reviewers. It must be written with clinical clarity, professional tone, and strict adherence to documented facts.

🛑 UNIVERSAL RESTRICTIONS (Apply to ALL Sections)

1. ALWAYS use the client's full name — never write "Client", "[Client Name]", or generic pronouns
2. NEVER mention: 
   - Employment, jobs, workplace, or career aspirations
   - Cultural background, race, religion, ethnicity, or heritage
   - Community involvement, social events, or location-specific references
   - Living arrangements, housing, family, or relationship history
   - Past experiences or speculative personal history
3. NEVER use adjectives like: resilient, strong, determined, independent, vibrant, brave, happy, or positive
4. ONLY use documented medical facts and support preferences
5. NEVER speculate, guess, or invent content
6. NEVER include legal language or professional disclaimers like "please consult a medical team"
7. DIAGNOSIS PHRASE FORMAT:
   - "Based on ${pronouns.possessive} diagnosis, ${pronouns.subjective} will likely respond well to..."
   - "Due to the nature of the diagnosis, staff are encouraged to..."
8. ALWAYS use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive} for ${clientName}

✍️ GENERAL WRITING STYLE
- Clinical
- Objective
- Direct
- No asterisks, emojis, or markdown
- Maximum: 400 words per section

This section must provide clear, practical support guidance for staff — with content tailored to the client's documented diagnosis and preferences.

---

🎯 BEHAVIOUR SUPPORT SECTION SPECIFIC REQUIREMENTS:
Client Information Available: ${behaviourContext}

Identify and address ONLY behavioural triggers that are explicitly documented. Use only documented preferences to shape proactive strategies. Align support strategies with evidence-based practices tailored to diagnosis. Propose: Proactive supports (staff prevention actions), Reactive strategies (escalation response), Protective actions (unsafe behaviour response). Do NOT include assumptions, invented behaviours, or generalised traits. Use only documented data.

📏 Output: Clean paragraph formatting with line breaks. No titles, explanations, or preamble.`;
            
            systemPrompt = universalPromptHeaderBehaviour;
            
            userPrompt = `Generate behaviour support content using the comprehensive client context provided above. User input: ${userInput || 'Generate PBS-aligned behaviour support strategies using documented triggers, preferences, and diagnosis'}`;
            
            console.log(`[BEHAVIOUR ENHANCED DEBUG] Behaviour context being sent to AI:`, behaviourContext);
            console.log(`[BEHAVIOUR ENHANCED DEBUG] Enhanced system prompt being sent to AI:`, systemPrompt);
            console.log(`[BEHAVIOUR ENHANCED DEBUG] About Me content available:`, plan?.aboutMeData?.content ? 'Yes' : 'No');
            console.log(`[BEHAVIOUR ENHANCED DEBUG] Documented triggers available:`, client?.dislikesAversions ? 'Yes' : 'No');
            console.log(`[BEHAVIOUR ENHANCED DEBUG] Documented preferences available:`, client?.likesPreferences ? 'Yes' : 'No');
            console.log(`[BEHAVIOUR ENHANCED DEBUG] NDIS goals available:`, client?.ndisGoals ? 'Yes' : 'No');
            console.log(`[BEHAVIOUR ENHANCED DEBUG] Behaviour data available:`, plan?.behaviourData?.summary ? 'Yes' : 'No');
            // Use comprehensive client info and final diagnosis like Goals section
            const updatedContextualInfoBehaviour = comprehensiveClientInfo || `Client: ${clientName}, Diagnosis: ${finalDiagnosis}`;
            userPrompt = `${updatedContextualInfoBehaviour}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInput || 'Generate factual behavior support using ONLY documented triggers, preferences and diagnosis-specific strategies'}`;
            
            console.log(`[BEHAVIOUR DEBUG] Final contextual info being sent to AI:`, updatedContextualInfoBehaviour);
          }
          break;
        
        case "disaster":
          // Enhanced disaster management with field-specific generation
          if (req.body.targetField && req.body.targetField.includes('_')) {
            const fieldParts = req.body.targetField.split('_');
            const disasterType = fieldParts[0];
            const targetField = fieldParts[1];
            
            // Map disaster types for better prompts
            const disasterTypeLabels = {
              'fire': 'Fire/Bushfire',
              'flood': 'Flood',
              'earthquake': 'Earthquake',
              'medical': 'Medical Emergency',
              'heatwave': 'Heatwave'
            };
            
            const disasterLabel = disasterTypeLabels[disasterType] || disasterType;
            const existingContent = req.body.existingContent?.currentContent || '';
            const userInputData = req.body.existingContent?.userInput || userInput || '';
            
            // Disaster-type-specific field prompts for more targeted content
            const getDisasterSpecificPrompts = (disasterType, disasterLabel) => {
              const basePrompts = {
                fire: {
                  preparation: `Generate fire/bushfire preparation content for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific fire preparation including: defensible space maintenance, emergency water supplies, fire-resistant clothing access, smoke detection equipment checks, medication fireproof storage, important document protection, and evacuation route familiarity. Address ${pronouns.possessive} specific mobility needs for rapid evacuation and smoke inhalation risks. Consider documented triggers and preferences for stress management during fire alerts. Focus on practical fire safety measures staff should implement. Maximum 150-200 words.`,
                  evacuation: `Generate fire evacuation procedures for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific fire evacuation support including: immediate smoke assessment, low-crawling techniques if mobile, wet cloth breathing protection, stay-low movement guidance, door temperature checks, alternative exit route knowledge, and meeting point coordination. Address ${pronouns.possessive} panic response patterns and provide calming techniques during fire evacuation. Consider mobility limitations and communication needs during high-stress evacuation. Maximum 150-200 words.`,
                  postEvent: `Generate post-fire recovery support for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific post-fire support including: smoke inhalation monitoring, trauma response management, temporary accommodation adjustment, belongings assessment participation, insurance process support, routine re-establishment in new environment, and grief counseling for losses. Address ${pronouns.possessive} coping mechanisms and provide stability during recovery period. Focus on emotional support and practical rebuilding assistance. Maximum 150-200 words.`,
                  clientNeeds: `Generate fire-specific client needs for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely have fire emergency needs including: respiratory protection due to smoke sensitivity, mobility assistance for rapid evacuation, medication accessibility during chaos, communication tools that work without power, sensory management for sirens and alarms, and emotional regulation during high-stress situations. Address ${pronouns.possessive} documented triggers and provide staff guidance for fire-specific support. Maximum 150-200 words.`
                },
                flood: {
                  preparation: `Generate flood preparation content for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific flood preparation including: waterproof medication storage, elevated essential supplies, portable communication devices, non-perishable food stockpiling, water purification tablets, battery-powered equipment, and elevated evacuation kit positioning. Address ${pronouns.possessive} mobility needs for accessing higher ground and water-related anxiety management. Consider documented preferences for maintaining routine during flood warnings. Maximum 150-200 words.`,
                  evacuation: `Generate flood evacuation procedures for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific flood evacuation support including: water depth assessment, safe wading techniques, flotation device usage, avoiding electrical hazards, waterproof medication container verification, high ground movement, and emergency contact notification. Address ${pronouns.possessive} water-related fears and provide reassurance during flood evacuation. Consider mobility limitations in wet conditions. Maximum 150-200 words.`,
                  postEvent: `Generate post-flood recovery support for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific post-flood support including: water damage assessment, mold prevention measures, contaminated water avoidance, temporary accommodation adjustment, insurance documentation assistance, belongings drying and cleaning, and health monitoring for waterborne illness. Address ${pronouns.possessive} stress responses to property damage and provide stability during cleanup. Maximum 150-200 words.`,
                  clientNeeds: `Generate flood-specific client needs for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely have flood emergency needs including: waterproof medication protection, mobility assistance in wet conditions, communication devices that function when wet, sensory management for water sounds and humidity, and emotional support for water-related anxiety. Address ${pronouns.possessive} specific flood vulnerabilities and staff guidance for water emergency support. Maximum 150-200 words.`
                },
                earthquake: {
                  preparation: `Generate earthquake preparation content for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific earthquake preparation including: furniture anchoring for safety, drop-cover-hold-on practice, earthquake kit positioning, sturdy table identification, glass hazard minimization, emergency shut-off valve knowledge, and structural safety assessment. Address ${pronouns.possessive} balance issues and provide stability techniques during ground shaking. Consider documented anxiety triggers and earthquake-specific coping strategies. Maximum 150-200 words.`,
                  evacuation: `Generate earthquake evacuation procedures for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific earthquake evacuation support including: drop-cover-hold-on positioning, doorway safety assessment, debris navigation assistance, aftershock awareness, structural damage identification, safe exit route verification, and assembly point coordination. Address ${pronouns.possessive} balance and mobility needs during ground instability. Provide reassurance techniques for earthquake fear. Maximum 150-200 words.`,
                  postEvent: `Generate post-earthquake recovery support for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific post-earthquake support including: structural safety assessment, aftershock preparedness, utility shut-off verification, debris cleanup assistance, injury assessment, temporary shelter adjustment, and trauma counseling for ground instability fear. Address ${pronouns.possessive} ongoing anxiety and provide stability after ground movement events. Maximum 150-200 words.`,
                  clientNeeds: `Generate earthquake-specific client needs for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely have earthquake emergency needs including: stability support during ground shaking, protection from falling objects, mobility assistance over debris, communication tools that work after infrastructure damage, and emotional regulation during unpredictable ground movement. Address ${pronouns.possessive} specific earthquake vulnerabilities and staff guidance. Maximum 150-200 words.`
                },
                medical: {
                  preparation: `Generate medical emergency preparation content for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific medical emergency preparation including: medication list maintenance, emergency contact accessibility, medical history documentation, symptom recognition training, first aid kit customization, emergency service contact information, and medical alert bracelet verification. Address ${pronouns.possessive} specific medical vulnerabilities and provide staff guidance for medical crisis preparation. Maximum 150-200 words.`,
                  evacuation: `Generate medical emergency procedures for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific medical emergency support including: symptom assessment, emergency service notification, medication administration, vital signs monitoring, medical history communication, positioning for comfort, and transport preparation. Address ${pronouns.possessive} medical communication needs and provide staff guidance for medical crisis response. Maximum 150-200 words.`,
                  postEvent: `Generate post-medical emergency support for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific post-medical emergency support including: recovery monitoring, medication adjustment, follow-up appointment coordination, symptom tracking, activity modification, emotional support for health anxiety, and care plan updates. Address ${pronouns.possessive} recovery needs and provide ongoing medical support guidance. Maximum 150-200 words.`,
                  clientNeeds: `Generate medical emergency-specific client needs for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely have medical emergency needs including: rapid symptom communication, medication access, medical history availability, emergency contact notification, comfort positioning, and emotional reassurance during medical crisis. Address ${pronouns.possessive} specific medical vulnerabilities and communication requirements. Maximum 150-200 words.`
                },
                heatwave: {
                  preparation: `Generate heatwave preparation content for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific heatwave preparation including: cooling system verification, hydration supply stockpiling, lightweight clothing access, sun protection equipment, medication heat protection, cool space identification, and heat illness symptom recognition. Address ${pronouns.possessive} heat sensitivity and provide cooling strategies during extreme temperatures. Consider documented comfort preferences. Maximum 150-200 words.`,
                  evacuation: `Generate heatwave evacuation procedures for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific heatwave evacuation support including: cooling center transportation, hydration maintenance, heat protection clothing, sun exposure minimization, medication temperature protection, frequent rest breaks, and heat exhaustion monitoring. Address ${pronouns.possessive} heat intolerance and provide cooling techniques during hot weather evacuation. Maximum 150-200 words.`,
                  postEvent: `Generate post-heatwave recovery support for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need specific post-heatwave support including: dehydration assessment, heat exhaustion monitoring, electrolyte replacement, cooling system restoration, medication storage review, and heat-related illness prevention education. Address ${pronouns.possessive} recovery from heat exposure and provide ongoing temperature management support. Maximum 150-200 words.`,
                  clientNeeds: `Generate heatwave-specific client needs for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely have heatwave emergency needs including: constant hydration access, cooling assistance, heat protection, medication temperature management, air conditioning access, and heat illness symptom communication. Address ${pronouns.possessive} specific heat vulnerabilities and staff cooling support guidance. Maximum 150-200 words.`
                }
              };
              
              return basePrompts[disasterType] || {
                preparation: `Generate preparation content for ${disasterLabel} emergencies specific to ${clientName}'s needs.`,
                evacuation: `Generate evacuation procedures for ${disasterLabel} situations specific to ${clientName}'s needs.`,
                postEvent: `Generate post-event support for ${disasterLabel} recovery specific to ${clientName}'s needs.`,
                clientNeeds: `Generate client-specific needs for ${disasterLabel} emergencies.`
              };
            };
            
            const fieldSpecificPrompts = getDisasterSpecificPrompts(disasterType, disasterLabel);
            
            systemPrompt = `You are generating field-specific disaster management content for the ${targetField} field. CRITICAL RULES:
1. Use EXACT client name "${clientName}" - never write "Client" or "[Client Name]"
2. Generate content specific to ${disasterLabel} scenarios and the ${targetField} phase
3. Begin with diagnosis phrasing: "Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely..."
4. Focus specifically on ${targetField} content - do not include other phases
5. Use documented client information and disaster management input
6. Generate practical, actionable content for staff
7. ALWAYS use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive}
8. If existing content is provided, ADD TO IT rather than replacing it
9. Do NOT include disclaimers about consulting professionals
10. Write in clinical but accessible language`;
            
            userPrompt = fieldSpecificPrompts[targetField] || `Generate ${targetField} content for ${disasterLabel} emergencies using documented client information`;
            
            console.log(`[DISASTER FIELD-SPECIFIC DEBUG] Generating ${targetField} content for ${disasterType} (${disasterLabel})`);
            console.log(`[DISASTER FIELD-SPECIFIC DEBUG] Existing content: ${existingContent}`);
            console.log(`[DISASTER FIELD-SPECIFIC DEBUG] User input: ${userInputData}`);
          } else if (targetField && targetField.startsWith('global_')) {
            // Global Disaster Management Centre field-specific generation
            const globalField = targetField.replace('global_', '');
            
            const globalFieldPrompts = {
              shelterArrangements: `Generate comprehensive shelter arrangements for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need shelter arrangements including: accessible accommodation requirements, medical equipment storage, medication refrigeration access, mobility assistance, communication support, dietary accommodation, emergency medical access, and staff support coordination. Consider all documented disaster plans and emergency needs across multiple disaster types. Address ${pronouns.possessive} specific shelter needs and safety requirements. Maximum 150-200 words.`,
              postDisasterSupport: `Generate comprehensive post-disaster support for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need post-disaster support including: psychological recovery assistance, routine re-establishment, medical care continuity, medication management, therapy service coordination, environmental safety assessment, community resource connection, and care plan updates. Consider recovery needs across all disaster types. Address ${pronouns.possessive} specific recovery and reintegration needs. Maximum 150-200 words.`,
              evacuationPlanAudit: `Generate comprehensive evacuation plan audit checklist for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need evacuation audit including: accessibility compliance verification, medical equipment transportation readiness, medication emergency kit preparation, communication system testing, staff role clarification, emergency contact verification, transport arrangement confirmation, and special needs accommodation review. Create practical audit checklist covering all disaster scenarios. Address ${pronouns.possessive} specific evacuation requirements and safety protocols. Maximum 150-200 words.`
            };
            
            systemPrompt = `You are generating comprehensive global disaster management content for the ${globalField} field. CRITICAL RULES:
1. Use EXACT client name "${clientName}" - never write "Client" or "[Client Name]"  
2. Generate content that applies across ALL disaster types and scenarios
3. Begin with diagnosis phrasing: "Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely..."
4. Focus specifically on ${globalField} content - comprehensive planning approach
5. Use documented client information and all disaster management input
6. Generate practical, actionable content for staff and emergency coordinators
7. ALWAYS use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive}
8. If existing content is provided, ADD TO IT rather than replacing it
9. Do NOT include disclaimers about consulting professionals
10. Write in clinical but accessible language for emergency planning`;
            
            // Use comprehensive client info and final diagnosis like other sections
            const updatedContextualInfoGlobal = comprehensiveClientInfo || `Client: ${clientName}, Diagnosis: ${finalDiagnosis}`;
            userPrompt = `${updatedContextualInfoGlobal}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInputData || 'Generate global disaster management content based on diagnosis and all disaster plans'}\n\n${globalFieldPrompts[globalField] || `Generate comprehensive ${globalField} content for global disaster management using documented client information and all disaster plans`}`;
            
            console.log(`[GLOBAL DISASTER DEBUG] Generating ${globalField} global content`);
            console.log(`[GLOBAL DISASTER DEBUG] Final diagnosis being used: ${finalDiagnosis}`);
            console.log(`[GLOBAL DISASTER DEBUG] Comprehensive client info: ${updatedContextualInfoGlobal}`);
            console.log(`[GLOBAL DISASTER DEBUG] User input: ${userInputData}`);
          } else {
            // General disaster management generation
            systemPrompt = `Generate comprehensive disaster management content based on the client's diagnosis. Create emergency preparedness, evacuation procedures, communication plans, and recovery support strategies considering the specific needs of this diagnosis. Always generate content using diagnosis-specific emergency needs.

DIAGNOSIS PHRASING: For any content relating to diagnosis, phrase as "Based on ${pronouns.possessive} diagnosis, ${pronouns.subjective} will likely respond well to..." 
PRONOUNS: Always use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive} for ${clientName}

Maximum 400 words.`;
            
            // Use comprehensive client info and final diagnosis like Goals section
            const updatedContextualInfoDisaster = comprehensiveClientInfo || `Client: ${clientName}, Diagnosis: ${finalDiagnosis}`;
            userPrompt = `${updatedContextualInfoDisaster}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInput || 'Generate disaster management based on diagnosis'}`;
            
            console.log(`[DISASTER DEBUG] Final contextual info being sent to AI:`, updatedContextualInfoDisaster);
          }
          break;
        
        case "mealtime":
          if (req.body.targetField && req.body.targetField.includes('_') && !req.body.targetField.startsWith('global_')) {
            // Risk-specific field generation (choking_prevention, aspiration_response, etc.)
            const targetFieldMealtime = req.body.targetField;
            const [riskType, fieldName] = targetFieldMealtime.split('_');
            
            const riskSpecificPrompts = {
              choking: {
                prevention: `Generate comprehensive choking prevention strategies for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need choking prevention including: proper food texture modification, supervised eating positioning, emergency equipment placement, staff vigilance protocols, meal environment setup, and swallowing assessment requirements. Focus on practical prevention measures that reduce airway obstruction risk during meals. Maximum 150-200 words.`,
                response: `Generate comprehensive choking response strategies for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need choking response including: immediate first aid procedures, emergency equipment usage, staff role delegation, communication protocols, medical emergency procedures, and post-incident documentation requirements. Create step-by-step response plan for airway obstruction emergencies. Maximum 150-200 words.`,
                equipment: `Generate comprehensive choking management equipment needs for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need choking equipment including: emergency suction devices, finger sweeps tools, positioning aids, emergency communication devices, first aid supplies, and specialized feeding equipment. Address equipment maintenance and accessibility requirements. Maximum 150-200 words.`,
                training: `Generate comprehensive choking response training requirements for ${clientName}'s care staff. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, staff will likely need choking training including: first aid certification, emergency response protocols, equipment operation procedures, incident reporting systems, risk recognition training, and ongoing competency assessment. Ensure staff preparedness for airway emergencies. Maximum 150-200 words.`
              },
              aspiration: {
                prevention: `Generate comprehensive aspiration prevention strategies for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need aspiration prevention including: safe swallowing positions, texture modification protocols, feeding pace management, respiratory monitoring, oral hygiene maintenance, and environmental safety measures. Focus on preventing food/fluid entry into airways. Maximum 150-200 words.`,
                response: `Generate comprehensive aspiration response strategies for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need aspiration response including: immediate airway clearing, respiratory assessment, emergency medication administration, medical intervention procedures, continuous monitoring protocols, and follow-up care requirements. Create emergency response plan for aspiration incidents. Maximum 150-200 words.`,
                equipment: `Generate comprehensive aspiration management equipment needs for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need aspiration equipment including: suction machines, oxygen delivery systems, positioning devices, respiratory monitoring equipment, emergency medications, and specialized feeding tools. Address equipment readiness and maintenance protocols. Maximum 150-200 words.`,
                training: `Generate comprehensive aspiration response training requirements for ${clientName}'s care staff. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, staff will likely need aspiration training including: respiratory emergency procedures, equipment operation skills, monitoring techniques, medical intervention protocols, documentation requirements, and emergency communication procedures. Ensure comprehensive respiratory emergency preparedness. Maximum 150-200 words.`
              },
              allergies: {
                prevention: `Generate comprehensive food allergy prevention strategies for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need allergy prevention including: allergen identification protocols, ingredient verification systems, cross-contamination prevention, emergency medication accessibility, dietary restriction compliance, and environmental safety measures. Focus on preventing allergic reactions during meals. Maximum 150-200 words.`,
                response: `Generate comprehensive food allergy response strategies for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need allergy response including: emergency medication administration, symptom recognition protocols, medical emergency procedures, communication systems, monitoring requirements, and post-reaction documentation. Create emergency response plan for allergic reactions. Maximum 150-200 words.`,
                equipment: `Generate comprehensive food allergy management equipment needs for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need allergy equipment including: epinephrine auto-injectors, emergency medication supplies, monitoring devices, communication tools, first aid supplies, and ingredient verification systems. Address equipment accessibility and expiration monitoring. Maximum 150-200 words.`,
                training: `Generate comprehensive food allergy response training requirements for ${clientName}'s care staff. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, staff will likely need allergy training including: allergen recognition, emergency medication administration, reaction assessment, medical intervention protocols, prevention strategies, and documentation procedures. Ensure staff competency in allergy management. Maximum 150-200 words.`
              },
              swallowing: {
                prevention: `Generate comprehensive swallowing difficulty prevention strategies for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need swallowing prevention including: texture modification protocols, positioning techniques, feeding pace control, oral preparation exercises, hydration management, and dysphagia assessment monitoring. Focus on safe swallowing practices during meals. Maximum 150-200 words.`,
                response: `Generate comprehensive swallowing difficulty response strategies for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need swallowing response including: immediate safety measures, airway protection protocols, emergency procedures, medical assessment requirements, modification adjustments, and incident documentation. Create response plan for swallowing difficulties. Maximum 150-200 words.`,
                equipment: `Generate comprehensive swallowing difficulty management equipment needs for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need swallowing equipment including: specialized feeding utensils, texture modification tools, positioning aids, suction equipment, hydration systems, and assessment instruments. Address equipment selection and maintenance requirements. Maximum 150-200 words.`,
                training: `Generate comprehensive swallowing difficulty management training requirements for ${clientName}'s care staff. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, staff will likely need swallowing training including: dysphagia recognition, safe feeding techniques, positioning methods, emergency procedures, assessment monitoring, and modification protocols. Ensure staff competency in swallowing safety. Maximum 150-200 words.`
              }
            };
            
            const fieldMappings = {
              preventionStrategy: 'prevention',
              responseStrategy: 'response', 
              equipmentNeeded: 'equipment',
              staffTraining: 'training'
            };
            
            const mappedField = fieldMappings[fieldName] || fieldName;
            const riskPrompts = riskSpecificPrompts[riskType];
            
            // Define userInputData for logging and context
            const userInputData = req.body.userInput || userInput || 'Mealtime assessment information';
            
            systemPrompt = `You are generating field-specific mealtime management content for the ${fieldName} field. CRITICAL RULES:
1. Use EXACT client name "${clientName}" - never write "Client" or "[Client Name]"
2. Generate content specific to ${riskType} risk management and the ${fieldName} field
3. Begin with diagnosis phrasing: "Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely..."
4. Focus specifically on ${fieldName} content - do not include other fields
5. Use documented client information and mealtime assessment input
6. Generate practical, actionable content for care staff
7. ALWAYS use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive}
8. If existing content is provided, ADD TO IT rather than replacing it
9. Do NOT include disclaimers about consulting professionals
10. Write in clinical but accessible language`;
            
            // Use comprehensive client info and final diagnosis like other sections
            const updatedContextualInfoMealtime = comprehensiveClientInfo || `Client: ${clientName}, Diagnosis: ${finalDiagnosis}`;
            const riskSpecificPrompt = riskPrompts?.[mappedField] || `Generate ${fieldName} content for ${riskType} risk management based on ${finalDiagnosis} diagnosis`;
            userPrompt = `${updatedContextualInfoMealtime}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInputData}\n\n${riskSpecificPrompt}`;
            
            console.log(`[MEALTIME FIELD-SPECIFIC DEBUG] Generating ${fieldName} content for ${riskType} risk`);
            console.log(`[MEALTIME FIELD-SPECIFIC DEBUG] User input: ${userInputData}`);
            console.log(`[MEALTIME FIELD-SPECIFIC DEBUG] Final contextual info: ${updatedContextualInfoMealtime}`);
          } else if (req.body.targetField && req.body.targetField.startsWith('global_')) {
            // Global Meal Management Centre field-specific generation
            const globalField = req.body.targetField.replace('global_', '');
            
            const globalFieldPrompts = {
              nutritionalGuidance: `Generate comprehensive nutritional guidance for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need nutritional guidance including: dietary requirements assessment, nutritional supplementation needs, caloric intake monitoring, hydration management, vitamin/mineral considerations, meal timing optimization, and therapeutic diet modifications. Consider all documented mealtime risks and dietary restrictions. Address ${pronouns.possessive} specific nutritional needs and health optimization. Maximum 150-200 words.`,
              staffProtocols: `Generate comprehensive staff mealtime protocols for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need staff protocols including: mealtime supervision procedures, risk assessment protocols, emergency response procedures, documentation requirements, communication standards, hygiene protocols, and quality assurance measures. Consider all mealtime risks and safety requirements. Address ${pronouns.possessive} specific care protocols and staff responsibilities. Maximum 150-200 words.`,
              environmentalSetup: `Generate comprehensive mealtime environmental setup for ${clientName}. Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely need environmental setup including: physical space arrangement, lighting optimization, noise control, temperature regulation, accessibility modifications, safety equipment placement, and sensory considerations. Consider all documented preferences and mealtime challenges. Address ${pronouns.possessive} specific environmental needs and comfort requirements. Maximum 150-200 words.`
            };
            
            systemPrompt = `You are generating comprehensive global mealtime management content for the ${globalField} field. CRITICAL RULES:
1. Use EXACT client name "${clientName}" - never write "Client" or "[Client Name]"  
2. Generate content that applies across ALL mealtime risk types and scenarios
3. Begin with diagnosis phrasing: "Based on ${pronouns.possessive} diagnosis of ${finalDiagnosis}, ${pronouns.subjective} will likely..."
4. Focus specifically on ${globalField} content - comprehensive planning approach
5. Use documented client information and all mealtime risk input
6. Generate practical, actionable content for staff and care coordinators
7. ALWAYS use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive}
8. If existing content is provided, ADD TO IT rather than replacing it
9. Do NOT include disclaimers about consulting professionals
10. Write in clinical but accessible language for mealtime management`;
            
            // Use comprehensive client info and final diagnosis like other sections
            const updatedContextualInfoGlobalMealtime = comprehensiveClientInfo || `Client: ${clientName}, Diagnosis: ${finalDiagnosis}`;
            const userInputDataGlobal = req.body.userInput || userInput || 'Generate global mealtime management content based on diagnosis and all risk assessments';
            userPrompt = `${updatedContextualInfoGlobalMealtime}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInputDataGlobal}\n\n${globalFieldPrompts[globalField] || `Generate comprehensive ${globalField} content for global mealtime management using documented client information and all risk parameters`}`;
            
            console.log(`[GLOBAL MEALTIME DEBUG] Generating ${globalField} global content`);
            console.log(`[GLOBAL MEALTIME DEBUG] Final diagnosis being used: ${finalDiagnosis}`);
            console.log(`[GLOBAL MEALTIME DEBUG] Comprehensive client info: ${updatedContextualInfoGlobalMealtime}`);
            console.log(`[GLOBAL MEALTIME DEBUG] User input: ${userInputDataGlobal}`);
          } else {
            // General mealtime management generation
            systemPrompt = `Generate mealtime management content based on the client's diagnosis. Create practical guidance for eating support, dietary considerations, safety protocols, and mealtime strategies typical for this diagnosis. Always generate content using diagnosis-specific mealtime needs.

DIAGNOSIS PHRASING: For any content relating to diagnosis, phrase as "Based on ${pronouns.possessive} diagnosis, ${pronouns.subjective} will likely respond well to..."
PRONOUNS: Always use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive} for ${clientName}

Maximum 400 words.`;
            
            // Use comprehensive client info and final diagnosis like Goals section
            const updatedContextualInfoMealtime = comprehensiveClientInfo || `Client: ${clientName}, Diagnosis: ${finalDiagnosis}`;
            userPrompt = `${updatedContextualInfoMealtime}\n\nExisting Context:\n${existingContext}\n\nUser Input: ${userInput || 'Generate mealtime management based on diagnosis'}`;
            
            console.log(`[MEALTIME DEBUG] Final contextual info being sent to AI:`, updatedContextualInfoMealtime);
          }
          break;
        
        default:
          systemPrompt = `Generate professional care support content for the specified section using ONLY documented client information: name, age, diagnosis, documented NDIS goals, documented preferences, documented dislikes, and user-provided input. DO NOT make assumptions or add generic content. Focus strictly on factual, evidence-based content specific to their documented diagnosis and client-provided information.

DIAGNOSIS PHRASING: For any content relating to diagnosis, phrase as "Based on ${pronouns.possessive} diagnosis, ${pronouns.subjective} will likely respond well to..."
PRONOUNS: Always use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive} for ${clientName}

Maximum 400 words.`;
          
          // Use comprehensive client info and final diagnosis like Goals section
          const updatedContextualInfoDefault = comprehensiveClientInfo || `Client: ${clientName}, Diagnosis: ${finalDiagnosis}`;
          userPrompt = `${updatedContextualInfoDefault}\n\nExisting Context:\n${existingContext}\n\nSection: ${section}\nUser Input: ${userInput || 'Generate factual content using ONLY documented client information - no assumptions'}`;
          
          console.log(`[${section.toUpperCase()} DEBUG] Final contextual info being sent to AI:`, updatedContextualInfoDefault);
      }

      // Generate AI content with strict factual approach (temperature 0.1 for maximum consistency and accuracy)
      // Special handling for culturalConsiderations field - allow family/religious content
      const isCulturalConsiderations = req.body.targetField === 'culturalConsiderations';
      const culturalRestrictions = isCulturalConsiderations 
        ? `- FOR CULTURAL CONSIDERATIONS FIELD: Focus specifically on family dynamics, religious practices, and cultural traditions that impact care delivery\n- Include practical aspects: family involvement, religious observances, prayer times, dietary requirements, cultural holidays\n- Use only documented family/religious information, clearly state if none documented`
        : `- NEVER mention cultural background, race, ethnicity, heritage, community, or location details\n- NEVER assume living situation, family, relationships, or personal history`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `${systemPrompt}\n\nCRITICAL RESTRICTIONS:\n- USE THE EXACT CLIENT NAME PROVIDED - NEVER write "Client" or "[Client Name]"\n- NEVER mention employment, work, jobs, career, workplace, or professional activities\n${culturalRestrictions}\n- NEVER use descriptive adjectives like "resilient," "independent," "vibrant," "committed"\n- ONLY reference documented medical diagnosis and documented support preferences\n- Be clinical and factual, avoid all speculation and generic statements\n- DIAGNOSIS CONTENT: Always phrase diagnosis-related content as "Based on ${pronouns.possessive} diagnosis, ${pronouns.subjective} will likely respond well to..."\n- PRONOUNS: Always use correct pronouns: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive} for ${clientName}\n- NEVER INCLUDE DISCLAIMERS: Do not say "Please consult with healthcare professionals" or any variation of consulting professionals\n- Write practical care content only, not legal advice` 
          },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 800,
      });

      const generatedContent = response.choices[0].message.content;
      
      // Always return content - no guard rails or validation that could block generation
      if (!generatedContent || generatedContent.trim().length === 0) {
        // Simple fallback using client's actual documented information and correct pronouns
        const fallbackContent = `${clientName} is diagnosed with ${finalDiagnosis}. Based on ${pronouns.possessive} diagnosis, ${pronouns.subjective} will likely respond well to structured ${section} approaches that consider ${pronouns.possessive} documented preferences and NDIS goals.`;
        res.json({ content: fallbackContent });
      } else {
        // Replace any placeholder client names with actual client name
        let finalContent = generatedContent.trim();
        if (clientName && clientName !== "Client" && clientName !== "Not specified") {
          finalContent = finalContent
            .replace(/\[Client Name\]/g, clientName)
            .replace(/\[Client\]/g, clientName)
            .replace(/Client Name/g, clientName);
        }
        
        // Apply pronoun consistency fixes if client data is available
        if (client && pronouns) {
          console.log(`[PRONOUN FIX] Applying pronoun corrections using: ${pronouns.subjective}/${pronouns.objective}/${pronouns.possessive}`);
          
          // Fix inconsistent pronoun usage in generated content with comprehensive patterns
          const incorrectPatterns = [
            // Fix "Based on his/her diagnosis" patterns
            {
              pattern: /Based on his diagnosis/g,
              replacement: `Based on ${pronouns.possessive} diagnosis`
            },
            {
              pattern: /Based on her diagnosis/g,
              replacement: `Based on ${pronouns.possessive} diagnosis`
            },
            // Fix standalone pronoun inconsistencies - subjective pronouns
            {
              pattern: /\b[Hh]e will\b/g,
              replacement: `${pronouns.subjective.charAt(0).toUpperCase() + pronouns.subjective.slice(1)} will`
            },
            {
              pattern: /\b[Ss]he will\b/g,
              replacement: `${pronouns.subjective.charAt(0).toUpperCase() + pronouns.subjective.slice(1)} will`
            },
            {
              pattern: /\b[Hh]e may\b/g,
              replacement: `${pronouns.subjective.charAt(0).toUpperCase() + pronouns.subjective.slice(1)} may`
            },
            {
              pattern: /\b[Ss]he may\b/g,
              replacement: `${pronouns.subjective.charAt(0).toUpperCase() + pronouns.subjective.slice(1)} may`
            },
            {
              pattern: /\b[Hh]e can\b/g,
              replacement: `${pronouns.subjective.charAt(0).toUpperCase() + pronouns.subjective.slice(1)} can`
            },
            {
              pattern: /\b[Ss]he can\b/g,
              replacement: `${pronouns.subjective.charAt(0).toUpperCase() + pronouns.subjective.slice(1)} can`
            },
            {
              pattern: /\b[Hh]e is\b/g,
              replacement: `${pronouns.subjective.charAt(0).toUpperCase() + pronouns.subjective.slice(1)} is`
            },
            {
              pattern: /\b[Ss]he is\b/g,
              replacement: `${pronouns.subjective.charAt(0).toUpperCase() + pronouns.subjective.slice(1)} is`
            },
            // Fix possessive pronoun patterns
            {
              pattern: /\bhis documented\b/g,
              replacement: `${pronouns.possessive} documented`
            },
            {
              pattern: /\bher documented\b/g,
              replacement: `${pronouns.possessive} documented`
            },
            {
              pattern: /\bhis individual\b/g,
              replacement: `${pronouns.possessive} individual`
            },
            {
              pattern: /\bher individual\b/g,
              replacement: `${pronouns.possessive} individual`
            },
            {
              pattern: /\bhis preferred\b/g,
              replacement: `${pronouns.possessive} preferred`
            },
            {
              pattern: /\bher preferred\b/g,
              replacement: `${pronouns.possessive} preferred`
            },
            {
              pattern: /\bhis daily\b/g,
              replacement: `${pronouns.possessive} daily`
            },
            {
              pattern: /\bher daily\b/g,
              replacement: `${pronouns.possessive} daily`
            },
            {
              pattern: /\bhis comfort\b/g,
              replacement: `${pronouns.possessive} comfort`
            },
            {
              pattern: /\bher comfort\b/g,
              replacement: `${pronouns.possessive} comfort`
            },
            // Fix objective pronoun patterns when client name follows
            {
              pattern: new RegExp(`\\b[Hh]im\\b(?=.*${clientName.split(' ')[0]})`, 'g'),
              replacement: pronouns.objective
            },
            {
              pattern: new RegExp(`\\b[Hh]er\\b(?=.*${clientName.split(' ')[0]})`, 'g'),
              replacement: pronouns.objective
            },

            {
              pattern: /\bhis preferences\b/g,
              replacement: `${pronouns.possessive} preferences`
            },
            {
              pattern: /\bher preferences\b/g,
              replacement: `${pronouns.possessive} preferences`
            }
          ];
          
          // Apply all pronoun corrections
          incorrectPatterns.forEach(({ pattern, replacement }) => {
            const beforeFix = finalContent;
            finalContent = finalContent.replace(pattern, replacement);
            if (beforeFix !== finalContent) {
              console.log(`[PRONOUN FIX] Applied correction: ${pattern} -> ${replacement}`);
            }
          });
        }
        
        console.log(`[GOALS NEW DEBUG] Original AI content:`, generatedContent.trim());
        console.log(`[GOALS NEW DEBUG] Final content after name replacement:`, finalContent);
        
        res.json({ content: finalContent });
      }

    } catch (error) {
      console.error("AI generation error:", error);
      
      // Provide diagnosis-based fallback even on error  
      const { section, planId } = req.body;
      let fallbackDiagnosis = "Not specified";
      
      if (planId) {
        try {
          const planResult = await db.select().from(careSupportPlans).where(eq(careSupportPlans.id, planId)).limit(1);
          if (planResult.length > 0) {
            const plan = planResult[0];
            
            // Check for extracted diagnosis first
            if (plan.aboutMeData?.diagnosis) {
              fallbackDiagnosis = plan.aboutMeData.diagnosis;
            } else {
              const clientResult = await db.select().from(clients).where(eq(clients.id, plan.clientId)).limit(1);
              if (clientResult.length > 0) {
                fallbackDiagnosis = clientResult[0].primaryDiagnosis || 'Not specified';
              }
            }
          }
        } catch (dbError) {
          console.error("Error fetching diagnosis for fallback:", dbError);
        }
      }
      
      const fallbackContent = `Information about ${section || 'this area'} was not provided in the client profile. Based on the diagnosis of ${fallbackDiagnosis}, appropriate ${section || 'care support'} strategies should be developed.`;
      
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

  // Medication Schedule Management APIs
  app.get("/api/medication-schedules", requireAuth, requireRole(['SupportWorker', 'TeamLeader', 'Coordinator', 'Admin', 'ConsoleManager']), async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { date } = req.query;
      
      const schedules = await storage.getMedicationSchedules(tenantId, date as string);
      res.json(schedules);
    } catch (error) {
      console.error("Error fetching medication schedules:", error);
      res.status(500).json({ error: "Failed to fetch medication schedules" });
    }
  });

  app.post("/api/medication-schedules", requireAuth, requireRole(['SupportWorker', 'TeamLeader', 'Coordinator', 'Admin', 'ConsoleManager']), async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const scheduleData = {
        ...req.body,
        tenantId,
      };

      const schedule = await storage.createMedicationSchedule(scheduleData);
      
      // Log activity
      await storage.createActivityLog({
        userId,
        action: "create",
        resourceType: "medication_schedule",
        resourceId: schedule.id,
        description: `Created medication schedule for ${schedule.medicationName}`,
        tenantId
      });
      
      res.json(schedule);
    } catch (error) {
      console.error("Error creating medication schedule:", error);
      res.status(500).json({ error: "Failed to create medication schedule" });
    }
  });

  app.patch("/api/medication-schedules/:id", requireAuth, requireRole(['SupportWorker', 'TeamLeader', 'Coordinator', 'Admin', 'ConsoleManager']), async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const { id } = req.params;
      
      const updatedSchedule = await storage.updateMedicationSchedule(parseInt(id), req.body, tenantId);
      
      if (updatedSchedule) {
        await storage.createActivityLog({
          userId,
          action: "update",
          resourceType: "medication_schedule",
          resourceId: parseInt(id),
          description: `Updated medication schedule status to ${req.body.status}`,
          tenantId
        });
      }
      
      res.json(updatedSchedule);
    } catch (error) {
      console.error("Error updating medication schedule:", error);
      res.status(500).json({ error: "Failed to update medication schedule" });
    }
  });

  app.delete("/api/medication-schedules/:id", requireAuth, requireRole(['SupportWorker', 'TeamLeader', 'Coordinator', 'Admin', 'ConsoleManager']), async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const { id } = req.params;
      
      await storage.deleteMedicationSchedule(parseInt(id), tenantId);
      
      await storage.createActivityLog({
        userId,
        action: "delete",
        resourceType: "medication_schedule",
        resourceId: parseInt(id),
        description: "Removed medication schedule",
        tenantId
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting medication schedule:", error);
      res.status(500).json({ error: "Failed to delete medication schedule" });
    }
  });

  // Admin timesheet endpoints for new interface
  app.get("/api/admin/timesheets/pending", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const pendingTimesheets = await db
        .select({
          id: timesheetsTable.id,
          userId: timesheetsTable.userId,
          staffName: users.fullName,
          staffEmail: users.email,
          payPeriodStart: timesheetsTable.payPeriodStart,
          payPeriodEnd: timesheetsTable.payPeriodEnd,
          status: timesheetsTable.status,
          totalHours: timesheetsTable.totalHours,
          totalEarnings: timesheetsTable.totalEarnings,
          submittedAt: timesheetsTable.submittedAt,
          createdAt: timesheetsTable.createdAt
        })
        .from(timesheetsTable)
        .innerJoin(users, eq(timesheetsTable.userId, users.id))
        .where(and(
          eq(timesheetsTable.tenantId, req.user.tenantId),
          eq(timesheetsTable.status, 'submitted')
        ))
        .orderBy(desc(timesheetsTable.submittedAt));

      res.json(pendingTimesheets);
    } catch (error) {
      console.error("Failed to get pending timesheets:", error);
      res.status(500).json({ message: "Failed to get pending timesheets" });
    }
  });

  app.get("/api/admin/timesheets/stats", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const pendingCount = await db
        .select({ count: count() })
        .from(timesheetsTable)
        .where(and(
          eq(timesheetsTable.tenantId, req.user.tenantId),
          eq(timesheetsTable.status, 'submitted')
        ));

      const statsQuery = await db
        .select({
          totalHours: sum(timesheetsTable.totalHours),
          totalEarnings: sum(timesheetsTable.totalEarnings),
          submittedCount: count(timesheetsTable.id)
        })
        .from(timesheetsTable)
        .where(and(
          eq(timesheetsTable.tenantId, req.user.tenantId),
          eq(timesheetsTable.status, 'submitted')
        ));

      const stats = {
        pendingCount: pendingCount[0]?.count || 0,
        totalHours: parseFloat(statsQuery[0]?.totalHours || '0'),
        totalEarnings: parseFloat(statsQuery[0]?.totalEarnings || '0'),
        autoSubmittedCount: statsQuery[0]?.autoSubmittedCount || 0
      };

      res.json(stats);
    } catch (error) {
      console.error("Failed to get timesheet stats:", error);
      res.status(500).json({ message: "Failed to get timesheet stats" });
    }
  });

  app.post("/api/admin/timesheets/bulk-approve", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { timesheetIds } = req.body;

      if (!Array.isArray(timesheetIds) || timesheetIds.length === 0) {
        return res.status(400).json({ message: "Invalid timesheet IDs" });
      }

      await db
        .update(timesheetsTable)
        .set({ 
          status: 'approved',
          approvedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(
          eq(timesheetsTable.tenantId, req.user.tenantId),
          inArray(timesheetsTable.id, timesheetIds)
        ));

      res.json({ message: `Successfully approved ${timesheetIds.length} timesheets` });
    } catch (error) {
      console.error("Failed to bulk approve timesheets:", error);
      res.status(500).json({ message: "Failed to bulk approve timesheets" });
    }
  });

  app.post("/api/admin/timesheets/:id/approve", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const timesheetId = parseInt(req.params.id);

      await db
        .update(timesheetsTable)
        .set({ 
          status: 'approved',
          approvedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(
          eq(timesheetsTable.id, timesheetId),
          eq(timesheetsTable.tenantId, req.user.tenantId)
        ));

      res.json({ message: "Timesheet approved successfully" });
    } catch (error) {
      console.error("Failed to approve timesheet:", error);
      res.status(500).json({ message: "Failed to approve timesheet" });
    }
  });

  app.post("/api/admin/timesheets/:id/reject", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const timesheetId = parseInt(req.params.id);

      await db
        .update(timesheetsTable)
        .set({ 
          status: 'rejected',
          updatedAt: new Date()
        })
        .where(and(
          eq(timesheetsTable.id, timesheetId),
          eq(timesheetsTable.tenantId, req.user.tenantId)
        ));

      res.json({ message: "Timesheet rejected successfully" });
    } catch (error) {
      console.error("Failed to reject timesheet:", error);
      res.status(500).json({ message: "Failed to reject timesheet" });
    }
  });

  app.get("/api/admin/timesheets/approved", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const approvedTimesheets = await db
        .select({
          id: timesheetsTable.id,
          userId: timesheetsTable.userId,
          staffName: users.fullName,
          staffEmail: users.email,
          payPeriodStart: timesheetsTable.payPeriodStart,
          payPeriodEnd: timesheetsTable.payPeriodEnd,
          totalHours: timesheetsTable.totalHours,
          totalEarnings: timesheetsTable.totalEarnings,
          totalTax: timesheetsTable.totalTax,
          totalSuper: timesheetsTable.totalSuper,
          netPay: timesheetsTable.netPay,
          approvedAt: timesheetsTable.approvedAt
        })
        .from(timesheetsTable)
        .innerJoin(users, eq(timesheetsTable.userId, users.id))
        .where(and(
          eq(timesheetsTable.tenantId, req.user.tenantId),
          eq(timesheetsTable.status, 'approved')
        ))
        .orderBy(desc(timesheetsTable.approvedAt));

      res.json(approvedTimesheets);
    } catch (error) {
      console.error("Failed to get approved timesheets:", error);
      res.status(500).json({ message: "Failed to get approved timesheets" });
    }
  });

  app.get("/api/admin/timesheets/payroll-stats", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const approvedCount = await db
        .select({ count: count() })
        .from(timesheetsTable)
        .where(and(
          eq(timesheetsTable.tenantId, req.user.tenantId),
          eq(timesheetsTable.status, 'approved')
        ));

      const payrollQuery = await db
        .select({
          totalPayroll: sum(timesheetsTable.totalEarnings),
          totalTax: sum(timesheetsTable.totalTax),
          totalSuper: sum(timesheetsTable.totalSuper)
        })
        .from(timesheetsTable)
        .where(and(
          eq(timesheetsTable.tenantId, req.user.tenantId),
          eq(timesheetsTable.status, 'approved')
        ));

      const stats = {
        approvedCount: approvedCount[0]?.count || 0,
        totalPayroll: parseFloat(payrollQuery[0]?.totalPayroll || '0'),
        totalTax: parseFloat(payrollQuery[0]?.totalTax || '0'),
        totalSuper: parseFloat(payrollQuery[0]?.totalSuper || '0')
      };

      res.json(stats);
    } catch (error) {
      console.error("Failed to get payroll stats:", error);
      res.status(500).json({ message: "Failed to get payroll stats" });
    }
  });

  app.get("/api/admin/timesheets/history", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const historicalTimesheets = await db
        .select({
          id: timesheetsTable.id,
          userId: timesheetsTable.userId,
          staffName: users.fullName,
          staffEmail: users.email,
          payPeriodStart: timesheetsTable.payPeriodStart,
          payPeriodEnd: timesheetsTable.payPeriodEnd,
          status: timesheetsTable.status,
          totalHours: timesheetsTable.totalHours,
          totalEarnings: timesheetsTable.totalEarnings,
          submittedAt: timesheetsTable.submittedAt,
          approvedAt: timesheetsTable.approvedAt,
          createdAt: timesheetsTable.createdAt
        })
        .from(timesheetsTable)
        .innerJoin(users, eq(timesheetsTable.userId, users.id))
        .where(eq(timesheetsTable.tenantId, req.user.tenantId))
        .orderBy(desc(timesheetsTable.createdAt))
        .limit(500); // Limit to prevent performance issues

      res.json(historicalTimesheets);
    } catch (error) {
      console.error("Failed to get timesheet history:", error);
      res.status(500).json({ message: "Failed to get timesheet history" });
    }
  });

  app.get("/api/admin/timesheets/analytics", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const totalTimesheets = await db
        .select({ count: count() })
        .from(timesheetsTable)
        .where(eq(timesheetsTable.tenantId, req.user.tenantId));

      const totalStaff = await db
        .select({ count: count(users.id) })
        .from(users)
        .where(eq(users.tenantId, req.user.tenantId));

      const avgHoursQuery = await db
        .select({
          avgHours: avg(timesheetsTable.totalHours),
          totalEarnings: sum(timesheetsTable.totalEarnings)
        })
        .from(timesheetsTable)
        .where(eq(timesheetsTable.tenantId, req.user.tenantId));

      const statusCounts = await db
        .select({
          status: timesheetsTable.status,
          count: count()
        })
        .from(timesheetsTable)
        .where(eq(timesheetsTable.tenantId, req.user.tenantId))
        .groupBy(timesheetsTable.status);

      const byStatus = {
        draft: statusCounts.find(s => s.status === 'draft')?.count || 0,
        submitted: statusCounts.find(s => s.status === 'submitted')?.count || 0,
        approved: statusCounts.find(s => s.status === 'approved')?.count || 0,
        rejected: statusCounts.find(s => s.status === 'rejected')?.count || 0
      };

      const analytics = {
        totalTimesheets: totalTimesheets[0]?.count || 0,
        totalStaff: totalStaff[0]?.count || 0,
        avgHoursPerStaff: parseFloat(avgHoursQuery[0]?.avgHours || '0'),
        totalEarnings: parseFloat(avgHoursQuery[0]?.totalEarnings || '0'),
        byStatus
      };

      res.json(analytics);
    } catch (error) {
      console.error("Failed to get timesheet analytics:", error);
      res.status(500).json({ message: "Failed to get timesheet analytics" });
    }
  });

  // Get detailed timesheet entries for admin review
  app.get("/api/admin/timesheets/:id/entries", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const timesheetId = parseInt(req.params.id);
      
      if (isNaN(timesheetId)) {
        return res.status(400).json({ message: "Invalid timesheet ID" });
      }

      // First verify the timesheet belongs to this tenant
      const timesheet = await db
        .select()
        .from(timesheetsTable)
        .where(and(
          eq(timesheetsTable.id, timesheetId),
          eq(timesheetsTable.tenantId, req.user.tenantId)
        ))
        .limit(1);

      if (timesheet.length === 0) {
        return res.status(404).json({ message: "Timesheet not found" });
      }

      const entries = await db
        .select({
          id: timesheetEntries.id,
          entryDate: timesheetEntries.entryDate,
          startTime: timesheetEntries.startTime,
          endTime: timesheetEntries.endTime,
          breakMinutes: timesheetEntries.breakMinutes,
          totalHours: timesheetEntries.totalHours,
          hourlyRate: timesheetEntries.hourlyRate,
          grossPay: timesheetEntries.grossPay,
          isAutoGenerated: timesheetEntries.isAutoGenerated,
          notes: timesheetEntries.notes,
          shiftId: timesheetEntries.shiftId,
          // Get shift and client details
          shiftTitle: shifts.title,
          shiftDescription: shifts.description,
          clientName: clients.fullName,
          clientId: clients.id
        })
        .from(timesheetEntries)
        .leftJoin(shifts, eq(timesheetEntries.shiftId, shifts.id))
        .leftJoin(clients, eq(shifts.clientId, clients.id))
        .where(eq(timesheetEntries.timesheetId, timesheetId))
        .orderBy(desc(timesheetEntries.entryDate));

      res.json(entries);
    } catch (error) {
      console.error("Failed to get timesheet entries:", error);
      res.status(500).json({ message: "Failed to get timesheet entries" });
    }
  });

  // Export timesheet as PDF (individual timesheet export)
  app.get("/api/admin/timesheets/:id/export-pdf", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const timesheetId = parseInt(req.params.id);

      // Get timesheet details with user information
      const timesheetQuery = await db
        .select({
          id: timesheetsTable.id,
          userId: timesheetsTable.userId,
          payPeriodStart: timesheetsTable.payPeriodStart,
          payPeriodEnd: timesheetsTable.payPeriodEnd,
          status: timesheetsTable.status,
          totalHours: timesheetsTable.totalHours,
          totalEarnings: timesheetsTable.totalEarnings,
          totalTax: timesheetsTable.totalTax,
          netPay: timesheetsTable.netPay,
          userName: users.fullName,
          userEmail: users.email,
          employmentType: users.employmentType,
          payLevel: users.payLevel,
          payPoint: users.payPoint,
        })
        .from(timesheetsTable)
        .innerJoin(users, eq(timesheetsTable.userId, users.id))
        .where(and(
          eq(timesheetsTable.id, timesheetId),
          eq(timesheetsTable.tenantId, req.user.tenantId)
        ));

      if (timesheetQuery.length === 0) {
        return res.status(404).json({ message: "Timesheet not found" });
      }

      const timesheet = timesheetQuery[0];

      // Get timesheet entries
      const entries = await db
        .select({
          id: timesheetEntries.id,
          entryDate: timesheetEntries.entryDate,
          startTime: timesheetEntries.startTime,
          endTime: timesheetEntries.endTime,
          breakMinutes: timesheetEntries.breakMinutes,
          totalHours: timesheetEntries.totalHours,
          hourlyRate: timesheetEntries.hourlyRate,
          grossPay: timesheetEntries.grossPay,
          isAutoGenerated: timesheetEntries.isAutoGenerated,
          shiftTitle: shifts.title,
          clientName: clients.fullName,
        })
        .from(timesheetEntries)
        .leftJoin(shifts, eq(timesheetEntries.shiftId, shifts.id))
        .leftJoin(clients, eq(shifts.clientId, clients.id))
        .where(eq(timesheetEntries.timesheetId, timesheetId))
        .orderBy(timesheetEntries.entryDate);

      // Get company details
      const company = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, req.user.tenantId))
        .limit(1);

      const pdfData = {
        timesheet,
        entries,
        company: company[0],
        exportedBy: req.user.username,
        exportedAt: new Date().toISOString(),
      };

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="timesheet-data-${timesheet.userName}-${timesheet.payPeriodStart}.json"`);

      res.json(pdfData);
    } catch (error) {
      console.error("Failed to export timesheet PDF:", error);
      res.status(500).json({ message: "Failed to export timesheet PDF" });
    }
  });

  // Get all timesheet history for admin
  app.get("/api/admin/timesheets/history", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const timesheets = await db
        .select({
          id: timesheetsTable.id,
          userId: timesheetsTable.userId,
          userName: users.fullName,
          userEmail: users.email,
          payPeriodStart: timesheetsTable.payPeriodStart,
          payPeriodEnd: timesheetsTable.payPeriodEnd,
          status: timesheetsTable.status,
          totalHours: timesheetsTable.totalHours,
          totalEarnings: timesheetsTable.totalEarnings,
          totalTax: timesheetsTable.totalTax,
          netPay: timesheetsTable.netPay,
          submittedAt: timesheetsTable.submittedAt,
          approvedAt: timesheetsTable.approvedAt,
          employmentType: users.employmentType,
          payLevel: users.payLevel,
          payPoint: users.payPoint,
        })
        .from(timesheetsTable)
        .innerJoin(users, eq(timesheetsTable.userId, users.id))
        .where(eq(timesheetsTable.tenantId, req.user.tenantId))
        .orderBy(desc(timesheetsTable.payPeriodEnd), desc(timesheetsTable.id));

      res.json(timesheets);
    } catch (error) {
      console.error("Failed to get timesheet history:", error);
      res.status(500).json({ message: "Failed to get timesheet history" });
    }
  });

  // Admin: Update timesheet entry
  app.put("/api/admin/timesheet-entries/:entryId", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const entryId = parseInt(req.params.entryId);
      const updateData = req.body;

      // Get the current entry to verify it exists and get timesheet details
      const existingEntry = await db
        .select({
          id: timesheetEntries.id,
          timesheetId: timesheetEntries.timesheetId,
          tenantId: timesheetEntries.tenantId,
        })
        .from(timesheetEntries)
        .where(and(
          eq(timesheetEntries.id, entryId),
          eq(timesheetEntries.tenantId, req.user.tenantId)
        ))
        .limit(1);

      if (existingEntry.length === 0) {
        return res.status(404).json({ message: "Timesheet entry not found" });
      }

      const entry = existingEntry[0];

      // Update the entry
      const [updatedEntry] = await db
        .update(timesheetEntries)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(
          eq(timesheetEntries.id, entryId),
          eq(timesheetEntries.tenantId, req.user.tenantId)
        ))
        .returning();

      // Recalculate timesheet totals
      await recalculateTimesheetTotals(entry.timesheetId);

      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "admin_edit_timesheet_entry",
        resourceType: "timesheet_entry",
        resourceId: entryId,
        description: `Admin edited timesheet entry`,
        tenantId: req.user.tenantId,
      });

      res.json(updatedEntry);
    } catch (error) {
      console.error("Failed to update timesheet entry:", error);
      res.status(500).json({ message: "Failed to update timesheet entry" });
    }
  });

  // Admin: Delete timesheet entry
  app.delete("/api/admin/timesheet-entries/:entryId", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const entryId = parseInt(req.params.entryId);

      // Get the current entry to verify it exists and get timesheet details
      const existingEntry = await db
        .select({
          id: timesheetEntries.id,
          timesheetId: timesheetEntries.timesheetId,
          tenantId: timesheetEntries.tenantId,
        })
        .from(timesheetEntries)
        .where(and(
          eq(timesheetEntries.id, entryId),
          eq(timesheetEntries.tenantId, req.user.tenantId)
        ))
        .limit(1);

      if (existingEntry.length === 0) {
        return res.status(404).json({ message: "Timesheet entry not found" });
      }

      const entry = existingEntry[0];

      // Delete the entry
      await db
        .delete(timesheetEntries)
        .where(and(
          eq(timesheetEntries.id, entryId),
          eq(timesheetEntries.tenantId, req.user.tenantId)
        ));

      // Recalculate timesheet totals
      await recalculateTimesheetTotals(entry.timesheetId);

      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "admin_delete_timesheet_entry",
        resourceType: "timesheet_entry",
        resourceId: entryId,
        description: `Admin deleted timesheet entry`,
        tenantId: req.user.tenantId,
      });

      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete timesheet entry:", error);
      res.status(500).json({ message: "Failed to delete timesheet entry" });
    }
  });

  // Helper function to recalculate timesheet totals
  async function recalculateTimesheetTotals(timesheetId: number) {
    try {
      // Get all entries for this timesheet
      const entries = await db
        .select({
          totalHours: timesheetEntries.totalHours,
          grossPay: timesheetEntries.grossPay,
        })
        .from(timesheetEntries)
        .where(eq(timesheetEntries.timesheetId, timesheetId));

      // Calculate new totals
      const totalHours = entries.reduce((sum, entry) => sum + parseFloat(entry.totalHours), 0);
      const totalEarnings = entries.reduce((sum, entry) => sum + parseFloat(entry.grossPay), 0);

      // Update timesheet with new totals
      await db
        .update(timesheetsTable)
        .set({
          totalHours: totalHours.toFixed(2),
          totalEarnings: totalEarnings.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(timesheetsTable.id, timesheetId));
    } catch (error) {
      console.error("Failed to recalculate timesheet totals:", error);
    }
  }

  // Bulk export timesheets
  app.get("/api/admin/timesheets/bulk-export", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { status, dateRange } = req.query;
      
      let whereConditions = [eq(timesheetsTable.tenantId, req.user.tenantId)];
      
      if (status && status !== 'all') {
        whereConditions.push(eq(timesheetsTable.status, status as string));
      }
      
      // Add date range filtering if provided
      if (dateRange) {
        // dateRange format: "2025-01-01,2025-12-31"
        const [startDate, endDate] = (dateRange as string).split(',');
        if (startDate && endDate) {
          whereConditions.push(
            and(
              gte(timesheetsTable.payPeriodStart, startDate),
              lte(timesheetsTable.payPeriodEnd, endDate)
            )
          );
        }
      }

      const timesheets = await db
        .select({
          id: timesheetsTable.id,
          userId: timesheetsTable.userId,
          userName: users.fullName,
          userEmail: users.email,
          payPeriodStart: timesheetsTable.payPeriodStart,
          payPeriodEnd: timesheetsTable.payPeriodEnd,
          status: timesheetsTable.status,
          totalHours: timesheetsTable.totalHours,
          totalEarnings: timesheetsTable.totalEarnings,
          totalTax: timesheetsTable.totalTax,
          netPay: timesheetsTable.netPay,
          submittedAt: timesheetsTable.submittedAt,
          approvedAt: timesheetsTable.approvedAt,
          employmentType: users.employmentType,
          payLevel: users.payLevel,
          payPoint: users.payPoint,
        })
        .from(timesheetsTable)
        .innerJoin(users, eq(timesheetsTable.userId, users.id))
        .where(and(...whereConditions))
        .orderBy(desc(timesheetsTable.payPeriodEnd), users.fullName);

      // Get company details
      const company = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, req.user.tenantId))
        .limit(1);

      const exportData = {
        timesheets,
        company: company[0],
        exportedBy: req.user.username,
        exportedAt: new Date().toISOString(),
        filters: { status, dateRange },
      };

      // Set response headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="timesheets-bulk-export-${new Date().toISOString().split('T')[0]}.json"`);

      res.json(exportData);
    } catch (error) {
      console.error("Failed to bulk export timesheets:", error);
      res.status(500).json({ message: "Failed to bulk export timesheets" });
    }
  });



  // Auto-submission settings API endpoints
  app.get("/api/settings/timesheet/auto-submit", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const tenantSettings = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, req.user.tenantId))
        .limit(1);

      if (!tenantSettings.length) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      const settings = tenantSettings[0].settings as any;
      const autoSubmitEnabled = settings?.timesheet?.autoSubmitEnabled ?? false;

      res.json({ autoSubmitEnabled });
    } catch (error) {
      console.error("Failed to get auto-submit settings:", error);
      res.status(500).json({ message: "Failed to get auto-submit settings" });
    }
  });

  app.put("/api/settings/timesheet/auto-submit", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const { autoSubmitEnabled } = req.body;

      if (typeof autoSubmitEnabled !== 'boolean') {
        return res.status(400).json({ message: "autoSubmitEnabled must be a boolean" });
      }

      // Get current settings
      const tenantSettings = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, req.user.tenantId))
        .limit(1);

      if (!tenantSettings.length) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      const currentSettings = tenantSettings[0].settings as any || {};
      
      // Update timesheet auto-submit settings
      const newSettings = {
        ...currentSettings,
        timesheet: {
          ...currentSettings.timesheet,
          autoSubmitEnabled
        }
      };

      await db
        .update(tenants)
        .set({ settings: newSettings })
        .where(eq(tenants.id, req.user.tenantId));

      console.log(`[AUTO-SUBMIT] Settings updated for tenant ${req.user.tenantId}: autoSubmitEnabled = ${autoSubmitEnabled}`);

      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_auto_submit_settings",
        resourceType: "tenant_settings",
        resourceId: req.user.tenantId,
        description: `${autoSubmitEnabled ? 'Enabled' : 'Disabled'} timesheet auto-submission`,
        tenantId: req.user.tenantId,
      });

      res.json({ autoSubmitEnabled, message: `Auto-submission ${autoSubmitEnabled ? 'enabled' : 'disabled'} successfully` });
    } catch (error) {
      console.error("Failed to update auto-submit settings:", error);
      res.status(500).json({ message: "Failed to update auto-submit settings" });
    }
  });

  // Serve static files from uploads directory  
  const expressStatic = await import('express');
  const pathModule = await import('path');
  app.use('/uploads', expressStatic.default.static(pathModule.join(process.cwd(), 'uploads')));

  // Close the registerRoutes function
  return server;
}
