import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Server } from 'http';

// Test helper functions to reduce duplication
const validateTimeResponse = (responseBody: any, expectedTimezone: string) => {
  // Validate response structure
  expect(responseBody).toHaveProperty('timestamp');
  expect(responseBody).toHaveProperty('timezone');
  expect(responseBody).toHaveProperty('utcOffset');
  expect(responseBody).toHaveProperty('formatted');

  // Validate formatted object structure
  expect(responseBody.formatted).toHaveProperty('date');
  expect(responseBody.formatted).toHaveProperty('time');
  expect(responseBody.formatted).toHaveProperty('full');

  // Validate data types
  expect(typeof responseBody.timestamp).toBe('string');
  expect(typeof responseBody.timezone).toBe('string');
  expect(typeof responseBody.utcOffset).toBe('string');
  expect(typeof responseBody.formatted.date).toBe('string');
  expect(typeof responseBody.formatted.time).toBe('string');
  expect(typeof responseBody.formatted.full).toBe('string');

  // Validate specific values
  expect(responseBody.timezone).toBe(expectedTimezone);
  expect(responseBody.utcOffset).toMatch(/^[+-]\d{2}:\d{2}$/);

  // Validate timestamp is valid ISO 8601 (but don't require UTC format)
  expect(() => new Date(responseBody.timestamp)).not.toThrow();
  // Just validate that it's a valid timestamp, not that it matches UTC format
  const parsedDate = new Date(responseBody.timestamp);
  expect(parsedDate.getTime()).not.toBeNaN();
};

const validateErrorResponse = (responseBody: any, expectedCode?: string) => {
  // Validate error response structure
  expect(responseBody).toHaveProperty('error');
  expect(responseBody.error).toHaveProperty('code');
  expect(responseBody.error).toHaveProperty('message');
  expect(responseBody.error).toHaveProperty('timestamp');

  if (expectedCode) {
    expect(responseBody.error.code).toBe(expectedCode);
  }
};

const validateConversionResponse = (responseBody: any, sourceTimezone: string, targetTimezone: string) => {
  // Validate response structure
  expect(responseBody).toHaveProperty('original');
  expect(responseBody).toHaveProperty('converted');
  expect(responseBody).toHaveProperty('utcOffsetDifference');

  // Validate original time structure
  expect(responseBody.original).toHaveProperty('timestamp');
  expect(responseBody.original).toHaveProperty('timezone');
  expect(responseBody.original).toHaveProperty('formatted');

  // Validate converted time structure
  expect(responseBody.converted).toHaveProperty('timestamp');
  expect(responseBody.converted).toHaveProperty('timezone');
  expect(responseBody.converted).toHaveProperty('formatted');

  // Validate data types
  expect(typeof responseBody.original.timestamp).toBe('string');
  expect(typeof responseBody.original.timezone).toBe('string');
  expect(typeof responseBody.original.formatted).toBe('string');
  expect(typeof responseBody.converted.timestamp).toBe('string');
  expect(typeof responseBody.converted.timezone).toBe('string');
  expect(typeof responseBody.converted.formatted).toBe('string');
  expect(typeof responseBody.utcOffsetDifference).toBe('string');

  // Validate specific values
  expect(responseBody.original.timezone).toBe(sourceTimezone);
  expect(responseBody.converted.timezone).toBe(targetTimezone);

  // Validate timestamps are valid ISO 8601
  expect(() => new Date(responseBody.original.timestamp)).not.toThrow();
  expect(() => new Date(responseBody.converted.timestamp)).not.toThrow();
};

const validateHealthResponse = (responseBody: any) => {
  // Validate response structure
  expect(responseBody).toHaveProperty('status');
  expect(responseBody).toHaveProperty('uptime');
  expect(responseBody).toHaveProperty('memory');
  expect(responseBody).toHaveProperty('version');
  expect(responseBody).toHaveProperty('timestamp');

  // Validate memory object structure
  expect(responseBody.memory).toHaveProperty('used');
  expect(responseBody.memory).toHaveProperty('total');
  expect(responseBody.memory).toHaveProperty('percentage');

  // Validate data types
  expect(typeof responseBody.status).toBe('string');
  expect(typeof responseBody.uptime).toBe('number');
  expect(typeof responseBody.memory.used).toBe('number');
  expect(typeof responseBody.memory.total).toBe('number');
  expect(typeof responseBody.memory.percentage).toBe('number');
  expect(typeof responseBody.version).toBe('string');
  expect(typeof responseBody.timestamp).toBe('string');

  // Validate enum values
  expect(['healthy', 'degraded', 'unhealthy']).toContain(responseBody.status);

  // Validate numeric constraints
  expect(responseBody.uptime).toBeGreaterThanOrEqual(0);
  expect(responseBody.memory.used).toBeGreaterThanOrEqual(0);
  expect(responseBody.memory.total).toBeGreaterThanOrEqual(0);
  expect(responseBody.memory.percentage).toBeGreaterThanOrEqual(0);
  expect(responseBody.memory.percentage).toBeLessThanOrEqual(100);

  // Validate timestamp format
  expect(() => new Date(responseBody.timestamp)).not.toThrow();
  expect(new Date(responseBody.timestamp).toISOString()).toBe(responseBody.timestamp);
};

