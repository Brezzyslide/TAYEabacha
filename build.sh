#!/bin/bash

# Phase 4 Build Script: Build once, serve correctly

set -e

echo "🚀 Phase 4: Building frontend and backend separately"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/public backend/dist

# Build frontend
echo "📦 Building frontend..."
npx vite build --mode production

# Build backend using esbuild (matches current working approach)
echo "🔧 Building backend..."
mkdir -p backend/dist

# Use esbuild to bundle the backend (keeping the working approach)
npx esbuild backend/src/server.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outfile=backend/dist/server.js \
  --target=node20 \
  --minify=false

echo "✅ Build completed successfully!"

# Verify builds exist
if [ -d "dist/public" ] && [ -f "backend/dist/server.js" ]; then
    echo "📊 Build verification:"
    echo "   Frontend: $(du -sh dist/public | cut -f1)"
    echo "   Backend: $(du -sh backend/dist/server.js | cut -f1)"
    echo ""
    echo "🎯 Ready for production deployment:"
    echo "   Frontend: dist/public/ (static files)"
    echo "   Backend: backend/dist/server.js"
    echo ""
    echo "▶️  Start production server:"
    echo "   NODE_ENV=production node backend/dist/server.js"
else
    echo "❌ Build verification failed!"
    exit 1
fi