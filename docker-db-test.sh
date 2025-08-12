#!/bin/bash

# Phase 6: Test database connectivity in Docker/Linux environment

set -e

echo "🐳 Testing database connectivity for Linux/Docker deployment"

# Test database connection
echo "🔗 Testing database connection..."
if [ -n "$DATABASE_URL" ]; then
    echo "Database URL configured: ${DATABASE_URL:0:20}..."
    
    # Test SSL connection (default for production)
    echo "🔒 Testing SSL connection..."
    node -e "
    import { neon } from '@neondatabase/serverless';
    const sql = neon(process.env.DATABASE_URL);
    
    sql\`SELECT 1 as test\`.then(() => {
        console.log('✅ SSL database connection successful');
        process.exit(0);
    }).catch((err) => {
        console.log('❌ SSL connection failed:', err.message);
        
        // Test without SSL if needed (not recommended for production)
        if (err.message.includes('SSL')) {
            console.log('⚠️  SSL connection failed, this may indicate SSL configuration issues');
            console.log('   For production, ensure your database provider supports SSL');
            console.log('   For development only, you may need to adjust SSL settings');
        }
        process.exit(1);
    });
    "
else
    echo "❌ DATABASE_URL not configured"
    exit 1
fi

echo "🗄️  Testing migration system..."
./db-migrate.sh

echo "✅ Database tests completed"