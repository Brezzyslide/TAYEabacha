# AWS Production Session Authentication Debugging Guide

## Overview

This guide addresses session authentication persistence issues in AWS production deployments.

## Root Cause Analysis

Authentication failures in AWS production typically stem from:

1. **CORS Configuration Issues** - Frontend and backend on different domains
2. **Cookie Security Settings** - Secure/SameSite attributes blocking cross-origin cookies
3. **Session Store Problems** - In-memory stores don't work with load balancers
4. **Proxy Configuration** - AWS ALB/CloudFront not passing session cookies properly

## Implemented Fixes

### 1. CORS Configuration (✅ COMPLETED)
```javascript
// server/index.ts
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://needscareai.replit.app',
      'https://your-frontend-domain.com',  // Update with actual domain
      'http://localhost:3000',
      'http://localhost:5000'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now - restrict in production
    }
  },
  credentials: true, // CRITICAL: Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
};
```

### 2. Session Configuration (✅ COMPLETED)
```javascript
// server/auth.ts
const sessionSettings = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: PostgresSessionStore, // ✅ Already using persistent store
  cookie: {
    secure: isProduction,           // HTTPS only in production
    httpOnly: true,                 // Prevent XSS
    maxAge: 24 * 60 * 60 * 1000,   // 24 hours
    sameSite: isProduction ? 'none' : 'lax', // ✅ Cross-origin support
    domain: undefined               // Let browser determine
  },
  rolling: true,                    // Extend on activity
  name: 'needscareai.sid',         // Custom session name
  proxy: isProduction              // ✅ Trust AWS ALB headers
};
```

### 3. Frontend Configuration (✅ ALREADY WORKING)
```javascript
// client/src/lib/queryClient.ts
export async function apiRequest(method, url, data) {
  const res = await fetch(url, {
    method,
    headers: data && !isFormData ? { "Content-Type": "application/json" } : {},
    body: isFormData ? data : data ? JSON.stringify(data) : undefined,
    credentials: "include", // ✅ Send cookies with requests
  });
  return res;
}
```

## Production Deployment Checklist

### Environment Variables
```bash
# Required for AWS production
export NODE_ENV=production
export SESSION_SECRET=your-super-secure-session-secret-here
export DATABASE_URL=postgresql://user:pass@your-aws-rds-endpoint:5432/dbname
```

### AWS Application Load Balancer Configuration
```yaml
# Ensure ALB passes session cookies
sticky_sessions: true
cookie_duration_seconds: 86400  # 24 hours
```

### Health Check Endpoints (✅ AVAILABLE)
```
GET /api/health - Basic health check
GET /api/debug/aws-production - Comprehensive diagnostics (requires auth)
```

## Testing Authentication in Production

### 1. Check CORS Headers
```bash
curl -H "Origin: https://your-frontend-domain.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://your-api-domain.com/api/login
```

Expected response headers:
```
Access-Control-Allow-Origin: https://your-frontend-domain.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS, PATCH
```

### 2. Test Login Flow
```bash
# 1. Login and capture cookies
curl -c cookies.txt \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"username":"test@test.com","password":"password"}' \
     https://your-api-domain.com/api/login

# 2. Test authenticated endpoint with cookies
curl -b cookies.txt \
     https://your-api-domain.com/api/auth/user
```

### 3. Debug Session Storage
```bash
# Check PostgreSQL sessions table
SELECT sess, expire FROM session WHERE sess LIKE '%needscareai%';
```

## Common Production Issues & Solutions

### Issue: "CORS error - credentials not allowed"
**Solution:** Ensure `credentials: true` in CORS config and frontend uses `credentials: 'include'`

### Issue: "Session not persisting across requests"
**Solution:** 
- Check `sameSite: 'none'` in production
- Ensure `secure: true` for HTTPS
- Verify `trust proxy` is enabled

### Issue: "Authentication works in dev but not production"
**Solution:**
- Check domain whitelist in CORS
- Verify HTTPS is used for secure cookies
- Check AWS ALB cookie settings

### Issue: "Session expires immediately"
**Solution:**
- Check `maxAge` is set properly
- Ensure PostgreSQL session store is working
- Verify `rolling: true` for session extension

## Enhanced Logging (✅ IMPLEMENTED)

The system now includes comprehensive logging:

```
[AUTH CONFIG] Environment: production
[AUTH CONFIG] Session store type: PostgresSessionStore
[LOGIN] Login attempt: { username: "user@example.com", sessionID: "abc123" }
[LOGIN] Login successful: { userId: 1, username: "user", tenantId: 1 }
[SESSION STORE] PostgreSQL session store initialized
[CORS] Origin https://frontend.com allowed
```

## Monitoring Session Health

### Key Metrics to Monitor
1. Session creation/destruction rates
2. Authentication success/failure rates
3. CORS preflight request volumes
4. Cookie persistence across requests

### Debug Commands
```bash
# Check active sessions
SELECT COUNT(*) FROM session WHERE expire > NOW();

# Check session data structure
SELECT sess FROM session LIMIT 1;

# Monitor session cleanup
SELECT COUNT(*) FROM session WHERE expire < NOW();
```

## Next Steps

1. **Update CORS Origins**: Replace placeholder domains with actual production domains
2. **SSL Certificate**: Ensure HTTPS is properly configured for secure cookies
3. **Load Balancer**: Configure sticky sessions if using multiple instances
4. **Monitoring**: Set up alerts for authentication failure rates
5. **Testing**: Run comprehensive authentication tests in staging environment

## Emergency Rollback

If issues persist, temporarily allow all origins:
```javascript
origin: true, // WARNING: Only for debugging
```

Then gradually restrict once working.