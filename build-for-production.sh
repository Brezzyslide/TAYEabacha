#!/bin/bash

# Production Build Script for AWS Deployment
# Fixes Vite runtime error plugin issues in production

echo "Building NeedsCareAI+ for production deployment..."

# Set environment variables to disable Replit plugins
export NODE_ENV=production
export VITE_NODE_ENV=production 
export REPL_ID=""

# Step 1: Build the client with production environment
echo "Step 1: Building client (disabling Replit plugins)..."
NODE_ENV=production REPL_ID="" npm run build

# Step 2: Copy SQL files to dist directory
echo "Step 2: Copying SQL files..."
mkdir -p dist/
cp server/simplified-composite-fk.sql dist/
echo "SQL files copied to dist/"

# Step 3: Create a production-ready package.json
echo "Step 3: Creating production package.json..."
cat > dist/package.json << 'EOF'
{
  "name": "needscare-ai-production",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "NODE_ENV=production node index.js"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.10.4",
    "connect-pg-simple": "^10.0.0",
    "drizzle-orm": "^0.39.1",
    "express": "^4.21.2",
    "express-session": "^1.18.1",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "pg": "^8.11.3",
    "zod": "^3.24.2"
  }
}
EOF

echo "Production build completed!"
echo "Files ready for deployment:"
echo "- dist/index.js (server)"
echo "- dist/public/ (client)"
echo "- dist/simplified-composite-fk.sql (database)"
echo "- dist/package.json (production dependencies)"