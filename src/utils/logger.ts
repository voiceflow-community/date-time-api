import { config, isProduction, isDevelopment } from '../config/index';

/**
 * Log levels enum
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * Log level mapping
 */
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  error: LogLevel.ERROR,
  warn: LogLevel.WARN,
  info: LogLevel.INFO,
  debug: LogLevel.DEBUG,
};

/**
 * Logger interface
 */
interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: Record<string, any>;
  requestId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Production-ready logger class
 */
class Logger {
  private currentLogLevel: LogLevel;
  private logFormat: 'json' | 'text';

  constructor() {
    this.currentLogLevel = LOG_LEVEL_MAP[config.LOG_LEVEL] || LogLevel.INFO;
    this.logFormat = config.LOG_FORMAT;
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLogLevel;
  }

  /**
   * Format log entry based on configuration
   */
  private formatLog(entry: LogEntry): string {
    if (this.logFormat === 'json') {
      return JSON.stringify(entry);
    }

    // Text format for development
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const requestId = entry.requestId ? `[${entry.requestId}] ` : '';
    const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
    const error = entry.error ? `\n  Error: ${entry.error.message}\n  Stack: ${entry.error.stack}` : '';
    
    return `${timestamp} ${level} ${requestId}${entry.message}${meta}${error}`;
  }

  /**
   * Write log to appropriate output
   */
  private writeLog(entry: LogEntry): void {
    const formattedLog = this.formatLog(entry);
    
    // Always write to console
    if (entry.level === 'error') {
      console.error(formattedLog);
    } else if (entry.level === 'warn') {
      console.warn(formattedLog);
    } else {
      console.log(formattedLog);
    }

    // TODO: Add file logging if enabled
    // This would require additional dependencies like winston or pino
    // For now, we'll keep it simple with console logging
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: string,
    message: string,
    meta?: Record<string, any>,
    error?: Error,
    requestId?: string
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (meta && Object.keys(meta).length > 0) {
      entry.meta = meta;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        ...(isProduction ? {} : { stack: error.stack }),
      };
    }

    if (requestId) {
      entry.requestId = requestId;
    }

    return entry;
  }

  /**
   * Log error message
   */
  error(message: string, meta?: Record<string, any>, error?: Error, requestId?: string): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const entry = this.createLogEntry('error', message, meta, error, requestId);
    this.writeLog(entry);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, any>, requestId?: string): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry = this.createLogEntry('warn', message, meta, undefined, requestId);
    this.writeLog(entry);
  }

  /**
   * Log info message
   */
  info(message: string, meta?: Record<string, any>, requestId?: string): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry = this.createLogEntry('info', message, meta, undefined, requestId);
    this.writeLog(entry);
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: Record<string, any>, requestId?: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry = this.createLogEntry('debug', message, meta, undefined, requestId);
    this.writeLog(entry);
  }

  /**
   * Log HTTP request
   */
  logRequest(req: any, res: any, duration: number): void {
    const meta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get?.('User-Agent'),
      contentLength: res.get?.('Content-Length'),
    };

    const level = res.statusCode >= 400 ? 'warn' : 'info';
    const message = `${req.method} ${req.url} ${res.statusCode} ${duration}ms`;
    
    if (level === 'warn') {
      this.warn(message, meta, req.requestId);
    } else {
      this.info(message, meta, req.requestId);
    }
  }

  /**
   * Log application startup
   */
  logStartup(port: number): void {
    this.info('🚀 Timezone API Server started', {
      port,
      environment: config.NODE_ENV,
      logLevel: config.LOG_LEVEL,
      pid: process.pid,
      nodeVersion: process.version,
    });
  }

  /**
   * Log application shutdown
   */
  logShutdown(reason: string): void {
    this.info('🛑 Timezone API Server shutting down', {
      reason,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log performance metrics
   */
  logMetrics(metrics: Record<string, any>): void {
    this.info('📊 Performance metrics', metrics);
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Request logger middleware with enhanced logging
 */
export function createRequestLogger() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add request ID to request object
    req.requestId = requestId;
    
    // Log request start (only in debug mode)
    if (isDevelopment) {
      logger.debug('Request started', {
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get?.('User-Agent'),
      }, requestId);
    }

    // Override res.end to capture response
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;
      
      // Log request completion
      logger.logRequest(req, res, duration);
      
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}