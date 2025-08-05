// Polyfill for import.meta.dirname in production environments
// This runs before the main application and ensures import.meta.dirname is available

import { fileURLToPath } from 'url';
import path from 'path';

// Only add polyfill if import.meta.dirname is not available
if (typeof import.meta.dirname === 'undefined') {
  console.log('[POLYFILL] Adding import.meta.dirname polyfill for production environment');
  
  // Create a getter that returns the correct dirname
  Object.defineProperty(import.meta, 'dirname', {
    get() {
      const __filename = fileURLToPath(import.meta.url);
      return path.dirname(__filename);
    },
    configurable: true
  });
} else {
  console.log('[POLYFILL] import.meta.dirname already available, skipping polyfill');
}