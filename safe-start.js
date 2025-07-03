#!/usr/bin/env node

/**
 * SAFE STARTUP WRAPPER FOR NEEDSCAREAI+
 * Handles undefined environment variables and path resolution issues
 * Use this instead of direct Node.js execution to prevent crashes
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Validate critical environment variables before startup
const requiredEnvVars = ['DATABASE_URL'];
const missingVars = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
  }
}

if (missingVars.length > 0) {
  console.error('❌ STARTUP FAILED: Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n💡 Set these variables before starting the application:');
  console.error('   export DATABASE_URL="postgresql://user:pass@host:port/db"');
  process.exit(1);
}

// Set safe defaults for optional environment variables
const safeDefaults = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '5000',
  SESSION_SECRET: process.env.SESSION_SECRET || 'fallback-session-secret-please-change-in-production',
  DISABLE_COMPOSITE_FK: process.env.DISABLE_COMPOSITE_FK || 'false'
};

// Apply safe defaults
Object.entries(safeDefaults).forEach(([key, value]) => {
  if (!process.env[key]) {
    process.env[key] = value;
    console.log(`🔧 Set default ${key}=${value}`);
  }
});

// Determine the correct entry point
let entryPoint = 'dist/index.js';
const possibleEntryPoints = [
  'dist/index.js',        // Production build
  'server/index.ts',      // Development with ts-node
  'server/index.js'       // Compiled development
];

for (const entry of possibleEntryPoints) {
  if (fs.existsSync(entry)) {
    entryPoint = entry;
    break;
  }
}

console.log(`🚀 Starting NeedsCareAI+ with entry point: ${entryPoint}`);
console.log(`📍 Working directory: ${process.cwd()}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);

// Determine Node.js execution command
const isTypeScript = entryPoint.endsWith('.ts');
const nodeCmd = isTypeScript ? 'tsx' : 'node';
const nodeArgs = isTypeScript ? [entryPoint] : ['--experimental-modules', entryPoint];

// Start the application with error handling
const childProcess = spawn(nodeCmd, nodeArgs, {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd()
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Graceful shutdown initiated...');
  childProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Termination signal received...');
  childProcess.kill('SIGTERM');
});

// Handle child process exit
childProcess.on('exit', (code, signal) => {
  if (code === 0) {
    console.log('✅ Application exited successfully');
  } else if (signal) {
    console.log(`🛑 Application terminated by signal: ${signal}`);
  } else {
    console.error(`❌ Application exited with code: ${code}`);
    
    // Provide helpful error guidance
    if (code === 1) {
      console.error('\n💡 Common fixes for exit code 1:');
      console.error('   1. Check DATABASE_URL is correct and database is accessible');
      console.error('   2. Verify all required environment variables are set');
      console.error('   3. Ensure file paths are correct for your deployment environment');
      console.error('   4. Try: export DISABLE_COMPOSITE_FK=true');
    }
  }
  process.exit(code);
});

childProcess.on('error', (error) => {
  console.error('❌ Failed to start application:', error.message);
  
  if (error.code === 'ENOENT') {
    console.error('\n💡 Node.js or tsx not found. Try:');
    console.error('   npm install -g tsx  # For TypeScript execution');
    console.error('   node --version      # Verify Node.js installation');
  }
  
  process.exit(1);
});