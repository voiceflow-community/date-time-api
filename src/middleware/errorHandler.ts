import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ErrorResponse, ValidationError } from '../types/index';
import { ErrorUtils } from '../utils/errorUtils';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;
  public isOperational: boolean;

  constructor(statusCode: number, code: string, message: string, details?: any, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    this.name = 'ApiError';
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error response formatting utilities (legacy - use ErrorUtils for new code)
 * @deprecated Use ErrorUtils from utils/errorUtils.ts instead
 */
export class ErrorFormatter {
  /**
   * Format Zod validation errors into ValidationError array
   * @deprecated Use ErrorUtils.formatZodErrors instead
   */
  static formatZodErrors(zodError: ZodError): ValidationError[] {
    return ErrorUtils.formatZodErrors(zodError);
  }

  /**
   * Create standardized error response
   * @deprecated Use ErrorUtils.createEnhancedErrorResponse instead
   */
  static createErrorResponse(
    code: string,
    message: string,
    details?: ValidationError[] | any,
    _statusCode?: number // HTTP status code for the error
  ): ErrorResponse {
    return {
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Determine if error should expose details in production
   */
  static shouldExposeDetails(error: Error): boolean {
    // Only expose details for operational errors
    if (error instanceof ApiError) {
      return error.isOperational;
    }
    
    // Expose details for validation and client errors
    return error instanceof ZodError || 
           error.name === 'ValidationError' ||
           error.name === 'CastError';
  }

  /**
   * Sanitize error message for production
   */
  static sanitizeErrorMessage(error: Error, isDevelopment: boolean = false): string {
    const formatted = ErrorUtils.formatErrorForEnvironment(
      error, 
      isDevelopment ? 'development' : 'production'
    );
    return formatted.message;
  }
}

/**
 * Centralized error handling middleware
 * Handles all errors and returns consistent error responses
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isDevelopment = process.env['NODE_ENV'] !== 'production';
  const correlationId = ErrorUtils.generateCorrelationId();
  
  // Sanitize error log to remove sensitive information
  const errorLog = ErrorUtils.sanitizeErrorForLogging({
    correlationId,
    message: error.message,
    stack: error.stack,
    name: error.name,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    headers: {
      'user-agent': req.get('user-agent'),
      'content-type': req.get('content-type'),
      'x-forwarded-for': req.get('x-forwarded-for'),
    },
    timestamp: new Date().toISOString(),
    isOperational: error instanceof ApiError ? error.isOperational : false
  });

  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  // Handle different error types
  if (error instanceof ApiError) {
    // Custom API errors
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    // Zod validation errors
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = ErrorUtils.formatZodErrors(error);
  } else if (error.name === 'ValidationError') {
    // Generic validation errors
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = ErrorFormatter.sanitizeErrorMessage(error, isDevelopment);
  } else if (error.name === 'CastError') {
    // Type casting errors
    statusCode = 400;
    errorCode = 'INVALID_INPUT';
    message = 'Invalid input format';
  } else if (error.name === 'SyntaxError' && 'body' in error) {
    // JSON parsing errors
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = 'Invalid JSON format in request body';
  } else if (error.message.includes('timezone')) {
    // Timezone-specific errors
    statusCode = 400;
    errorCode = 'INVALID_TIMEZONE';
    message = 'Invalid timezone identifier';
  } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
    // Network/connection errors
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'External service temporarily unavailable';
  } else if (error.message.includes('timeout')) {
    // Timeout errors
    statusCode = 408;
    errorCode = 'REQUEST_TIMEOUT';
    message = 'Request timeout';
  } else {
    // Unknown errors - don't expose details in production
    const formatted = ErrorUtils.formatErrorForEnvironment(
      error, 
      isDevelopment ? 'development' : 'production'
    );
    message = formatted.message;
    if (isDevelopment && formatted.details) {
      details = formatted.details;
    }
  }

  // Determine error severity and log appropriately
  const severity = ErrorUtils.getErrorSeverity(statusCode, error);
  const isRetryable = ErrorUtils.isRetryableError(statusCode, error);

  // Log based on error severity
  if (error instanceof ApiError && error.isOperational) {
    console.warn('Operational error:', { ...errorLog, severity, isRetryable });
  } else if (statusCode >= 500) {
    console.error('System error:', { ...errorLog, severity, isRetryable });
  } else {
    console.info('Client error:', { ...errorLog, severity, isRetryable });
  }

  // Create enhanced error response with metadata
  const errorResponse = ErrorUtils.createEnhancedErrorResponse(
    errorCode,
    message,
    details,
    statusCode,
    correlationId
  );

  // Set appropriate headers
  res.set({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-Correlation-ID': correlationId
  });

  res.status(statusCode).json(errorResponse);
}

/**
 * Middleware to handle 404 errors for unknown routes
 */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  const errorResponse: ErrorResponse = {
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString()
    }
  };

  res.status(404).json(errorResponse);
}

/**
 * Helper function to create API errors
 */
export function createApiError(statusCode: number, code: string, message: string, details?: any): ApiError {
  return new ApiError(statusCode, code, message, details);
}

/**
 * Common API error creators
 */
export const ApiErrors = {
  badRequest: (message: string, details?: any) => 
    createApiError(400, 'BAD_REQUEST', message, details),
  
  unauthorized: (message: string = 'Unauthorized') => 
    createApiError(401, 'UNAUTHORIZED', message),
  
  forbidden: (message: string = 'Forbidden') => 
    createApiError(403, 'FORBIDDEN', message),
  
  notFound: (message: string = 'Resource not found') => 
    createApiError(404, 'NOT_FOUND', message),
  
  conflict: (message: string, details?: any) => 
    createApiError(409, 'CONFLICT', message, details),
  
  tooManyRequests: (message: string = 'Too many requests') => 
    createApiError(429, 'TOO_MANY_REQUESTS', message),
  
  internalServer: (message: string = 'Internal server error') => 
    createApiError(500, 'INTERNAL_SERVER_ERROR', message),
  
  invalidTimezone: (timezone: string) => 
    createApiError(400, 'INVALID_TIMEZONE', `Invalid timezone identifier: ${timezone}`),
  
  invalidDateTime: (datetime: string) => 
    createApiError(400, 'INVALID_DATETIME', `Invalid datetime format: ${datetime}`)
};