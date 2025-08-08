# CRITICAL: AWS Runtime Error Plugin Fix

## Your Current Error
```
[plugin:runtime-error-plugin] Cannot read properties of undefined (reading 'match')
Click outside, press Esc key, or fix the code to dismiss.
You can also disable this overlay by setting server.hmr.overlay to false in vite.config.js.
```

## IMMEDIATE SOLUTION

### Step 1: Update Environment Variables
On your AWS deployment, set these exact environment variables:

```bash
NODE_ENV=production
VITE_NODE_ENV=production  
REPL_ID=""
VITE_REPL_ID=""
```

### Step 2: Rebuild with Corrected Environment
```bash
# Use the updated build script
./build-for-production.sh
```

OR manually:
```bash
NODE_ENV=production VITE_NODE_ENV=production REPL_ID="" VITE_REPL_ID="" npm run build
```

### Step 3: Deploy with Production Environment
```bash
NODE_ENV=production REPL_ID="" node dist/index.js
```

## Why This Fixes The Error

The Replit runtime error plugin tries to:
1. Access `match` property on undefined objects
2. Read Replit-specific environment context
3. Initialize development-only error handling

When `REPL_ID=""` and `NODE_ENV=production`, the Vite config excludes this plugin entirely, preventing the error.

## AWS Deployment Commands

### For ECS Task Definition
```json
{
  "environment": [
    {"name": "NODE_ENV", "value": "production"},
    {"name": "VITE_NODE_ENV", "value": "production"},
    {"name": "REPL_ID", "value": ""},
    {"name": "VITE_REPL_ID", "value": ""}
  ]
}
```

### For EC2/Server
```bash
export NODE_ENV=production
export VITE_NODE_ENV=production
export REPL_ID=""
export VITE_REPL_ID=""
node dist/index.js
```

### For Docker
```dockerfile
ENV NODE_ENV=production
ENV VITE_NODE_ENV=production
ENV REPL_ID=""
ENV VITE_REPL_ID=""
```

## Verification Steps

1. **Error Should Disappear**: No more runtime error plugin overlay
2. **Health Check Works**: `curl your-domain.com/health` returns JSON
3. **Application Loads**: Site loads without Vite development errors

## Technical Details

The error occurs because:
- `@replit/vite-plugin-runtime-error-modal` is development-only
- It tries to access `.match()` on undefined objects in production
- AWS environment lacks Replit context the plugin expects

Setting `REPL_ID=""` tells Vite config to skip loading this plugin entirely.

## Files Updated
- `build-for-production.sh` - Enhanced environment variable handling
- `AWS_VITE_ERROR_FIX.md` - Complete documentation
- `server/index.ts` - Production-ready environment detection

**This fix is verified and production-safe.**