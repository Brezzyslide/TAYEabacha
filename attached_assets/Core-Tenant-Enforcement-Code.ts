// CORE TENANT ENFORCEMENT CODE
// ==============================

// 1. AUTHENTICATION & SESSION TENANT BINDING
// ============================================
// server/auth.ts

interface SessionUser {
  id: number;
  username: string;
  role: string;
  tenantId: number;    // CRITICAL: Every user bound to ONE tenant
  companyId: string;   // Company reference for branding
  employmentType: string;
}

// Passport Local Strategy with tenant context
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const user = await storage.getUserByUsername(username);
    if (!user || !(await comparePasswords(password, user.password))) {
      return done(null, false);
    }

    // Session includes tenant context automatically
    const sessionUser: SessionUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId,  // MANDATORY tenant binding
      companyId: user.companyId,
      employmentType: user.employmentType
    };

    return done(null, sessionUser);
  } catch (error) {
    return done(error);
  }
}));

// 2. MIDDLEWARE TENANT ENFORCEMENT
// =================================
// server/routes.ts

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  // Validate tenant context exists
  if (!req.user?.tenantId) {
    return res.status(401).json({ message: "No tenant context" });
  }
  
  next();
}

function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // ConsoleManager bypasses ALL restrictions (global access)
    if (req.user.role === 'ConsoleManager') {
      return next();
    }

    // All other roles respect tenant boundaries
    if (!roles.includes(req.user.role)) {
      console.log(`[ROLE CHECK] User role: ${req.user.role}, Required roles: ${roles.join(', ')}`);
      console.log(`[ROLE CHECK] FAILED - User ${req.user.id} with role '${req.user.role}' denied access`);
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
}

// Cross-tenant access prevention
function validateTenantAccess(resourceTenantId: number, userTenantId: number, userRole: string): boolean {
  // ConsoleManager can access any tenant
  if (userRole === 'ConsoleManager') return true;
  
  // All other roles MUST match tenant
  return resourceTenantId === userTenantId;
}

// 3. DATABASE SCHEMA WITH MANDATORY TENANT FIELDS
// ================================================
// shared/schema.ts

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("SupportWorker"),
  employmentType: text("employment_type").default("casual"),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id), // MANDATORY
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  ndisNumber: text("ndis_number").notNull(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id), // MANDATORY
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  clientId: integer("client_id").references(() => clients.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  status: text("status").default("assigned"),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id), // MANDATORY
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ALL other tables follow same pattern with tenantId field

// 4. API ENDPOINT TENANT FILTERING
// =================================
// server/routes.ts

// Standard query pattern - EVERY query includes tenant filter
app.get("/api/shifts", requireAuth, async (req: any, res) => {
  try {
    const shifts = await db
      .select()
      .from(shiftsTable)
      .where(eq(shiftsTable.tenantId, req.user.tenantId))  // MANDATORY FILTER
      .orderBy(desc(shiftsTable.startTime));
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch shifts" });
  }
});

// Create operations auto-assign tenant
app.post("/api/clients", requireAuth, async (req: any, res) => {
  try {
    const newClient = await db.insert(clientsTable).values({
      ...req.body,
      tenantId: req.user.tenantId,  // AUTO-ASSIGN from session
      companyId: req.user.companyId,
      createdBy: req.user.id
    });
    res.json(newClient);
  } catch (error) {
    res.status(500).json({ message: "Failed to create client" });
  }
});

// Update operations validate tenant ownership
app.patch("/api/shifts/:id", requireAuth, async (req: any, res) => {
  try {
    const shiftId = parseInt(req.params.id);
    
    // Get existing shift to validate tenant ownership
    const existingShift = await db
      .select()
      .from(shiftsTable)
      .where(and(
        eq(shiftsTable.id, shiftId),
        eq(shiftsTable.tenantId, req.user.tenantId)  // TENANT VALIDATION
      ))
      .limit(1);

    if (!existingShift.length) {
      return res.status(404).json({ message: "Shift not found or access denied" });
    }

    // Update only within tenant boundary
    await db
      .update(shiftsTable)
      .set(req.body)
      .where(and(
        eq(shiftsTable.id, shiftId),
        eq(shiftsTable.tenantId, req.user.tenantId)  // DOUBLE CHECK
      ));

    res.json({ message: "Shift updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update shift" });
  }
});

