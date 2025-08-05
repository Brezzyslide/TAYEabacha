import { fileURLToPath } from 'url';
import path from 'path';

// Compatibility layer for import.meta.dirname in different environments
export function getServerDirname(): string {
  try {
    // Try to use import.meta.dirname if available (Node.js 20.11+)
    if (import.meta.dirname) {
      return import.meta.dirname;
    }
  } catch (error) {
    // Fall back to compatible method
  }
  
  // Fallback for build environments or older Node.js versions
  try {
    const __filename = fileURLToPath(import.meta.url);
    return path.dirname(__filename);
  } catch (error) {
    // Last resort fallback for production builds
    return process.cwd();
  }
}

// Export a consistent dirname that works across environments
export const serverDirname = getServerDirname();