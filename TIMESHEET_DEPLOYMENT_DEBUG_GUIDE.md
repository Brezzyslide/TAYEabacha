# Timesheet Deployment Debugging Guide

## Issue Overview
Timesheet submission works perfectly on Replit but fails on AWS deployment with:
- **Error**: 500 Internal Server Error
- **Endpoint**: `/api/timesheet/10/submit`
- **URL**: `http://ec2-54-80-195-220.compute-1.amazonaws.com:5000/api/timesheet/10/submit`

## Enhanced Debugging Implementation

### 1. Backend Error Logging Enhanced
```typescript
// Added comprehensive logging in routes.ts for timesheet submission
console.log(`[TIMESHEET SUBMIT] Starting submission for timesheet ${req.params.timesheetId}, user ${req.user.id}, tenant ${req.user.tenantId}`);
console.log(`[TIMESHEET SUBMIT] Found ${timesheet.length} timesheets matching criteria`);
console.log(`[TIMESHEET SUBMIT] Timesheet status: ${timesheet[0].status}`);

// Enhanced error handling with detailed stack traces
console.error("[TIMESHEET SUBMIT ERROR] Full error details:", {
  message: error.message,
  stack: error.stack,
  code: error.code,
  timesheetId: req.params.timesheetId,
  userId: req.user?.id,
  tenantId: req.user?.tenantId,
  timestamp: new Date().toISOString()
});
```

### 2. Frontend Error Handling Enhanced
```typescript
// Added detailed frontend error logging
console.log(`[FRONTEND] Submitting timesheet ${timesheetId} for user ${user?.id}`);
console.error(`[FRONTEND] Timesheet submission failed:`, {
  timesheetId,
  userId: user?.id,
  error: error.message,
  status: error.status,
  response: error.response,
  timestamp: new Date().toISOString()
});
```

### 3. New Debugging Endpoints Added

#### Health Check Endpoint
```
GET /api/health/timesheet
```
- Tests database connectivity
- Verifies user authentication
- Checks timesheet data availability

#### Debug Endpoint
```
GET /api/debug/timesheet/:timesheetId
```
- Provides detailed timesheet information
- Shows user context and permissions
- Displays timesheet entries
- Indicates submission eligibility

## Troubleshooting Steps for AWS Deployment

### Step 1: Test Basic Connectivity
```bash
# Test basic health check
curl http://ec2-54-80-195-220.compute-1.amazonaws.com:5000/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-07-08T...",
  "version": "1.0.0",
  "environment": "production",
  "database": "connected"
}
```

### Step 2: Test Authentication
```bash
# Login and capture session cookie
curl -c cookies.txt -X POST \
  http://ec2-54-80-195-220.compute-1.amazonaws.com:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your@email.com","password":"yourpassword"}'
```

### Step 3: Test Timesheet Health Check
```bash
# Test timesheet-specific health check (requires authentication)
curl -b cookies.txt \
  http://ec2-54-80-195-220.compute-1.amazonaws.com:5000/api/health/timesheet
```

### Step 4: Debug Specific Timesheet
```bash
# Debug the failing timesheet (ID: 10)
curl -b cookies.txt \
  http://ec2-54-80-195-220.compute-1.amazonaws.com:5000/api/debug/timesheet/10
```

### Step 5: Check Server Logs
Monitor AWS CloudWatch or EC2 instance logs for:
- Database connection errors
- Authentication failures
- Missing environment variables
- Permission issues

## Common Deployment Issues

### 1. Environment Variables
Ensure these are properly set on AWS:
```env
DATABASE_URL=postgresql://...
SESSION_SECRET=your-secure-secret
NODE_ENV=production
```

### 2. Database Connectivity
- Verify RDS/database is accessible from EC2
- Check security groups and VPC settings
- Confirm connection string format

### 3. Session Configuration
Production session settings may differ:
```typescript
// Check if session store is properly configured
app.use(session({
  store: new (require('connect-pg-simple')(session))({
    conString: process.env.DATABASE_URL,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

### 4. Port and Network Configuration
- Confirm port 5000 is accessible
- Check firewall and security group rules
- Verify load balancer configuration if used

## Quick Fix Commands

### Check if timesheet exists in database:
```sql
SELECT id, user_id, tenant_id, status, total_hours 
FROM timesheets 
WHERE id = 10;
```

### Check if user has permission:
```sql
SELECT u.id, u.tenant_id, u.role, u.username 
FROM users u 
WHERE u.id = (SELECT user_id FROM timesheets WHERE id = 10);
```

### Verify timesheet entries:
```sql
SELECT * FROM timesheet_entries WHERE timesheet_id = 10;
```

## Expected Results
With the enhanced logging, the AWS deployment should now provide detailed error information in the server logs, making it possible to identify the exact cause of the 500 error.

## Next Steps
1. Deploy the enhanced debugging code to AWS
2. Test the debugging endpoints
3. Check server logs for detailed error information
4. Fix the identified issue based on the specific error details
5. Verify timesheet submission works correctly