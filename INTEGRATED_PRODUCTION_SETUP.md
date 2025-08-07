# Integrated Production-Ready Setup

## Overview
The main CareConnect codebase is now **production-ready by default** with automatic environment detection and configuration.

## Key Features

### ✅ Automatic Environment Detection
The server automatically detects whether it's running in development or production:
- **Development**: `NODE_ENV=development` (default on Replit)
- **Production**: `NODE_ENV=production` (set for AWS/server deployment)

### ✅ Environment-Specific Configuration

#### Development Mode (Replit)
- Full Vite development server with hot reload
- Detailed error messages with stack traces
- Permissive CORS for all origins
- Development plugins enabled
- Verbose logging for debugging

#### Production Mode (AWS/Server)
- Static file serving (no Vite development server)
- Generic error messages (security)
- Strict CORS origin checking
- Security headers enabled
- Replit plugins automatically disabled
- Optimized logging

### ✅ Production Security Features
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **CORS Protection**: Strict origin validation in production
- **Error Handling**: Secure error responses that don't expose sensitive information
- **Health Monitoring**: `/health` endpoint for load balancers and monitoring

## Deployment Instructions

### For AWS Production Deployment

1. **Build for Production**:
```bash
NODE_ENV=production npm run build
```

2. **Set Environment Variables**:
```bash
export NODE_ENV=production
export DATABASE_URL=your_production_database_url
export SESSION_SECRET=strong_random_key
```

3. **Start Production Server**:
```bash
NODE_ENV=production npm start
```

### For Docker Deployment

```dockerfile
FROM node:20-alpine
COPY . /app
WORKDIR /app
RUN npm ci --only=production
RUN NODE_ENV=production npm run build
ENV NODE_ENV=production
EXPOSE 5000
CMD ["npm", "start"]
```

### Environment Variables

#### Required for Production
- `NODE_ENV=production` - Enables production mode
- `DATABASE_URL` - PostgreSQL connection string

#### Optional
- `PORT` - Server port (default: 5000)
- `SESSION_SECRET` - Session encryption key
- `STRIPE_SECRET_KEY` - For payment processing
- `VITE_STRIPE_PUBLIC_KEY` - For frontend payments

## Verification

### Development (Replit)
- Server logs show: `[DEVELOPMENT] Full debugging enabled`
- Health check: `http://localhost:5000/health` returns `"environment": "development"`
- Vite development server active

### Production (AWS/Server)
- Server logs show: `[PRODUCTION] Security headers enabled`
- Health check returns `"environment": "production"`
- Static files served directly
- Error responses are generic (secure)

## Health Check Endpoint

**URL**: `/health`

**Response**:
```json
{
  "status": "healthy",
  "environment": "development|production",
  "timestamp": "2025-08-07T20:44:04.123Z",
  "uptime": 123.456,
  "memory": {
    "rss": 123456789,
    "heapTotal": 123456789,
    "heapUsed": 123456789,
    "external": 123456789
  },
  "version": "1.0.0"
}
```

## Migration from Development to Production

No code changes required! Simply:
1. Set `NODE_ENV=production`
2. Set required environment variables
3. Build and deploy

The same codebase automatically adapts to the environment.

## Troubleshooting

### Common Issues

1. **Vite Plugin Errors**: Automatically resolved by setting `REPL_ID=""` in production
2. **CORS Issues**: Check origin is in allowed list for production
3. **Database Connection**: Verify `DATABASE_URL` is set correctly
4. **Health Check Fails**: Ensure server is running and port is accessible

### Debug Commands

```bash
# Check health endpoint
curl http://localhost:5000/health

# Test with production environment
NODE_ENV=production npm start

# Build for production
NODE_ENV=production npm run build
```

This integrated setup ensures your application works seamlessly in both development and production environments with optimal security and performance for each.