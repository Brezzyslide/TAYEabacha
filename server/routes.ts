import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
const { medicationRecords, medicationPlans, clients, users } = schema;
import { insertClientSchema, insertFormTemplateSchema, insertFormSubmissionSchema, insertShiftSchema, insertHourlyObservationSchema, insertMedicationPlanSchema, insertMedicationRecordSchema, insertIncidentReportSchema, insertIncidentClosureSchema, insertStaffMessageSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";

// Helper function to determine shift type based on start time
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
    
    // ConsoleManager has access to everything
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
  // Setup authentication routes
  setupAuth(app);

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
        password 
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

      // Log to console as requested
      console.table([
        {
          companyId: company.id,
          companyName: company.name,
          tenantId: tenant.id,
          adminUserId: adminUser.id,
          adminEmail: adminUser.email,
          status: "Created Successfully"
        }
      ]);

      res.status(201).json({
        company,
        tenant,
        admin: adminUser,
        message: "Company created successfully"
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
          return res.json([]);
        }
        
        // Get only the clients this user is assigned to
        const allClients = await storage.getClients(req.user.tenantId);
        clients = allClients.filter(client => assignedClientIds.includes(client.id));
        
        console.log(`[CLIENT ACCESS] SupportWorker ${req.user.username} can access ${clients.length} clients based on shift assignments`);
      } else {
        // Admin, Coordinator, TeamLeader, ConsoleManager can see all clients
        clients = await storage.getClients(req.user.tenantId);
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
      const validatedData = insertClientSchema.parse({
        ...req.body,
        tenantId: req.user.tenantId,
        createdBy: req.user.id,
      });
      
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
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid client data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create client" });
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
      
      const updatedUser = await storage.updateUser(staffId, updateData, req.user.tenantId);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      
      // Remove sensitive data
      const { password, ...sanitizedUser } = updatedUser;
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update",
        resourceType: "user",
        resourceId: staffId,
        description: `Updated staff member: ${updatedUser.fullName}`,
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
      console.log(`[SHIFTS API] User: ${req.user.username}, TenantId: ${req.user.tenantId}`);
      
      const shifts = await storage.getActiveShifts(req.user.tenantId);
      console.log(`[SHIFTS API] Found ${shifts.length} shifts for tenant ${req.user.tenantId}`);
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
        tenantId: req.user.tenantId,
      };
      
      const shiftData = insertShiftSchema.parse(processedBody);
      
      const shift = await storage.createShift(shiftData);
      
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

  app.put("/api/shifts/:id", requireAuth, requireRole(["Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      const updateData = req.body;
      
      console.log(`[SHIFT UPDATE] User ${req.user.id} (${req.user.role}) updating shift ${shiftId}`);
      console.log(`[SHIFT UPDATE] Update data:`, JSON.stringify(updateData, null, 2));
      console.log(`[SHIFT UPDATE] Tenant ID: ${req.user.tenantId}`);
      
      // Convert string timestamps to Date objects for Drizzle
      const processedUpdateData = { ...updateData };
      if (processedUpdateData.startTime && typeof processedUpdateData.startTime === 'string') {
        processedUpdateData.startTime = new Date(processedUpdateData.startTime);
      }
      if (processedUpdateData.endTime && typeof processedUpdateData.endTime === 'string') {
        processedUpdateData.endTime = new Date(processedUpdateData.endTime);
      }
      
      console.log(`[SHIFT UPDATE] Processed data with Date objects:`, processedUpdateData);
      
      const updatedShift = await storage.updateShift(shiftId, processedUpdateData, req.user.tenantId);
      
      console.log(`[SHIFT UPDATE] Updated shift result:`, updatedShift ? 'SUCCESS' : 'FAILED - Shift not found');
      
      if (!updatedShift) {
        return res.status(404).json({ message: "Shift not found" });
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
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "end_shift",
        resourceType: "shift",
        resourceId: shift.id,
        description: `Ended shift`,
        tenantId: req.user.tenantId,
      });
      
      res.json(shift);
    } catch (error) {
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
      
      // Process NDIS budget deduction when shift is completed
      if (processedUpdateData.status === "completed" && processedUpdateData.endTimestamp && shift.startTimestamp) {
        try {
          // Calculate shift duration in hours
          const startTime = new Date(shift.startTimestamp);
          const endTime = new Date(processedUpdateData.endTimestamp);
          const shiftHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          
          if (shiftHours > 0 && shift.clientId) {
            // Get client's NDIS budget
            const budget = await storage.getNdisBudgetByClient(shift.clientId, req.user.tenantId);
            
            if (budget) {
              // Determine shift type and get pricing
              const shiftType = determineShiftType(startTime);
              const staffRatio = shift.staffRatio || "1:1";
              
              // Get pricing for this shift type and ratio
              const pricing = await storage.getNdisPricingByTypeAndRatio(shiftType, staffRatio, req.user.tenantId);
              
              let effectiveRate = 0;
              
              if (pricing) {
                // Use NDIS pricing table rate
                effectiveRate = parseFloat(pricing.rate.toString());
              } else {
                // Use price overrides from budget when no pricing records exist
                const priceOverrides = budget.priceOverrides as any;
                if (priceOverrides && priceOverrides[shiftType]) {
                  effectiveRate = parseFloat(priceOverrides[shiftType].toString());
                }
              }
              
              if (effectiveRate > 0) {
                const shiftCost = effectiveRate * shiftHours;
                
                // Determine which budget category to deduct from based on shift type
                let budgetUpdate: any = {};
                if (shiftType === "AM" || shiftType === "PM") {
                  // Community Access for day shifts
                  const currentRemaining = parseFloat(budget.communityAccessRemaining.toString());
                  if (currentRemaining >= shiftCost) {
                    budgetUpdate = {
                      communityAccessRemaining: (currentRemaining - shiftCost).toString()
                    };
                  }
                } else {
                  // SIL for overnight shifts
                  const currentRemaining = parseFloat(budget.silRemaining.toString());
                  if (currentRemaining >= shiftCost) {
                    budgetUpdate = {
                      silRemaining: (currentRemaining - shiftCost).toString()
                    };
                  }
                }
                
                // Update budget if deduction is possible
                if (Object.keys(budgetUpdate).length > 0) {
                  await storage.updateNdisBudget(budget.id, budgetUpdate, req.user.tenantId);
                  
                  // Log the budget deduction
                  await storage.createActivityLog({
                    userId: req.user.id,
                    action: "budget_deduction",
                    resourceType: "ndis_budget",
                    resourceId: budget.id,
                    description: `Deducted $${shiftCost.toFixed(2)} for completed shift: ${shift.title} (${shiftHours.toFixed(1)}h @ $${effectiveRate}/h)`,
                    tenantId: req.user.tenantId,
                  });
                }
              }
            }
          }
        } catch (budgetError) {
          console.error("Error processing NDIS budget deduction:", budgetError);
          // Don't fail the shift completion if budget deduction fails
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
      };
      
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
      res.status(500).json({ message: "Failed to create staff availability" });
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

  app.post("/api/case-notes", requireAuth, async (req: any, res) => {
    try {
      const caseNoteData = {
        ...req.body,
        userId: req.user.id,
        tenantId: req.user.tenantId,
      };
      
      const caseNote = await storage.createCaseNote(caseNoteData);
      
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
    } catch (error) {
      console.error("Case note creation error:", error);
      res.status(500).json({ message: "Failed to create case note" });
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
      const caseNoteData = {
        ...req.body,
        clientId,
        userId: req.user.id,
        tenantId: req.user.tenantId,
      };
      
      const caseNote = await storage.createCaseNote(caseNoteData);
      
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
    } catch (error) {
      res.status(500).json({ message: "Failed to create case note" });
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
          
          // Get observations for all assigned clients
          let allObservations = [];
          for (const clientId of assignedClientIds) {
            const clientObservations = await storage.getObservationsByClient(clientId, req.user.tenantId);
            allObservations.push(...clientObservations);
          }
          observations = allObservations;
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
      // Prepare data with server-side fields before validation
      const observationData = {
        ...req.body,
        userId: req.user.id,
        tenantId: req.user.tenantId,
        timestamp: new Date(req.body.timestamp), // Convert string to Date
      };

      const validationResult = insertHourlyObservationSchema.safeParse(observationData);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid observation data", 
          errors: validationResult.error.issues 
        });
      }

      const observation = await storage.createObservation(validationResult.data);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_observation",
        resourceType: "observation",
        resourceId: observation.id,
        description: `Created ${observation.observationType} observation for client ${observation.clientId}`,
        tenantId: req.user.tenantId,
      });
      
      res.status(201).json(observation);
    } catch (error) {
      console.error("Create observation error:", error);
      res.status(500).json({ message: "Failed to create observation" });
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
      const { username, email, password, role, fullName, phone, address, isActive } = req.body;
      
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
      
      const recordData = {
        medicationPlanId: req.body.medicationPlanId || null,
        clientId,
        administeredBy: req.user.id,
        medicationName: req.body.medicationName,
        scheduledTime: actualTime, // Use actual time as scheduled time for database constraint
        actualTime: actualTime,
        dateTime: actualTime, // Duplicate field for compatibility
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
      const reports = await storage.getIncidentReportsWithClosures(tenantId);
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

  app.post("/api/incident-closures", requireAuth, async (req: any, res) => {
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

  app.put("/api/incident-closures/:incidentId", requireAuth, async (req: any, res) => {
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

  // Task Board API - TeamLeader+ can manage tasks
  app.get("/api/task-board-tasks", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
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

  app.put("/api/task-board-tasks/:id", requireAuth, requireRole(["TeamLeader", "Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const task = await storage.updateTaskBoardTask(taskId, req.body, req.user.companyId);
      
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
      const success = await storage.deleteTaskBoardTask(taskId, req.user.companyId);
      
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
      const transactions = await storage.getBudgetTransactions(budgetId, "5b3d3a66-ef3d-4e48-9399-ee580c64e303");
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

  app.post("/api/observations", requireAuth, requireRole(["Admin", "Coordinator", "SupportWorker"]), async (req: any, res) => {
    try {
      const validationResult = insertHourlyObservationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid observation data", 
          errors: validationResult.error.issues 
        });
      }

      const observationData = {
        ...validationResult.data,
        userId: req.user.id,
        tenantId: req.user.tenantId,
      };

      const observation = await storage.createObservation(observationData);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_observation",
        resourceType: "observation",
        resourceId: observation.id,
        description: `Created ${observation.observationType} observation for client ${observation.clientId}`,
        tenantId: req.user.tenantId,
      });
      
      res.status(201).json(observation);
    } catch (error) {
      console.error("Create observation error:", error);
      res.status(500).json({ message: "Failed to create observation" });
    }
  });

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

  // Staff Management API - Edit staff and password reset
  app.put("/api/staff/:id", requireAuth, requireRole(["Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const staffId = parseInt(req.params.id);
      const updateData = req.body;
      
      // Update user in database
      const updatedUser = await storage.updateUser(staffId, updateData, req.user.tenantId);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "update_staff",
        resourceType: "user",
        resourceId: staffId,
        description: `Updated staff member: ${updatedUser.username}`,
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

  // AI Generation API for Care Support Plans
  app.post("/api/care-support-plans/generate-ai", requireAuth, async (req: any, res) => {
    try {
      const { section, userInput, clientDiagnosis, clientName, maxWords = 300, previousSections = {}, targetField = null, existingContent = {} } = req.body;
      
      if (!section || !userInput) {
        return res.status(400).json({ message: "Section and user input are required" });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Build contextual information with existing content awareness
      const contextualInfo = `Client: ${clientName || 'Client'}, Diagnosis: ${clientDiagnosis || 'Not specified'}`;
      
      // Create context-aware content summary
      const buildExistingContentContext = (existingContent: any, targetField: string | null) => {
        const populated = [];
        const empty = [];
        
        for (const [field, content] of Object.entries(existingContent)) {
          if (content && content.toString().trim()) {
            populated.push(`${field}: ${content.toString().slice(0, 100)}${content.toString().length > 100 ? '...' : ''}`);
          } else {
            empty.push(field);
          }
        }
        
        let context = "";
        if (populated.length > 0) {
          context += `\nAlready populated fields: ${populated.join('; ')}`;
        }
        if (targetField) {
          context += `\nTarget field to populate: ${targetField}`;
          context += `\nFocus specifically on ${targetField} content, avoid repeating information already covered in other fields.`;
        }
        
        return context;
      };
      
      const existingContext = buildExistingContentContext(existingContent, targetField);

      let systemPrompt = "";
      let userPrompt = "";

      switch (section) {
        case "aboutMe":
          if (targetField) {
            // Field-specific prompts for About Me section
            const fieldPrompts: { [key: string]: string } = {
              "personalHistory": `Staff need to understand: Client's background, living situation, significant life events. Include specific details about diagnosis impact on daily life. State practical facts staff should know. Max ${maxWords} words.`,
              "interests": `Staff need to know: What activities client enjoys, preferred entertainment, hobbies they can participate in. Include specific examples: "Client enjoys music therapy sessions", "Responds well to art activities". Max ${maxWords} words.`,
              "preferences": `Staff must understand: Daily preferences, routines client prefers, dislikes to avoid. Example: "Client prefers morning showers", "Dislikes loud environments", "Needs 30 minutes between activities". Max ${maxWords} words.`,
              "strengths": `Staff should recognize: Client's abilities, skills they can use, positive behaviors to encourage. Example: "Client has excellent memory for faces", "Communicates well through gestures". Max ${maxWords} words.`,
              "challenges": `Staff must be aware: Specific difficulties client faces, behaviors that may occur, triggers to avoid. Example: "Client becomes anxious in crowded spaces", "Requires prompting for hygiene tasks". Max ${maxWords} words.`,
              "familyBackground": `Staff need to know: Family involvement, cultural background affecting care, important family dynamics. Include contact preferences and family support role. Max ${maxWords} words.`,
              "culturalConsiderations": `Staff must understand: Religious practices, cultural needs, dietary requirements, communication customs. Example: "Client observes halal diet", "Family involvement expected in decisions". Max ${maxWords} words.`
            };
            systemPrompt = fieldPrompts[targetField] || `Generate focused ${targetField} content for this client's care plan. Avoid repeating information from other populated fields. Max ${maxWords} words, professional tone.`;
          } else {
            systemPrompt = `Generate a professional "About Me" section for a care support plan. If specific information is limited, provide evidence-based recommendations and considerations typical for the given diagnosis. Use provided details to create a comprehensive paragraph (max ${maxWords} words). Write in third person, professional tone. Do not include preambles or disclaimers.`;
          }
          userPrompt = `${contextualInfo}${existingContext}\nProvided information: ${userInput}`;
          break;
        
        case "goals":
          if (targetField) {
            // Field-specific prompts for Goals section
            const goalFieldPrompts: { [key: string]: string } = {
              "ndisGoals": `Generate NDIS-aligned goals for this client based on their diagnosis and support needs. Focus on independence, community participation, and skill development. Each goal should be specific, measurable, and relevant to NDIS outcomes. Max ${maxWords} words.`,
              "personalGoals": `Generate personal aspirations and life goals for this client considering their abilities and interests. Focus on meaningful personal achievements, relationships, and lifestyle preferences. Avoid duplicating NDIS goals. Max ${maxWords} words.`,
              "shortTermGoals": `Generate achievable short-term goals (3-6 months) for this client. Focus on immediate skill building and support needs based on their diagnosis. Each goal should be specific and measurable. Max ${maxWords} words.`,
              "longTermGoals": `Generate long-term goals (12+ months) for this client focusing on independence and quality of life improvements. Consider their diagnosis and potential for growth. Each goal should be aspirational yet realistic. Max ${maxWords} words.`
            };
            systemPrompt = goalFieldPrompts[targetField] || `Generate focused ${targetField} for this client's care plan. Ensure goals are SMART and avoid repeating content from other goal fields. Max ${maxWords} words.`;
          } else {
            systemPrompt = `Generate 4 prioritized SMART goals for a care support plan. If specific NDIS goals are limited, create evidence-based goals typical for the given diagnosis. Each goal should be specific, measurable, achievable, relevant, and time-bound. Max ${maxWords} words total. Professional tone, no preambles.`;
          }
          userPrompt = `${contextualInfo}${existingContext}\nProvided goals/objectives: ${userInput}`;
          break;
        
        case "adl":
          systemPrompt = `Generate comprehensive ADL (Activities of Daily Living) support strategies. If specific input is limited, provide evidence-based recommendations typical for the given diagnosis. Focus on practical support approaches. Max ${maxWords} words. Professional care plan language.`;
          userPrompt = `${contextualInfo}${existingContext}\nADL assessment notes: ${userInput}`;
          break;
        
        case "communication":
          if (targetField) {
            // Field-specific prompts for Communication section
            const commFieldPrompts: { [key: string]: string } = {
              "expressive": `Generate expressive communication strategies for this client based on their diagnosis and abilities. Focus on how they communicate needs, wants, and feelings. Include verbal and non-verbal methods. Avoid duplicating receptive strategies. Max ${maxWords} words.`,
              "receptive": `Generate receptive communication strategies for this client based on their diagnosis and abilities. Focus on how they best understand and process information from others. Include visual, auditory, and tactile approaches. Avoid duplicating expressive strategies. Max ${maxWords} words.`,
              "supportStrategies": `Generate communication support strategies and tools for this client. Focus on assistive technologies, environmental modifications, and staff communication approaches. Consider their specific diagnosis needs. Max ${maxWords} words.`
            };
            systemPrompt = commFieldPrompts[targetField] || `Generate focused ${targetField} communication content for this client. Avoid repeating information from other communication fields. Max ${maxWords} words.`;
          } else {
            systemPrompt = `Generate comprehensive communication strategies for both RECEPTIVE and EXPRESSIVE communication. If specific client information is limited, provide evidence-based recommendations for the given diagnosis. Return JSON format: {"generatedContent": "overall strategy", "receptiveStrategies": "receptive specific strategies", "expressiveStrategies": "expressive specific strategies"}. Max ${maxWords} words total.`;
          }
          userPrompt = `${contextualInfo}${existingContext}\nCommunication Assessment: ${userInput}`;
          break;
        
        case "behaviour":
          systemPrompt = `Generate behavior support strategies with proactive, reactive, and protective approaches. If specific behaviors aren't detailed, provide evidence-based strategies typical for the given diagnosis. Each strategy should be max 3 lines. Focus on PBS approaches. Consider information from other sections to avoid duplication.`;
          userPrompt = `${contextualInfo}${existingContext}\nBehavior observations: ${userInput}`;
          break;
        
        case "disaster":
          systemPrompt = `Generate disaster management procedures for the specified scenario. If scenario details are limited, provide comprehensive strategies based on diagnosis considerations. Provide preparation, evacuation, and post-event care strategies. Max 5 lines each section. Consider client's abilities and support needs from other sections.`;
          userPrompt = `${contextualInfo}${existingContext}\nDisaster scenario: ${userInput}`;
          break;
        
        case "adl":
          if (targetField) {
            // Field-specific prompts for ADL section
            const fieldPrompts: { [key: string]: string } = {
              "personalCare": `Staff need to understand: Client's personal care abilities, hygiene support needs, prompting requirements. Include specific assistance levels and independence skills. Example: 'Client requires verbal prompts for teeth brushing', 'Independent with showering but needs temperature check'. Max ${maxWords} words.`,
              "mobility": `Staff need to know: Client's mobility abilities, transfer requirements, safety considerations. Include specific techniques and equipment needs. Example: 'Client uses walking frame for distances over 10 meters', 'Requires two-person assist for bed transfers'. Max ${maxWords} words.`,
              "household": `Staff must understand: Client's household task abilities, supervision needs, safety considerations. Include specific support strategies. Example: 'Client can prepare simple meals with supervision', 'Requires assistance with cleaning products due to chemical sensitivity'. Max ${maxWords} words.`,
              "community": `Staff need to know: Client's community access abilities, transport needs, social support requirements. Include specific strategies for community participation. Example: 'Client travels independently on familiar bus routes', 'Requires support worker for new environments'. Max ${maxWords} words.`,
              "safety": `Staff must be aware: Client's safety awareness, risk recognition abilities, emergency response capabilities. Include specific safety considerations and intervention strategies. Example: 'Client has limited road safety awareness', 'Understands basic fire safety procedures'. Max ${maxWords} words.`,
              "independence": `Staff should recognize: Client's independent living skills, decision-making abilities, self-advocacy strengths. Include specific areas for skill development. Example: 'Client advocates well for preferred activities', 'Developing budgeting skills with support'. Max ${maxWords} words.`,
              "assistiveTechnology": `Staff need to know: Client's assistive technology needs, current equipment, training requirements. Include specific technology support strategies. Example: 'Client uses communication app on tablet', 'Requires support with hearing aid maintenance'. Max ${maxWords} words.`,
              "recommendations": `Staff guidance: Specific ADL support strategies, environmental modifications, skill development goals. Include practical recommendations for daily support. Example: 'Use visual schedules for morning routine', 'Encourage independence while ensuring safety'. Max ${maxWords} words.`
            };
            
            systemPrompt = fieldPrompts[targetField] || `Generate practical ADL support guidance for staff. Max ${maxWords} words.`;
            userPrompt = `${contextualInfo}${existingContext}\nProvided information: ${userInput}`;
          } else {
            systemPrompt = `Generate comprehensive ADL (Activities of Daily Living) assessment content focusing on practical staff guidance. Include specific abilities, support needs, and intervention strategies. Avoid generic care plan language - provide actionable information for support workers. Max ${maxWords} words.`;
            userPrompt = `${contextualInfo}${existingContext}\nADL assessment information: ${userInput}`;
          }
          break;

        case "structure":
          if (targetField) {
            // Field-specific prompts for Structure section
            const fieldPrompts: { [key: string]: string } = {
              "dailyStructure": `Staff need to understand: Client's daily structure needs, preferred timing, essential routines. Include specific scheduling requirements and flexibility levels. Example: 'Client requires consistent meal times', 'Needs 2-hour break between activities'. Max ${maxWords} words.`,
              "weeklyPattern": `Staff need to know: Client's weekly patterns, recurring commitments, schedule variations. Include weekly structure preferences and consistency needs. Example: 'Mondays require quiet activities', 'Weekend routine can be more flexible'. Max ${maxWords} words.`,
              "transitions": `Staff must understand: Client's transition support needs, change management strategies, adaptation time requirements. Include specific transition techniques. Example: 'Client needs 10-minute warning before transitions', 'Visual countdown helps with changes'. Max ${maxWords} words.`,
              "flexibility": `Staff should recognize: Client's flexibility tolerance, adaptation abilities, change management needs. Include specific flexibility strategies. Example: 'Client can handle minor schedule changes with notice', 'Major changes require day-before preparation'. Max ${maxWords} words.`,
              "environmental": `Staff need to know: Client's environmental structure needs, space requirements, setting preferences. Include specific environmental considerations. Example: 'Client works best in quiet spaces', 'Requires consistent seating arrangement'. Max ${maxWords} words.`,
              "staffGuidance": `Staff guidance: Specific structure implementation strategies, routine maintenance, schedule management approaches. Include practical implementation instructions. Max ${maxWords} words.`
            };
            
            systemPrompt = fieldPrompts[targetField] || `Generate practical structure and routine guidance for staff. Max ${maxWords} words.`;
            userPrompt = `${contextualInfo}${existingContext}\nProvided information: ${userInput}`;
          } else {
            systemPrompt = `Generate comprehensive structure and routine content focusing on practical staff guidance. Include daily structure, routine management, transition support, and environmental considerations. Avoid generic care plan language - provide actionable information for support workers. Max ${maxWords} words.`;
            userPrompt = `${contextualInfo}${existingContext}\nStructure and routine information: ${userInput}`;
          }
          break;

        case "communication":
          if (targetField) {
            // Field-specific prompts for Communication section
            const fieldPrompts: { [key: string]: string } = {
              "receptiveStrategies": `Staff need to understand: How client receives and processes information, comprehension support methods, information delivery techniques. Include specific receptive communication strategies. Example: 'Client understands simple instructions best', 'Use visual aids with verbal instructions'. Max ${maxWords} words.`,
              "expressiveStrategies": `Staff need to know: How client expresses needs and thoughts, output methods, expression support techniques. Include specific expressive communication strategies. Example: 'Client uses gestures when verbal difficult', 'Picture cards help express complex needs'. Max ${maxWords} words.`,
              "augmentativeTools": `Staff must understand: AAC devices, picture systems, alternative communication methods needed. Include specific tools and usage instructions. Example: 'Client uses iPad communication app', 'PECS system for meal choices'. Max ${maxWords} words.`,
              "socialInteraction": `Staff should recognize: Client's social communication abilities, interaction preferences, peer communication approaches. Include specific social strategies. Example: 'Client prefers one-on-one conversations', 'Group activities overwhelm communication'. Max ${maxWords} words.`,
              "staffApproaches": `Staff guidance: Specific communication approaches, language level, timing, interaction strategies staff should use. Include practical communication instructions. Max ${maxWords} words.`,
              "assistiveTechnology": `Staff need to know: Communication technology, devices, apps, and technical supports required. Include setup and usage instructions. Example: 'Speech generating device requires daily charging', 'Backup communication cards always available'. Max ${maxWords} words.`
            };
            
            systemPrompt = fieldPrompts[targetField] || `Generate practical communication support guidance for staff. Max ${maxWords} words.`;
            userPrompt = `${contextualInfo}${existingContext}\nProvided information: ${userInput}`;
          } else {
            systemPrompt = `Generate comprehensive communication support content focusing on practical staff guidance. Include receptive and expressive strategies, AAC tools, and staff communication approaches. Avoid generic care plan language - provide actionable information for support workers. Max ${maxWords} words.`;
            userPrompt = `${contextualInfo}${existingContext}\nCommunication assessment information: ${userInput}`;
          }
          break;

        case "behaviour":
          if (targetField) {
            // Field-specific prompts for Behaviour section
            const fieldPrompts: { [key: string]: string } = {
              "overallApproach": `Staff need to understand: Overall behaviour support philosophy, PBS principles, general approach to challenging behaviours. Include consistent approach strategies. Example: 'Focus on positive reinforcement over restriction', 'Understand behaviour as communication'. Max ${maxWords} words.`,
              "preventativeStrategies": `Staff must know: Proactive strategies to prevent challenging behaviours, environmental modifications, early intervention techniques. Include specific prevention methods. Example: 'Provide 10-minute activity warnings', 'Ensure regular sensory breaks'. Max ${maxWords} words.`,
              "deEscalationTechniques": `Staff need to know: Active de-escalation methods, calming techniques, immediate response strategies during escalation. Include step-by-step de-escalation approaches. Example: 'Lower voice tone and slow movements', 'Provide space while maintaining safety'. Max ${maxWords} words.`,
              "positiveBehaviourSupport": `Staff should understand: PBS strategies, reinforcement approaches, positive behavior promotion techniques. Include specific PBS implementation. Example: 'Acknowledge appropriate behaviours immediately', 'Use client's preferred activities as reinforcement'. Max ${maxWords} words.`,
              "staffGuidance": `Staff guidance: Specific behaviour support implementation, team consistency, response protocols staff must follow. Include practical implementation instructions. Max ${maxWords} words.`,
              "riskAssessment": `Staff must be aware: Safety considerations, risk factors, protective measures, emergency procedures for high-risk situations. Include specific safety protocols. Example: 'Monitor for escalation triggers', 'Clear exit strategies during incidents'. Max ${maxWords} words.`
            };
            
            systemPrompt = fieldPrompts[targetField] || `Generate practical behaviour support guidance for staff. Max ${maxWords} words.`;
            userPrompt = `${contextualInfo}${existingContext}\nProvided information: ${userInput}`;
          } else {
            systemPrompt = `Generate comprehensive behaviour support content focusing on practical staff guidance. Include PBS approaches, de-escalation techniques, prevention strategies, and safety considerations. Avoid generic care plan language - provide actionable information for support workers. Max ${maxWords} words.`;
            userPrompt = `${contextualInfo}${existingContext}\nBehaviour assessment information: ${userInput}`;
          }
          break;

        case "disaster":
          if (targetField) {
            // Field-specific prompts for Disaster section
            const fieldPrompts: { [key: string]: string } = {
              "generalPreparedness": `Staff need to understand: Overall disaster preparedness strategies, supplies needed, readiness measures for various emergency scenarios. Include specific preparation requirements. Example: 'Emergency kit must include client medications', 'Backup communication devices charged weekly'. Max ${maxWords} words.`,
              "evacuationProcedures": `Staff must know: General evacuation procedures, mobility considerations, route planning, assistance requirements during evacuations. Include step-by-step evacuation guidance. Example: 'Client requires wheelchair during evacuation', 'Use elevator alternative route B'. Max ${maxWords} words.`,
              "communicationPlan": `Staff need to know: Emergency communication methods, contact procedures, backup communication systems, family notification protocols. Include specific communication steps. Example: 'Contact family via emergency phone tree', 'Use radio if mobile networks fail'. Max ${maxWords} words.`,
              "medicationManagement": `Staff must understand: Emergency medication protocols, supply maintenance, access procedures, storage requirements during disasters. Include medication-specific guidance. Example: 'Insulin requires cool storage during power outages', 'Emergency medication kit location'. Max ${maxWords} words.`,
              "shelterArrangements": `Staff should know: Emergency accommodation requirements, accessibility needs, special equipment for shelter situations. Include shelter-specific considerations. Example: 'Client requires quiet shelter area', 'Wheelchair accessible bathroom essential'. Max ${maxWords} words.`,
              "postDisasterSupport": `Staff guidance: Post-disaster support requirements, recovery procedures, ongoing care considerations after emergency events. Include recovery support strategies. Max ${maxWords} words.`
            };
            
            systemPrompt = fieldPrompts[targetField] || `Generate practical disaster management guidance for staff. Max ${maxWords} words.`;
            userPrompt = `${contextualInfo}${existingContext}\nProvided information: ${userInput}`;
          } else {
            systemPrompt = `Generate comprehensive disaster management content focusing on practical staff guidance. Include preparedness, evacuation, communication, and recovery procedures specific to client needs. Avoid generic care plan language - provide actionable emergency information for support workers. Max ${maxWords} words.`;
            userPrompt = `${contextualInfo}${existingContext}\nDisaster management information: ${userInput}`;
          }
          break;

        case "mealtime":
          if (targetField) {
            // Field-specific prompts for Mealtime section
            const fieldPrompts: { [key: string]: string } = {
              "dietaryRequirements": `Staff need to understand: Specific dietary needs, restrictions, allergies, cultural requirements, medical dietary considerations. Include clear dietary guidelines. Example: 'Client requires gluten-free diet', 'No dairy due to lactose intolerance'. Max ${maxWords} words.`,
              "textureModifications": `Staff must know: Food texture requirements, fluid consistency needs, preparation methods, safety considerations for modified textures. Include specific texture instructions. Example: 'All foods minced to 5mm pieces', 'Fluids thickened to Level 2 consistency'. Max ${maxWords} words.`,
              "assistanceLevel": `Staff need to know: Required mealtime assistance, positioning needs, cueing requirements, independence promotion strategies. Include specific assistance techniques. Example: 'Client needs setup but feeds independently', 'Verbal prompts for pacing required'. Max ${maxWords} words.`,
              "emergencyProcedures": `Staff must understand: Emergency response for choking, aspiration, allergic reactions, medical incidents during meals. Include step-by-step emergency protocols. Example: 'Call 000 immediately for severe choking', 'EpiPen location and usage steps'. Max ${maxWords} words.`,
              "staffGuidance": `Staff guidance: Specific mealtime support implementation, safety protocols, monitoring requirements staff must follow. Include practical mealtime instructions. Max ${maxWords} words.`,
              "monitoringRequirements": `Staff must monitor: Specific indicators, warning signs, assessment requirements, documentation needs during mealtimes. Include monitoring protocols. Example: 'Watch for signs of fatigue during eating', 'Document fluid intake hourly'. Max ${maxWords} words.`
            };
            
            systemPrompt = fieldPrompts[targetField] || `Generate practical mealtime support guidance for staff. Max ${maxWords} words.`;
            userPrompt = `${contextualInfo}${existingContext}\nProvided information: ${userInput}`;
          } else {
            systemPrompt = `Generate comprehensive mealtime risk management content focusing on practical staff guidance. Include dietary requirements, texture modifications, assistance needs, and safety protocols. Avoid generic care plan language - provide actionable mealtime information for support workers. Max ${maxWords} words.`;
            userPrompt = `${contextualInfo}${existingContext}\nMealtime assessment information: ${userInput}`;
          }
          break;
        
        default:
          return res.status(400).json({ message: "Invalid section specified" });
      }

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: Math.min(maxWords * 2, 500),
      });

      const generatedContent = response.choices[0].message.content;
      
      // Handle special parsing for communication section
      if (section === "communication") {
        try {
          const parsedContent = JSON.parse(generatedContent || "{}");
          res.json({ 
            section,
            generatedContent: parsedContent.generatedContent || generatedContent || "",
            receptiveStrategies: parsedContent.receptiveStrategies || "",
            expressiveStrategies: parsedContent.expressiveStrategies || "",
            userInput,
            clientName,
            clientDiagnosis
          });
        } catch (error) {
          // Fallback if JSON parsing fails
          res.json({ 
            section,
            generatedContent: generatedContent || "",
            receptiveStrategies: "",
            expressiveStrategies: "",
            userInput,
            clientName,
            clientDiagnosis
          });
        }
      } else {
        res.json({ 
          section,
          generatedContent: generatedContent || "",
          userInput,
          clientName,
          clientDiagnosis
        });
      }
    } catch (error: any) {
      console.error("AI generation error:", error);
      res.status(500).json({ message: "Failed to generate AI content", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