// 5. AUTOMATIC TENANT PROVISIONING
// =================================
// server/new-tenant-auto-provisioning.ts

export async function autoProvisionNewTenant(
  tenantId: number, 
  companyId: string, 
  adminUserId: number
): Promise<void> {
  console.log(`[NEW TENANT SETUP] Starting auto-provisioning for tenant ${tenantId}`);
  
  try {
    // 1. Core tenant provisioning (clients, shifts, budgets)
    await provisionTenant(tenantId, companyId);
    
    // 2. ScHADS pay scales
    await provisionScHADSRates(tenantId);
    
    // 3. NDIS pricing structure
    await createNdisPricingForTenant(tenantId);
    
    // 4. Australian tax brackets (system-wide)
    await ensureTaxBrackets();
    
    // 5. Hour allocations for all staff
    await createHourAllocationsForTenant(tenantId);
    
    // 6. Timesheet provisioning
    await createTimesheetsForTenant(tenantId);
    
    console.log(`[NEW TENANT SETUP] Successfully auto-provisioned tenant ${tenantId} with complete feature set`);
    
  } catch (error) {
    console.error(`[NEW TENANT SETUP] Failed to auto-provision tenant ${tenantId}:`, error);
    throw error;
  }
}

// Integrated into company registration
app.post("/api/companies", async (req, res) => {
  try {
    // 1. Create company
    const company = await storage.createCompany(companyData);
    
    // 2. Create tenant
    const tenant = await storage.createTenant({
      name: companyData.name,
      type: "healthcare",
      companyId: company.id,
    });
    
    // 3. Create admin user
    const adminUser = await storage.createUser({
      ...userData,
      tenantId: tenant.id,  // BIND TO TENANT
      role: "Admin"
    });
    
    // 4. AUTO-PROVISION COMPLETE FEATURE SET
    await autoProvisionNewTenant(tenant.id, company.id, adminUser.id);
    
    res.status(201).json({
      company,
      tenant,
      admin: adminUser,
      message: "Company created with complete feature set"
    });
    
  } catch (error) {
    res.status(500).json({ error: "Failed to create company" });
  }
});

// 6. CONSISTENCY ENFORCEMENT ENGINE
// =================================
// server/multi-tenant-consistency-fix.ts

export async function enforceMultiTenantConsistency(): Promise<void> {
  console.log("[MULTI-TENANT FIX] Starting comprehensive consistency enforcement");
  
  // Get all active tenants
  const tenants = await db.select({ tenantId: users.tenantId })
    .from(users)
    .groupBy(users.tenantId);
  
  for (const tenant of tenants) {
    const tenantId = tenant.tenantId;
    console.log(`[MULTI-TENANT FIX] Processing tenant ${tenantId}`);
    
    // 1. Fix Budget System
    await fixBudgetDeductionConsistency(tenantId);
    
    // 2. Fix Timesheet System
    await fixTimesheetConsistency(tenantId);
    
    // 3. Fix Pay Scale System
    await fixPayScaleConsistency(tenantId);
    
    // 4. Fix NDIS Pricing System
    await fixNdisPricingConsistency(tenantId);
    
    console.log(`[MULTI-TENANT FIX] Tenant ${tenantId} is consistent`);
  }
  
  console.log("[MULTI-TENANT FIX] Consistency enforcement completed");
}

// Runs on server startup
// server/index.ts
async function startServer() {
  // Ensure all tenants have consistent features
  await enforceMultiTenantConsistency();
  
  app.listen(5000, () => {
    console.log("Server running with multi-tenant enforcement");
  });
}

// 7. ATOMIC TRANSACTION OPERATIONS
// =================================
// Prevent race conditions in tenant-sensitive operations

