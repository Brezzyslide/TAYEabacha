import { pgTable, serial, integer, text, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema";
import { tenants } from "./schema";

// Hour Allocations table
export const hourAllocations = pgTable("hour_allocations", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => users.id),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  allocationPeriod: text("allocation_period").notNull(), // "weekly" | "fortnightly"
  maxHours: decimal("max_hours", { precision: 5, scale: 2 }).notNull(),
  hoursUsed: decimal("hours_used", { precision: 5, scale: 2 }).default("0").notNull(),
  remainingHours: decimal("remaining_hours", { precision: 5, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schema
export const insertHourAllocationSchema = createInsertSchema(hourAllocations).omit({
  id: true,
  hoursUsed: true,
  remainingHours: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  maxHours: z.number().min(1, "Max hours must be at least 1").max(168, "Max hours cannot exceed 168 (hours in a week)"),
  allocationPeriod: z.enum(["weekly", "fortnightly"], { required_error: "Allocation period is required" }),
});

// Types
export type HourAllocation = typeof hourAllocations.$inferSelect;
export type InsertHourAllocation = z.infer<typeof insertHourAllocationSchema>;