import { storage } from "./storage";
import { NotificationService } from "./notification-service";

export async function createSampleNotifications(): Promise<void> {
  console.log("[NOTIFICATIONS] Creating sample notifications for testing...");

  try {
    // Get users for tenant 1 (current logged in user's tenant)
    const tenantId = 1;
    const users = await storage.getUsersByTenant(tenantId);
    
    if (users.length === 0) {
      console.log("[NOTIFICATIONS] No users found for tenant 1");
      return;
    }

    // Find admin and staff users
    const adminUsers = users.filter(user => ["Admin", "ConsoleManager"].includes(user.role));
    const staffUsers = users.filter(user => ["SupportWorker", "TeamLeader"].includes(user.role));

    console.log(`[NOTIFICATIONS] Found ${adminUsers.length} admin users and ${staffUsers.length} staff users`);

    // Create admin notifications
    if (adminUsers.length > 0) {
      const adminUser = adminUsers[0];
      
      // Shift cancellation request notification
      await NotificationService.createNotification({
        userId: adminUser.id,
        tenantId,
        type: "admin_request",
        title: "⚠️ Shift Cancellation Request",
        message: "Sarah Mitchell has requested to cancel shift: Morning Support - Emma Wilson",
        resourceType: "shift",
        resourceId: 98,
        priority: "high",
      });

      // Incident closure required notification
      await NotificationService.createNotification({
        userId: adminUser.id,
        tenantId,
        type: "admin_request",
        title: "🚨 Incident Closure Required",
        message: "Safety incident 'Client Fall in Bathroom' requires admin closure",
        resourceType: "incident",
        resourceId: 5,
        priority: "urgent",
      });

      // Timesheet submission notification
      await NotificationService.createNotification({
        userId: adminUser.id,
        tenantId,
        type: "timesheet_submitted",
        title: "📊 Timesheet Submitted",
        message: "David Rodriguez has submitted timesheet for December 16-29, 2024",
        resourceType: "timesheet",
        resourceId: 12,
        priority: "normal",
      });
    }

    // Create staff notifications
    if (staffUsers.length > 0) {
      const staffUser = staffUsers[0];

      // Shift assignment notification
      await NotificationService.createNotification({
        userId: staffUser.id,
        tenantId,
        type: "shift_assignment",
        title: "📅 New Shift Assignment",
        message: "You have been assigned to shift: Afternoon Support - Michael Brown on December 25, 2024",
        resourceType: "shift",
        resourceId: 102,
        priority: "normal",
      });

      // Due case note notification
      await NotificationService.createNotification({
        userId: staffUser.id,
        tenantId,
        type: "due_task",
        title: "📝 Case Note Due",
        message: "Case note required for completed shift with Emma Wilson",
        resourceType: "case_note",
        resourceId: 95,
        priority: "high",
      });

      // New message notification
      await NotificationService.createNotification({
        userId: staffUser.id,
        tenantId,
        type: "message",
        title: "💬 New Message",
        message: "New message from Team Leader regarding schedule changes",
        resourceType: "message",
        resourceId: 8,
        priority: "normal",
      });

      // Available shift notification
      await NotificationService.createNotification({
        userId: staffUser.id,
        tenantId,
        type: "available_shift",
        title: "🔔 Available Shift",
        message: "New shift available: Evening Support - Sarah Johnson on December 26, 2024",
        resourceType: "shift",
        resourceId: 105,
        priority: "normal",
      });

      // Overdue medication notification
      await NotificationService.createNotification({
        userId: staffUser.id,
        tenantId,
        type: "due_task",
        title: "💊 Medication Overdue",
        message: "Metformin for Michael Brown is overdue for administration",
        resourceType: "medication",
        resourceId: 3,
        priority: "urgent",
      });
    }

    console.log("[NOTIFICATIONS] Sample notifications created successfully");

  } catch (error) {
    console.error("[NOTIFICATIONS] Error creating sample notifications:", error);
  }
}