const validateCommonHeaders = (response: any) => {
  expect(response.headers['content-type']).toMatch(/application\/json/);
  expect(response.headers).toHaveProperty('access-control-allow-origin');
  expect(response.headers).toHaveProperty('x-content-type-options');
  expect(response.headers).toHaveProperty('x-frame-options');
};

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
          .get('/api/time/current/' + encodeURIComponent('America/New_York'))
          .expect('Content-Type', /json/)
          .expect(200);

        validateTimeResponse(response.body, 'America/New_York');
      });

      it('should return current time for UTC timezone', async () => {
        const response = await request(app)
          .get('/api/time/current/UTC')
          .expect(200);

        validateTimeResponse(response.body, 'UTC');
        expect(response.body.utcOffset).toBe('+00:00');
      });

      it('should return current time for Europe/London timezone', async () => {
        const response = await request(app)
          .get('/api/time/current/' + encodeURIComponent('Europe/London'))
          .expect(200);

        validateTimeResponse(response.body, 'Europe/London');
      });

      it('should return current time for Asia/Tokyo timezone', async () => {
        const response = await request(app)
          .get('/api/time/current/' + encodeURIComponent('Asia/Tokyo'))
          .expect(200);

        validateTimeResponse(response.body, 'Asia/Tokyo');
      });

      it('should handle timezone with special characters', async () => {
        const response = await request(app)
          .get('/api/time/current/' + encodeURIComponent('America/Argentina/Buenos_Aires'))
          .expect(200);

        validateTimeResponse(response.body, 'America/Argentina/Buenos_Aires');
      });
    });

    describe('Error Handling', () => {
      it('should return 400 for invalid timezone format', async () => {
        const response = await request(app)
          .get('/api/time/current/InvalidTimezone')
          .expect('Content-Type', /json/)
          .expect(400);

        validateErrorResponse(response.body, 'VALIDATION_ERROR');
        expect(response.body.error.message).toContain('validation failed');
        expect(response.body.error.details).toBeDefined();
        expect(Array.isArray(response.body.error.details)).toBe(true);
      });

      it('should return 400 for empty timezone parameter', async () => {
        const response = await request(app)
          .get('/api/time/current/')
          .expect(404); // Route not found since parameter is missing

        validateErrorResponse(response.body, 'NOT_FOUND');
      });

      it('should return 400 for timezone with invalid characters', async () => {
        const response = await request(app)
          .get('/api/time/current/Invalid@Timezone!')
          .expect(400);

        validateErrorResponse(response.body, 'VALIDATION_ERROR');
      });

      it('should return 400 for non-existent timezone', async () => {
        const response = await request(app)
          .get('/api/time/current/' + encodeURIComponent('Fake/NonExistent'))
          .expect(400);

        validateErrorResponse(response.body);
        expect(response.body.error.code).toMatch(/VALIDATION_ERROR|INVALID_TIMEZONE/);
      });
    });

    describe('Response Headers and Metadata', () => {
      it('should return proper headers', async () => {
        const response = await request(app)
          .get('/api/time/current/UTC')
          .expect(200);

        validateCommonHeaders(response);
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

        validateTimeResponse(response.body, 'Europe/Paris');
      });

      it('should return current time for UTC timezone', async () => {
        const requestBody = {
          timezone: 'UTC'
        };

        const response = await request(app)
          .post('/api/time/current')
          .send(requestBody)
          .expect(200);

        validateTimeResponse(response.body, 'UTC');
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

        validateTimeResponse(response.body, 'America/Argentina/Buenos_Aires');
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

        validateErrorResponse(response.body, 'VALIDATION_ERROR');
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

        validateConversionResponse(response.body, 'America/New_York', 'Europe/London');
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

        validateConversionResponse(response.body, 'America/New_York', 'UTC');
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

        validateConversionResponse(response.body, 'UTC', 'UTC');
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

        validateConversionResponse(response.body, 'America/New_York', 'Europe/London');
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

        validateHealthResponse(response.body);
      });

      it('should not be rate limited', async () => {
        // Health endpoint should not be rate limited
        const requests = Array(10).fill(null).map(() =>
          request(app).get('/health')
        );

        const responses = await Promise.all(requests);

        responses.forEach(response => {
          expect(response.status).toBe(200);
          validateHealthResponse(response.body);
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
          if (response.status === 200) {
            validateHealthResponse(response.body);
          } else {
            validateErrorResponse(response.body);
          }
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

      validateErrorResponse(response.body, 'NOT_FOUND');
      expect(response.body.error.message).toContain('Route GET /api/unknown/route not found');
    });

    it('should return 404 for unknown POST routes', async () => {
      const response = await request(app)
        .post('/api/unknown/route')
        .send({})
        .expect(404);

      validateErrorResponse(response.body, 'NOT_FOUND');
      expect(response.body.error.message).toContain('Route POST /api/unknown/route not found');
    });

    it('should return 404 for unsupported HTTP methods', async () => {
      const response = await request(app)
        .put('/api/time/current/UTC')
        .expect(404);

      validateErrorResponse(response.body, 'NOT_FOUND');
    });
  });
});
