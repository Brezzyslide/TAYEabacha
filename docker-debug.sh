#!/bin/bash

# Docker debugging script to identify the exact error on Linux servers

echo "=== Docker Build & Run Debug Script ==="
echo "Building Docker image..."

# Build with verbose output
docker build -t needscareai-debug . --no-cache 2>&1 | tee build.log

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Check build.log for details."
    exit 1
fi

echo "✅ Build successful. Starting container with debug output..."

# Run container with debug output and capture logs
docker run --rm -p 5000:5000 \
    -e DATABASE_URL="postgresql://test:test@host:5432/test" \
    -e SESSION_SECRET="debug-session-secret-for-testing-only" \
    -e GMAIL_EMAIL="test@example.com" \
    -e GMAIL_APP_PASSWORD="test-password" \
    --name needscareai-debug-container \
    needscareai-debug 2>&1 | tee runtime.log &

CONTAINER_PID=$!

# Wait for startup and test
sleep 10

echo "Testing health endpoint..."
curl -f http://localhost:5000/api/health 2>/dev/null && echo "✅ Health check passed" || echo "❌ Health check failed"

# Kill the container
kill $CONTAINER_PID 2>/dev/null || docker stop needscareai-debug-container 2>/dev/null

echo "=== Debug logs saved to build.log and runtime.log ==="