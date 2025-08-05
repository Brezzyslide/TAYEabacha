import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UseAutoRefreshOptions {
  queryKeys: string[];
  interval?: number; // in milliseconds, default 30 seconds
  enabled?: boolean;
}

export function useAutoRefresh({ 
  queryKeys, 
  interval = 30000, 
  enabled = true 
}: UseAutoRefreshOptions) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const refreshData = () => {
      // Only invalidate if user is still authenticated
      const authData = queryClient.getQueryData(['/api/auth/user']);
      if (authData) {
        queryKeys.forEach(queryKey => {
          queryClient.invalidateQueries({ 
            queryKey: [queryKey],
            exact: false 
          });
        });
      }
    };

    // Set up interval for auto-refresh
    intervalRef.current = setInterval(refreshData, interval);

    // Cleanup on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [queryClient, queryKeys, interval, enabled]);

  // Manual refresh function
  const manualRefresh = () => {
    queryKeys.forEach(queryKey => {
      queryClient.invalidateQueries({ 
        queryKey: [queryKey],
        exact: false 
      });
    });
  };

  return { manualRefresh };
}