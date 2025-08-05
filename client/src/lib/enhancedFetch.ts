import { getConfig } from './productionConfig';

const config = getConfig();

// Enhanced fetch with automatic retry and session handling
export async function enhancedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...options.headers,
    },
    ...options,
  };

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= config.NETWORK.RETRY_COUNT; attempt++) {
    try {
      console.log(`[ENHANCED FETCH] Attempt ${attempt}/${config.NETWORK.RETRY_COUNT}: ${options.method || 'GET'} ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.NETWORK.TIMEOUT);
      
      const response = await fetch(url, {
        ...defaultOptions,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // Handle different response statuses
      if (response.status === 401) {
        console.warn('[ENHANCED FETCH] Authentication required, but not auto-logging out');
        // Don't automatically redirect - let components handle auth state
        return response;
      }

      if (response.status === 403) {
        console.warn('[ENHANCED FETCH] Access forbidden');
        return response;
      }

      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      // Success or client error (4xx other than 401/403)
      console.log(`[ENHANCED FETCH] Success: ${response.status} ${response.statusText}`);
      return response;

    } catch (error: any) {
      lastError = error;
      console.error(`[ENHANCED FETCH] Attempt ${attempt} failed:`, error.message);

      // Don't retry on abort (timeout) or non-network errors for final attempt
      if (attempt === config.NETWORK.RETRY_COUNT) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = config.NETWORK.RETRY_DELAY * Math.pow(config.NETWORK.BACKOFF_MULTIPLIER, attempt - 1);
      console.log(`[ENHANCED FETCH] Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries failed
  console.error('[ENHANCED FETCH] All retries failed, throwing last error');
  throw lastError || new Error('Request failed after all retries');
}

// Enhanced apiRequest that preserves session
export async function enhancedApiRequest(method: string, url: string, data?: any): Promise<Response> {
  const options: RequestInit = {
    method: method.toUpperCase(),
  };

  if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
    options.body = JSON.stringify(data);
  }

  return enhancedFetch(url, options);
}