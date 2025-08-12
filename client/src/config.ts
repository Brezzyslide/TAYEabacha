// Frontend environment configuration validation
// Only VITE_ prefixed variables are available in the frontend

const requiredEnvVars = {
  VITE_APP_API_URL: import.meta.env.VITE_APP_API_URL,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
} as const;

// Validate environment variables on app startup
const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key, _]) => key);

if (missingVars.length > 0 && import.meta.env.PROD) {
  console.error('[FRONTEND CONFIG] Missing required environment variables:', missingVars);
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

if (missingVars.length > 0) {
  console.warn('[FRONTEND CONFIG] Development mode: Missing environment variables:', missingVars);
}

export const frontendConfig = {
  apiUrl: requiredEnvVars.VITE_APP_API_URL || 'http://localhost:5000',
  supabase: {
    url: requiredEnvVars.VITE_SUPABASE_URL || '',
    anonKey: requiredEnvVars.VITE_SUPABASE_ANON_KEY || '',
  },
  stripe: {
    publishableKey: requiredEnvVars.VITE_STRIPE_PUBLISHABLE_KEY || '',
  },
} as const;

console.log('[FRONTEND CONFIG] Environment validated:', {
  apiUrl: frontendConfig.apiUrl,
  hasSupabase: !!frontendConfig.supabase.url,
  hasStripe: !!frontendConfig.stripe.publishableKey,
});