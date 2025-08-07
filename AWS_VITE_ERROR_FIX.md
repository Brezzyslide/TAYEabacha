# URGENT: AWS Vite Runtime Error Plugin Fix

## Error Description
You're seeing this error on AWS deployment:
```
[plugin:runtime-error-plugin] Cannot read properties of undefined (reading 'match')
```

## Root Cause
The `@replit/vite-plugin-runtime-error-modal` plugin is only designed for Replit development environment and fails in AWS production because it expects Replit-specific environment variables.

## IMMEDIATE FIX

### Solution 1: Environment Variables (Quickest Fix)
Add these environment variables to your AWS deployment:
```bash
NODE_ENV=production
VITE_NODE_ENV=production
REPL_ID=""
```

### Solution 2: Updated Build Process
Use the updated build script:
```bash
# Build with Replit plugins disabled
NODE_ENV=production REPL_ID="" npm run build

# Start server with production environment
NODE_ENV=production REPL_ID="" node dist/index.js
```

### Solution 3: AWS Deployment Command
Replace your current start command with:
```bash
NODE_ENV=production REPL_ID="" node dist/index.js
```

## AWS-Specific Instructions

### For ECS/Fargate
Add to your task definition environment variables:
```json
{
  "name": "NODE_ENV",
  "value": "production"
},
{
  "name": "REPL_ID", 
  "value": ""
}
```

### For EC2/Direct Server
```bash
export NODE_ENV=production
export REPL_ID=""
node dist/index.js
```

### For Docker Deployment
Update your Dockerfile:
```dockerfile
ENV NODE_ENV=production
ENV REPL_ID=""
CMD ["node", "dist/index.js"]
```

## Verification
After applying the fix:
1. The Vite error screen should disappear
2. The application should load normally
3. No more runtime error plugin issues

## Files Updated
- `build-for-production.sh` - Now disables Replit plugins during build
- `aws-production-deployment-fix.md` - Complete documentation

This fix is production-safe and maintains all functionality while resolving the AWS compatibility issue.