import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getConfig } from '@/lib/productionConfig';

export function useProductionOptimizations() {
  const queryClient = useQueryClient();
  const config = getConfig();

  useEffect(() => {
    // Set up cache garbage collection
    const garbageCollectInterval = setInterval(() => {
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();
      
      if (queries.length > config.CACHE.MAX_CACHE_SIZE) {
        console.log(`[CACHE GC] Cleaning up cache, ${queries.length} queries cached`);
        
        // Remove stale queries older than 10 minutes
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        let removedCount = 0;
        
        queries.forEach(query => {
          if (query.state.dataUpdatedAt < tenMinutesAgo && query.getObserversCount() === 0) {
            queryClient.removeQueries({ queryKey: query.queryKey });
            removedCount++;
          }
        });
        
        console.log(`[CACHE GC] Removed ${removedCount} stale queries`);
      }
    }, config.CACHE.GARBAGE_COLLECT_INTERVAL);

    // Monitor network status
    const handleOnline = () => {
      console.log('[NETWORK] Came back online, invalidating queries');
      queryClient.invalidateQueries();
    };

    const handleOffline = () => {
      console.log('[NETWORK] Went offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(garbageCollectInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient, config]);

  return {
    clearCache: () => {
      console.log('[MANUAL] Clearing all query cache');
      queryClient.clear();
    },
    invalidateAll: () => {
      console.log('[MANUAL] Invalidating all queries');
      queryClient.invalidateQueries();
    }
  };
}