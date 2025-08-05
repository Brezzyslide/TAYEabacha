# Docker Production Fix - Node.js Path Resolution

## Issue
The Docker production build was failing with:
```
TypeError [ERR_INVALID_ARG_TYPE]: The "paths[0]" argument must be of type string. Received undefined
```

## Root Cause
- The error occurred because `import.meta.dirname` was `undefined` in Node.js 18
- The application was trying to resolve paths using `undefined` values
- This primarily affected the `server/vite.ts` file's static asset serving

## Solution Applied
1. **Upgraded Node.js Version**: Changed from Node.js 18 to Node.js 20 in Dockerfile
   - Node.js 20.11+ has native support for `import.meta.dirname`
   - This provides proper path resolution in ES modules

2. **Docker Changes Made**:
   ```dockerfile
   # Before
   FROM node:18-alpine AS builder
   FROM node:18-alpine AS production
   
   # After  
   FROM node:20-alpine AS builder
   FROM node:20-alpine AS production
   ```

## Files Modified
- `Dockerfile`: Updated base image from node:18-alpine to node:20-alpine

## Expected Outcome
- Docker production builds should now work correctly
- Path resolution for static assets will function properly
- No more `undefined` path errors during startup

## Testing
To test the fix:
1. Build the Docker image: `docker build -t needscareai .`
2. Run the container: `docker run -p 5000:5000 needscareai`
3. Verify the application starts without path resolution errors