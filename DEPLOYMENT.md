# Deployment Guide

## Quick Deploy Options

### Option 1: Vercel (Recommended)
1. Fork this repository to your GitHub account
2. Connect your GitHub account to Vercel
3. Import the project and configure environment variables:
   ```
   DATABASE_URL=your_postgresql_url
   SESSION_SECRET=your_secure_random_string
   ```
4. Deploy automatically

### Option 2: Railway
1. Connect Railway to your GitHub repository
2. Add environment variables in Railway dashboard
3. Deploy with one click

### Option 3: Render
1. Connect to GitHub repository
2. Set build command: `npm install && npm run build`
3. Set start command: `npm start`
4. Add environment variables

## Environment Variables Required

```bash
# Database (Required)
DATABASE_URL=postgresql://user:password@host:port/database

# Session Security (Required)
SESSION_SECRET=your-super-secure-random-string-at-least-32-characters

# Optional
NODE_ENV=production
PORT=5000
```

## Database Setup

### Using Neon (Recommended)
1. Create account at neon.tech
2. Create new project
3. Copy connection string to DATABASE_URL
4. Run `npm run db:push` to create tables

### Using Supabase
1. Create project at supabase.com
2. Get PostgreSQL connection string
3. Use as DATABASE_URL
4. Push schema with `npm run db:push`

## Pre-deployment Checklist

- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] Session secret generated (32+ characters)
- [ ] Build process tested locally
- [ ] HTTPS enabled for production

## Production Considerations

### Security
- Use HTTPS in production
- Set secure session configuration
- Implement rate limiting
- Regular security updates

### Performance
- Database connection pooling
- Static asset caching
- CDN for static files
- Database indexing optimization

### Monitoring
- Application logging
- Error tracking
- Performance monitoring
- Database monitoring