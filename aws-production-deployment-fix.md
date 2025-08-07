# AWS Production Deployment Fix - Vite Runtime Error Plugin

## Issue Identified
The error `[plugin:runtime-error-plugin] Cannot read properties of undefined (reading 'match')` occurs when deploying to AWS production environment because:

1. **Replit-Specific Plugins**: The `@replit/vite-plugin-runtime-error-modal` plugin is designed for Replit development environment only
2. **Missing Environment Variables**: AWS doesn't have `REPL_ID` environment variable which triggers plugin loading
3. **Production Build Issues**: The plugin tries to read undefined match properties in production builds

## Solution Applied

### 1. Updated Build Script
Modified `build-for-production.sh` to:
- Set `NODE_ENV=production`
- Clear `REPL_ID=""` to disable Replit plugins 
- Use production-safe build environment

### 2. Environment Variable Fix
```bash
# Add to AWS deployment environment
NODE_ENV=production
VITE_NODE_ENV=production
REPL_ID=""
```

### 3. Production Start Command
Use this command on AWS servers:
```bash
NODE_ENV=production REPL_ID="" node dist/index.js
```

## AWS Deployment Steps

### Step 1: Build for Production
```bash
chmod +x build-for-production.sh
./build-for-production.sh
```

### Step 2: Deploy to AWS
```bash
# Copy dist folder to AWS server
scp -r dist/ user@aws-server:/path/to/app/

# On AWS server, install production dependencies
cd /path/to/app/dist
npm install --only=production

# Start with production environment
NODE_ENV=production REPL_ID="" node index.js
```

### Step 3: Set AWS Environment Variables
In your AWS deployment configuration (ECS, EC2, Lambda):
```
NODE_ENV=production
VITE_NODE_ENV=production
REPL_ID=""
DATABASE_URL=your_production_database_url
```

## Prevention
This fix ensures:
- ✅ Replit plugins are disabled in production
- ✅ Vite builds without runtime error overlay
- ✅ Clean production builds without development dependencies
- ✅ AWS compatibility with proper environment variables

## Verification
After deployment, the application should:
1. Start without Vite plugin errors
2. Serve static assets correctly
3. Connect to production database
4. Display the application without runtime error overlays

The error screen shown in the screenshot will no longer appear with these fixes applied.