#!/usr/bin/env node

// Production startup script with comprehensive import.meta.dirname support
// This ensures compatibility across all Linux server environments

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Ensure import.meta.dirname is available before loading the main application  
console.log('[STARTUP] Checking import.meta.dirname availability...');

if (typeof import.meta.dirname === 'undefined') {
  console.log('[STARTUP] Adding import.meta.dirname polyfill');
  
  // Add polyfill to import.meta
  Object.defineProperty(import.meta, 'dirname', {
    get() {
      const __filename = fileURLToPath(import.meta.url);
      return path.dirname(__filename);
    },
    configurable: true,
    enumerable: true
  });
  
  console.log('[STARTUP] Polyfill added successfully');
} else {
  console.log('[STARTUP] import.meta.dirname already available');
}

// Verify the polyfill works
try {
  const testPath = import.meta.dirname;
  console.log('[STARTUP] import.meta.dirname test:', testPath);
  
  if (!testPath || testPath === 'undefined') {
    throw new Error('import.meta.dirname is still undefined after polyfill');
  }
} catch (error) {
  console.error('[STARTUP] Failed to setup import.meta.dirname:', error);
  process.exit(1);
}

// Load the main application
console.log('[STARTUP] Loading main application...');
try {
  // Dynamic import the built application
  await import('./dist/index.js');
} catch (error) {
  console.error('[STARTUP] Failed to load main application:', error);
  console.error('[STARTUP] Stack trace:', error.stack);
  process.exit(1);
}