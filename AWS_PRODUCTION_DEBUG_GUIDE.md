# AWS Production Deployment Debug Guide

## Current Issues Identified
1. **401 Authentication Errors** - Login/session issues on AWS
2. **500 Case Notes Creation** - Database constraint violations
3. **Observation Duplicates** - Fixed in code but may persist due to caching

## Immediate AWS Debugging Steps

### 1. Environment Variables Check
Ensure your AWS deployment has these critical variables:
```bash
SESSION_SECRET=your_secret_key_here
NODE_ENV=production
DATABASE_URL=your_postgres_connection_string
PORT=5000
```

### 2. Session Configuration Issues
**Problem**: Sessions not persisting in production
**Solution**: Check CloudWatch logs for session errors

### 3. Database Connection
**Problem**: PostgreSQL constraints failing
**Check**: RDS connection string and database schema

### 4. Health Check Endpoints
Your AWS deployment now has these debug endpoints:
- `GET /api/health` - Overall system health
- `GET /api/health/timesheet` - Timesheet system status
- `GET /api/debug/timesheet/:id` - Specific timesheet debugging

## Debug Logging Patterns
Watch for these patterns in AWS CloudWatch:
- `[LOGIN]` - Authentication process details
- `[AUTH]` - Session validation
- `[CASE NOTES]` - Case note creation errors
- `[OBSERVATION CREATE]` - Observation duplicate debugging

## Common AWS Production Fixes

### Session/Cookie Issues
```javascript
// In production, ensure secure cookies
app.use(session({
  cookie: {
    secure: true,        // HTTPS required
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict'
  }
}));
```

### Database Pool Configuration
```javascript
// Increase connection pool for AWS RDS
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Memory and Performance
- Monitor ECS task memory usage
- Check for database connection leaks
- Verify load balancer health checks

## Troubleshooting Steps
1. Check AWS CloudWatch logs for error patterns
2. Verify RDS connectivity from ECS
3. Test session persistence across requests
4. Validate HTTPS certificate configuration
5. Check security group rules for database access

## Quick Fixes to Deploy
The following code updates should resolve AWS-specific issues:
- Enhanced session configuration for production
- Improved database error handling
- Comprehensive logging for CloudWatch
- Duplicate prevention for observations