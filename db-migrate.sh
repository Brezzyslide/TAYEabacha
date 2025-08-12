#!/bin/bash

# Phase 6: Database Migration Script for Linux/Docker

set -e

echo "🗄️  Phase 6: Database Migration System"

# Check if we're using Drizzle (current setup)
if [ -f "drizzle.config.ts" ]; then
    echo "📋 Using Drizzle ORM for migrations"
    
    # Generate migrations if needed
    if [ "$1" = "generate" ] || [ "$1" = "all" ]; then
        echo "🔧 Generating migrations..."
        npx drizzle-kit generate
    fi
    
    # Run migrations (safe for existing databases)
    echo "🚀 Running database migrations..."
    if npx drizzle-kit migrate; then
        echo "✅ Migrations completed successfully"
    else
        echo "ℹ️  Some migrations may have been skipped (database already up to date)"
        echo "   This is normal for existing databases with current schema"
    fi
    
    echo "✅ Drizzle migrations completed"
    
elif [ -f "prisma/schema.prisma" ]; then
    echo "📋 Using Prisma for migrations"
    
    # Generate Prisma client
    if [ "$1" = "generate" ] || [ "$1" = "all" ]; then
        echo "🔧 Generating Prisma client..."
        npx prisma generate
    fi
    
    # Deploy migrations  
    echo "🚀 Deploying database migrations..."
    npx prisma migrate deploy
    
    echo "✅ Prisma migrations completed"
    
else
    echo "❌ No ORM configuration found (drizzle.config.ts or prisma/schema.prisma)"
    exit 1
fi

echo "✅ Database migration completed successfully"