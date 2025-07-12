#!/usr/bin/env node

/**
 * ULTIMATE DEMO DATA ELIMINATION SYSTEM
 * Real-time monitoring and immediate elimination of ANY demo data creation
 * Runs continuously to catch and eliminate phantom demo data
 */

import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

let monitoringActive = true;
let eliminationCount = 0;

async function eliminateAnyDemoData() {
  try {
    // Delete any clients with demo patterns immediately
    const demoClientDeletion = await db.execute(sql`
      DELETE FROM clients 
      WHERE first_name IN ('Sarah', 'Michael', 'Emma', 'John', 'Jane', 'Test')
         OR last_name IN ('Johnson', 'Chen', 'Williams', 'Doe', 'Smith')
         OR ndis_number LIKE 'NDIS001%'
         OR ndis_number LIKE '%_T%'
    `);
    
    if (demoClientDeletion.rowCount > 0) {
      eliminationCount += demoClientDeletion.rowCount;
      console.log(`🗑️ [DEMO ELIMINATION] Eliminated ${demoClientDeletion.rowCount} demo clients (Total: ${eliminationCount})`);
    }
    
    // Delete any demo shifts
    const demoShiftDeletion = await db.execute(sql`
      DELETE FROM shifts 
      WHERE title LIKE '%demo%' 
         OR title LIKE '%test%'
         OR title LIKE '%sample%'
    `);
    
    if (demoShiftDeletion.rowCount > 0) {
      eliminationCount += demoShiftDeletion.rowCount;
      console.log(`🗑️ [DEMO ELIMINATION] Eliminated ${demoShiftDeletion.rowCount} demo shifts (Total: ${eliminationCount})`);
    }
    
    // Delete any demo case notes
    const demoCaseNotesDeletion = await db.execute(sql`
      DELETE FROM case_notes 
      WHERE title LIKE '%demo%' 
         OR title LIKE '%test%'
         OR title LIKE '%sample%'
    `);
    
    if (demoCaseNotesDeletion.rowCount > 0) {
      eliminationCount += demoCaseNotesDeletion.rowCount;
      console.log(`🗑️ [DEMO ELIMINATION] Eliminated ${demoCaseNotesDeletion.rowCount} demo case notes (Total: ${eliminationCount})`);
    }
    
  } catch (error) {
    console.error('❌ [ELIMINATION ERROR]:', error);
  }
}

async function runContinuousMonitoring() {
  console.log('🚀 [ULTIMATE DEMO ELIMINATION] Starting continuous demo data monitoring and elimination...\n');
  
  while (monitoringActive) {
    await eliminateAnyDemoData();
    
    // Check every 5 seconds for new demo data
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 [DEMO ELIMINATION] Monitoring stopped');
  console.log(`✅ [DEMO ELIMINATION] Total demo records eliminated: ${eliminationCount}`);
  monitoringActive = false;
  process.exit(0);
});

// Start continuous monitoring
runContinuousMonitoring().catch(console.error);