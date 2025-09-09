import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: any,
  tz?: string
): Promise<any> {
  // Handle base URL for different environments
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  // Add timezone header if provided
  if (tz) {
    headers["X-Timezone"] = tz;
  }
  
  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    // Try to get error message from response
    let errorMessage = `${res.status}: ${res.statusText}`;
    try {
      const errorData = await res.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      // If response is not JSON, use the status text
      const text = await res.text();
      errorMessage = text || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  // Handle 204 No Content responses (common for DELETE requests)
  if (res.status === 204) {
    return { success: true };
  }

  // Handle responses with no content
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return { success: true };
  }
  
  return res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Handle base URL for different environments
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const url = queryKey[0] as string;
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }), // Don't throw on 401, handle gracefully
      refetchInterval: false,
      refetchOnWindowFocus: true,  // Refresh when user returns to tab
      staleTime: 30000,            // 30 seconds staleness
      retry: (failureCount, error: any) => {
        // Don't retry on auth errors
        if (error?.message?.includes('401') || error?.message?.includes('403')) {
          return false;
        }
        return failureCount < 2; // Retry up to 2 times for other errors
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Don't retry auth errors or validation errors
        if (error?.message?.includes('401') || error?.message?.includes('403') || error?.message?.includes('400')) {
          return false;
        }
        return failureCount < 1; // Retry once for other errors
      },
    },
  },
});
