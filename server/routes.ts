import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
const { medicationRecords, medicationPlans, clients, users } = schema;
import { insertClientSchema, insertFormTemplateSchema, insertFormSubmissionSchema, insertShiftSchema, insertHourlyObservationSchema, insertMedicationPlanSchema, insertMedicationRecordSchema, insertIncidentReportSchema, insertIncidentClosureSchema, insertStaffMessageSchema } from "@shared/schema";
import { z } from "zod";
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
    if (!roles.includes(req.user.role)) {
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
      const clients = await storage.getClients(req.user.tenantId);
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", requireAuth, async (req: any, res) => {
    try {
      const client = await storage.getClient(parseInt(req.params.id), req.user.tenantId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
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
      const shifts = await storage.getActiveShifts(req.user.tenantId);
      res.json(shifts);
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
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid shift data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create shift" });
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
      
      // Validate that this is a shift request operation
      if (updateData.userId && updateData.status === "requested") {
        // Ensure user can only request for themselves
        if (updateData.userId !== req.user.id) {
          return res.status(403).json({ message: "Can only request shifts for yourself" });
        }
        
        // Check if shift exists and is unassigned
        const existingShift = await storage.getShift(shiftId, req.user.tenantId);
        if (!existingShift) {
          return res.status(404).json({ message: "Shift not found" });
        }
        
        if (existingShift.userId) {
          return res.status(400).json({ message: "Shift already assigned" });
        }
      }
      
      const shift = await storage.updateShift(shiftId, updateData, req.user.tenantId);
      
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      // Log activity for shift requests
      if (updateData.status === "requested") {
        await storage.createActivityLog({
          userId: req.user.id,
          action: "request_shift",
          resourceType: "shift",
          resourceId: shift.id,
          description: `Requested shift: ${shift.title}`,
          tenantId: req.user.tenantId,
        });
      }
      
      res.json(shift);
    } catch (error) {
      res.status(500).json({ message: "Failed to update shift" });
    }
  });

  // Approve shift request
  app.post("/api/shifts/:id/approve", requireAuth, requireRole(["Admin", "Coordinator"]), async (req: any, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      
      // Get the shift to find the requesting user
      const shift = await storage.getShift(shiftId, req.user.tenantId);
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      if ((shift as any).status !== "requested") {
        return res.status(400).json({ message: "Shift is not in requested status" });
      }
      
      // Approve the shift by changing status to assigned
      const updatedShift = await storage.updateShift(shiftId, {
        status: "assigned"
      }, req.user.tenantId);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "approve_shift_request",
        resourceType: "shift",
        resourceId: shift.id,
        description: `Approved shift request: ${shift.title}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(updatedShift);
    } catch (error) {
      res.status(500).json({ message: "Failed to approve shift request" });
    }
  });

  // Reject shift request
  app.post("/api/shifts/:id/reject", requireAuth, requireRole(["Admin", "Coordinator"]), async (req: any, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      
      // Get the shift to find the requesting user
      const shift = await storage.getShift(shiftId, req.user.tenantId);
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      if ((shift as any).status !== "requested") {
        return res.status(400).json({ message: "Shift is not in requested status" });
      }
      
      // Reject the shift by removing user assignment and changing status back to unassigned
      const updatedShift = await storage.updateShift(shiftId, {
        userId: null,
        status: "unassigned"
      }, req.user.tenantId);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user.id,
        action: "reject_shift_request",
        resourceType: "shift",
        resourceId: shift.id,
        description: `Rejected shift request: ${shift.title}`,
        tenantId: req.user.tenantId,
      });
      
      res.json(updatedShift);
    } catch (error) {
      res.status(500).json({ message: "Failed to reject shift request" });
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
        caseNotes = await storage.getCaseNotes(parseInt(clientId), tenantId);
      } else {
        // Get all case notes for the tenant - using storage method
        const clients = await storage.getClients(tenantId);
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

  app.get("/api/clients/:clientId/case-notes", requireAuth, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const tenantId = req.user.tenantId;
      
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
        observations = await storage.getObservationsByClient(parseInt(clientId), req.user.tenantId);
      } else {
        observations = await storage.getObservations(req.user.tenantId);
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
      
      // Get all medication plans for the tenant by fetching all clients first
      const clients = await storage.getClients(tenantId);
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

  app.get("/api/clients/:clientId/medication-plans", async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const tenantId = req.user?.tenantId || 1; // Default tenant for testing
      const plans = await storage.getMedicationPlans(clientId, tenantId);
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch medication plans" });
    }
  });

  app.post("/api/medication-plans", requireAuth, requireRole(["Admin", "Coordinator"]), async (req: any, res) => {
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

  app.post("/api/clients/:clientId/medication-plans", requireAuth, requireRole(["Admin", "Coordinator"]), async (req: any, res) => {
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
      
      // Use the storage layer instead of direct DB query
      const records = await storage.getMedicationRecords(0, tenantId); // Pass 0 for clientId to get all records
      
      res.json(records);
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

  // Get users for messaging (filtered by tenant)
  app.get("/api/users", requireAuth, async (req: any, res) => {
    try {
      const users = await storage.getUsersByTenant(req.user.tenantId);
      
      // Return user info without sensitive data
      const safeUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive
      }));
      
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Medication Records API
  app.get("/api/clients/:clientId/medication-records", async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const tenantId = req.user?.tenantId || 1; // Default tenant for testing
      const records = await storage.getMedicationRecords(clientId, tenantId);
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch medication records" });
    }
  });

  app.post("/api/clients/:clientId/medication-records", requireAuth, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const recordData = insertMedicationRecordSchema.parse({
        ...req.body,
        clientId,
        administeredBy: req.user.id,
        tenantId: req.user.tenantId,
      });

      const record = await storage.createMedicationRecord(recordData);
      
      await storage.createActivityLog({
        userId: req.user.id,
        action: "create_medication_record",
        resourceType: "medication_record",
        resourceId: record.id,
        description: `Recorded medication administration: ${record.result}`,
        tenantId: req.user.tenantId,
      });

      res.json(record);
    } catch (error) {
      res.status(500).json({ message: "Failed to create medication record" });
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
      const allocations = await storage.getHourAllocations(req.user.tenantId);
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
      const tasks = await storage.getTaskBoardTasks(req.user.companyId);
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
        companyId: String(req.user.companyId), // Ensure it's a string to match TEXT field
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
    } catch (error) {
      console.error("Task creation error:", error);
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

  const httpServer = createServer(app);
  return httpServer;
}
