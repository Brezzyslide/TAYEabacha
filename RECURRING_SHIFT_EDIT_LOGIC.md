# Recurring Shift Edit Logic - Complete Guide

## Overview
The recurring shift edit system provides three editing options with comprehensive backend logic for handling different scenarios. This document explains the complete flow from frontend to database.

## System Architecture

### 1. Frontend Components

#### RecurringEditChoiceDialog.tsx
- Presents three editing options to users
- **Edit This Shift Only**: Single shift modification (not implemented yet)
- **Edit All Future Shifts**: From clicked shift onwards
- **Edit Entire Series**: All shifts in the series

#### EditRecurringShiftModal.tsx
- Form for editing recurring shift parameters
- Generates new shift data using `generateRecurringShifts()`
- Sends API request with edit type and shift data

### 2. Backend Processing (server/routes.ts)

#### API Endpoint: PUT /api/shifts/series/:seriesId

**Step 1: Determine Cutoff Date**
```javascript
if (updateData.editType === "future" && updateData.fromShiftId) {
  // Use clicked shift's date as cutoff
  const targetShift = seriesShifts.find(s => s.id === updateData.fromShiftId);
  cutoffDate = new Date(targetShift.startTime);
} else {
  // For "series" editType, use today as cutoff
  cutoffDate = new Date();
  cutoffDate.setHours(0, 0, 0, 0);
}
```

**Step 2: Delete Old Shifts**
```javascript
for (const shift of seriesShifts) {
  const shiftDate = new Date(shift.startTime);
  const shouldDelete = shiftDate >= cutoffDate && shift.status !== "completed";
  
  if (shouldDelete) {
    await storage.deleteShift(shift.id, req.user.tenantId);
  }
}
```

**Step 3: Create New Shifts** (Currently Failing)
```javascript
const newShifts = [];
for (const shiftData of updateData.shifts) {
  const newShiftData = {
    ...shiftData,
    seriesId: seriesId,
    tenantId: req.user.tenantId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  const createdShift = await storage.createShift(newShiftData);
  if (createdShift) {
    newShifts.push(createdShift);
  }
}
```

## Current Issue Analysis

### Problem: Shift Creation Returns Null
The deletion phase works correctly, but `storage.createShift()` returns null for all new shifts.

### Root Cause: Data Structure Mismatch
The `generateRecurringShifts()` function creates shift objects with the following structure:
```javascript
{
  title: data.title,
  startTime: shiftStart,        // Date object
  endTime: shiftEnd,           // Date object
  userId: data.userId,
  clientId: data.clientId,
  fundingCategory: data.fundingCategory,
  staffRatio: data.staffRatio,
  status: data.userId ? "assigned" : "unassigned",
  isRecurring: true,
  recurringPattern: data.recurrenceType,
  recurringDays: [weekday],
  shiftStartDate: data.shiftStartDate,
  shiftStartTime: data.shiftStartTime,
  shiftEndTime: data.shiftEndTime,
}
```

### Database Schema Requirements (shared/schema.ts)
```javascript
startTime: timestamp("start_time").notNull(),  // Required
tenantId: integer("tenant_id").notNull(),      // Required
```

### Data Validation Issues
1. **Missing tenantId**: Frontend doesn't include tenantId in generated shifts
2. **Date serialization**: Date objects might not serialize correctly over API
3. **Extra fields**: Some generated fields might not exist in schema
4. **Field name mismatch**: Generated data uses camelCase, schema uses snake_case

## Solution Implementation

### 1. Fix Data Structure Generation
Update the `generateRecurringShifts()` function to include all required fields:

```javascript
shifts.push({
  title: data.title,
  startTime: shiftStart,
  endTime: shiftEnd,
  userId: data.userId || null,
  clientId: data.clientId,
  fundingCategory: data.fundingCategory,
  staffRatio: data.staffRatio,
  status: data.userId ? "assigned" : "unassigned",
  isRecurring: true,
  recurringPattern: data.recurrenceType,
  recurringDays: [weekday],
  // Include required fields that were missing
  tenantId: user.tenantId,  // This needs to be passed from frontend
  createdAt: new Date(),
});
```

### 2. Enhance Backend Data Processing
Add data validation and sanitization before database insertion:

```javascript
const newShiftData = {
  ...shiftData,
  seriesId: seriesId,
  tenantId: req.user.tenantId,
  // Ensure startTime is a proper Date object
  startTime: new Date(shiftData.startTime),
  endTime: shiftData.endTime ? new Date(shiftData.endTime) : null,
  // Remove any fields not in schema
  createdAt: new Date(),
};

// Remove undefined fields that might cause issues
Object.keys(newShiftData).forEach(key => {
  if (newShiftData[key] === undefined) {
    delete newShiftData[key];
  }
});
```

### 3. Add Comprehensive Error Handling
```javascript
try {
  const createdShift = await storage.createShift(newShiftData);
  if (createdShift) {
    newShifts.push(createdShift);
  } else {
    console.error(`[SERIES UPDATE] createShift returned null for data:`, newShiftData);
  }
} catch (createError) {
  console.error(`[SERIES UPDATE] Failed to create new shift:`, createError);
  console.error(`[SERIES UPDATE] Failed data:`, JSON.stringify(newShiftData, null, 2));
}
```

## Testing Strategy

### 1. Frontend Generation Testing
- Log generated shift data structure
- Verify all required fields are present
- Check Date object serialization

### 2. Backend Processing Testing
- Log received data structure
- Verify data transformation
- Test database insertion with sample data

### 3. End-to-End Testing
- Test all three edit types (single, future, series)
- Verify correct cutoff date calculation
- Confirm old shifts are deleted properly
- Ensure new shifts are created successfully

## Implementation Status

✅ Frontend choice dialog implemented
✅ Backend deletion logic working
✅ Cutoff date calculation working
❌ **Shift creation failing** - needs data structure fix
❌ Single shift edit not implemented
❌ Error handling incomplete

## Next Steps

1. Fix data structure mismatch in `generateRecurringShifts()`
2. Add proper field validation in backend
3. Implement comprehensive error handling
4. Test with enhanced debugging
5. Implement single shift edit functionality
6. Add transaction rollback for failed operations

## Debug Logs to Monitor

When testing recurring shift edits, watch for these log entries:
- `[RECURRING EDIT] Updating recurring shift series:`
- `[SERIES UPDATE] Found X shifts in series`
- `[SERIES UPDATE] Deleting shift X`
- `[STORAGE CREATE SHIFT] Attempting to create shift`
- `[STORAGE CREATE SHIFT] Successfully created shift with ID:`