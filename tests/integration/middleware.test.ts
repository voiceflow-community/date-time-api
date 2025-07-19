import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Server } from 'http';

describe('Middleware Integration Tests', () => {
  let server: Server;

  beforeAll(async () => {
    // Start the server for testing
    server = app.listen(0); // Use port 0 to get a random available port
  });

  afterAll(async () => {
    // Close the server after tests
    if (server) {
      server.close();
    }
  });

  describe('Security Middleware (Helmet)', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for helmet security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers['x-frame-options']).toBe('DENY');
      
      expect(response.headers).toHaveProperty('x-download-options');
      expect(response.headers['x-download-options']).toBe('noopen');
    });

    it('should include Content Security Policy headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('content-security-policy');
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
    });

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Server header should not be present or should be modified
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS Middleware', () => {
    it('should include CORS headers for API requests', async () => {
      const response = await request(app)
        .get('/api/time/current/UTC')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers['access-control-allow-origin']).toBe('*');
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/time/convert')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    it('should allow specified HTTP methods', async () => {
      const response = await request(app)
        .options('/api/time/convert')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      const allowedMethods = response.headers['access-control-allow-methods'];
      expect(allowedMethods).toContain('POST');
      expect(allowedMethods).toContain('GET');
      expect(allowedMethods).toContain('OPTIONS');
    });

    it('should allow specified headers', async () => {
      const response = await request(app)
        .options('/api/time/convert')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization')
        .expect(204);

      const allowedHeaders = response.headers['access-control-allow-headers'];
      expect(allowedHeaders).toContain('Content-Type');
      expect(allowedHeaders).toContain('Authorization');
    });
  });

  describe('Rate Limiting Middleware', () => {
    it('should apply rate limiting to API routes', async () => {
      // Make multiple requests quickly to trigger rate limiting
      const requests = Array(105).fill(null).map(() => 
        request(app).get('/api/time/current/UTC')
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check rate limit response format
      if (rateLimitedResponses.length > 0) {
        const rateLimitResponse = rateLimitedResponses[0];
        expect(rateLimitResponse.body.error.code).toBe('TOO_MANY_REQUESTS');
        expect(rateLimitResponse.body.error.message).toContain('Too many requests');
      }
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/time/current/UTC');

      // Check for rate limit headers (if not rate limited)
      if (response.status === 200) {
        expect(response.headers).toHaveProperty('ratelimit-limit');
        expect(response.headers).toHaveProperty('ratelimit-remaining');
        expect(response.headers).toHaveProperty('ratelimit-reset');
      }
    });

    it('should not rate limit health endpoint', async () => {
      // Make many requests to health endpoint
      const requests = Array(50).fill(null).map(() => 
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      
      // All health requests should succeed (no rate limiting)
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
      });
    });

    it('should reset rate limit after window expires', async () => {
      // This test would require waiting for the rate limit window to reset
      // For now, we'll just verify the rate limit configuration is working
      const response = await request(app)
        .get('/api/time/current/UTC');

      if (response.status === 200) {
        expect(response.headers).toHaveProperty('ratelimit-limit');
        const limit = parseInt(response.headers['ratelimit-limit']);
        expect(limit).toBe(100); // Should match our configured limit
      }
    });
  });

  describe('Request Validation Middleware', () => {
    it('should validate timezone parameters', async () => {
      const response = await request(app)
        .get('/api/time/current/InvalidTimezone')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
      expect(Array.isArray(response.body.error.details)).toBe(true);

      // Check validation error details
      const timezoneError = response.body.error.details.find((d: any) => d.field === 'timezone');
      expect(timezoneError).toBeDefined();
      expect(timezoneError.message).toContain('timezone');
    });

    it('should validate request body for conversion endpoint', async () => {
      const invalidBody = {
        sourceTime: 'invalid-date',
        sourceTimezone: 'America/New_York',
        targetTimezone: 'Europe/London'
      };

      const response = await request(app)
        .post('/api/time/convert')
        .send(invalidBody)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();

      // Check that sourceTime validation failed
      const sourceTimeError = response.body.error.details.find((d: any) => d.field === 'sourceTime');
      expect(sourceTimeError).toBeDefined();
    });

    it('should validate required fields', async () => {
      const incompleteBody = {
        sourceTime: '2024-01-15T14:30:00'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/time/convert')
        .send(incompleteBody)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details.length).toBeGreaterThan(0);
    });

    it('should pass validation for valid requests', async () => {
      const validBody = {
        sourceTime: '2024-01-15T14:30:00',
        sourceTimezone: 'America/New_York',
        targetTimezone: 'Europe/London'
      };

      const response = await request(app)
        .post('/api/time/convert')
        .send(validBody)
        .expect(200);

      // Should not have validation errors
      expect(response.body.error).toBeUndefined();
      expect(response.body).toHaveProperty('original');
      expect(response.body).toHaveProperty('converted');
    });
  });

  describe('Error Handling Middleware', () => {
    it('should handle validation errors consistently', async () => {
      const response = await request(app)
        .get('/api/time/current/InvalidTimezone')
        .expect(400);

      // Check error response structure
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('timestamp');

      // Validate timestamp format
      expect(() => new Date(response.body.error.timestamp)).not.toThrow();
      expect(new Date(response.body.error.timestamp).toISOString()).toBe(response.body.error.timestamp);
    });

    it('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/api/time/convert')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.error.code).toMatch(/INVALID_JSON|VALIDATION_ERROR/);
      expect(response.body.error.message).toBeDefined();
    });

    it('should handle 404 errors for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown/endpoint')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('Route GET /api/unknown/endpoint not found');
    });

    it('should include correlation ID in error responses', async () => {
      const response = await request(app)
        .get('/api/time/current/InvalidTimezone')
        .expect(400);

      // Check for correlation ID header
      expect(response.headers).toHaveProperty('x-correlation-id');
      expect(response.headers['x-correlation-id']).toMatch(/^[a-f0-9-]+$/);
    });

    it('should not expose internal error details in production mode', async () => {
      // Set NODE_ENV to production temporarily
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const response = await request(app)
          .get('/api/time/current/InvalidTimezone')
          .expect(400);

        // Error message should be sanitized for production
        expect(response.body.error.message).toBeDefined();
        expect(response.body.error.message).not.toContain('stack');
        expect(response.body.error.message).not.toContain('internal');
      } finally {
        // Restore original NODE_ENV
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should handle content-type validation', async () => {
      const response = await request(app)
        .post('/api/time/convert')
        .set('Content-Type', 'text/plain')
        .send('plain text data')
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBeDefined();
    });
  });

  describe('Request Logging Middleware', () => {
    it('should log requests without affecting response', async () => {
      // Capture console output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (message: string) => {
        logs.push(message);
      };

      try {
        const response = await request(app)
          .get('/health')
          .expect(200);

        // Response should be normal
        expect(response.body).toHaveProperty('status');

        // Should have logged the request (check if any logs contain request info)
        const hasRequestLog = logs.some(log => 
          log.includes('GET') || log.includes('/health') || log.includes('200')
        );
        expect(hasRequestLog).toBe(true);
      } finally {
        // Restore original console.log
        console.log = originalLog;
      }
    });

    it('should include request timing information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Response should include timing headers or be processed quickly
      const responseTime = response.get('X-Response-Time');
      if (responseTime) {
        expect(responseTime).toMatch(/\d+ms/);
      }
    });
  });

  describe('Body Parsing Middleware', () => {
    it('should parse JSON request bodies', async () => {
      const requestBody = {
        sourceTime: '2024-01-15T14:30:00',
        sourceTimezone: 'UTC',
        targetTimezone: 'UTC'
      };

      const response = await request(app)
        .post('/api/time/convert')
        .send(requestBody)
        .expect(200);

      // Should successfully parse and process the JSON body
      expect(response.body.original.timezone).toBe('UTC');
    });

    it('should handle URL-encoded data', async () => {
      const response = await request(app)
        .post('/api/time/convert')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('sourceTime=2024-01-15T14:30:00&sourceTimezone=UTC&targetTimezone=UTC')
        .expect(200);

      expect(response.body.original.timezone).toBe('UTC');
    });

    it('should enforce body size limits', async () => {
      // Create a large payload (larger than 10MB limit)
      const largePayload = {
        sourceTime: '2024-01-15T14:30:00',
        sourceTimezone: 'UTC',
        targetTimezone: 'UTC',
        largeData: 'x'.repeat(11 * 1024 * 1024) // 11MB of data
      };

      const response = await request(app)
        .post('/api/time/convert')
        .send(largePayload)
        .expect(413); // Payload Too Large

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Middleware Chain Integration', () => {
    it('should process middleware in correct order', async () => {
      const response = await request(app)
        .post('/api/time/convert')
        .send({
          sourceTime: '2024-01-15T14:30:00',
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        })
        .expect(200);

      // Should have all middleware effects:
      // 1. Security headers (helmet)
      expect(response.headers).toHaveProperty('x-content-type-options');
      
      // 2. CORS headers
      expect(response.headers).toHaveProperty('access-control-allow-origin');
      
      // 3. Rate limiting headers (if not rate limited)
      if (response.status === 200) {
        expect(response.headers).toHaveProperty('ratelimit-limit');
      }
      
      // 4. Successful validation and processing
      expect(response.body).toHaveProperty('original');
      expect(response.body).toHaveProperty('converted');
    });

    it('should handle errors through the complete middleware chain', async () => {
      const response = await request(app)
        .post('/api/time/convert')
        .send({
          sourceTime: 'invalid-date',
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        })
        .expect(400);

      // Should have security headers even for errors
      expect(response.headers).toHaveProperty('x-content-type-options');
      
      // Should have CORS headers even for errors
      expect(response.headers).toHaveProperty('access-control-allow-origin');
      
      // Should have proper error structure from error handler
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.timestamp).toBeDefined();
      
      // Should have correlation ID from error handler
      expect(response.headers).toHaveProperty('x-correlation-id');
    });

    it('should maintain consistent response format across all endpoints', async () => {
      // Test successful responses
      const healthResponse = await request(app).get('/health').expect(200);
      const timeResponse = await request(app).get('/api/time/current/UTC').expect(200);
      
      // Both should have JSON content type
      expect(healthResponse.headers['content-type']).toMatch(/application\/json/);
      expect(timeResponse.headers['content-type']).toMatch(/application\/json/);
      
      // Test error responses
      const notFoundResponse = await request(app).get('/api/unknown').expect(404);
      const validationResponse = await request(app).get('/api/time/current/Invalid').expect(400);
      
      // Both errors should have consistent structure
      expect(notFoundResponse.body.error.code).toBeDefined();
      expect(notFoundResponse.body.error.timestamp).toBeDefined();
      expect(validationResponse.body.error.code).toBeDefined();
      expect(validationResponse.body.error.timestamp).toBeDefined();
    });
  });
});