import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError, z } from 'zod';
import { ErrorUtils, ErrorSeverity, ErrorCategory } from '../../../src/utils/errorUtils.js';

describe('ErrorUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatZodErrors', () => {
    it('should format Zod validation errors with enhanced messages', () => {
      const schema = z.object({
        name: z.string().min(2, 'Name too short'),
        age: z.number().min(0).max(120),
        email: z.string().email(),
        id: z.string().uuid()
      });

      let zodError: ZodError;
      try {
        schema.parse({
          name: 'A',
          age: -5,
          email: 'invalid-email',
          id: 'not-a-uuid'
        });
      } catch (error) {
        zodError = error as ZodError;
      }

      const formatted = ErrorUtils.formatZodErrors(zodError!);

      expect(formatted).toHaveLength(4);
      expect(formatted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            message: 'Name too short',
            code: 'too_small'
          }),
          expect.objectContaining({
            field: 'age',
            message: expect.stringContaining('Too small'),
            code: 'too_small'
          }),
          expect.objectContaining({
            field: 'email',
            message: 'Must be a valid email address',
            code: 'invalid_format'
          }),
          expect.objectContaining({
            field: 'id',
            message: 'Must be a valid UUID',
            code: 'invalid_format'
          })
        ])
      );
    });

    it('should handle nested object validation errors', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string().min(1)
          })
        })
      });

      let zodError: ZodError;
      try {
        schema.parse({
          user: {
            profile: {
              name: ''
            }
          }
        });
      } catch (error) {
        zodError = error as ZodError;
      }

      const formatted = ErrorUtils.formatZodErrors(zodError!);

      expect(formatted).toHaveLength(1);
      expect(formatted[0]).toEqual({
        field: 'user.profile.name',
        message: expect.stringContaining('Too small'),
        code: 'too_small'
      });
    });

    it('should handle array validation errors', () => {
      const schema = z.object({
        tags: z.array(z.string().min(1)).min(1)
      });

      let zodError: ZodError;
      try {
        schema.parse({
          tags: []
        });
      } catch (error) {
        zodError = error as ZodError;
      }

      const formatted = ErrorUtils.formatZodErrors(zodError!);

      expect(formatted).toHaveLength(1);
      expect(formatted[0]).toEqual({
        field: 'tags',
        message: expect.stringContaining('Too small'),
        code: 'too_small'
      });
    });

    it('should handle root level validation errors', () => {
      const schema = z.string().min(5);

      let zodError: ZodError;
      try {
        schema.parse('abc');
      } catch (error) {
        zodError = error as ZodError;
      }

      const formatted = ErrorUtils.formatZodErrors(zodError!);

      expect(formatted).toHaveLength(1);
      expect(formatted[0]).toEqual({
        field: 'root',
        message: expect.stringContaining('Too small'),
        code: 'too_small'
      });
    });
  });

  describe('createEnhancedErrorResponse', () => {
    it('should create enhanced error response with metadata', () => {
      const response = ErrorUtils.createEnhancedErrorResponse(
        'VALIDATION_ERROR',
        'Request validation failed',
        [{ field: 'name', message: 'Required', code: 'required' }],
        400,
        'req_123'
      );

      expect(response).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [{ field: 'name', message: 'Required', code: 'required' }],
          timestamp: expect.any(String)
        },
        meta: {
          category: ErrorCategory.VALIDATION,
          severity: ErrorSeverity.LOW,
          isRetryable: true,
          userMessage: 'Please check your input and try again',
          suggestedAction: 'Verify all required fields are provided with correct formats',
          requestId: 'req_123'
        }
      });
    });

    it('should create response without metadata for unknown error codes', () => {
      const response = ErrorUtils.createEnhancedErrorResponse(
        'UNKNOWN_ERROR',
        'Unknown error occurred'
      );

      expect(response).toEqual({
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'Unknown error occurred',
          details: undefined,
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle all predefined error codes', () => {
      const errorCodes = [
        'VALIDATION_ERROR',
        'INVALID_TIMEZONE',
        'INVALID_DATETIME',
        'INVALID_JSON',
        'NOT_FOUND',
        'TOO_MANY_REQUESTS',
        'SERVICE_UNAVAILABLE',
        'REQUEST_TIMEOUT',
        'INTERNAL_SERVER_ERROR'
      ];

      errorCodes.forEach(code => {
        const response = ErrorUtils.createEnhancedErrorResponse(code, 'Test message');
        expect(response.meta).toBeDefined();
        expect(response.meta.category).toBeDefined();
        expect(response.meta.severity).toBeDefined();
        expect(response.meta.isRetryable).toBeDefined();
      });
    });
  });

  describe('getErrorSeverity', () => {
    it('should return CRITICAL for 5xx status codes', () => {
      const error = new Error('Server error');
      expect(ErrorUtils.getErrorSeverity(500, error)).toBe(ErrorSeverity.CRITICAL);
      expect(ErrorUtils.getErrorSeverity(503, error)).toBe(ErrorSeverity.CRITICAL);
    });

    it('should return MEDIUM for 429 status code', () => {
      const error = new Error('Rate limit');
      expect(ErrorUtils.getErrorSeverity(429, error)).toBe(ErrorSeverity.MEDIUM);
    });

    it('should return LOW for 4xx status codes', () => {
      const error = new Error('Client error');
      expect(ErrorUtils.getErrorSeverity(400, error)).toBe(ErrorSeverity.LOW);
      expect(ErrorUtils.getErrorSeverity(404, error)).toBe(ErrorSeverity.LOW);
    });

    it('should return MEDIUM for other status codes', () => {
      const error = new Error('Other error');
      expect(ErrorUtils.getErrorSeverity(300, error)).toBe(ErrorSeverity.MEDIUM);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for 5xx server errors', () => {
      const error = new Error('Server error');
      expect(ErrorUtils.isRetryableError(500, error)).toBe(true);
      expect(ErrorUtils.isRetryableError(503, error)).toBe(true);
    });

    it('should return true for rate limiting errors', () => {
      const error = new Error('Rate limit');
      expect(ErrorUtils.isRetryableError(429, error)).toBe(true);
    });

    it('should return true for timeout errors', () => {
      const error = new Error('Timeout');
      expect(ErrorUtils.isRetryableError(408, error)).toBe(true);
    });

    it('should return true for network errors', () => {
      const enotfoundError = new Error('ENOTFOUND service.com');
      expect(ErrorUtils.isRetryableError(400, enotfoundError)).toBe(true);

      const econnrefusedError = new Error('ECONNREFUSED');
      expect(ErrorUtils.isRetryableError(400, econnrefusedError)).toBe(true);

      const timeoutError = new Error('Request timeout');
      expect(ErrorUtils.isRetryableError(400, timeoutError)).toBe(true);
    });

    it('should return false for client errors', () => {
      const error = new Error('Bad request');
      expect(ErrorUtils.isRetryableError(400, error)).toBe(false);
      expect(ErrorUtils.isRetryableError(404, error)).toBe(false);
    });
  });

  describe('sanitizeErrorForLogging', () => {
    it('should redact sensitive fields', () => {
      const errorData = {
        message: 'Error occurred',
        request: {
          body: {
            username: 'john',
            password: 'secret123',
            email: 'john@example.com'
          },
          headers: {
            authorization: 'Bearer token123',
            'content-type': 'application/json'
          }
        },
        user: {
          name: 'John',
          apiKey: 'key123'
        }
      };

      const sanitized = ErrorUtils.sanitizeErrorForLogging(errorData);

      expect(sanitized.message).toBe('Error occurred');
      expect(sanitized.request.body.username).toBe('john');
      expect(sanitized.request.body.password).toBe('[REDACTED]');
      expect(sanitized.request.body.email).toBe('john@example.com');
      expect(sanitized.request.headers.authorization).toBe('[REDACTED]');
      expect(sanitized.request.headers['content-type']).toBe('application/json');
      expect(sanitized.user.name).toBe('John');
      expect(sanitized.user.apiKey).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const errorData = {
        level1: {
          level2: {
            level3: {
              password: 'secret',
              data: 'safe'
            }
          }
        }
      };

      const sanitized = ErrorUtils.sanitizeErrorForLogging(errorData);

      expect(sanitized.level1.level2.level3.password).toBe('[REDACTED]');
      expect(sanitized.level1.level2.level3.data).toBe('safe');
    });

    it('should handle non-object values', () => {
      expect(ErrorUtils.sanitizeErrorForLogging('string')).toBe('string');
      expect(ErrorUtils.sanitizeErrorForLogging(123)).toBe(123);
      expect(ErrorUtils.sanitizeErrorForLogging(null)).toBe(null);
      expect(ErrorUtils.sanitizeErrorForLogging(undefined)).toBe(undefined);
    });
  });

  describe('generateCorrelationId', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = ErrorUtils.generateCorrelationId();
      const id2 = ErrorUtils.generateCorrelationId();

      expect(id1).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with correct format', () => {
      const id = ErrorUtils.generateCorrelationId();
      const parts = id.split('_');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('err');
      expect(parts[1]).toMatch(/^\d+$/); // timestamp
      expect(parts[2]).toMatch(/^[a-z0-9]+$/); // random string
    });
  });

  describe('formatErrorForEnvironment', () => {
    it('should return detailed error info for development', () => {
      const error = new Error('Detailed error message');
      error.stack = 'Error: Detailed error message\n    at test\n    at another';

      const formatted = ErrorUtils.formatErrorForEnvironment(error, 'development');

      expect(formatted).toEqual({
        message: 'Detailed error message',
        details: {
          name: 'Error',
          stack: expect.any(Array),
          cause: undefined
        }
      });

      expect(formatted.details.stack).toHaveLength(3); // Limited to 10 lines
    });

    it('should return detailed error info for test environment', () => {
      const error = new Error('Test error');
      const formatted = ErrorUtils.formatErrorForEnvironment(error, 'test');

      expect(formatted).toEqual({
        message: 'Test error',
        details: expect.objectContaining({
          name: 'Error',
          stack: expect.any(Array)
        })
      });
    });

    it('should return minimal info for production - exposable errors', () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';

      const formatted = ErrorUtils.formatErrorForEnvironment(validationError, 'production');

      expect(formatted).toEqual({
        message: 'Validation failed'
      });
    });

    it('should return generic message for production - non-exposable errors', () => {
      const systemError = new Error('Database connection failed');

      const formatted = ErrorUtils.formatErrorForEnvironment(systemError, 'production');

      expect(formatted).toEqual({
        message: 'An unexpected error occurred'
      });
    });

    it('should expose timezone-related errors in production', () => {
      const timezoneError = new Error('Invalid timezone America/Invalid');

      const formatted = ErrorUtils.formatErrorForEnvironment(timezoneError, 'production');

      expect(formatted).toEqual({
        message: 'Invalid timezone America/Invalid'
      });
    });

    it('should expose datetime-related errors in production', () => {
      const datetimeError = new Error('Invalid datetime format');

      const formatted = ErrorUtils.formatErrorForEnvironment(datetimeError, 'production');

      expect(formatted).toEqual({
        message: 'Invalid datetime format'
      });
    });

    it('should expose ZodError in production', () => {
      const schema = z.string().min(5);
      let zodError: ZodError;
      try {
        schema.parse('abc');
      } catch (error) {
        zodError = error as ZodError;
      }

      const formatted = ErrorUtils.formatErrorForEnvironment(zodError!, 'production');

      expect(formatted.message).toContain('Too small');
    });
  });

  describe('Error severity and category mapping', () => {
    it('should have correct mapping for validation errors', () => {
      const response = ErrorUtils.createEnhancedErrorResponse('VALIDATION_ERROR', 'Test');
      expect(response.meta?.category).toBe(ErrorCategory.VALIDATION);
      expect(response.meta?.severity).toBe(ErrorSeverity.LOW);
      expect(response.meta?.isRetryable).toBe(true);
    });

    it('should have correct mapping for rate limit errors', () => {
      const response = ErrorUtils.createEnhancedErrorResponse('TOO_MANY_REQUESTS', 'Test');
      expect(response.meta?.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(response.meta?.severity).toBe(ErrorSeverity.MEDIUM);
      expect(response.meta?.isRetryable).toBe(true);
    });

    it('should have correct mapping for system errors', () => {
      const response = ErrorUtils.createEnhancedErrorResponse('INTERNAL_SERVER_ERROR', 'Test');
      expect(response.meta?.category).toBe(ErrorCategory.SYSTEM);
      expect(response.meta?.severity).toBe(ErrorSeverity.CRITICAL);
      expect(response.meta?.isRetryable).toBe(false);
    });

    it('should have correct mapping for external service errors', () => {
      const response = ErrorUtils.createEnhancedErrorResponse('SERVICE_UNAVAILABLE', 'Test');
      expect(response.meta?.category).toBe(ErrorCategory.EXTERNAL_SERVICE);
      expect(response.meta?.severity).toBe(ErrorSeverity.HIGH);
      expect(response.meta?.isRetryable).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty Zod error issues', () => {
      const zodError = new ZodError([]);
      const formatted = ErrorUtils.formatZodErrors(zodError);
      expect(formatted).toEqual([]);
    });

    it('should handle error with cause property', () => {
      const error = new Error('Main error');
      (error as any).cause = new Error('Root cause');

      const formatted = ErrorUtils.formatErrorForEnvironment(error, 'development');
      expect(formatted.details.cause).toEqual(new Error('Root cause'));
    });

    it('should handle very long stack traces', () => {
      const error = new Error('Test error');
      error.stack = Array(20).fill('    at test').join('\n');

      const formatted = ErrorUtils.formatErrorForEnvironment(error, 'development');
      expect(formatted.details.stack).toHaveLength(10); // Limited to 10 lines
    });
  });
});