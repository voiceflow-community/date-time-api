import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requestLogger, detailedRequestLogger, accessLogger } from '../../../src/middleware/logging.js';

// Mock console.log to capture log output
const mockConsoleLog = vi.fn();
vi.stubGlobal('console', {
  log: mockConsoleLog
});

// Mock Express objects
const mockRequest = (overrides = {}) => ({
  method: 'GET',
  url: '/test',
  originalUrl: '/test',
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' },
  body: {},
  params: {},
  query: {},
  get: vi.fn((header: string) => {
    const headers: Record<string, string> = {
      'User-Agent': 'test-agent',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...overrides.headers
    };
    return headers[header];
  }),
  ...overrides
}) as unknown as Request;

const mockResponse = () => {
  const res = {} as Response;
  res.end = vi.fn();
  res.get = vi.fn();
  res.on = vi.fn();
  res.statusCode = 200;
  return res;
};

const mockNext = vi.fn() as NextFunction;

describe('Logging Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('requestLogger', () => {
    it('should log incoming request', () => {
      const req = mockRequest({
        method: 'POST',
        url: '/api/test',
        body: { name: 'test' },
        params: { id: '123' },
        query: { filter: 'active' }
      });
      const res = mockResponse();

      requestLogger(req, res, mockNext);

      expect(mockConsoleLog).toHaveBeenCalledWith('Incoming request:', {
        method: 'POST',
        url: '/api/test',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
        timestamp: expect.any(String),
        body: { name: 'test' },
        params: { id: '123' },
        query: { filter: 'active' }
      });

      expect(mockNext).toHaveBeenCalled();
    });

    it('should not log body for GET requests', () => {
      const req = mockRequest({
        method: 'GET',
        url: '/api/test',
        body: { should: 'not-appear' }
      });
      const res = mockResponse();

      requestLogger(req, res, mockNext);

      expect(mockConsoleLog).toHaveBeenCalledWith('Incoming request:', {
        method: 'GET',
        url: '/api/test',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
        timestamp: expect.any(String),
        body: undefined,
        params: undefined,
        query: undefined
      });
    });

    it('should log request completion when response ends', () => {
      const req = mockRequest();
      const res = mockResponse();
      res.get = vi.fn().mockReturnValue('100');
      res.statusCode = 201;

      // Start the middleware
      requestLogger(req, res, mockNext);

      // Simulate time passing
      vi.advanceTimersByTime(150);

      // Simulate response ending
      const originalEnd = res.end as any;
      res.end('response data');

      expect(mockConsoleLog).toHaveBeenCalledWith('Request completed:', {
        method: 'GET',
        url: '/test',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
        timestamp: expect.any(String),
        duration: 150,
        statusCode: 201,
        contentLength: 100
      });
    });

    it('should handle missing IP address', () => {
      const req = mockRequest({
        ip: undefined,
        connection: { remoteAddress: undefined }
      });
      const res = mockResponse();

      requestLogger(req, res, mockNext);

      expect(mockConsoleLog).toHaveBeenCalledWith('Incoming request:', 
        expect.objectContaining({
          ip: 'unknown'
        })
      );
    });
  });

  describe('detailedRequestLogger', () => {
    it('should log detailed request information', () => {
      const req = mockRequest({
        method: 'POST',
        url: '/api/users',
        originalUrl: '/api/users?debug=true',
        body: { name: 'John', email: 'john@example.com' }
      });
      const res = mockResponse();

      detailedRequestLogger(req, res, mockNext);

      expect(mockConsoleLog).toHaveBeenCalledWith('📥 Request started:', {
        requestId: expect.stringMatching(/^req_\d+_[a-z0-9]+$/),
        method: 'POST',
        url: '/api/users',
        originalUrl: '/api/users?debug=true',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
        timestamp: expect.any(String),
        headers: {
          contentType: 'application/json',
          accept: 'application/json',
          authorization: undefined
        },
        body: { name: 'John', email: 'john@example.com' },
        params: undefined,
        query: undefined
      });

      // Check that request ID was added to request object
      expect((req as any).requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should redact authorization header', () => {
      const req = mockRequest({
        headers: { 'Authorization': 'Bearer token123' }
      });
      req.get = vi.fn((header: string) => {
        if (header === 'Authorization') return 'Bearer token123';
        return 'test-agent';
      });
      const res = mockResponse();

      detailedRequestLogger(req, res, mockNext);

      expect(mockConsoleLog).toHaveBeenCalledWith('📥 Request started:', 
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: '[REDACTED]'
          })
        })
      );
    });

    it('should not log large request bodies', () => {
      const largeBody = { data: 'x'.repeat(2000) }; // Large body
      const req = mockRequest({ body: largeBody });
      const res = mockResponse();

      detailedRequestLogger(req, res, mockNext);

      expect(mockConsoleLog).toHaveBeenCalledWith('📥 Request started:', 
        expect.objectContaining({
          body: '[BODY_NOT_LOGGED]'
        })
      );
    });

    it('should log request completion with detailed info', () => {
      const req = mockRequest();
      const res = mockResponse();
      res.get = vi.fn().mockReturnValue('250');

      detailedRequestLogger(req, res, mockNext);

      // Simulate time passing
      vi.advanceTimersByTime(75);

      // Simulate response ending
      res.end('test response');

      expect(mockConsoleLog).toHaveBeenCalledWith('📤 Request completed:', {
        requestId: expect.stringMatching(/^req_\d+_[a-z0-9]+$/),
        method: 'GET',
        url: '/test',
        duration: '75ms',
        statusCode: 200,
        contentLength: '250 bytes',
        timestamp: expect.any(String)
      });
    });
  });

  describe('accessLogger', () => {
    it('should log in Apache-style access log format', () => {
      const req = mockRequest({
        method: 'POST',
        url: '/api/users/123'
      });
      const res = mockResponse();
      res.get = vi.fn().mockReturnValue('150');
      res.statusCode = 201;

      // Mock res.on to immediately call the callback
      res.on = vi.fn((event, callback) => {
        if (event === 'finish') {
          // Simulate time passing
          vi.advanceTimersByTime(100);
          callback();
        }
      });

      accessLogger(req, res, mockNext);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(
          /^127\.0\.0\.1 - - \[.+\] "POST \/api\/users\/123 HTTP\/1\.1" 201 150 "test-agent" 100ms$/
        )
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing content length and user agent', () => {
      const req = mockRequest();
      req.get = vi.fn().mockReturnValue(undefined);
      const res = mockResponse();
      res.get = vi.fn().mockReturnValue(undefined);

      res.on = vi.fn((event, callback) => {
        if (event === 'finish') {
          callback();
        }
      });

      accessLogger(req, res, mockNext);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(
          /^127\.0\.0\.1 - - \[.+\] "GET \/test HTTP\/1\.1" 200 - "-" \d+ms$/
        )
      );
    });

    it('should handle missing IP address', () => {
      const req = mockRequest({
        ip: undefined,
        connection: { remoteAddress: undefined }
      });
      const res = mockResponse();

      res.on = vi.fn((event, callback) => {
        if (event === 'finish') {
          callback();
        }
      });

      accessLogger(req, res, mockNext);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/^- - - \[.+\]/)
      );
    });
  });
});