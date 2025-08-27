/**
 * Environment Sanity Check
 * Validates and logs environment variables to prevent configuration errors
 * Particularly important to verify AWS DB connection vs old Replit DB
 */

export interface EnvironmentConfig {
  DATABASE_URL: string;
  JWT_SECRET: string;
  PASSWORD_PEPPER: string;
  SESSION_SECRET: string;
  NODE_ENV: string;
  GMAIL_EMAIL?: string;
  GMAIL_APP_PASSWORD?: string;
}

/**
 * Safely logs first few characters of a secret for verification
 */
function logSecretPrefix(name: string, secret: string | undefined, prefixLength: number = 8): void {
  if (!secret) {
    console.log(`❌ [ENV] ${name}: NOT SET`);
    return;
  }
  
  const prefix = secret.substring(0, prefixLength);
  const maskedLength = secret.length - prefixLength;
  console.log(`✅ [ENV] ${name}: ${prefix}${'*'.repeat(Math.min(maskedLength, 20))} (length: ${secret.length})`);
}

/**
 * Performs environment sanity check and returns validated config
 */
export function performEnvironmentSanityCheck(): EnvironmentConfig {
  console.log('\n🔍 [ENV] Starting Environment Sanity Check...');
  console.log('================================================');
  
  // Critical secrets that must be present
  const DATABASE_URL = process.env.DATABASE_URL;
  const JWT_SECRET = process.env.JWT_SECRET;
  const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER;
  const SESSION_SECRET = process.env.SESSION_SECRET;
  const NODE_ENV = process.env.NODE_ENV || 'development';
  
  // Optional secrets
  const GMAIL_EMAIL = process.env.GMAIL_EMAIL;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
  
  // Log all secrets with prefixes for verification
  logSecretPrefix('DATABASE_URL', DATABASE_URL, 12);
  logSecretPrefix('JWT_SECRET', JWT_SECRET);
  logSecretPrefix('PASSWORD_PEPPER', PASSWORD_PEPPER);
  logSecretPrefix('SESSION_SECRET', SESSION_SECRET);
  logSecretPrefix('GMAIL_EMAIL', GMAIL_EMAIL, 10);
  logSecretPrefix('GMAIL_APP_PASSWORD', GMAIL_APP_PASSWORD);
  
  console.log(`✅ [ENV] NODE_ENV: ${NODE_ENV}`);
  
  // Validate critical secrets
  const missingSecrets: string[] = [];
  
  if (!DATABASE_URL) missingSecrets.push('DATABASE_URL');
  if (!JWT_SECRET) missingSecrets.push('JWT_SECRET');
  if (!PASSWORD_PEPPER) missingSecrets.push('PASSWORD_PEPPER');
  if (!SESSION_SECRET) missingSecrets.push('SESSION_SECRET');
  
  if (missingSecrets.length > 0) {
    console.log('\n❌ [ENV] CRITICAL: Missing required environment variables:');
    missingSecrets.forEach(secret => console.log(`   - ${secret}`));
    throw new Error(`Missing required environment variables: ${missingSecrets.join(', ')}`);
  }
  
  // Database connection validation
  if (DATABASE_URL) {
    console.log('\n🔗 [ENV] Database Connection Analysis:');
    
    // Check if using AWS RDS (expected)
    if (DATABASE_URL.includes('amazonaws.com') || DATABASE_URL.includes('rds')) {
      console.log('✅ [ENV] Using AWS RDS database (CORRECT)');
    } else if (DATABASE_URL.includes('replit') || DATABASE_URL.includes('neon')) {
      console.log('⚠️  [ENV] Using Replit/Neon database - verify this is intentional');
    } else if (DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')) {
      console.log('🔧 [ENV] Using local database (development)');
    } else {
      console.log('❓ [ENV] Unknown database provider - please verify');
    }
    
    // Extract and log database host for verification
    try {
      const url = new URL(DATABASE_URL);
      console.log(`🏠 [ENV] Database Host: ${url.hostname}`);
      console.log(`🔌 [ENV] Database Port: ${url.port || '5432'}`);
      console.log(`📄 [ENV] Database Name: ${url.pathname.replace('/', '')}`);
    } catch (error) {
      console.log('❌ [ENV] Invalid DATABASE_URL format');
    }
  }
  
  console.log('\n✅ [ENV] Environment sanity check completed successfully');
  console.log('================================================\n');
  
  return {
    DATABASE_URL: DATABASE_URL!,
    JWT_SECRET: JWT_SECRET!,
    PASSWORD_PEPPER: PASSWORD_PEPPER!,
    SESSION_SECRET: SESSION_SECRET!,
    NODE_ENV,
    GMAIL_EMAIL,
    GMAIL_APP_PASSWORD
  };
}

/**
 * Quick environment check for runtime validation
 */
export function quickEnvironmentCheck(): boolean {
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'PASSWORD_PEPPER', 'SESSION_SECRET'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.log(`❌ [ENV] Missing environment variables: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
}

// Export the validated environment configuration
export const env = performEnvironmentSanityCheck();