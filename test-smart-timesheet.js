/**
 * Test script to validate Smart Timesheet functionality
 * Tests early vs late submission logic for proper payroll compliance
 */

const API_BASE = 'http://localhost:5000';

async function testSmartTimesheetLogic() {
  console.log('\n=== SMART TIMESHEET TESTING ===\n');
  
  try {
    // First, let's authenticate as admin to access all functions
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@example.com',
        password: 'password123'
      }),
      credentials: 'include'
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    console.log('✓ Authenticated successfully');
    
    // Get list of shifts to test with
    const shiftsResponse = await fetch(`${API_BASE}/api/shifts`, {
      credentials: 'include'
    });
    
    if (!shiftsResponse.ok) {
      throw new Error(`Failed to fetch shifts: ${shiftsResponse.status}`);
    }
    
    const shifts = await shiftsResponse.json();
    console.log(`✓ Found ${shifts.length} shifts`);
    
    // Find an assigned shift that we can test with
    const testableShifts = shifts.filter(shift => 
      shift.status === 'assigned' && 
      shift.startTime && 
      shift.endTime &&
      shift.userId
    );
    
    if (testableShifts.length === 0) {
      console.log('⚠️  No testable assigned shifts found');
      return;
    }
    
    const testShift = testableShifts[0];
    console.log(`✓ Testing with shift ${testShift.id}: "${testShift.title}"`);
    console.log(`   Scheduled: ${new Date(testShift.startTime).toLocaleString()} - ${new Date(testShift.endTime).toLocaleString()}`);
    
    // Test 1: EARLY SUBMISSION (complete shift before scheduled end time)
    console.log('\n--- Test 1: EARLY SUBMISSION ---');
    
    const scheduledEndTime = new Date(testShift.endTime);
    const earlyCompletionTime = new Date(scheduledEndTime.getTime() - (30 * 60 * 1000)); // 30 minutes early
    
    console.log(`Completing shift early at: ${earlyCompletionTime.toLocaleString()}`);
    console.log(`Scheduled end time was: ${scheduledEndTime.toLocaleString()}`);
    
    const earlyCompletionResponse = await fetch(`${API_BASE}/api/shifts/${testShift.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        status: 'completed',
        endTimestamp: earlyCompletionTime.toISOString(),
        endLocationData: {
          latitude: -37.8136,
          longitude: 144.9631,
          address: "Melbourne VIC, Australia"
        }
      })
    });
    
    if (!earlyCompletionResponse.ok) {
      throw new Error(`Early completion failed: ${earlyCompletionResponse.status}`);
    }
    
    console.log('✓ Early completion successful');
    
    // Wait a moment for timesheet processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check timesheet entries for this shift
    const timesheetResponse = await fetch(`${API_BASE}/api/admin/staff-timesheets`, {
      credentials: 'include'
    });
    
    if (timesheetResponse.ok) {
      const timesheetData = await timesheetResponse.json();
      const relevantEntries = timesheetData.filter(entry => 
        entry.shiftId === testShift.id
      );
      
      if (relevantEntries.length > 0) {
        const entry = relevantEntries[0];
        console.log(`✓ Timesheet entry created:`);
        console.log(`   Payment method: ${entry.paymentMethod || 'unknown'}`);
        console.log(`   Total hours: ${entry.totalHours}`);
        console.log(`   Gross pay: $${entry.grossPay}`);
        console.log(`   Notes: ${entry.notes || 'none'}`);
        
        if (entry.paymentMethod === 'actual') {
          console.log('🎯 SUCCESS: Early submission correctly paid for actual time worked');
        } else {
          console.log('⚠️  WARNING: Early submission should have payment_method = "actual"');
        }
      } else {
        console.log('⚠️  No timesheet entry found for this shift');
      }
    }
    
    // Test 2: LATE SUBMISSION (complete shift after scheduled end time)
    console.log('\n--- Test 2: LATE SUBMISSION ---');
    
    // Find another testable shift for late submission test
    const anotherTestShift = testableShifts.find(shift => shift.id !== testShift.id);
    
    if (!anotherTestShift) {
      console.log('⚠️  No second shift available for late submission test');
      return;
    }
    
    const lateScheduledEndTime = new Date(anotherTestShift.endTime);
    const lateCompletionTime = new Date(lateScheduledEndTime.getTime() + (2 * 60 * 60 * 1000)); // 2 hours late
    
    console.log(`Completing shift late at: ${lateCompletionTime.toLocaleString()}`);
    console.log(`Scheduled end time was: ${lateScheduledEndTime.toLocaleString()}`);
    
    const lateCompletionResponse = await fetch(`${API_BASE}/api/shifts/${anotherTestShift.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        status: 'completed',
        endTimestamp: lateCompletionTime.toISOString(),
        endLocationData: {
          latitude: -37.8136,
          longitude: 144.9631,
          address: "Melbourne VIC, Australia"
        }
      })
    });
    
    if (!lateCompletionResponse.ok) {
      throw new Error(`Late completion failed: ${lateCompletionResponse.status}`);
    }
    
    console.log('✓ Late completion successful');
    
    // Wait a moment for timesheet processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check timesheet entries for the late completion
    const lateTimesheetResponse = await fetch(`${API_BASE}/api/admin/staff-timesheets`, {
      credentials: 'include'
    });
    
    if (lateTimesheetResponse.ok) {
      const lateTimesheetData = await lateTimesheetResponse.json();
      const lateRelevantEntries = lateTimesheetData.filter(entry => 
        entry.shiftId === anotherTestShift.id
      );
      
      if (lateRelevantEntries.length > 0) {
        const lateEntry = lateRelevantEntries[0];
        console.log(`✓ Timesheet entry created:`);
        console.log(`   Payment method: ${lateEntry.paymentMethod || 'unknown'}`);
        console.log(`   Total hours: ${lateEntry.totalHours}`);
        console.log(`   Gross pay: $${lateEntry.grossPay}`);
        console.log(`   Notes: ${lateEntry.notes || 'none'}`);
        
        if (lateEntry.paymentMethod === 'scheduled') {
          console.log('🎯 SUCCESS: Late submission correctly capped at scheduled hours');
        } else {
          console.log('⚠️  WARNING: Late submission should have payment_method = "scheduled"');
        }
      } else {
        console.log('⚠️  No timesheet entry found for late submission shift');
      }
    }
    
    console.log('\n=== SMART TIMESHEET TESTING COMPLETE ===');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSmartTimesheetLogic();