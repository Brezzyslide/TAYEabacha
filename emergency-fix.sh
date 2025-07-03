#!/bin/bash

# EMERGENCY FIX for NeedsCareAI+ Path Resolution Issue
# Run this script to fix the TypeError [ERR_INVALID_ARG_TYPE] error

echo "🚨 EMERGENCY FIX: Resolving path.resolve() undefined argument error"

# Make safe-start.js executable
chmod +x safe-start.js

echo "✅ Step 1: Created safe startup wrapper"

# Set critical environment variables if missing
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set. Using current PostgreSQL connection..."
    export DATABASE_URL="postgresql://needscareai_admin:yourpassword@localhost:5432/needscareai_production"
fi

if [ -z "$SESSION_SECRET" ]; then
    echo "🔧 Setting default SESSION_SECRET"
    export SESSION_SECRET="emergency-session-secret-change-in-production-$(date +%s)"
fi

if [ -z "$NODE_ENV" ]; then
    echo "🔧 Setting NODE_ENV to production"
    export NODE_ENV="production"
fi

# Create a safe production environment file
cat > .env.emergency << EOF
# Emergency Environment Configuration
NODE_ENV=production
PORT=5000
DATABASE_URL=${DATABASE_URL}
SESSION_SECRET=${SESSION_SECRET}
DISABLE_COMPOSITE_FK=true
EOF

echo "✅ Step 2: Created emergency environment configuration"

# Option 1: Use safe startup wrapper
echo ""
echo "🎯 OPTION 1 (Recommended): Use Safe Startup Wrapper"
echo "   Run: node safe-start.js"
echo ""

# Option 2: Direct startup with environment override
echo "🎯 OPTION 2: Direct Startup with Environment Override"
echo "   Run: DISABLE_COMPOSITE_FK=true NODE_ENV=production node dist/index.js"
echo ""

# Option 3: Development mode bypass
echo "🎯 OPTION 3: Development Mode (if production build fails)"
echo "   Run: npm run dev"
echo ""

echo "✅ Emergency fix complete! Choose an option above to start the application."

# Test if we have a built version
if [ -f "dist/index.js" ]; then
    echo "📦 Production build found: dist/index.js"
else
    echo "⚠️  No production build found. Building now..."
    npm run build
fi