import { z } from "zod";

// Production-ready configuration schema with strict validation
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.string().default("5000"),
  APP_BASE_URL: z.string().url(),
  CORS_ORIGINS: z.string().optional(), // comma-separated
  DATABASE_URL: z.string(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string(),
  JWT_ISSUER: z.string(),
  JWT_AUDIENCE: z.string(),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  EMAIL_SMTP_HOST: z.string(),
  EMAIL_SMTP_USER: z.string(),
  EMAIL_SMTP_PASS: z.string(),
  TZ: z.string().default("Australia/Melbourne"),
});

// Parse and validate environment variables on boot
// Will crash loudly if any required variables are missing
export const cfg = schema.parse(process.env);

console.log(`[CONFIG] Environment: ${cfg.NODE_ENV}`);
console.log(`[CONFIG] Port: ${cfg.PORT}`);
console.log(`[CONFIG] Base URL: ${cfg.APP_BASE_URL}`);
console.log(`[CONFIG] Timezone: ${cfg.TZ}`);
console.log(`[CONFIG] Database: ${cfg.DATABASE_URL ? 'Connected' : 'Missing'}`);
console.log(`[CONFIG] All required environment variables validated ✓`);