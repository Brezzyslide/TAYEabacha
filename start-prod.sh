#!/bin/bash

# Phase 4 Production Start Script

echo "🚀 Starting CareConnect in Production Mode"

# Verify build exists
if [ ! -f "backend/dist/server.js" ]; then
    echo "❌ Backend build not found. Run ./build.sh first."
    exit 1
fi

if [ ! -d "dist/public" ]; then
    echo "❌ Frontend build not found. Run ./build.sh first."
    exit 1
fi

echo "✅ Build verification passed"

# Set production environment
export NODE_ENV=production

# Start the production server
echo "🎯 Starting production server on port ${PORT:-5000}..."
node backend/dist/server.js