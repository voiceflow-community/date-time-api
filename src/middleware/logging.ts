import { Request, Response, NextFunction } from 'express';

/**
 * Interface for request log data
 */
interface RequestLogData {
  method: string;
  url: string;
  userAgent: string | undefined;
  ip: string;
  timestamp: string;
  duration?: number;
  statusCode?: number;
  contentLength?: number;
}

/**
 * Request logging middleware
 * Logs incoming requests and their responses for debugging and monitoring
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // Extract request information
  const logData: RequestLogData = {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent') || undefined,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    timestamp
  };

  // Log incoming request
  console.log('Incoming request:', {
    ...logData,
    body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
    params: Object.keys(req.params).length > 0 ? req.params : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined
  });

  // Override res.end to capture response information
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    const contentLength = res.get('Content-Length');

    // Log response information
    console.log('Request completed:', {
      ...logData,
      duration,
      statusCode: res.statusCode,
      contentLength: contentLength ? parseInt(contentLength) : undefined
    });

    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * Enhanced request logger with more detailed information
 */
export function detailedRequestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const requestId = generateRequestId();

  // Add request ID to request object for correlation
  (req as any).requestId = requestId;

  // Extract detailed request information
  const logData = {
    requestId,
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    timestamp,
    headers: {
      contentType: req.get('Content-Type'),
      accept: req.get('Accept'),
      authorization: req.get('Authorization') ? '[REDACTED]' : undefined
    },
    body: shouldLogBody(req) ? req.body : '[BODY_NOT_LOGGED]',
    params: Object.keys(req.params).length > 0 ? req.params : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined
  };

  console.log('📥 Request started:', logData);

  // Override res.end to capture response information
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    const contentLength = res.get('Content-Length');

    console.log('📤 Request completed:', {
      requestId,
      method: req.method,
      url: req.url,
      duration: `${duration}ms`,
      statusCode: res.statusCode,
      contentLength: contentLength ? `${contentLength} bytes` : undefined,
      timestamp: new Date().toISOString()
    });

    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * Simple access log middleware (similar to Apache/Nginx access logs)
 */
export function accessLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const ip = req.ip || req.connection.remoteAddress || '-';
    const method = req.method;
    const url = req.url;
    const statusCode = res.statusCode;
    const contentLength = res.get('Content-Length') || '-';
    const userAgent = req.get('User-Agent') || '-';
    const timestamp = new Date().toISOString();

    // Format: IP - - [timestamp] "METHOD URL HTTP/1.1" status size "user-agent" duration
    console.log(
      `${ip} - - [${timestamp}] "${method} ${url} HTTP/1.1" ${statusCode} ${contentLength} "${userAgent}" ${duration}ms`
    );
  });

  next();
}

/**
 * Generate a unique request ID for correlation
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Determine if request body should be logged
 * Avoid logging sensitive data or large payloads
 */
function shouldLogBody(req: Request): boolean {
  // Don't log if no body
  if (!req.body || Object.keys(req.body).length === 0) {
    return false;
  }

  // Don't log if content type suggests binary data
  const contentType = req.get('Content-Type') || '';
  if (contentType.includes('multipart/form-data') || 
      contentType.includes('application/octet-stream')) {
    return false;
  }

  // Don't log if body is too large (rough check)
  const bodyString = JSON.stringify(req.body);
  if (bodyString.length > 1000) {
    return false;
  }

  return true;
}