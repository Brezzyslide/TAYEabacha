# URGENT: AWS Vite Runtime Error Plugin Fix

## Error Description
You're seeing this exact error on AWS deployment:
```
[plugin:runtime-error-plugin] Cannot read properties of undefined (reading 'match')
Click outside, press Esc key, or fix the code to dismiss.
You can also disable this overlay by setting server.hmr.overlay to false in vite.config.js.
```

## Root Cause
The `@replit/vite-plugin-runtime-error-modal` plugin is designed only for Replit development and fails in AWS production because:
1. It tries to read properties that don't exist in production environments
2. The plugin expects Replit-specific variables and context
3. It attempts to access the `match` property on an undefined object

## IMMEDIATE FIX

### Solution 1: Environment Variables (Quickest Fix)
Add these environment variables to your AWS deployment to disable the Replit plugins:
```bash
NODE_ENV=production
VITE_NODE_ENV=production
REPL_ID=""
VITE_REPL_ID=""
```
**This tells the Vite config to exclude the runtime error plugin entirely.**

### Solution 2: Updated Build Process
Use the enhanced build script that explicitly disables all Replit plugins:
```bash
# Build with all Replit plugins disabled
NODE_ENV=production VITE_NODE_ENV=production REPL_ID="" VITE_REPL_ID="" npm run build

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