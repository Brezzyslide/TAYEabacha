import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertClientSchema, insertFormTemplateSchema, insertFormSubmissionSchema, insertShiftSchema } from "@shared/schema";
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
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
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

  app.put("/api/shifts/:id", requireAuth, requireRole(["Coordinator", "Admin", "ConsoleManager"]), async (req: any, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      const updateData = req.body;
      
      const updatedShift = await storage.updateShift(shiftId, updateData, req.user.tenantId);
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
      
      res.json(updatedShift);
    } catch (error) {
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
      const headers = ['ID', 'Full Name', 'Date of Birth', 'Phone', 'Email', 'Care Level', 'Created At'];
      const csvContent = [
        headers.join(','),
        ...clients.map(client => [
          client.id,
          `"${client.fullName}"`,
          client.dateOfBirth ? new Date(client.dateOfBirth).toISOString().split('T')[0] : '',
          client.phone || '',
          client.email || '',
          client.careLevel || '',
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
  app.get("/api/clients/:clientId/case-notes", async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const tenantId = 1; // Default tenant for testing
      
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

  const httpServer = createServer(app);
  return httpServer;
}
