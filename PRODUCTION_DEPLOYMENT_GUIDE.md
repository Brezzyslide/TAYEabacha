# CareConnect Production Deployment Guide

## Overview
This guide covers deploying CareConnect to production environments with proper security, optimization, and monitoring.

## Production-Ready Features Implemented

### ✅ Environment Separation
- **Development Mode**: Uses development plugins and detailed error messages
- **Production Mode**: Disables development plugins, optimized builds, secure error handling

### ✅ Security Hardening
- Production environment variables properly configured
- Replit development plugins disabled (`REPL_ID=""`)
- Secure session configuration
- Database SSL enabled by default

### ✅ Performance Optimization
- Minified builds
- Optimized chunk sizes
- Production database connection pooling
- Reduced logging verbosity

### ✅ AWS Compatibility
- Fixed Vite runtime error plugin issues
- Proper environment variable handling
- Production-safe startup scripts

## Quick Production Deployment

### Step 1: Build for Production
```bash
chmod +x production-build.sh
./production-build.sh
```

### Step 2: Deploy to Your Server
```bash
# Copy build to server
scp -r dist/ user@your-server:/app/

# On server, install dependencies
cd /app
npm install --only=production

# Set environment variables (required)
export DATABASE_URL="your_production_database_url"
export SESSION_SECRET="strong_random_32_character_key"

# Optional environment variables
export PORT=5000
export STRIPE_SECRET_KEY="sk_live_..."
export EMAIL_HOST="smtp.gmail.com"
export EMAIL_USER="your_email@domain.com"
export EMAIL_PASS="your_app_password"

# Start the server
npm start
```

### Step 3: Verify Production Deployment
- ✅ No Vite runtime error overlays
- ✅ Optimized frontend loads quickly
- ✅ Database connections use SSL
- ✅ Sessions work properly
- ✅ All features functional

## Environment Variables Required

### Required (must be set)
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Strong random key for sessions

### Optional (feature-dependent)
- `PORT` - Server port (default: 5000)
- `STRIPE_SECRET_KEY` - For payment processing
- `VITE_STRIPE_PUBLIC_KEY` - For frontend payment forms
- `EMAIL_HOST` - SMTP server for emails
- `EMAIL_USER` - Email account username
- `EMAIL_PASS` - Email account password

## Deployment Platforms

### AWS (ECS/EC2)
```bash
# Use production-start.js as entrypoint
ENTRYPOINT ["node", "production-start.js"]

# Environment variables in task definition
NODE_ENV=production
DATABASE_URL=your_production_url
SESSION_SECRET=your_secret_key
```

### Docker
```dockerfile
FROM node:20-alpine
COPY dist/ /app/
WORKDIR /app
RUN npm install --only=production
EXPOSE 5000
ENV NODE_ENV=production
CMD ["npm", "start"]
```

### Traditional Server
```bash
# Install Node.js 20+
# Copy dist/ folder
# Set environment variables
# Use PM2 for process management
pm2 start production-start.js --name careconnect
```

## Production Checklist

### Pre-Deployment
- [ ] Run production build successfully
- [ ] Set all required environment variables
- [ ] Test database connectivity
- [ ] Configure SSL certificates
- [ ] Set up monitoring/logging

### Post-Deployment
- [ ] Verify application loads without errors
- [ ] Test authentication flow
- [ ] Confirm all features work
- [ ] Monitor performance metrics
- [ ] Set up automated backups

## Security Considerations

1. **Environment Variables**: Never commit secrets to code
2. **Database**: Use SSL connections in production
3. **Sessions**: Use strong random session secrets
4. **HTTPS**: Always use HTTPS in production
5. **Updates**: Keep dependencies updated

## Monitoring & Maintenance

### Health Check Endpoint
The application includes a health check at `/health` that returns:
```json
{
  "status": "healthy",
  "environment": "production",
  "database": "connected"
}
```

### Log Management
- Production mode reduces log verbosity
- Monitor application logs for errors
- Set up log rotation to manage disk space

## Troubleshooting

### Common Issues
1. **Vite Plugin Errors**: Ensure `REPL_ID=""` is set
2. **Database Connection**: Check DATABASE_URL format
3. **Session Issues**: Verify SESSION_SECRET is set
4. **Port Binding**: Ensure port is available and properly configured

This production configuration ensures your CareConnect deployment is secure, performant, and maintainable.