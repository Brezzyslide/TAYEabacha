// Test smart timesheet processing for shift 228
const { createSmartTimesheetEntry } = require('./server/smart-timesheet-service');

async function processShift228() {
  const shift = {
    id: 228,
    userId: 9,
    title: 'EMMA',
    startTime: new Date('2025-06-19 03:15:12.408'),
    endTime: new Date('2025-06-19 11:15:12.408'),
    completedAt: new Date('2025-06-19 11:15:12.408') // Simulate late completion
  };

  console.log('Processing shift 228 with smart timesheet logic...');
  await createSmartTimesheetEntry(shift, 9, 1);
  console.log('Smart timesheet entry created for shift 228');
}

processShift228().catch(console.error);