#!/usr/bin/env node

// Production Start Script
// Handles production environment setup and server startup

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set production environment variables
process.env.NODE_ENV = 'production';
process.env.VITE_NODE_ENV = 'production';
process.env.REPL_ID = ''; // Disable Replit plugins

console.log('🚀 Starting CareConnect in PRODUCTION mode...');
console.log('📊 Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  VITE_NODE_ENV: process.env.VITE_NODE_ENV,
  REPL_ID: process.env.REPL_ID || 'undefined',
  PORT: process.env.PORT || '5000'
});

// Production safety checks
const requiredEnvVars = ['DATABASE_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  console.error('Please set these variables before starting the server.');
  process.exit(1);
}

// Add import.meta.dirname polyfill for production environments
if (!import.meta.dirname) {
  import.meta.dirname = __dirname;
}

// Start the server
try {
  console.log('🔧 Loading server modules...');
  await import('./dist/index.js');
  console.log('✅ Server started successfully in production mode');
} catch (error) {
  console.error('❌ Failed to start server:', error);
  
  // Provide helpful debugging information
  if (error.message.includes('import.meta.dirname')) {
    console.error('🔍 Path resolution issue detected. This is common in production.');
    console.error('💡 The server includes a polyfill to handle this.');
  }
  
  if (error.message.includes('runtime-error-plugin')) {
    console.error('🔍 Vite plugin issue detected.');
    console.error('💡 Make sure REPL_ID="" is set to disable development plugins.');
  }
  
  process.exit(1);
}