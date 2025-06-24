/**
 * TEST SCRIPT: Hour Allocation System
 * Tests the complete hour allocation tracking system
 */

import { storage } from "./storage";

export async function testHourAllocationSystem() {
  console.log("=== TESTING HOUR ALLOCATION SYSTEM ===");
  
  try {
    // Test tenant 1 - get hour allocations
    const allocations = await storage.getHourAllocations(1);
    console.log(`Found ${allocations.length} hour allocations for tenant 1:`);
    
    for (const allocation of allocations) {
      console.log(`Staff ${allocation.staffId}: ${allocation.hoursUsed}/${allocation.maxHours} hours used (${allocation.remainingHours} remaining)`);
    }
    
    // Get assigned shifts for comparison
    const shifts = await storage.getAllShifts(1);
    const assignedShifts = shifts.filter(shift => shift.userId && shift.status === 'assigned');
    
    console.log(`\nFound ${assignedShifts.length} assigned shifts:`);
    for (const shift of assignedShifts) {
      if (shift.startTime && shift.endTime) {
        const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
        console.log(`Shift ${shift.id}: User ${shift.userId}, Duration: ${duration.toFixed(1)} hours, Status: ${shift.status}`);
      }
    }
    
    console.log("\n=== HOUR ALLOCATION TEST COMPLETE ===");
    
  } catch (error) {
    console.error("Hour allocation test failed:", error);
  }
}