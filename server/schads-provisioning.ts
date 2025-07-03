import { db } from "./db";
import { payScales } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// ScHADS Award Wage Rates 2024-25 - Home Care Employee (Disability Care)
const SCHADS_DISABILITY_RATES = [
  // Level 1 - Home Care Employee (Entry Level)
  { level: 1, payPoint: 1, hourlyRate: 26.30, description: "Less than 1 year experience" },
  { level: 1, payPoint: 2, hourlyRate: 27.15, description: "6 months experience" },
  { level: 1, payPoint: 3, hourlyRate: 28.00, description: "12 months experience" },
  
  // Level 2 - Home Care Employee (Personal Care)
  { level: 2, payPoint: 1, hourlyRate: 29.10, description: "Personal care qualified" },
  { level: 2, payPoint: 2, hourlyRate: 30.25, description: "Experienced personal care" },
  { level: 2, payPoint: 3, hourlyRate: 31.40, description: "Senior personal care worker" },
  
  // Level 3 - Home Care Employee (Qualified)
  { level: 3, payPoint: 1, hourlyRate: 33.45, description: "Certificate III or equivalent" },
  { level: 3, payPoint: 2, hourlyRate: 34.60, description: "Advanced skills" },
  { level: 3, payPoint: 3, hourlyRate: 35.75, description: "Senior qualified worker" },
  
  // Level 4 - Home Care Employee (Team Leader)
  { level: 4, payPoint: 1, hourlyRate: 38.20, description: "Team leadership" },
  { level: 4, payPoint: 2, hourlyRate: 39.35, description: "Senior team leader" },
  { level: 4, payPoint: 3, hourlyRate: 40.50, description: "Lead coordinator" },
  
  // Level 5 - Home Care Employee (Specialist/Manager)
  { level: 5, payPoint: 1, hourlyRate: 42.85, description: "Resource coordination" },
  { level: 5, payPoint: 2, hourlyRate: 44.00, description: "Senior manager" },
  { level: 5, payPoint: 3, hourlyRate: 45.15, description: "Area/Operations manager" },
];

export async function provisionScHADSRates(tenantId: number): Promise<void> {
  console.log(`Provisioning ScHADS award rates for tenant ${tenantId}...`);

  const employmentTypes = [
    { type: "fulltime", multiplier: 1.0, description: "Full-time permanent" },
    { type: "parttime", multiplier: 1.0, description: "Part-time permanent" },
    { type: "casual", multiplier: 1.25, description: "Casual with 25% loading" }
  ];

  for (const employmentType of employmentTypes) {
    console.log(`  Provisioning ${employmentType.description} rates...`);
    
    for (const rate of SCHADS_DISABILITY_RATES) {
      // Check if rate already exists for this employment type
      const existing = await db
        .select()
        .from(payScales)
        .where(and(
          eq(payScales.tenantId, tenantId),
          eq(payScales.level, rate.level),
          eq(payScales.payPoint, rate.payPoint),
          eq(payScales.employmentType, employmentType.type)
        ))
        .limit(1);

      if (!existing.length) {
        const adjustedRate = rate.hourlyRate * employmentType.multiplier;
        await db.insert(payScales).values({
          tenantId,
          level: rate.level,
          payPoint: rate.payPoint,
          employmentType: employmentType.type,
          hourlyRate: adjustedRate.toFixed(2),
          effectiveDate: new Date(),
        });
        
        console.log(`    Added ${employmentType.type}: Level ${rate.level}, Pay Point ${rate.payPoint} - $${adjustedRate.toFixed(2)}/hour`);
      }
    }
  }

  console.log(`✓ ScHADS rates provisioning completed for all employment types for tenant ${tenantId}`);
}

export async function updateScHADSRate(
  tenantId: number, 
  level: number, 
  payPoint: number, 
  newRate: number
): Promise<void> {
  await db
    .update(payScales)
    .set({
      hourlyRate: newRate.toString(),
      effectiveDate: new Date(),
    })
    .where(and(
      eq(payScales.tenantId, tenantId),
      eq(payScales.level, level),
      eq(payScales.payPoint, payPoint)
    ));
}

export function getScHADSRateInfo() {
  return SCHADS_DISABILITY_RATES;
}