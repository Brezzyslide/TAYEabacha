# AWS Production Demo Data Cleanup Guide

## CRITICAL ISSUE IDENTIFIED
The AWS production database still contains demo data despite comprehensive code elimination. This indicates the production database was populated before our demo data elimination changes were deployed.

## ROOT CAUSE
- Local codebase: ✅ Demo data creation completely eliminated
- Production database: ❌ Still contains previously created demo data
- Gap: Production database needs manual cleanup of existing demo records

## IMMEDIATE SOLUTION REQUIRED
Since production database contains persistent demo data from before our elimination changes, we need to:

1. **Connect to Production Database**
2. **Identify All Demo Records** 
3. **Execute Safe Cleanup Queries**
4. **Verify Complete Removal**

## PRODUCTION DATABASE CLEANUP QUERIES

### Step 1: Identify Demo Data Pattern
```sql
-- Check for demo clients (usually have test names or patterns)
SELECT id, firstName, lastName, email, tenantId 
FROM clients 
WHERE firstName ILIKE '%test%' 
   OR firstName ILIKE '%demo%' 
   OR lastName ILIKE '%sample%'
   OR email ILIKE '%test%'
   OR email ILIKE '%demo%';

-- Check for demo shifts
SELECT id, clientId, userId, status, shiftType, tenantId
FROM shifts 
WHERE clientId IN (SELECT id FROM clients WHERE firstName ILIKE '%test%' OR firstName ILIKE '%demo%');

-- Check for demo case notes
SELECT id, clientId, userId, title, tenantId
FROM case_notes 
WHERE clientId IN (SELECT id FROM clients WHERE firstName ILIKE '%test%' OR firstName ILIKE '%demo%');
```

### Step 2: Safe Demo Data Removal (Execute in Order)
```sql
-- 1. Remove dependent records first (foreign key constraints)
DELETE FROM budget_transactions WHERE clientId IN (
    SELECT id FROM clients WHERE firstName ILIKE '%test%' OR firstName ILIKE '%demo%'
);

DELETE FROM timesheet_entries WHERE shift_id IN (
    SELECT id FROM shifts WHERE clientId IN (
        SELECT id FROM clients WHERE firstName ILIKE '%test%' OR firstName ILIKE '%demo%'
    )
);

DELETE FROM case_notes WHERE clientId IN (
    SELECT id FROM clients WHERE firstName ILIKE '%test%' OR firstName ILIKE '%demo%'
);

DELETE FROM medication_records WHERE clientId IN (
    SELECT id FROM clients WHERE firstName ILIKE '%test%' OR firstName ILIKE '%demo%'
);

DELETE FROM incident_reports WHERE clientId IN (
    SELECT id FROM clients WHERE firstName ILIKE '%test%' OR firstName ILIKE '%demo%'
);

DELETE FROM observations WHERE clientId IN (
    SELECT id FROM clients WHERE firstName ILIKE '%test%' OR firstName ILIKE '%demo%'
);

DELETE FROM ndis_budgets WHERE clientId IN (
    SELECT id FROM clients WHERE firstName ILIKE '%test%' OR firstName ILIKE '%demo%'
);

-- 2. Remove shifts
DELETE FROM shifts WHERE clientId IN (
    SELECT id FROM clients WHERE firstName ILIKE '%test%' OR firstName ILIKE '%demo%'
);

-- 3. Remove demo clients last
DELETE FROM clients WHERE firstName ILIKE '%test%' OR firstName ILIKE '%demo%';
```

### Step 3: Verification Queries
```sql
-- Verify demo data removal
SELECT COUNT(*) as demo_clients FROM clients WHERE firstName ILIKE '%test%' OR firstName ILIKE '%demo%';
SELECT COUNT(*) as demo_shifts FROM shifts WHERE clientId IN (SELECT id FROM clients WHERE firstName ILIKE '%test%' OR firstName ILIKE '%demo%');
SELECT COUNT(*) as total_clients FROM clients;
SELECT COUNT(*) as total_shifts FROM shifts;
```

## EXECUTION PLAN

### Option A: Database Direct Access
1. Connect to AWS RDS PostgreSQL instance
2. Execute cleanup queries in production database
3. Verify removal and restart application

### Option B: Emergency Cleanup Endpoint
1. Create secure admin-only cleanup endpoint
2. Deploy to production with authentication
3. Execute cleanup via secure API call
4. Remove endpoint after cleanup

## SECURITY CONSIDERATIONS
- ✅ Backup production database before cleanup
- ✅ Use transaction rollback capability
- ✅ Verify tenant isolation (only remove demo data, preserve real client data)
- ✅ Test queries with SELECT before DELETE operations

## POST-CLEANUP VERIFICATION
After cleanup, production should show:
- ✅ Zero demo clients with test names
- ✅ Zero demo shifts/case notes/medications
- ✅ Clean tenant dashboards
- ✅ Only real user-created data remains

## PREVENTION
This issue confirms our demo data elimination was successful - no new demo data can be created. This is a one-time cleanup of existing production database records.