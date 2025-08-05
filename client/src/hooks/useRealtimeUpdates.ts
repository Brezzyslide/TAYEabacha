import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface RealtimeUpdateOptions {
  enabled?: boolean;
  onUpdate?: (data: any) => void;
}

export function useRealtimeUpdates({ 
  enabled = true, 
  onUpdate 
}: RealtimeUpdateOptions = {}) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('[REALTIME] Connected to WebSocket');
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different types of updates
          switch (data.type) {
            case 'incident_created':
            case 'incident_updated':
            case 'incident_closed':
              queryClient.invalidateQueries({ queryKey: ['/api/incident-reports'] });
              break;
            case 'client_created':
            case 'client_updated':
              queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
              break;
            case 'staff_created':
            case 'staff_updated':
              queryClient.invalidateQueries({ queryKey: ['/api/users'] });
              break;
            case 'notification_created':
              queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
              break;
            default:
              console.log('[REALTIME] Unknown update type:', data.type);
          }

          if (onUpdate) {
            onUpdate(data);
          }
        } catch (error) {
          console.error('[REALTIME] Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('[REALTIME] WebSocket connection closed');
        
        // Attempt to reconnect with exponential backoff
        if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // 1s, 2s, 4s, 8s, 16s
          reconnectAttempts.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`[REALTIME] Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})`);
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[REALTIME] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[REALTIME] Failed to create WebSocket connection:', error);
    }
  };

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [enabled]);

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  return { connect, disconnect };
}