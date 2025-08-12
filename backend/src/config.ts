import { z } from "zod";

// Flexible configuration schema for development/production
const isProduction = process.env.NODE_ENV === 'production';

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("5000"),
  APP_BASE_URL: z.string().default("http://localhost:5000"),
  CORS_ORIGINS: z.string().optional(), // comma-separated
  DATABASE_URL: z.string(),
  // Optional fields for development, required for production
  SUPABASE_URL: isProduction ? z.string().url() : z.string().optional(),
  SUPABASE_KEY: isProduction ? z.string() : z.string().optional(),
  JWT_ISSUER: isProduction ? z.string() : z.string().optional(),
  JWT_AUDIENCE: isProduction ? z.string() : z.string().optional(),
  STRIPE_SECRET_KEY: isProduction ? z.string() : z.string().optional(),
  STRIPE_WEBHOOK_SECRET: isProduction ? z.string() : z.string().optional(),
  EMAIL_SMTP_HOST: isProduction ? z.string() : z.string().optional(),
  EMAIL_SMTP_USER: isProduction ? z.string() : z.string().optional(),
  EMAIL_SMTP_PASS: isProduction ? z.string() : z.string().optional(),
  TZ: z.string().default("Australia/Melbourne"),
});

// Parse and validate environment variables on boot
export const cfg = schema.parse(process.env);

console.log(`[CONFIG] Environment: ${cfg.NODE_ENV}`);
console.log(`[CONFIG] Port: ${cfg.PORT}`);
console.log(`[CONFIG] Base URL: ${cfg.APP_BASE_URL}`);
console.log(`[CONFIG] Timezone: ${cfg.TZ}`);
console.log(`[CONFIG] Database: ${cfg.DATABASE_URL ? 'Connected' : 'Missing'}`);
console.log(`[CONFIG] All required environment variables validated ✓`);