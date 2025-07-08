import { storage } from "./storage";

// Backfill budget deductions for completed shifts that haven't been processed yet
export async function backfillBudgetDeductions() {
  console.log("[BUDGET BACKFILL] Starting backfill process for all tenants...");

  try {
    // Get all tenants
    const tenants = await storage.getAllTenants();
    console.log(`[BUDGET BACKFILL] Found ${tenants.length} tenants`);

    for (const tenant of tenants) {
      console.log(`[BUDGET BACKFILL] Processing tenant ${tenant.id}...`);
      
      // Get completed shifts without budget transactions
      const completedShifts = await storage.getCompletedShiftsWithoutBudgetTransactions(tenant.id);
      console.log(`[BUDGET BACKFILL] Found ${completedShifts.length} unprocessed shifts for tenant ${tenant.id} (using scheduled duration billing)`);

      for (const shift of completedShifts) {
        try {
          await processShiftBudgetDeduction(shift);
          console.log(`[BUDGET BACKFILL] Processed shift ${shift.id}`);
        } catch (error) {
          console.error(`[BUDGET BACKFILL] Failed to process shift ${shift.id}:`, error);
        }
      }
    }

    console.log("[BUDGET BACKFILL] Backfill process completed successfully");
  } catch (error) {
    console.error("[BUDGET BACKFILL] Backfill process failed:", error);
  }
}

async function processShiftBudgetDeduction(shift: any) {
  // Validate shift has required data
  if (!shift.startTime || !shift.endTime || !shift.clientId) {
    console.log(`[BUDGET BACKFILL] Skipping shift ${shift.id} - missing required data`);
    return;
  }

  // Calculate shift duration based on SCHEDULED hours (not actual worked time)
  // Healthcare sector billing: charge full booking regardless of completion time
  const startTime = new Date(shift.startTime);
  const endTime = new Date(shift.endTime);
  const shiftHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  
  if (shiftHours <= 0 || shiftHours > 24) {
    console.log(`[BUDGET BACKFILL] Skipping shift ${shift.id} - invalid duration: ${shiftHours} hours`);
    return;
  }

  // Get client's NDIS budget
  const budget = await storage.getNdisBudgetByClient(shift.clientId, shift.tenantId);
  if (!budget) {
    console.log(`[BUDGET BACKFILL] No budget found for client ${shift.clientId} in tenant ${shift.tenantId}`);
    return;
  }

  // Determine shift type and get pricing
  const shiftType = determineShiftType(startTime);
  const staffRatio = shift.staffRatio || "1:1";

  // Get effective rate (priority: budget price overrides → NDIS pricing table)
  let effectiveRate = 0;
  
  const priceOverrides = budget.priceOverrides as any;
  if (priceOverrides && priceOverrides[shiftType]) {
    effectiveRate = parseFloat(priceOverrides[shiftType].toString());
  } else {
    const pricing = await storage.getNdisPricingByTypeAndRatio(shiftType, staffRatio, shift.tenantId);
    if (pricing) {
      effectiveRate = parseFloat(pricing.rate.toString());
    }
  }
  
  if (effectiveRate <= 0) {
    console.log(`[BUDGET BACKFILL] No valid rate found for shift ${shift.id} (${shiftType} ${staffRatio})`);
    return;
  }

  // Apply ratio multiplier for shared staffing costs
  const ratioMultiplier = getRatioMultiplier(staffRatio);
  const shiftCost = effectiveRate * shiftHours * ratioMultiplier;
  
  // Use the shift's actual funding category instead of defaulting based on shift type
  const category = shift.fundingCategory || 
    ((shiftType === "AM" || shiftType === "PM") ? "CommunityAccess" : "SIL");
  
  console.log(`[BUDGET BACKFILL] Shift ${shift.id}: fundingCategory="${shift.fundingCategory}", calculated category="${category}", shiftType="${shiftType}"`);

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
    console.log(`[BUDGET BACKFILL] Insufficient funds for shift ${shift.id}: Available $${currentRemaining}, Required $${shiftCost}`);
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
    description: `Backfill: Shift completion - ${shift.title} (${shiftHours.toFixed(1)}h × $${effectiveRate} × ${ratioMultiplier} ratio)`,
    companyId,
    createdByUserId: shift.userId || 1, // Use shift assignee or fallback to admin
    tenantId: shift.tenantId,
  });

  console.log(`[BUDGET BACKFILL] Processed $${shiftCost} deduction for shift ${shift.id}`);
}

function determineShiftType(startTime: Date): "AM" | "PM" | "ActiveNight" | "Sleepover" {
  const hour = startTime.getHours();
  
  if (hour >= 6 && hour < 20) {
    return hour < 14 ? "AM" : "PM";
  } else {
    return hour >= 22 || hour < 6 ? "ActiveNight" : "Sleepover";
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