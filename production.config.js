// Production Configuration Module
// This file defines production-safe settings and environment handling

export const productionConfig = {
  // Environment settings
  environment: {
    NODE_ENV: 'production',
    VITE_NODE_ENV: 'production',
    REPL_ID: '', // Disable Replit plugins
  },
  
  // Server configuration
  server: {
    port: process.env.PORT || 5000,
    host: '0.0.0.0', // Allow external connections
  },
  
  // Security settings
  security: {
    enableCors: true,
    enableHelmet: true,
    enableRateLimit: true,
    trustProxy: true,
  },
  
  // Database settings
  database: {
    ssl: true, // Enable SSL in production
    poolSize: 10,
    connectionTimeout: 30000,
  },
  
  // Logging configuration
  logging: {
    level: 'warn', // Reduce log verbosity in production
    enableConsole: true,
    enableFile: false,
  },
  
  // Build optimization
  build: {
    minify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  }
};

export default productionConfig;