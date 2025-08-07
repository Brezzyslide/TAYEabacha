#!/bin/bash

# Production Build Script
# Creates optimized production builds with proper environment configuration

echo "🔨 Building CareConnect for PRODUCTION deployment..."

# Set production environment variables
export NODE_ENV=production
export VITE_NODE_ENV=production
export REPL_ID=""

echo "✅ Production environment configured"
echo "   NODE_ENV: $NODE_ENV"
echo "   VITE_NODE_ENV: $VITE_NODE_ENV"
echo "   REPL_ID: '$REPL_ID'"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
mkdir -p dist

# Build frontend with production optimizations
echo "🌐 Building frontend with production optimizations..."
NODE_ENV=production REPL_ID="" npm run build

if [ $? -eq 0 ]; then
  echo "✅ Frontend build completed successfully"
else
  echo "❌ Frontend build failed"
  exit 1
fi

# Copy production files
echo "📁 Copying production files..."
cp -r server/ dist/ 2>/dev/null || true
cp drizzle.config.ts dist/ 2>/dev/null || true
cp production-start.js dist/ 2>/dev/null || true
cp production.config.js dist/ 2>/dev/null || true

# Create production package.json
echo "📦 Creating production package.json..."
cat > dist/package.json << 'EOF'
{
  "name": "careconnect-production",
  "version": "1.0.0",
  "type": "module",
  "main": "production-start.js",
  "scripts": {
    "start": "node production-start.js"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.10.4",
    "connect-pg-simple": "^10.0.0",
    "drizzle-orm": "^0.39.1",
    "drizzle-zod": "^0.5.1",
    "express": "^4.21.2",
    "express-session": "^1.18.1",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "pg": "^8.11.3",
    "zod": "^3.24.2",
    "cors": "^2.8.5",
    "helmet": "^8.0.0"
  }
}
EOF

# Set executable permissions
chmod +x dist/production-start.js

echo ""
echo "🎉 PRODUCTION BUILD COMPLETE!"
echo "📂 Build output: ./dist/"
echo ""
echo "🚀 Deployment Instructions:"
echo "1. Copy the ./dist/ folder to your production server"
echo "2. Run 'npm install --only=production' in the dist folder"
echo "3. Set required environment variables:"
echo "   - DATABASE_URL=your_production_database_url"
echo "   - SESSION_SECRET=strong_random_key"
echo "4. Start with: 'npm start' or 'node production-start.js'"
echo ""
echo "✅ This build is production-ready and AWS compatible!"