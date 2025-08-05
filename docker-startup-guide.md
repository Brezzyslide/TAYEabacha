# Docker Production Startup Guide

## Prerequisites
The application requires these environment variables to start successfully:

### Required Environment Variables
1. **DATABASE_URL** or **AWS_DATABASE_URL** - PostgreSQL database connection
2. **SESSION_SECRET** - Secure session secret (minimum 32 characters)
3. **GMAIL_EMAIL** - Gmail address for email service
4. **GMAIL_APP_PASSWORD** - Gmail app password for email service

### Optional Environment Variables
- **OPENAI_API_KEY** - For AI features
- **DISABLE_COMPOSITE_FK** - Set to `true` to disable composite foreign keys

## Setup Instructions

### Option 1: Using Docker Compose (Recommended)
1. Copy the environment template:
   ```bash
   cp .env.docker.example .env.docker
   ```

2. Edit `.env.docker` with your actual values:
   ```bash
   nano .env.docker
   ```

3. Start the application:
   ```bash
   docker-compose up -d
   ```

### Option 2: Using Docker Run
1. Build the image:
   ```bash
   docker build -t needscareai .
   ```

2. Run with environment variables:
   ```bash
   docker run -d \
     -p 5000:5000 \
     -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
     -e SESSION_SECRET="your-secure-session-secret" \
     -e GMAIL_EMAIL="your-email@gmail.com" \
     -e GMAIL_APP_PASSWORD="your-app-password" \
     -e OPENAI_API_KEY="your-openai-key" \
     --name needscareai \
     needscareai
   ```

## Troubleshooting

### Check Container Logs
```bash
docker logs needscareai
```

### Common Startup Issues
1. **Database Connection Failed**: Verify DATABASE_URL is correct and database is accessible
2. **Session Secret Missing**: Ensure SESSION_SECRET is set and has sufficient entropy
3. **Email Service Errors**: Check GMAIL_EMAIL and GMAIL_APP_PASSWORD are valid
4. **import.meta.dirname Error on Linux Servers**: Use the production-start.js script (already configured in Dockerfile)

### Linux Server Specific Issues
If you get `TypeError [ERR_INVALID_ARG_TYPE]: The "paths[0]" argument must be of type string. Received undefined`:

1. **Check startup logs**: `docker logs needscareai` should show polyfill messages
2. **Run debug script**: `./docker-debug.sh` for detailed diagnostics  
3. **Verify Node.js version**: Container should use Node.js 20+

### Health Check
The application includes a health check endpoint:
```bash
curl http://localhost:5000/api/health
```

## Environment Variable Examples

### Development Database
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/needscareai_dev
```

### Production Database
```
DATABASE_URL=postgresql://username:password@production-host:5432/needscareai_prod
```

### Session Secret Generation
```bash
# Generate secure session secret
openssl rand -base64 32
```

## Security Notes
- Never commit actual environment values to version control
- Use strong, unique passwords for database connections
- Rotate session secrets regularly in production
- Use Gmail App Passwords, not regular passwords