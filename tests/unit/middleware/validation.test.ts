import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest, validateBody, validateParams, validateQuery } from '../../../src/middleware/validation.js';

// Mock Express objects
const mockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  ...overrides
}) as Request;

const mockResponse = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockNext = vi.fn() as NextFunction;

describe('Validation Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateRequest', () => {
    it('should pass validation with valid data', () => {
      const bodySchema = z.object({
        name: z.string(),
        age: z.number()
      });

      const paramsSchema = z.object({
        id: z.string()
      });

      const middleware = validateRequest({
        body: bodySchema,
        params: paramsSchema
      });

      const req = mockRequest({
        body: { name: 'John', age: 30 },
        params: { id: '123' }
      });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 400 error for invalid body data', () => {
      const bodySchema = z.object({
        name: z.string(),
        age: z.number()
      });

      const middleware = validateRequest({ body: bodySchema });

      const req = mockRequest({
        body: { name: 'John', age: 'invalid' } // age should be number
      });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'age',
              message: 'Invalid input: expected number, received string',
              code: 'invalid_type'
            })
          ]),
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 error for invalid params data', () => {
      const paramsSchema = z.object({
        id: z.string().uuid()
      });

      const middleware = validateRequest({ params: paramsSchema });

      const req = mockRequest({
        params: { id: 'invalid-uuid' }
      });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'id',
              message: 'Invalid UUID',
              code: 'invalid_format'
            })
          ]),
          timestamp: expect.any(String)
        }
      });
    });

    it('should return 400 error for invalid query data', () => {
      const querySchema = z.object({
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100))
      });

      const middleware = validateRequest({ query: querySchema });

      const req = mockRequest({
        query: { limit: '0' } // should be >= 1
      });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'limit',
              message: 'Too small: expected number to be >=1'
            })
          ]),
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle multiple validation errors', () => {
      const bodySchema = z.object({
        name: z.string().min(2),
        age: z.number().min(0),
        email: z.string().email()
      });

      const middleware = validateRequest({ body: bodySchema });

      const req = mockRequest({
        body: {
          name: 'A', // too short
          age: -1,   // negative
          email: 'invalid-email' // invalid format
        }
      });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'name' }),
            expect.objectContaining({ field: 'age' }),
            expect.objectContaining({ field: 'email' })
          ]),
          timestamp: expect.any(String)
        }
      });
    });

    it('should pass non-Zod errors to next middleware', () => {
      const bodySchema = z.object({
        name: z.string()
      });

      // Mock schema.parse to throw a non-Zod error
      const mockSchema = {
        parse: vi.fn().mockImplementation(() => {
          throw new Error('Non-Zod error');
        })
      };

      const middleware = validateRequest({ body: mockSchema as any });

      const req = mockRequest({ body: { name: 'John' } });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('validateBody', () => {
    it('should validate only request body', () => {
      const schema = z.object({
        name: z.string()
      });

      const middleware = validateBody(schema);

      const req = mockRequest({
        body: { name: 'John' },
        params: { invalid: 'data' } // This should be ignored
      });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('validateParams', () => {
    it('should validate only request params', () => {
      const schema = z.object({
        id: z.string()
      });

      const middleware = validateParams(schema);

      const req = mockRequest({
        params: { id: '123' },
        body: { invalid: 'data' } // This should be ignored
      });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('validateQuery', () => {
    it('should validate only request query', () => {
      const schema = z.object({
        search: z.string()
      });

      const middleware = validateQuery(schema);

      const req = mockRequest({
        query: { search: 'test' },
        body: { invalid: 'data' } // This should be ignored
      });
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});