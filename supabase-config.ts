// Phase 6: Supabase Configuration for Linux/Docker deployment

// Note: This project uses Drizzle ORM with PostgreSQL, not Supabase client
// If migrating to Supabase, use the DATABASE_URL from Supabase project settings

export interface SupabaseConfig {
  databaseUrl: string;
  sslMode: 'require' | 'prefer' | 'disable';
  connectionPool: {
    max: number;
    idleTimeout: number;
    connectionTimeout: number;
  };
}

export const getSupabaseConfig = (): SupabaseConfig => {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for Supabase connection');
  }

  // For Supabase, SSL is always required in production
  const sslMode = process.env.NODE_ENV === 'production' ? 'require' : 'prefer';
  
  return {
    databaseUrl,
    sslMode,
    connectionPool: {
      max: 10,
      idleTimeout: 30000,
      connectionTimeout: 5000
    }
  };
};

// Instructions for Supabase integration:
// 1. Create Supabase project at https://supabase.com/dashboard/projects  
// 2. Go to Settings > Database > Connection pooling
// 3. Copy the "Connection string" URI under "Transaction pooler"
// 4. Replace [YOUR-PASSWORD] with your database password
// 5. Set as DATABASE_URL environment variable
// 6. SSL is enabled by default and required for production