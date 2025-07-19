import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import { 
  errorHandler, 
  notFoundHandler, 
  ApiError, 
  createApiError, 
  ApiErrors,
  ErrorFormatter
} from '../../../src/middleware/errorHandler.js';

// Mock console methods to avoid noise in tests
const mockConsoleError = vi.fn();
const mockConsoleWarn = vi.fn();
const mockConsoleInfo = vi.fn();
vi.stubGlobal('console', {
  error: mockConsoleError,
  warn: mockConsoleWarn,
  info: mockConsoleInfo
});

// Mock Express objects
const mockRequest = (overrides = {}) => ({
  url: '/test',
  method: 'GET',
  body: {},
  params: {},
  query: {},
  get: vi.fn().mockReturnValue('test-value'),
  ...overrides
}) as Request;

const mockResponse = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  return res;
};

const mockNext = vi.fn() as NextFunction;

describe('Error Handler Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ApiError class', () => {
    it('should create ApiError with all properties', () => {
      const error = new ApiError(400, 'BAD_REQUEST', 'Test error', { field: 'test' });

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Test error');
      expect(error.details).toEqual({ field: 'test' });
      expect(error.name).toBe('ApiError');
      expect(error.isOperational).toBe(true);
    });

    it('should create ApiError without details', () => {
      const error = new ApiError(404, 'NOT_FOUND', 'Resource not found');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
      expect(error.details).toBeUndefined();
      expect(error.isOperational).toBe(true);
    });

    it('should create non-operational ApiError', () => {
      const error = new ApiError(500, 'SYSTEM_ERROR', 'System failure', undefined, false);

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('SYSTEM_ERROR');
      expect(error.message).toBe('System failure');
      expect(error.isOperational).toBe(false);
    });

    it('should capture stack trace', () => {
      const error = new ApiError(400, 'TEST_ERROR', 'Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ApiError');
    });
  });

  describe('errorHandler', () => {
    it('should handle ApiError correctly', () => {
      const apiError = new ApiError(400, 'BAD_REQUEST', 'Invalid input', { field: 'name' });
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(apiError, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid input',
            details: { field: 'name' },
            timestamp: expect.any(String)
          },
          meta: expect.objectContaining({
            requestId: expect.stringMatching(/^err_\d+_[a-z0-9]+$/)
          })
        })
      );
    });

    it('should handle ValidationError', () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(validationError, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: undefined,
            timestamp: expect.any(String)
          },
          meta: expect.objectContaining({
            category: 'validation',
            severity: 'low',
            isRetryable: true,
            requestId: expect.stringMatching(/^err_\d+_[a-z0-9]+$/)
          })
        })
      );
    });

    it('should handle CastError', () => {
      const castError = new Error('Cast failed');
      castError.name = 'CastError';
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(castError, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid input format',
            details: undefined,
            timestamp: expect.any(String)
          },
          meta: expect.objectContaining({
            requestId: expect.stringMatching(/^err_\d+_[a-z0-9]+$/)
          })
        })
      );
    });

    it('should handle timezone-related errors', () => {
      const timezoneError = new Error('Invalid timezone America/Invalid');
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(timezoneError, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: {
            code: 'INVALID_TIMEZONE',
            message: 'Invalid timezone identifier',
            details: undefined,
            timestamp: expect.any(String)
          },
          meta: expect.objectContaining({
            category: 'validation',
            severity: 'low',
            isRetryable: true,
            requestId: expect.stringMatching(/^err_\d+_[a-z0-9]+$/)
          })
        })
      );
    });

    it('should handle generic errors as internal server error', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production'; // Test production behavior
      
      const genericError = new Error('Something went wrong');
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(genericError, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
            details: undefined,
            timestamp: expect.any(String)
          },
          meta: expect.objectContaining({
            category: 'system',
            severity: 'critical',
            isRetryable: false,
            requestId: expect.stringMatching(/^err_\d+_[a-z0-9]+$/)
          })
        })
      );

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle ZodError with detailed validation errors', () => {
      const schema = z.object({
        name: z.string().min(2),
        age: z.number().min(0),
        email: z.string().email()
      });

      let zodError: ZodError;
      try {
        schema.parse({ name: 'A', age: -1, email: 'invalid' });
      } catch (error) {
        zodError = error as ZodError;
      }

      const req = mockRequest();
      const res = mockResponse();

      errorHandler(zodError!, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: expect.arrayContaining([
              expect.objectContaining({
                field: expect.any(String),
                message: expect.any(String),
                code: expect.any(String)
              })
            ]),
            timestamp: expect.any(String)
          }),
          meta: expect.objectContaining({
            category: 'validation',
            severity: 'low',
            isRetryable: true,
            requestId: expect.stringMatching(/^err_\d+_[a-z0-9]+$/)
          })
        })
      );
    });

    it('should handle JSON syntax errors', () => {
      const syntaxError = new SyntaxError('Unexpected token in JSON');
      (syntaxError as any).body = true; // Simulate JSON parsing error
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(syntaxError, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INVALID_JSON',
            message: 'Invalid JSON format in request body'
          })
        })
      );
    });

    it('should handle network errors as service unavailable', () => {
      const networkError = new Error('ENOTFOUND external-service.com');
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(networkError, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'SERVICE_UNAVAILABLE',
            message: 'External service temporarily unavailable'
          })
        })
      );
    });

    it('should handle timeout errors', () => {
      const timeoutError = new Error('Request timeout after 5000ms');
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(timeoutError, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(408);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'REQUEST_TIMEOUT',
            message: 'Request timeout'
          })
        })
      );
    });

    it('should set correlation ID header', () => {
      const error = new Error('Test error');
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(error, req, res, mockNext);

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-Correlation-ID': expect.stringMatching(/^err_\d+_[a-z0-9]+$/)
        })
      );
    });

    it('should log operational errors as warnings', () => {
      const operationalError = new ApiError(400, 'BAD_REQUEST', 'Invalid input', undefined, true);
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(operationalError, req, res, mockNext);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Operational error:',
        expect.objectContaining({
          correlationId: expect.any(String),
          message: 'Invalid input',
          isOperational: true,
          severity: 'low',
          isRetryable: false // 400 errors are not retryable by default
        })
      );
    });

    it('should log system errors as errors', () => {
      const systemError = new Error('Database connection failed');
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(systemError, req, res, mockNext);

      expect(mockConsoleError).toHaveBeenCalledWith(
        'System error:',
        expect.objectContaining({
          correlationId: expect.any(String),
          message: 'Database connection failed',
          severity: 'critical',
          isRetryable: true // 500 errors are retryable by default
        })
      );
    });

    it('should log client errors as info', () => {
      const clientError = new Error('Validation failed');
      clientError.name = 'ValidationError';
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(clientError, req, res, mockNext);

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        'Client error:',
        expect.objectContaining({
          correlationId: expect.any(String),
          message: 'Validation failed',
          severity: 'low',
          isRetryable: false // ValidationError with 400 status is not retryable
        })
      );
    });

    it('should sanitize sensitive information from logs', () => {
      const error = new Error('Test error');
      const req = mockRequest({
        body: { password: 'secret123', name: 'John' },
        headers: { authorization: 'Bearer token123' }
      });
      const res = mockResponse();

      errorHandler(error, req, res, mockNext);

      // Check that sensitive data is redacted in logs
      const logCall = mockConsoleError.mock.calls[0];
      const logData = logCall[1];
      
      expect(logData.body.password).toBe('[REDACTED]');
      expect(logData.body.name).toBe('John'); // Non-sensitive data should remain
    });

    it('should include enhanced metadata in error response', () => {
      const validationError = new Error('Invalid input');
      validationError.name = 'ValidationError';
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(validationError, req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            timestamp: expect.any(String)
          }),
          meta: expect.objectContaining({
            category: 'validation',
            severity: 'low',
            isRetryable: true,
            userMessage: 'Please check your input and try again',
            suggestedAction: 'Verify all required fields are provided with correct formats',
            requestId: expect.stringMatching(/^err_\d+_[a-z0-9]+$/)
          })
        })
      );
    });

    it('should handle development vs production error details', () => {
      const originalEnv = process.env.NODE_ENV;
      
      // Test development mode
      process.env.NODE_ENV = 'development';
      const devError = new Error('Detailed error message');
      const req = mockRequest();
      const res = mockResponse();

      errorHandler(devError, req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Detailed error message',
            details: expect.objectContaining({
              name: 'Error',
              stack: expect.any(Array)
            })
          })
        })
      );

      vi.clearAllMocks();

      // Test production mode
      process.env.NODE_ENV = 'production';
      const prodError = new Error('Detailed error message');
      
      errorHandler(prodError, req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'An unexpected error occurred'
          })
        })
      );

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 error for unknown routes', () => {
      const req = mockRequest({ method: 'GET', path: '/unknown' });
      const res = mockResponse();

      notFoundHandler(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'NOT_FOUND',
          message: 'Route GET /unknown not found',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle different HTTP methods', () => {
      const req = mockRequest({ method: 'POST', path: '/api/unknown' });
      const res = mockResponse();

      notFoundHandler(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'NOT_FOUND',
          message: 'Route POST /api/unknown not found',
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('createApiError', () => {
    it('should create ApiError with all parameters', () => {
      const error = createApiError(422, 'UNPROCESSABLE_ENTITY', 'Invalid data', { field: 'email' });

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(error.message).toBe('Invalid data');
      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('ApiErrors helpers', () => {
    it('should create badRequest error', () => {
      const error = ApiErrors.badRequest('Bad input', { field: 'name' });

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Bad input');
      expect(error.details).toEqual({ field: 'name' });
    });

    it('should create unauthorized error', () => {
      const error = ApiErrors.unauthorized();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Unauthorized');
    });

    it('should create forbidden error', () => {
      const error = ApiErrors.forbidden('Access denied');

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Access denied');
    });

    it('should create notFound error', () => {
      const error = ApiErrors.notFound('User not found');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('User not found');
    });

    it('should create conflict error', () => {
      const error = ApiErrors.conflict('Resource exists', { id: '123' });

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.message).toBe('Resource exists');
      expect(error.details).toEqual({ id: '123' });
    });

    it('should create tooManyRequests error', () => {
      const error = ApiErrors.tooManyRequests('Rate limit exceeded');

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('TOO_MANY_REQUESTS');
      expect(error.message).toBe('Rate limit exceeded');
    });

    it('should create internalServer error', () => {
      const error = ApiErrors.internalServer('Database error');

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.message).toBe('Database error');
    });

    it('should create invalidTimezone error', () => {
      const error = ApiErrors.invalidTimezone('America/Invalid');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('INVALID_TIMEZONE');
      expect(error.message).toBe('Invalid timezone identifier: America/Invalid');
    });

    it('should create invalidDateTime error', () => {
      const error = ApiErrors.invalidDateTime('invalid-date');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('INVALID_DATETIME');
      expect(error.message).toBe('Invalid datetime format: invalid-date');
    });
  });
});