import { db } from "./db";
import { payScales } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// ScHADS Award Wage Rates 2024-25
const SCHADS_RATES = [
  // Level 1 - Support Worker
  { level: 1, payPoint: 1, hourlyRate: 24.98, description: "Entry level, no experience" },
  { level: 1, payPoint: 2, hourlyRate: 25.98, description: "3 months experience" },
  { level: 1, payPoint: 3, hourlyRate: 26.98, description: "6 months experience" },
  { level: 1, payPoint: 4, hourlyRate: 27.98, description: "12 months experience" },
  
  // Level 2 - Support Worker Grade 2
  { level: 2, payPoint: 1, hourlyRate: 28.45, description: "Certificate III + experience" },
  { level: 2, payPoint: 2, hourlyRate: 29.45, description: "Additional skills/experience" },
  { level: 2, payPoint: 3, hourlyRate: 30.45, description: "Senior support worker" },
  { level: 2, payPoint: 4, hourlyRate: 31.45, description: "Lead support worker" },
  
  // Level 3 - Coordinator/Team Leader
  { level: 3, payPoint: 1, hourlyRate: 32.89, description: "Diploma + coordination duties" },
  { level: 3, payPoint: 2, hourlyRate: 33.89, description: "Advanced coordination" },
  { level: 3, payPoint: 3, hourlyRate: 34.89, description: "Senior coordinator" },
  { level: 3, payPoint: 4, hourlyRate: 35.89, description: "Team leader" },
  
  // Level 4 - Manager/Senior Coordinator
  { level: 4, payPoint: 1, hourlyRate: 37.45, description: "Degree + management" },
  { level: 4, payPoint: 2, hourlyRate: 38.45, description: "Senior management" },
  { level: 4, payPoint: 3, hourlyRate: 39.45, description: "Area manager" },
  { level: 4, payPoint: 4, hourlyRate: 40.45, description: "Senior manager" },
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
    
    for (const rate of SCHADS_RATES) {
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
  return SCHADS_RATES;
}