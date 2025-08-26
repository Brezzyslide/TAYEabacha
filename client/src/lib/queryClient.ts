import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<any> {
  const { method = "GET", body, headers = {} } = options;
  
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
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
