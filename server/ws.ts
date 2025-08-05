import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  tenantId?: number;
  isAlive?: boolean;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();

  init(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      verifyClient: (info) => {
        // Basic verification - you can enhance this with session validation
        return true;
      }
    });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
      console.log('[WS] New WebSocket connection established');
      
      ws.isAlive = true;
      
      // Generate a unique client ID
      const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.clients.set(clientId, ws);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Handle authentication
          if (message.type === 'auth' && message.userId && message.tenantId) {
            ws.userId = message.userId;
            ws.tenantId = message.tenantId;
            console.log(`[WS] Client ${clientId} authenticated: User ${message.userId}, Tenant ${message.tenantId}`);
            
            ws.send(JSON.stringify({
              type: 'auth_success',
              clientId
            }));
          }
          
          // Handle ping/pong for connection health
          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (error) {
          console.error('[WS] Error parsing message:', error);
        }
      });

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('close', () => {
        console.log(`[WS] Client ${clientId} disconnected`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`[WS] Client ${clientId} error:`, error);
        this.clients.delete(clientId);
      });

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      }));
    });

    // Ping clients every 30 seconds to check connection health
    const pingInterval = setInterval(() => {
      this.clients.forEach((ws, clientId) => {
        if (!ws.isAlive) {
          console.log(`[WS] Terminating dead connection: ${clientId}`);
          ws.terminate();
          this.clients.delete(clientId);
          return;
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(pingInterval);
    });

    console.log('[WS] WebSocket server initialized');
  }

  // Broadcast update to specific tenant
  broadcastToTenant(tenantId: number, data: any) {
    const message = JSON.stringify({
      ...data,
      timestamp: new Date().toISOString()
    });

    this.clients.forEach((ws, clientId) => {
      if (ws.tenantId === tenantId && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
          console.log(`[WS] Broadcasted to tenant ${tenantId}, client ${clientId}:`, data.type);
        } catch (error) {
          console.error(`[WS] Failed to send to client ${clientId}:`, error);
        }
      }
    });
  }

  // Broadcast update to all clients
  broadcastToAll(data: any) {
    const message = JSON.stringify({
      ...data,
      timestamp: new Date().toISOString()
    });

    this.clients.forEach((ws, clientId) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (error) {
          console.error(`[WS] Failed to send to client ${clientId}:`, error);
        }
      }
    });
  }

  getConnectedClients(): number {
    return this.clients.size;
  }
}

export const wsManager = new WebSocketManager();