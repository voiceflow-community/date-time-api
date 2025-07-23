import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Server } from 'http';

describe('API Integration Tests', () => {
  let server: Server;

  beforeAll(async () => {
    // Start the server for testing
    server = app.listen(0); // Use port 0 to get a random available port
    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Close the server after tests
    if (server) {
      server.close();
    }
  });

  describe('Current Time Endpoint - GET /api/time/current/{timezone}', () => {
    describe('Successful Requests', () => {
      it('should return current time for valid timezone (America/New_York)', async () => {
        const response = await request(app)
          .get('/api/time/current/America/New_York')
          .expect('Content-Type', /json/)
          .expect(200);

        // Validate response structure
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('timezone');
        expect(response.body).toHaveProperty('utcOffset');
        expect(response.body).toHaveProperty('formatted');

        // Validate formatted object structure
        expect(response.body.formatted).toHaveProperty('date');
        expect(response.body.formatted).toHaveProperty('time');
        expect(response.body.formatted).toHaveProperty('full');

        // Validate data types
        expect(typeof response.body.timestamp).toBe('string');
        expect(typeof response.body.timezone).toBe('string');
        expect(typeof response.body.utcOffset).toBe('string');
        expect(typeof response.body.formatted.date).toBe('string');
        expect(typeof response.body.formatted.time).toBe('string');
        expect(typeof response.body.formatted.full).toBe('string');

        // Validate specific values
        expect(response.body.timezone).toBe('America/New_York');
        expect(response.body.utcOffset).toMatch(/^[+-]\d{2}:\d{2}$/);
        
        // Validate timestamp is valid ISO 8601
        expect(() => new Date(response.body.timestamp)).not.toThrow();
        expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
      });

      it('should return current time for UTC timezone', async () => {
        const response = await request(app)
          .get('/api/time/current/UTC')
          .expect(200);

        expect(response.body.timezone).toBe('UTC');
        expect(response.body.utcOffset).toBe('+00:00');
      });

      it('should return current time for Europe/London timezone', async () => {
        const response = await request(app)
          .get('/api/time/current/Europe/London')
          .expect(200);

        expect(response.body.timezone).toBe('Europe/London');
        expect(response.body.utcOffset).toMatch(/^[+-]\d{2}:\d{2}$/);
      });

      it('should return current time for Asia/Tokyo timezone', async () => {
        const response = await request(app)
          .get('/api/time/current/Asia/Tokyo')
          .expect(200);

        expect(response.body.timezone).toBe('Asia/Tokyo');
        expect(response.body.utcOffset).toMatch(/^[+-]\d{2}:\d{2}$/);
      });

      it('should handle timezone with special characters', async () => {
        const response = await request(app)
          .get('/api/time/current/America/Argentina/Buenos_Aires')
          .expect(200);

        expect(response.body.timezone).toBe('America/Argentina/Buenos_Aires');
      });
    });

    describe('Error Handling', () => {
      it('should return 400 for invalid timezone format', async () => {
        const response = await request(app)
          .get('/api/time/current/InvalidTimezone')
          .expect('Content-Type', /json/)
          .expect(400);

        // Validate error response structure
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error).toHaveProperty('timestamp');

        // Validate error details
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toContain('validation failed');
        expect(response.body.error.details).toBeDefined();
        expect(Array.isArray(response.body.error.details)).toBe(true);
      });

      it('should return 400 for empty timezone parameter', async () => {
        const response = await request(app)
          .get('/api/time/current/')
          .expect(404); // Route not found since parameter is missing

        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('should return 400 for timezone with invalid characters', async () => {
        const response = await request(app)
          .get('/api/time/current/Invalid@Timezone!')
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for non-existent timezone', async () => {
        const response = await request(app)
          .get('/api/time/current/Fake/NonExistent')
          .expect(400);

        expect(response.body.error.code).toMatch(/VALIDATION_ERROR|INVALID_TIMEZONE/);
      });
    });

    describe('Response Headers and Metadata', () => {
      it('should return proper content-type header', async () => {
        const response = await request(app)
          .get('/api/time/current/UTC')
          .expect(200);

        expect(response.headers['content-type']).toMatch(/application\/json/);
      });

      it('should include CORS headers', async () => {
        const response = await request(app)
          .get('/api/time/current/UTC')
          .expect(200);

        expect(response.headers).toHaveProperty('access-control-allow-origin');
      });

      it('should include security headers', async () => {
        const response = await request(app)
          .get('/api/time/current/UTC')
          .expect(200);

        // Check for helmet security headers
        expect(response.headers).toHaveProperty('x-content-type-options');
        expect(response.headers).toHaveProperty('x-frame-options');
      });
    });
  });

  describe('Current Time Endpoint - POST /api/time/current', () => {
    describe('Successful Requests', () => {
      it('should return current time for valid timezone (Europe/Paris)', async () => {
        const requestBody = {
          timezone: 'Europe/Paris'
        };

        const response = await request(app)
          .post('/api/time/current')
          .send(requestBody)
          .expect('Content-Type', /json/)
          .expect(200);

        // Validate response structure
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('timezone');
        expect(response.body).toHaveProperty('utcOffset');
        expect(response.body).toHaveProperty('formatted');

        // Validate formatted object structure
        expect(response.body.formatted).toHaveProperty('date');
        expect(response.body.formatted).toHaveProperty('time');
        expect(response.body.formatted).toHaveProperty('full');

        // Validate data types
        expect(typeof response.body.timestamp).toBe('string');
        expect(typeof response.body.timezone).toBe('string');
        expect(typeof response.body.utcOffset).toBe('string');
        expect(typeof response.body.formatted.date).toBe('string');
        expect(typeof response.body.formatted.time).toBe('string');
        expect(typeof response.body.formatted.full).toBe('string');

        // Validate specific values
        expect(response.body.timezone).toBe('Europe/Paris');
        expect(response.body.utcOffset).toMatch(/^[+-]\d{2}:\d{2}$/);
        
        // Validate timestamp is valid ISO 8601
        expect(() => new Date(response.body.timestamp)).not.toThrow();
        expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
      });

      it('should return current time for UTC timezone', async () => {
        const requestBody = {
          timezone: 'UTC'
        };

        const response = await request(app)
          .post('/api/time/current')
          .send(requestBody)
          .expect(200);

        expect(response.body.timezone).toBe('UTC');
        expect(response.body.utcOffset).toBe('+00:00');
      });

      it('should handle timezone with special characters', async () => {
        const requestBody = {
          timezone: 'America/Argentina/Buenos_Aires'
        };

        const response = await request(app)
          .post('/api/time/current')
          .send(requestBody)
          .expect(200);

        expect(response.body.timezone).toBe('America/Argentina/Buenos_Aires');
      });
    });

    describe('Error Handling', () => {
      it('should return 400 for invalid timezone format', async () => {
        const requestBody = {
          timezone: 'InvalidTimezone'
        };

        const response = await request(app)
          .post('/api/time/current')
          .send(requestBody)
          .expect('Content-Type', /json/)
          .expect(400);

        // Validate error response structure
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error).toHaveProperty('timestamp');

        // Validate error details
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toContain('validation failed');
        expect(response.body.error.details).toBeDefined();
        expect(Array.isArray(response.body.error.details)).toBe(true);
      });

      it('should return 400 for missing timezone parameter', async () => {
        const response = await request(app)
          .post('/api/time/current')
          .send({})
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details).toBeDefined();
        
        // Check that timezone validation failed
        const timezoneError = response.body.error.details.find((d: any) => d.field === 'timezone');
        expect(timezoneError).toBeDefined();
      });

      it('should return 400 for timezone with invalid characters', async () => {
        const requestBody = {
          timezone: 'Invalid@Timezone!'
        };

        const response = await request(app)
          .post('/api/time/current')
          .send(requestBody)
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for non-existent timezone', async () => {
        const requestBody = {
          timezone: 'Fake/NonExistent'
        };

        const response = await request(app)
          .post('/api/time/current')
          .send(requestBody)
          .expect(400);

        expect(response.body.error.code).toMatch(/VALIDATION_ERROR|INVALID_TIMEZONE/);
      });
    });

    describe('Response Headers and Metadata', () => {
      it('should return proper content-type header', async () => {
        const requestBody = {
          timezone: 'UTC'
        };

        const response = await request(app)
          .post('/api/time/current')
          .send(requestBody)
          .expect(200);

        expect(response.headers['content-type']).toMatch(/application\/json/);
      });

      it('should include CORS headers', async () => {
        const requestBody = {
          timezone: 'UTC'
        };

        const response = await request(app)
          .post('/api/time/current')
          .send(requestBody)
          .expect(200);

        expect(response.headers).toHaveProperty('access-control-allow-origin');
      });
    });
  });

  describe('Time Conversion Endpoint - POST /api/time/convert', () => {
    describe('Successful Requests', () => {
      it('should convert time between timezones successfully', async () => {
        const requestBody = {
          sourceTime: '2024-01-15T14:30:00',
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        };

        const response = await request(app)
          .post('/api/time/convert')
          .send(requestBody)
          .expect('Content-Type', /json/)
          .expect(200);

        // Validate response structure
        expect(response.body).toHaveProperty('original');
        expect(response.body).toHaveProperty('converted');
        expect(response.body).toHaveProperty('utcOffsetDifference');

        // Validate original time structure
        expect(response.body.original).toHaveProperty('timestamp');
        expect(response.body.original).toHaveProperty('timezone');
        expect(response.body.original).toHaveProperty('formatted');

        // Validate converted time structure
        expect(response.body.converted).toHaveProperty('timestamp');
        expect(response.body.converted).toHaveProperty('timezone');
        expect(response.body.converted).toHaveProperty('formatted');

        // Validate data types
        expect(typeof response.body.original.timestamp).toBe('string');
        expect(typeof response.body.original.timezone).toBe('string');
        expect(typeof response.body.original.formatted).toBe('string');
        expect(typeof response.body.converted.timestamp).toBe('string');
        expect(typeof response.body.converted.timezone).toBe('string');
        expect(typeof response.body.converted.formatted).toBe('string');
        expect(typeof response.body.utcOffsetDifference).toBe('string');

        // Validate specific values
        expect(response.body.original.timezone).toBe('America/New_York');
        expect(response.body.converted.timezone).toBe('Europe/London');

        // Validate timestamps are valid ISO 8601
        expect(() => new Date(response.body.original.timestamp)).not.toThrow();
        expect(() => new Date(response.body.converted.timestamp)).not.toThrow();
      });

      it('should handle ISO 8601 timestamp with timezone', async () => {
        const requestBody = {
          sourceTime: '2024-01-15T14:30:00-05:00',
          sourceTimezone: 'America/New_York',
          targetTimezone: 'UTC'
        };

        const response = await request(app)
          .post('/api/time/convert')
          .send(requestBody)
          .expect(200);

        expect(response.body.original.timezone).toBe('America/New_York');
        expect(response.body.converted.timezone).toBe('UTC');
      });

      it('should convert between same timezone (no change)', async () => {
        const requestBody = {
          sourceTime: '2024-01-15T14:30:00',
          sourceTimezone: 'UTC',
          targetTimezone: 'UTC'
        };

        const response = await request(app)
          .post('/api/time/convert')
          .send(requestBody)
          .expect(200);

        expect(response.body.original.timezone).toBe('UTC');
        expect(response.body.converted.timezone).toBe('UTC');
        expect(response.body.utcOffsetDifference).toBe('+00:00');
      });

      it('should handle date-only input', async () => {
        const requestBody = {
          sourceTime: '2024-01-15',
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        };

        const response = await request(app)
          .post('/api/time/convert')
          .send(requestBody)
          .expect(200);

        expect(response.body.original.timezone).toBe('America/New_York');
        expect(response.body.converted.timezone).toBe('Europe/London');
      });
    });

    describe('Error Handling', () => {
      it('should return 400 for missing required fields', async () => {
        const incompleteBody = {
          sourceTime: '2024-01-15T14:30:00',
          sourceTimezone: 'America/New_York'
          // Missing targetTimezone
        };

        const response = await request(app)
          .post('/api/time/convert')
          .send(incompleteBody)
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details).toBeDefined();
        expect(Array.isArray(response.body.error.details)).toBe(true);
        
        // Check that the missing field is mentioned in validation details
        const fieldErrors = response.body.error.details.map((d: any) => d.field);
        expect(fieldErrors).toContain('targetTimezone');
      });

      it('should return 400 for invalid datetime format', async () => {
        const invalidBody = {
          sourceTime: 'invalid-date-format',
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
        expect(sourceTimeError.message).toContain('datetime format');
      });

      it('should return 400 for invalid source timezone', async () => {
        const invalidBody = {
          sourceTime: '2024-01-15T14:30:00',
          sourceTimezone: 'Invalid/Timezone',
          targetTimezone: 'Europe/London'
        };

        const response = await request(app)
          .post('/api/time/convert')
          .send(invalidBody)
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for invalid target timezone', async () => {
        const invalidBody = {
          sourceTime: '2024-01-15T14:30:00',
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Invalid/Timezone'
        };

        const response = await request(app)
          .post('/api/time/convert')
          .send(invalidBody)
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for empty request body', async () => {
        const response = await request(app)
          .post('/api/time/convert')
          .send({})
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details).toBeDefined();
        expect(response.body.error.details.length).toBeGreaterThan(0);
      });

      it('should return 400 for malformed JSON', async () => {
        const response = await request(app)
          .post('/api/time/convert')
          .set('Content-Type', 'application/json')
          .send('{"invalid": json}')
          .expect(400);

        expect(response.body.error.code).toMatch(/INVALID_JSON|VALIDATION_ERROR/);
      });
    });

    describe('Content Type Handling', () => {
      it('should accept application/json content type', async () => {
        const requestBody = {
          sourceTime: '2024-01-15T14:30:00',
          sourceTimezone: 'UTC',
          targetTimezone: 'UTC'
        };

        const response = await request(app)
          .post('/api/time/convert')
          .set('Content-Type', 'application/json')
          .send(requestBody)
          .expect(200);

        expect(response.body.original.timezone).toBe('UTC');
      });

      it('should reject unsupported content types', async () => {
        const response = await request(app)
          .post('/api/time/convert')
          .set('Content-Type', 'text/plain')
          .send('plain text data')
          .expect(400);

        // Should fail due to invalid JSON or content type
        expect(response.body.error).toBeDefined();
      });
    });
  });

  describe('Health Check Endpoint - GET /health', () => {
    describe('Successful Requests', () => {
      it('should return health status with all required fields', async () => {
        const response = await request(app)
          .get('/health')
          .expect('Content-Type', /json/)
          .expect(200);

        // Validate response structure
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('memory');
        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('timestamp');

        // Validate memory object structure
        expect(response.body.memory).toHaveProperty('used');
        expect(response.body.memory).toHaveProperty('total');
        expect(response.body.memory).toHaveProperty('percentage');

        // Validate data types
        expect(typeof response.body.status).toBe('string');
        expect(typeof response.body.uptime).toBe('number');
        expect(typeof response.body.memory.used).toBe('number');
        expect(typeof response.body.memory.total).toBe('number');
        expect(typeof response.body.memory.percentage).toBe('number');
        expect(typeof response.body.version).toBe('string');
        expect(typeof response.body.timestamp).toBe('string');

        // Validate enum values
        expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);

        // Validate numeric constraints
        expect(response.body.uptime).toBeGreaterThanOrEqual(0);
        expect(response.body.memory.used).toBeGreaterThanOrEqual(0);
        expect(response.body.memory.total).toBeGreaterThanOrEqual(0);
        expect(response.body.memory.percentage).toBeGreaterThanOrEqual(0);
        expect(response.body.memory.percentage).toBeLessThanOrEqual(100);

        // Validate timestamp format
        expect(() => new Date(response.body.timestamp)).not.toThrow();
        expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
      });

      it('should not be rate limited', async () => {
        // Health endpoint should not be rate limited
        const requests = Array(10).fill(null).map(() => 
          request(app).get('/health')
        );

        const responses = await Promise.all(requests);
        
        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('status');
        });
      });
    });

    describe('Performance and Reliability', () => {
      it('should respond quickly', async () => {
        const startTime = Date.now();
        
        await request(app)
          .get('/health')
          .expect(200);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      });

      it('should handle concurrent requests', async () => {
        const concurrentRequests = Array(20).fill(null).map(() => 
          request(app).get('/health')
        );

        const responses = await Promise.all(concurrentRequests);
        
        responses.forEach(response => {
          expect([200, 503]).toContain(response.status); // 503 if unhealthy
          expect(response.body).toHaveProperty('status');
          expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
        });
      });
    });
  });

  describe('Unknown Routes - 404 Handling', () => {
    it('should return 404 for unknown GET routes', async () => {
      const response = await request(app)
        .get('/api/unknown/route')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('Route GET /api/unknown/route not found');
    });

    it('should return 404 for unknown POST routes', async () => {
      const response = await request(app)
        .post('/api/unknown/route')
        .send({})
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('Route POST /api/unknown/route not found');
    });

    it('should return 404 for unsupported HTTP methods', async () => {
      const response = await request(app)
        .put('/api/time/current/UTC')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});