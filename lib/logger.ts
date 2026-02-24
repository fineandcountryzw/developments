/**
 * Logger Configuration for Fine & Country Zimbabwe ERP
 * 
 * Provides structured logging that works in both browser and server environments.
 * Uses console-based logging with structured output for production compatibility.
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isServer = typeof window === 'undefined';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMeta {
  module?: string;
  action?: string;
  [key: string]: unknown;
}

/**
 * Format log message with metadata
 */
function formatMessage(level: LogLevel, message: string, meta?: LogMeta): string {
  const timestamp = new Date().toISOString();
  let formattedMsg = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (meta?.module) {
    formattedMsg += ` [${meta.module}]`;
  }
  
  if (meta?.action) {
    formattedMsg += ` [${meta.action}]`;
  }
  
  formattedMsg += ` ${message}`;
  
  // Add remaining metadata
  const { module: _m, action: _a, ...rest } = meta || {};
  if (Object.keys(rest).length > 0) {
    formattedMsg += ` ${JSON.stringify(rest)}`;
  }
  
  return formattedMsg;
}

/**
 * Structured log entry for JSON logging in production
 */
function createLogEntry(level: LogLevel, message: string, meta?: LogMeta) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: 'fine-country-erp',
    ...meta,
  };
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, meta?: LogMeta) {
  const consoleMethod = level === 'debug' ? 'log' : level;
  
  if (isDevelopment) {
    // Formatted console output for development
    console[consoleMethod](formatMessage(level, message, meta));
  } else if (isServer) {
    // JSON structured logging for production server
    console[consoleMethod](JSON.stringify(createLogEntry(level, message, meta)));
  } else {
    // Minimal logging in production browser
    if (level === 'error' || level === 'warn') {
      console[consoleMethod](formatMessage(level, message, meta));
    }
  }
}

/**
 * Logger instance with standard log methods
 */
export const logger = {
  debug: (message: string, meta?: LogMeta) => {
    if (isDevelopment) {
      log('debug', message, meta);
    }
  },
  
  info: (message: string, meta?: LogMeta) => {
    log('info', message, meta);
  },
  
  warn: (message: string, meta?: LogMeta) => {
    log('warn', message, meta);
  },
  
  error: (message: string, errorOrMeta?: Error | LogMeta, meta?: LogMeta) => {
    // Handle overloaded signature: error(msg, Error, meta) or error(msg, meta)
    const MAX_STACK_LENGTH = 2000; // ~2KB
    const MAX_PAYLOAD_BYTES = 8000; // 8KB hard limit

    const truncateStack = (stack?: string, maxLength = MAX_STACK_LENGTH): string | undefined => {
      if (!stack) return undefined;
      return stack.length > maxLength ? stack.substring(0, maxLength) + '...' : stack;
    };

    const truncateMessage = (msg: string | null | undefined, maxLength = 500): string | undefined => {
      if (!msg) return undefined;
      return msg.length > maxLength ? msg.substring(0, maxLength) + '...' : msg;
    };

    let logMeta: LogMeta = {};
    
    if (errorOrMeta instanceof Error) {
      logMeta = {
        ...meta,
        error: truncateMessage(errorOrMeta.message),
        stack: truncateStack(errorOrMeta.stack),
      };
    } else if (errorOrMeta) {
      logMeta = errorOrMeta;
    }

    // Validate and limit payload size
    const payload = createLogEntry('error', message, logMeta);
    const payloadSize = new Blob([JSON.stringify(payload)]).size;
    
    if (payloadSize > MAX_PAYLOAD_BYTES) {
      // If payload is too large, strip unnecessary fields
      logMeta = {
        ...(meta || {}),
        error: truncateMessage(errorOrMeta instanceof Error ? errorOrMeta.message : undefined, 200),
        stack: undefined,
        // Remove any large fields that might be in meta
        ...Object.keys(logMeta).reduce((acc, key) => {
          const value = logMeta[key];
          if (typeof value === 'string' && value.length > 1000) {
            acc[key] = value.substring(0, 1000) + '...';
          } else if (typeof value === 'object' && value !== null) {
            // Stringify and truncate large objects
            const strValue = JSON.stringify(value);
            if (strValue.length > 1000) {
              acc[key] = strValue.substring(0, 1000) + '...';
            } else {
              acc[key] = value;
            }
          } else {
            acc[key] = value;
          }
          return acc;
        }, {} as LogMeta),
        truncated: true,
      };
    }

    log('error', message, logMeta);
  },
};

/**
 * Create child logger with module context
 */
export function createModuleLogger(moduleName: string) {
  return {
    debug: (message: string, meta?: LogMeta) => logger.debug(message, { module: moduleName, ...meta }),
    info: (message: string, meta?: LogMeta) => logger.info(message, { module: moduleName, ...meta }),
    warn: (message: string, meta?: LogMeta) => logger.warn(message, { module: moduleName, ...meta }),
    error: (message: string, errorOrMeta?: Error | LogMeta, meta?: LogMeta) => {
      if (errorOrMeta instanceof Error) {
        logger.error(message, errorOrMeta, { module: moduleName, ...meta });
      } else {
        logger.error(message, { module: moduleName, ...errorOrMeta });
      }
    },
  };
}

/**
 * Log HTTP request
 */
export function logRequest(method: string, url: string, statusCode: number, duration: number) {
  logger.info('HTTP Request', {
    action: 'HTTP_REQUEST',
    method,
    url,
    statusCode,
    duration: `${duration}ms`,
  });
}

/**
 * Log database query
 */
export function logQuery(query: string, duration: number, rows?: number) {
  logger.debug('Database Query', {
    action: 'DB_QUERY',
    query: query.substring(0, 100), // Truncate long queries
    duration: `${duration}ms`,
    rows,
  });
}

/**
 * Log authentication event
 */
export function logAuthEvent(event: 'LOGIN' | 'LOGOUT' | 'FAILED_LOGIN', userId?: string, email?: string, reason?: string) {
  logger.info('Authentication Event', {
    action: 'AUTH_EVENT',
    event,
    userId,
    email,
    reason,
  });
}

/**
 * Log security event
 */
export function logSecurityEvent(event: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', details?: Record<string, unknown>) {
  logger.warn('Security Event', {
    action: 'SECURITY_EVENT',
    event,
    severity,
    ...details,
  });
}

export default logger;
