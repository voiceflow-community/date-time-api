import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { getHealth } from '../../src/controllers/healthController.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

describe('Health Monitoring Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());

    // Add health endpoint
    app.get('/health', getHealth);

    // Add error handler
    app.use(errorHandler);
  });

  describe('GET /health', () => {
    it('should return health status with all required fields', async () => {
      // Act
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        uptime: expect.any(Number),
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number)
        },
        version: expect.any(String),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      });
    });

    it('should return positive uptime value', async () => {
      // Act
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Assert
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return valid memory usage data', async () => {
      // Act
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Assert
      const { memory } = response.body;
      expect(memory.used).toBeGreaterThanOrEqual(0);
      expect(memory.total).toBeGreaterThanOrEqual(0);
      expect(memory.percentage).toBeGreaterThanOrEqual(0);
      expect(memory.percentage).toBeLessThanOrEqual(100);

      // If total > 0, percentage should be calculated correctly
      if (memory.total > 0) {
        const expectedPercentage = Math.round((memory.used / memory.total) * 100);
        expect(memory.percentage).toBe(expectedPercentage);
      }
    });

    it('should return valid timestamp in ISO format', async () => {
      // Act
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Assert
      const timestamp = response.body.timestamp;
      const parsedDate = new Date(timestamp);

      expect(parsedDate.toISOString()).toBe(timestamp);
      expect(parsedDate.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
    });

    it('should return service version information', async () => {
      // Act
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Assert
      expect(response.body.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic versioning format
    });

    it('should handle multiple concurrent requests', async () => {
      // Arrange
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/health')
      );

      // Act
      const responses = await Promise.all(requests);

      // Assert
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('memory');
        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('timestamp');
      });
    });

    it('should return consistent status across multiple calls', async () => {
      // Act
      const response1 = await request(app).get('/health').expect(200);
      const response2 = await request(app).get('/health').expect(200);

      // Assert
      // Status should be consistent (unless system conditions change dramatically)
      expect(response1.body.status).toBe(response2.body.status);

      // Uptime should increase or stay the same
      expect(response2.body.uptime).toBeGreaterThanOrEqual(response1.body.uptime);

      // Version should be the same
      expect(response1.body.version).toBe(response2.body.version);
    });

    it('should respond quickly (performance test)', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      await request(app)
        .get('/health')
        .expect(200);

      // Assert
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('Health Status Logic', () => {
    it('should return appropriate status based on system conditions', async () => {
      // Act
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Assert
      const { status, memory, uptime } = response.body;

      // Validate status logic
      if (memory.percentage > 90) {
        expect(status).toBe('unhealthy');
        expect(response.status).toBe(503);
      } else if (memory.percentage > 75 || uptime < 10) {
        expect(status).toBe('degraded');
        expect(response.status).toBe(200);
      } else {
        expect(status).toBe('healthy');
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle health check gracefully even under stress', async () => {
      // Arrange - Create multiple concurrent requests to stress the system
      const stressRequests = Array(20).fill(null).map(() =>
        request(app).get('/health')
      );

      // Act
      const responses = await Promise.all(stressRequests);

      // Assert - All requests should complete successfully
      responses.forEach(response => {
        expect([200, 503]).toContain(response.status);
        expect(response.body).toHaveProperty('status');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
      });
    });
  });
});
