import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { getHealth } from '../../../src/controllers/healthController.js';
import { timezoneService } from '../../../src/services/TimezoneService.js';
import * as fs from 'fs';

// Mock the timezone service
vi.mock('../../../src/services/TimezoneService.js', () => ({
  timezoneService: {
    getServiceHealth: vi.fn()
  }
}));

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn()
}));

// Mock process methods
const mockProcess = {
  uptime: vi.fn(),
  memoryUsage: vi.fn(),
  cwd: vi.fn()
};

// Replace process methods with mocks
Object.defineProperty(global, 'process', {
  value: {
    ...process,
    uptime: mockProcess.uptime,
    memoryUsage: mockProcess.memoryUsage,
    cwd: mockProcess.cwd
  },
  writable: true
});

describe('healthController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    mockNext = vi.fn();
    vi.clearAllMocks();

    // Set up default mock implementations
    mockProcess.uptime.mockReturnValue(3600); // 1 hour uptime
    mockProcess.memoryUsage.mockReturnValue({
      rss: 50000000,
      heapTotal: 20000000,
      heapUsed: 15000000,
      external: 1000000,
      arrayBuffers: 500000
    });
    mockProcess.cwd.mockReturnValue('/app');
    
    vi.mocked(timezoneService.getServiceHealth).mockReturnValue({
      status: 'healthy',
      supportedTimezones: 400,
      version: '1.0.0'
    });

    // Mock fs.readFileSync to return package.json content
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      name: 'timezone-api-server',
      version: '1.0.0'
    }));
  });

  describe('getHealth', () => {
    it('should return healthy status with detailed system information', async () => {
      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'healthy',
        uptime: 3600,
        memory: {
          used: 15000000,
          total: 20000000,
          percentage: 75
        },
        version: '1.0.0',
        timestamp: expect.any(String)
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return degraded status for high memory usage', async () => {
      // Arrange - Set memory usage to 80% (above 75% threshold)
      mockProcess.memoryUsage.mockReturnValue({
        rss: 50000000,
        heapTotal: 10000000,
        heapUsed: 8000000, // 80%
        external: 1000000,
        arrayBuffers: 500000
      });

      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          memory: {
            used: 8000000,
            total: 10000000,
            percentage: 80
          }
        })
      );
    });

    it('should return unhealthy status for very high memory usage', async () => {
      // Arrange - Set memory usage to 95% (above 90% threshold)
      mockProcess.memoryUsage.mockReturnValue({
        rss: 50000000,
        heapTotal: 10000000,
        heapUsed: 9500000, // 95%
        external: 1000000,
        arrayBuffers: 500000
      });

      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          memory: {
            used: 9500000,
            total: 10000000,
            percentage: 95
          }
        })
      );
    });

    it('should return degraded status for very low uptime', async () => {
      // Arrange - Set uptime to 5 seconds (below 10 second threshold)
      mockProcess.uptime.mockReturnValue(5);

      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          uptime: 5
        })
      );
    });

    it('should read service version from package.json', async () => {
      // Arrange
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        name: 'timezone-api-server',
        version: '2.1.0'
      }));

      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '2.1.0'
        })
      );
      expect(fs.readFileSync).toHaveBeenCalledWith('/app/package.json', 'utf8');
    });

    it('should fallback to default version when package.json read fails', async () => {
      // Arrange
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '1.0.0'
        })
      );
    });

    it('should return unhealthy status when timezone service is unhealthy', async () => {
      // Arrange
      vi.mocked(timezoneService.getServiceHealth).mockReturnValue({
        status: 'unhealthy',
        supportedTimezones: 0,
        version: '1.0.0'
      });

      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy'
        })
      );
    });

    it('should handle timezone service errors and return unhealthy status', async () => {
      // Arrange
      vi.mocked(timezoneService.getServiceHealth).mockImplementation(() => {
        throw new Error('Service health check failed');
      });

      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy'
        })
      );
    });

    it('should handle process.uptime() errors gracefully', async () => {
      // Arrange
      mockProcess.uptime.mockImplementation(() => {
        throw new Error('Uptime retrieval failed');
      });

      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy'
        })
      );
    });

    it('should handle process.memoryUsage() errors gracefully', async () => {
      // Arrange
      mockProcess.memoryUsage.mockImplementation(() => {
        throw new Error('Memory usage retrieval failed');
      });

      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy'
        })
      );
    });

    it('should provide emergency response when critical errors occur', async () => {
      // Arrange - Mock all functions to throw errors to trigger the critical error path
      mockProcess.uptime.mockImplementation(() => {
        throw new Error('Critical uptime error');
      });
      mockProcess.memoryUsage.mockImplementation(() => {
        throw new Error('Critical memory error');
      });
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Critical file read error');
      });
      vi.mocked(timezoneService.getServiceHealth).mockImplementation(() => {
        throw new Error('Critical service error');
      });

      // Mock Date.prototype.toISOString to throw error during emergency response
      const originalToISOString = Date.prototype.toISOString;
      Date.prototype.toISOString = vi.fn().mockImplementation(() => {
        throw new Error('Critical ISO string error');
      });

      try {
        // Act
        await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert - Should call next middleware when even emergency response fails
        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      } finally {
        // Restore Date.prototype.toISOString
        Date.prototype.toISOString = originalToISOString;
      }
    });

    it('should calculate memory percentage correctly', async () => {
      // Arrange
      mockProcess.memoryUsage.mockReturnValue({
        rss: 50000000,
        heapTotal: 10000000,
        heapUsed: 3000000,
        external: 1000000,
        arrayBuffers: 500000
      });

      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          memory: {
            used: 3000000,
            total: 10000000,
            percentage: 30
          }
        })
      );
    });

    it('should handle zero memory usage', async () => {
      // Arrange
      mockProcess.memoryUsage.mockReturnValue({
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0
      });

      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          memory: {
            used: 0,
            total: 0,
            percentage: 0 // Should handle division by zero
          }
        })
      );
    });

    it('should round uptime to nearest second', async () => {
      // Arrange
      mockProcess.uptime.mockReturnValue(3661.7); // 1 hour, 1 minute, 1.7 seconds

      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          uptime: 3662
        })
      );
    });

    it('should include valid ISO timestamp', async () => {
      // Act
      await getHealth(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const callArgs = vi.mocked(mockResponse.json).mock.calls[0][0];
      const timestamp = callArgs.timestamp;
      
      // Verify it's a valid ISO string
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });
});