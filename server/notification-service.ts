import { storage } from "./storage";
import type { InsertNotification } from "@shared/schema";

interface NotificationData {
  userId?: number;
  userIds?: number[];
  tenantId: number;
  type: "admin_request" | "shift_assignment" | "due_task" | "message" | "available_shift" | "timesheet_submitted";
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: number;
  priority?: "low" | "normal" | "high" | "urgent";
}

export class NotificationService {
  /**
   * Create notification for a single user
   */
  static async createNotification(data: NotificationData): Promise<void> {
    if (!data.userId) return;

    const notification: InsertNotification = {
      userId: data.userId,
      tenantId: data.tenantId,
      type: data.type,
      title: data.title,
      message: data.message,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      priority: data.priority || "normal",
      isRead: false,
    };

    await storage.createNotification(notification);
  }

  /**
   * Create notifications for multiple users
   */
  static async createBulkNotifications(data: NotificationData): Promise<void> {
    if (!data.userIds || data.userIds.length === 0) return;

    const notifications: InsertNotification[] = data.userIds.map(userId => ({
      userId,
      tenantId: data.tenantId,
      type: data.type,
      title: data.title,
      message: data.message,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      priority: data.priority || "normal",
      isRead: false,
    }));

    await storage.createBulkNotifications(notifications);
  }

  /**
   * Notify admins about cancellation requests
   */
  static async notifyAdminsAboutCancellationRequest(
    tenantId: number,
    staffName: string,
    shiftTitle: string,
    shiftId: number
  ): Promise<void> {
    const admins = await storage.getUsersByTenant(tenantId);
    const adminIds = admins
      .filter(user => ["Admin", "ConsoleManager"].includes(user.role))
      .map(user => user.id);

    if (adminIds.length === 0) return;

    await this.createBulkNotifications({
      userIds: adminIds,
      tenantId,
      type: "admin_request",
      title: "⚠️ Shift Cancellation Request",
      message: `${staffName} has requested to cancel shift: ${shiftTitle}`,
      resourceType: "shift",
      resourceId: shiftId,
      priority: "high",
    });
  }

  /**
   * Notify staff about shift assignment
   */
  static async notifyStaffAboutShiftAssignment(
    userId: number,
    tenantId: number,
    shiftTitle: string,
    shiftDate: Date,
    shiftId: number
  ): Promise<void> {
    const dateStr = shiftDate.toLocaleDateString();
    
    await this.createNotification({
      userId,
      tenantId,
      type: "shift_assignment",
      title: "📅 New Shift Assignment",
      message: `You have been assigned to shift: ${shiftTitle} on ${dateStr}`,
      resourceType: "shift",
      resourceId: shiftId,
      priority: "normal",
    });
  }

  /**
   * Notify about due case notes
   */
  static async notifyAboutDueCaseNotes(
    userId: number,
    tenantId: number,
    clientName: string,
    shiftId: number
  ): Promise<void> {
    await this.createNotification({
      userId,
      tenantId,
      type: "due_task",
      title: "📝 Case Note Due",
      message: `Case note required for completed shift with ${clientName}`,
      resourceType: "case_note",
      resourceId: shiftId,
      priority: "high",
    });
  }

  /**
   * Notify about new unread messages
   */
  static async notifyAboutNewMessage(
    recipientId: number,
    tenantId: number,
    senderName: string,
    messageId: number
  ): Promise<void> {
    await this.createNotification({
      userId: recipientId,
      tenantId,
      type: "message",
      title: "💬 New Message",
      message: `New message from ${senderName}`,
      resourceType: "message",
      resourceId: messageId,
      priority: "normal",
    });
  }

  /**
   * Notify about available shifts
   */
  static async notifyAboutAvailableShift(
    tenantId: number,
    shiftTitle: string,
    shiftDate: Date,
    shiftId: number
  ): Promise<void> {
    const staff = await storage.getUsersByTenant(tenantId);
    const staffIds = staff
      .filter(user => ["SupportWorker", "TeamLeader"].includes(user.role))
      .map(user => user.id);

    if (staffIds.length === 0) return;

    const dateStr = shiftDate.toLocaleDateString();

    await this.createBulkNotifications({
      userIds: staffIds,
      tenantId,
      type: "available_shift",
      title: "🔔 Available Shift",
      message: `New shift available: ${shiftTitle} on ${dateStr}`,
      resourceType: "shift",
      resourceId: shiftId,
      priority: "normal",
    });
  }

  /**
   * Notify admins about timesheet submission
   */
  static async notifyAdminsAboutTimesheetSubmission(
    tenantId: number,
    staffName: string,
    payPeriod: string,
    timesheetId: number
  ): Promise<void> {
    const admins = await storage.getUsersByTenant(tenantId);
    const adminIds = admins
      .filter(user => ["Admin", "ConsoleManager"].includes(user.role))
      .map(user => user.id);

    if (adminIds.length === 0) return;

    await this.createBulkNotifications({
      userIds: adminIds,
      tenantId,
      type: "timesheet_submitted",
      title: "📊 Timesheet Submitted",
      message: `${staffName} has submitted timesheet for ${payPeriod}`,
      resourceType: "timesheet",
      resourceId: timesheetId,
      priority: "normal",
    });
  }

  /**
   * Notify about incident closures required (Admin notifications)
   */
  static async notifyAdminsAboutIncidentClosure(
    tenantId: number,
    incidentTitle: string,
    incidentId: number
  ): Promise<void> {
    const admins = await storage.getUsersByTenant(tenantId);
    const adminIds = admins
      .filter(user => ["Admin", "ConsoleManager"].includes(user.role))
      .map(user => user.id);

    if (adminIds.length === 0) return;

    await this.createBulkNotifications({
      userIds: adminIds,
      tenantId,
      type: "admin_request",
      title: "🚨 Incident Closure Required",
      message: `Incident "${incidentTitle}" requires admin closure`,
      resourceType: "incident",
      resourceId: incidentId,
      priority: "urgent",
    });
  }

  /**
   * Notify about overdue medication administration
   */
  static async notifyAboutOverdueMedication(
    userId: number,
    tenantId: number,
    clientName: string,
    medicationName: string,
    medicationId: number
  ): Promise<void> {
    await this.createNotification({
      userId,
      tenantId,
      type: "due_task",
      title: "💊 Medication Overdue",
      message: `${medicationName} for ${clientName} is overdue for administration`,
      resourceType: "medication",
      resourceId: medicationId,
      priority: "urgent",
    });
  }
}