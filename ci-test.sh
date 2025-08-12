#!/bin/bash

# Phase 7: Local CI testing script

set -e

echo "🧪 Phase 7: Running CI tests locally"

echo "1️⃣ Testing build process..."
./build.sh

echo "2️⃣ Testing migration system..."
./test-migration-system.sh

echo "3️⃣ Testing Docker build..."
docker build -t careconnect:ci-test .

echo "4️⃣ Testing Docker Compose..."
docker-compose -f docker-compose.ci.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Test health endpoint
echo "🔍 Testing health endpoint..."
if curl -f http://localhost:5000/health; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    docker-compose -f docker-compose.ci.yml logs app
fi

# Cleanup
echo "🧹 Cleaning up..."
docker-compose -f docker-compose.ci.yml down
docker rmi careconnect:ci-test || true

echo "✅ Phase 7 CI test completed"