import { useEffect, useRef } from 'react';
import { useAuth } from './use-auth';

interface SessionStabilityOptions {
  onSessionLost?: () => void;
  refreshSessionInterval?: number; // in milliseconds, default 5 minutes
}

export function useSessionStability({ 
  onSessionLost, 
  refreshSessionInterval = 5 * 60 * 1000 // 5 minutes
}: SessionStabilityOptions = {}) {
  const { user, refetch: refetchAuth } = useAuth();
  const sessionCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const lastActivityTime = useRef(Date.now());

  // Update last activity time on user interactions
  const updateActivity = () => {
    lastActivityTime.current = Date.now();
  };

  // Check session validity
  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.warn('[SESSION] Session check failed:', response.status);
        if (onSessionLost) {
          onSessionLost();
        }
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('[SESSION] Session check error:', error);
      return false;
    }
  };

  // Refresh session without logout
  const refreshSession = async () => {
    try {
      // Make a lightweight request to keep session alive
      await fetch('/api/auth/user', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      console.log('[SESSION] Session refreshed successfully');
    } catch (error) {
      console.error('[SESSION] Failed to refresh session:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Add event listeners for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Set up periodic session refresh
    sessionCheckInterval.current = setInterval(async () => {
      const timeSinceActivity = Date.now() - lastActivityTime.current;
      
      // Only refresh if user has been active recently (within last 10 minutes)
      if (timeSinceActivity < 10 * 60 * 1000) {
        await refreshSession();
      }
    }, refreshSessionInterval);

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
      
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
        sessionCheckInterval.current = null;
      }
    };
  }, [user, refreshSessionInterval]);

  // Handle page visibility changes to refresh on focus
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && user) {
        // Refresh session when user returns to tab
        await refreshSession();
        // Optionally refetch auth data
        if (refetchAuth) {
          refetchAuth();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, refetchAuth]);

  return { 
    checkSession, 
    refreshSession,
    updateActivity 
  };
}