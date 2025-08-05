# Linux Server Docker Deployment Guide

## Issue Description
The application works perfectly on local computers but fails on Linux servers with the error:
```
TypeError [ERR_INVALID_ARG_TYPE]: The "paths[0]" argument must be of type string. Received undefined
```

This occurs because `import.meta.dirname` is not properly available in the esbuild-bundled production code on certain Linux server environments.

## Complete Fix

### 1. Enhanced Production Startup Script
The `production-start.js` script now:
- ✅ Checks for `import.meta.dirname` availability before starting
- ✅ Adds a polyfill if needed for Linux server compatibility  
- ✅ Provides detailed error logging for debugging
- ✅ Gracefully handles startup failures

### 2. Deployment Steps for Linux Servers

#### Option A: Using Docker Compose (Recommended)
```bash
# 1. Copy environment template
cp .env.docker.example .env.docker

# 2. Edit with your actual values
nano .env.docker

# 3. Deploy
docker-compose up -d

# 4. Check logs
docker-compose logs -f
```

#### Option B: Direct Docker Commands
```bash
# 1. Build image
docker build -t needscareai .

# 2. Run with environment variables
docker run -d \
  -p 5000:5000 \
  -e DATABASE_URL="your-database-url" \
  -e SESSION_SECRET="your-session-secret" \
  -e GMAIL_EMAIL="your-email" \
  -e GMAIL_APP_PASSWORD="your-app-password" \
  --name needscareai \
  needscareai

# 3. Check logs
docker logs -f needscareai
```

### 3. Troubleshooting Linux Server Issues

#### Check Container Startup
```bash
# View detailed startup logs
docker logs needscareai

# Expected successful output:
# [STARTUP] Checking import.meta.dirname availability...
# [STARTUP] import.meta.dirname already available (or polyfill added)
# [STARTUP] Loading main application...
# [express] serving on port 5000
```

#### If Still Failing
```bash
# Run debug container with shell access
docker run -it --rm needscareai /bin/sh

# Inside container, test Node.js version and features
node --version
node -e "console.log(import.meta)"
```

### 4. Linux Server Specific Considerations

1. **Node.js Version**: Ensure the server supports Node.js 20+
2. **Container Runtime**: Tested with Docker 20.10+ and containerd
3. **File Permissions**: The container runs as non-root user (needscareai:nodejs)
4. **Network Access**: Ensure port 5000 is accessible

### 5. Environment Variables Required

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Secure session secret (32+ chars) |
| `GMAIL_EMAIL` | Yes | Gmail address for notifications |
| `GMAIL_APP_PASSWORD` | Yes | Gmail app password |
| `OPENAI_API_KEY` | Optional | For AI features |

### 6. Health Check
```bash
# Test application health
curl http://your-server:5000/api/health

# Expected response:
# {"status":"healthy","timestamp":"2025-08-05T...","version":"1.0.0"}
```

## Files Modified for Linux Server Compatibility
- `Dockerfile`: Uses production-start.js script
- `production-start.js`: Comprehensive startup with import.meta polyfill  
- `docker-compose.yml`: Production-ready orchestration
- `.env.docker.example`: Environment template

## Support
If issues persist on your Linux server:
1. Run `docker-debug.sh` to generate detailed logs
2. Check `build.log` and `runtime.log` for specific errors
3. Verify all environment variables are correctly set