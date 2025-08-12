import { randomUUID } from 'crypto';

// Structured JSON logging with request/tenant IDs
export interface LogContext {
  requestId?: string;
  tenantId?: number;
  userId?: number;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production';

  log(level: LogContext['level'], message: string, context: Partial<LogContext> = {}) {
    const logEntry: LogContext = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...context
    };

    if (this.isProduction) {
      // Production: Structured JSON logging
      console.log(JSON.stringify(logEntry));
    } else {
      // Development: Human-readable format
      const prefix = `[${level.toUpperCase()}]`;
      const requestInfo = context.requestId ? ` [${context.requestId}]` : '';
      const tenantInfo = context.tenantId ? ` [T:${context.tenantId}]` : '';
      console.log(`${prefix}${requestInfo}${tenantInfo} ${message}`);
    }
  }

  info(message: string, context?: Partial<LogContext>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Partial<LogContext>) {
    this.log('warn', message, context);
  }

  error(message: string, context?: Partial<LogContext>) {
    this.log('error', message, context);
  }

  debug(message: string, context?: Partial<LogContext>) {
    this.log('debug', message, context);
  }
}

export const logger = new Logger();

// Middleware to add request ID and logging context
export function requestLoggingMiddleware(req: any, res: any, next: any) {
  req.requestId = randomUUID();
  req.startTime = Date.now();
  
  // Extract tenant info from authenticated user
  const user = req.user;
  const context = {
    requestId: req.requestId,
    tenantId: user?.tenantId,
    userId: user?.id,
    userAgent: req.get('User-Agent'),
    method: req.method,
    path: req.path
  };

  // Log incoming request
  logger.info(`${req.method} ${req.path}`, context);

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.info(`${req.method} ${req.path} ${res.statusCode}`, {
      ...context,
      statusCode: res.statusCode,
      duration
    });
  });

  next();
}