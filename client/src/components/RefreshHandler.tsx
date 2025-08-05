import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

export function RefreshHandler() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Don't show confirmation dialog for normal navigation
      // Just ensure we don't lose session
      if (user) {
        // Store a flag to indicate intentional navigation
        sessionStorage.setItem('intentional_navigation', 'true');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // When user returns to tab, refresh critical data
        queryClient.invalidateQueries({ 
          queryKey: ['/api/incident-reports'],
          exact: false 
        });
        
        queryClient.invalidateQueries({ 
          queryKey: ['/api/notifications'], 
          exact: false 
        });

        console.log('[REFRESH HANDLER] Page became visible, refreshed critical data');
      }
    };

    const handleOnline = () => {
      if (user) {
        // When coming back online, refresh all data
        queryClient.invalidateQueries();
        console.log('[REFRESH HANDLER] Came back online, refreshed all data');
      }
    };

    const handleFocus = () => {
      // Clear any stale cache when window regains focus
      if (user) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/auth/user'],
          exact: false 
        });
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
    };
  }, [queryClient, user]);

  return null; // This component doesn't render anything
}