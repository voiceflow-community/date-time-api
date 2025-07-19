import { ZodError } from 'zod';
import { ValidationError, ErrorResponse } from '../types/index';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error categories for better classification
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  RATE_LIMIT = 'rate_limit',
  EXTERNAL_SERVICE = 'external_service',
  SYSTEM = 'system',
  NETWORK = 'network'
}

/**
 * Enhanced error information interface
 */
export interface ErrorInfo {
  category: ErrorCategory;
  severity: ErrorSeverity;
  isRetryable: boolean;
  userMessage?: string;
  technicalMessage?: string;
  suggestedAction?: string;
}

/**
 * Comprehensive error utilities for formatting and handling errors
 */
export class ErrorUtils {
  /**
   * Map of error codes to error information
   */
  private static readonly ERROR_INFO_MAP: Record<string, ErrorInfo> = {
    'VALIDATION_ERROR': {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      isRetryable: true,
      userMessage: 'Please check your input and try again',
      suggestedAction: 'Verify all required fields are provided with correct formats'
    },
    'INVALID_TIMEZONE': {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      isRetryable: true,
      userMessage: 'The timezone you provided is not valid',
      suggestedAction: 'Use a valid IANA timezone identifier (e.g., "America/New_York")'
    },
    'INVALID_DATETIME': {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      isRetryable: true,
      userMessage: 'The date/time format is not valid',
      suggestedAction: 'Use ISO 8601 format (e.g., "2023-12-25T10:30:00Z")'
    },
    'INVALID_JSON': {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      isRetryable: true,
      userMessage: 'The request body contains invalid JSON',
      suggestedAction: 'Check your JSON syntax and ensure all quotes and brackets are properly closed'
    },
    'NOT_FOUND': {
      category: ErrorCategory.NOT_FOUND,
      severity: ErrorSeverity.LOW,
      isRetryable: false,
      userMessage: 'The requested resource was not found',
      suggestedAction: 'Check the URL and ensure the endpoint exists'
    },
    'TOO_MANY_REQUESTS': {
      category: ErrorCategory.RATE_LIMIT,
      severity: ErrorSeverity.MEDIUM,
      isRetryable: true,
      userMessage: 'You have made too many requests',
      suggestedAction: 'Please wait a moment before making another request'
    },
    'SERVICE_UNAVAILABLE': {
      category: ErrorCategory.EXTERNAL_SERVICE,
      severity: ErrorSeverity.HIGH,
      isRetryable: true,
      userMessage: 'The service is temporarily unavailable',
      suggestedAction: 'Please try again in a few minutes'
    },
    'REQUEST_TIMEOUT': {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      isRetryable: true,
      userMessage: 'The request took too long to complete',
      suggestedAction: 'Please try again with a simpler request'
    },
    'INTERNAL_SERVER_ERROR': {
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
      isRetryable: false,
      userMessage: 'An unexpected error occurred',
      suggestedAction: 'Please contact support if the problem persists'
    }
  };

  /**
   * Format Zod validation errors with enhanced details
   */
  static formatZodErrors(zodError: ZodError): ValidationError[] {
    return zodError.issues.map((issue) => {
      const field = issue.path.join('.') || 'root';
      let message = issue.message;
      
      // Keep the original Zod messages as they are already descriptive
      // Only enhance specific cases where we want custom messages
      switch (issue.code) {
        case 'invalid_type':
          message = `Expected ${issue.expected}, but received ${(issue as any).received}`;
          break;
        // Note: invalid_string is not in the current Zod issue codes
        // Keeping this for potential future compatibility
        case 'invalid_format':
          // Handle invalid_format for email and UUID validation
          if (issue.message.includes('email')) {
            message = 'Must be a valid email address';
          } else if (issue.message.includes('UUID')) {
            message = 'Must be a valid UUID';
          }
          break;
        case 'custom':
          // Keep the custom message as is
          break;
        default:
          // Use the original Zod message for other cases (they are already good)
          break;
      }

      return {
        field,
        message,
        code: issue.code
      };
    });
  }

  /**
   * Create enhanced error response with additional metadata
   */
  static createEnhancedErrorResponse(
    code: string,
    message: string,
    details?: ValidationError[] | any,
    _statusCode?: number, // HTTP status code for the error
    requestId?: string
  ): ErrorResponse & { meta?: any } {
    const errorInfo = this.ERROR_INFO_MAP[code];
    
    const response: ErrorResponse & { meta?: any } = {
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString()
      }
    };

    // Add metadata if error info is available
    if (errorInfo) {
      response.meta = {
        category: errorInfo.category,
        severity: errorInfo.severity,
        isRetryable: errorInfo.isRetryable,
        userMessage: errorInfo.userMessage,
        suggestedAction: errorInfo.suggestedAction
      };
    }

    // Add request ID if provided
    if (requestId) {
      response.meta = {
        ...response.meta,
        requestId
      };
    }

    return response;
  }

  /**
   * Determine error severity based on status code and error type
   */
  static getErrorSeverity(statusCode: number, _error: Error): ErrorSeverity {
    if (statusCode >= 500) {
      return ErrorSeverity.CRITICAL;
    } else if (statusCode === 429) {
      return ErrorSeverity.MEDIUM;
    } else if (statusCode >= 400) {
      return ErrorSeverity.LOW;
    }
    
    return ErrorSeverity.MEDIUM;
  }

  /**
   * Check if error is retryable based on error type and status code
   */
  static isRetryableError(statusCode: number, error: Error): boolean {
    // Server errors are generally retryable
    if (statusCode >= 500) {
      return true;
    }
    
    // Rate limiting is retryable after waiting
    if (statusCode === 429) {
      return true;
    }
    
    // Timeout errors are retryable
    if (statusCode === 408) {
      return true;
    }
    
    // Network errors are retryable
    if (error.message.includes('ENOTFOUND') || 
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('timeout')) {
      return true;
    }
    
    // Client errors are generally not retryable
    return false;
  }

  /**
   * Sanitize error for logging (remove sensitive information)
   */
  static sanitizeErrorForLogging(error: any): any {
    // Handle non-object values directly
    if (typeof error !== 'object' || error === null) {
      return error;
    }
    
    // Handle arrays
    if (Array.isArray(error)) {
      return error.map(item => this.sanitizeErrorForLogging(item));
    }
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'authorization'];
    
    const removeSensitiveData = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(item => removeSensitiveData(item));
      }
      
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          cleaned[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          cleaned[key] = removeSensitiveData(value);
        } else {
          cleaned[key] = value;
        }
      }
      return cleaned;
    };
    
    return removeSensitiveData(error);
  }

  /**
   * Generate correlation ID for error tracking
   */
  static generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format error for different environments
   */
  static formatErrorForEnvironment(
    error: Error,
    environment: 'development' | 'production' | 'test' = 'production'
  ): { message: string; details?: any } {
    if (environment === 'development' || environment === 'test') {
      return {
        message: error.message,
        details: {
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 10), // Limit stack trace
          cause: error.cause
        }
      };
    }
    
    // Production - minimal information
    return {
      message: this.shouldExposeMessage(error) ? error.message : 'An unexpected error occurred'
    };
  }

  /**
   * Determine if error message should be exposed to client
   */
  private static shouldExposeMessage(error: Error): boolean {
    // Expose validation and client errors
    const exposableErrors = [
      'ValidationError',
      'CastError',
      'SyntaxError'
    ];
    
    return exposableErrors.includes(error.name) || 
           error instanceof ZodError ||
           error.message.includes('timezone') ||
           error.message.includes('datetime');
  }
}