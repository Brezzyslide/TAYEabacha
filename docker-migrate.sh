#!/bin/bash

# Phase 6: Docker-safe migration script for Linux deployment

set -e

echo "🐳 Docker-safe database migration for Linux deployment"

# Wait for database to be ready (important for Docker containers)
echo "⏳ Waiting for database connection..."
for i in {1..30}; do
    if node -e "
        import { Pool } from 'pg';
        const pool = new Pool({ 
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' 
                ? { rejectUnauthorized: true } 
                : { rejectUnauthorized: false }
        });
        pool.query('SELECT 1').then(() => {
            console.log('Database ready'); 
            process.exit(0);
        }).catch(() => process.exit(1));
    " 2>/dev/null; then
        echo "✅ Database connection established"
        break
    fi
    
    echo "Database not ready, waiting... ($i/30)"
    sleep 2
done

# Run migrations
echo "🚀 Running database migrations in Docker environment..."
./db-migrate.sh

# Verify migration success
echo "🔍 Verifying migration success..."
node -e "
    import { Pool } from 'pg';
    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' 
            ? { rejectUnauthorized: true } 
            : { rejectUnauthorized: false }
    });
    
    pool.query(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'\")
        .then(result => {
            console.log(\`✅ Found \${result.rows.length} tables in database\`);
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Migration verification failed:', err);
            process.exit(1);
        });
"

echo "✅ Docker database migration completed successfully"