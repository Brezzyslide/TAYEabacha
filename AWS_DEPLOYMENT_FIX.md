# AWS Deployment Fix for NeedsCareAI+

## Issue Analysis
The error you're encountering:
```
TypeError [ERR_INVALID_ARG_TYPE]: The "paths[0]" argument must be of type string. Received undefined
```

This occurs because the production build uses ES modules with `import.meta.dirname` which may not be available in all Node.js environments, particularly in AWS deployments.

## Root Cause
The issue is in the vite.ts file where `import.meta.dirname` is used for path resolution, but in production builds this can return undefined, causing path resolution to fail.

## Solution 1: Pre-deployment Build Fix (Recommended)

### Step 1: Run the production build script
```bash
chmod +x build-for-production.sh
./build-for-production.sh
```

### Step 2: Deploy the dist/ directory contents
Upload these files to your AWS environment:
- `dist/index.js` (your server)
- `dist/public/` (your client files)
- `dist/simplified-composite-fk.sql` (database migration)
- `dist/package.json` (production dependencies)

### Step 3: Install production dependencies
```bash
cd /path/to/your/aws/deployment
npm install --production
```

### Step 4: Start the application
```bash
NODE_ENV=production node index.js
```

## Solution 2: Environment Variable Override

Set these environment variables in your AWS deployment:

```bash
export NODE_ENV=production
export DISABLE_COMPOSITE_FK=true  # If SQL loading fails
```

## Solution 3: Manual File Setup

If the automated script doesn't work, manually copy the SQL file:

```bash
# In your AWS deployment directory
mkdir -p dist/
cp simplified-composite-fk.sql dist/
```

## Verification

After deployment, check the logs for:
```
[COMPOSITE FK] Successfully loaded SQL from: /path/to/simplified-composite-fk.sql
```

If you see this message, the path resolution is working correctly.

## Fallback Strategy

If all else fails, the application will skip the composite foreign key migration and continue running with the existing database constraints. This is safe as the core functionality will still work.

## AWS-Specific Considerations

1. **Lambda**: If deploying to Lambda, ensure the SQL file is included in your deployment package
2. **EC2**: Standard Node.js deployment should work with the fixed path resolution
3. **ECS**: Container-based deployment should include all files in the dist/ directory
4. **Elastic Beanstalk**: Use the build script and upload the entire dist/ directory

## Testing the Fix

You can test the path resolution locally by:
```bash
NODE_ENV=production node dist/index.js
```

This should start without the path resolution error.