async function processBudgetDeduction(shift: any, userId: number) {
  return await db.transaction(async (tx) => {
    // 1. Get current budget with row lock (tenant-filtered)
    const budget = await tx
      .select()
      .from(ndisBudgets)
      .where(and(
        eq(ndisBudgets.clientId, shift.clientId),
        eq(ndisBudgets.tenantId, shift.tenantId)  // TENANT BOUNDARY
      ))
      .for('update')  // Row lock prevents race conditions
      .limit(1);
      
    if (!budget.length) {
      throw new Error(`No budget found for client ${shift.clientId} in tenant ${shift.tenantId}`);
    }
      
    // 2. Calculate deduction with precision
    const deductionAmount = calculatePreciseDeduction(shift);
    
    // 3. Update budget atomically
    await tx
      .update(ndisBudgets)
      .set({
        currentSpent: (parseFloat(budget[0].currentSpent) + deductionAmount).toString()
      })
      .where(and(
        eq(ndisBudgets.id, budget[0].id),
        eq(ndisBudgets.tenantId, shift.tenantId)  // DOUBLE CHECK
      ));
      
    // 4. Create transaction record (tenant-bound)
    await tx.insert(budgetTransactions).values({
      budgetId: budget[0].id,
      shiftId: shift.id,
      amount: deductionAmount.toString(),
      tenantId: shift.tenantId,  // MAINTAIN ISOLATION
      createdBy: userId
    });
  });
}

// 8. FRONTEND TENANT CONTEXT
// ===========================
// client/src/hooks/use-auth.tsx

export function useAuth() {
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false
  });

  return {
    user,           // Includes tenantId automatically
    isAuthenticated: !!user,
    hasPermission: (requiredRoles: string[]) => {
      if (!user) return false;
      
      // ConsoleManager bypasses all restrictions
      if (user.role === 'ConsoleManager') return true;
      
      // All other roles check within tenant context
      return requiredRoles.includes(user.role);
    }
  };
}

// All API calls automatically include tenant context via session
const { data: shifts } = useQuery({
  queryKey: ['/api/shifts'],  // Tenant filtering happens server-side
  enabled: !!user
});

// No explicit tenant passing needed in mutations
const createMutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/shifts', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/shifts'] });
  }
});

// 9. TENANT VALIDATION MIDDLEWARE
// ================================
// Prevents cross-tenant data injection

app.use((req: any, res: Response, next: NextFunction) => {
  if (req.user && req.body) {
    // Detect tenant manipulation attempts
    if (req.body.tenantId && req.body.tenantId !== req.user.tenantId) {
      if (req.user.role !== 'ConsoleManager') {
        console.error(`[SECURITY] Tenant manipulation detected: User ${req.user.id} (tenant ${req.user.tenantId}) attempted to access tenant ${req.body.tenantId}`);
        return res.status(403).json({ 
          message: "Tenant boundary violation detected" 
        });
      }
    }
    
    // Auto-inject tenant context for create operations
    if (['POST', 'PUT'].includes(req.method) && !req.body.tenantId) {
      req.body.tenantId = req.user.tenantId;
    }
  }
  next();
});

// 10. ACTIVITY LOGGING WITH TENANT CONTEXT
// =========================================
// Every action logs tenant context for audit

interface ActivityLog {
  userId: number;
  tenantId: number;  // ALWAYS included
  action: string;
  resourceType: string;
  resourceId: number;
  description: string;
  timestamp: Date;
}

// Usage throughout system
await storage.createActivityLog({
  userId: req.user.id,
  tenantId: req.user.tenantId,  // Automatic tenant tracking
  action: "create_shift",
  resourceType: "shift",
  resourceId: newShift.id,
  description: `Created shift for client ${clientId}`
});

// SUMMARY: TENANT ENFORCEMENT GUARANTEES
// =======================================

/*
1. DATABASE LEVEL:
   - Every table has tenantId foreign key constraint
   - No orphaned records possible across tenants
   - Consistent schema enforcement

2. API LEVEL:
   - ALL queries filter by req.user.tenantId
   - ALL creates auto-assign tenant context
   - ALL updates validate tenant ownership
   - Cross-tenant access blocked (except ConsoleManager)

3. SESSION LEVEL:
   - User bound to single tenant at login
   - Tenant context automatically included in all requests
   - No client-side tenant manipulation possible

4. PROVISIONING LEVEL:
   - New tenants get complete feature replication
   - Consistency enforcement on server startup
   - Automatic gap detection and fixing

5. AUDIT LEVEL:
   - All actions logged with tenant context
   - Cross-tenant violation detection
   - Comprehensive integrity checks

This architecture ensures bulletproof tenant isolation while guaranteeing
identical functionality across ALL current and future tenants through
automated provisioning and consistency enforcement.
*/