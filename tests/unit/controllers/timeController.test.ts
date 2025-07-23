import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { getCurrentTime, convertTime } from '../../../src/controllers/timeController.js';
import { timezoneService, TimezoneError } from '../../../src/services/TimezoneService.js';
import { TimeResponse, ConversionResponse } from '../../../src/types/index.js';

// Mock the timezone service
vi.mock('../../../src/services/TimezoneService.js', () => ({
  timezoneService: {
    getCurrentTime: vi.fn(),
    convertTime: vi.fn()
  },
  TimezoneError: class extends Error {
    constructor(
      message: string,
      public code: string = 'TIMEZONE_ERROR',
      public statusCode: number = 400,
      public details?: any[]
    ) {
      super(message);
      this.name = 'TimezoneError';
    }
  }
}));

describe('timeController', () => {
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
  });

  describe('getCurrentTime', () => {
    it('should return current time for valid timezone using GET request', async () => {
      // Arrange
      const timezone = 'America/New_York';
      const expectedResponse: TimeResponse = {
        timestamp: '2024-01-15T10:30:00.000Z',
        timezone: 'America/New_York',
        utcOffset: '-05:00',
        formatted: {
          date: '2024-01-15',
          time: '05:30:00',
          full: 'January 15, 2024 at 5:30:00 AM EST'
        }
      };

      mockRequest.method = 'GET';
      mockRequest.params = { timezone };
      vi.mocked(timezoneService.getCurrentTime).mockResolvedValue(expectedResponse);

      // Act
      await getCurrentTime(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(timezoneService.getCurrentTime).toHaveBeenCalledWith(timezone);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResponse);
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    it('should return current time for valid timezone using POST request', async () => {
      // Arrange
      const timezone = 'Europe/Paris';
      const expectedResponse: TimeResponse = {
        timestamp: '2024-01-15T10:30:00.000Z',
        timezone: 'Europe/Paris',
        utcOffset: '+01:00',
        formatted: {
          date: '2024-01-15',
          time: '11:30:00',
          full: 'January 15, 2024 at 11:30:00 AM CET'
        }
      };

      mockRequest.method = 'POST';
      mockRequest.body = { timezone };
      vi.mocked(timezoneService.getCurrentTime).mockResolvedValue(expectedResponse);

      // Act
      await getCurrentTime(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(timezoneService.getCurrentTime).toHaveBeenCalledWith(timezone);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResponse);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle invalid timezone error with GET request', async () => {
      // Arrange
      const timezone = 'Invalid/Timezone';
      const timezoneError = new TimezoneError(
        'Invalid timezone identifier',
        'INVALID_TIMEZONE',
        400,
        [{ field: 'timezone', message: 'Invalid IANA timezone identifier', code: 'INVALID_FORMAT' }]
      );

      mockRequest.method = 'GET';
      mockRequest.params = { timezone };
      vi.mocked(timezoneService.getCurrentTime).mockRejectedValue(timezoneError);

      // Act
      await getCurrentTime(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(timezoneService.getCurrentTime).toHaveBeenCalledWith(timezone);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TIMEZONE',
          message: 'Invalid timezone identifier',
          details: [{ field: 'timezone', message: 'Invalid IANA timezone identifier', code: 'INVALID_FORMAT' }],
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    it('should handle invalid timezone error with POST request', async () => {
      // Arrange
      const timezone = 'Invalid/Timezone';
      const timezoneError = new TimezoneError(
        'Invalid timezone identifier',
        'INVALID_TIMEZONE',
        400,
        [{ field: 'timezone', message: 'Invalid IANA timezone identifier', code: 'INVALID_FORMAT' }]
      );

      mockRequest.method = 'POST';
      mockRequest.body = { timezone };
      vi.mocked(timezoneService.getCurrentTime).mockRejectedValue(timezoneError);

      // Act
      await getCurrentTime(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(timezoneService.getCurrentTime).toHaveBeenCalledWith(timezone);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TIMEZONE',
          message: 'Invalid timezone identifier',
          details: [{ field: 'timezone', message: 'Invalid IANA timezone identifier', code: 'INVALID_FORMAT' }],
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle empty timezone parameter', async () => {
      // Arrange
      const timezone = '';
      const timezoneError = new TimezoneError(
        'Timezone cannot be empty',
        'EMPTY_TIMEZONE',
        400,
        [{ field: 'timezone', message: 'Timezone cannot be empty', code: 'EMPTY' }]
      );

      mockRequest.params = { timezone };
      vi.mocked(timezoneService.getCurrentTime).mockRejectedValue(timezoneError);

      // Act
      await getCurrentTime(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(timezoneService.getCurrentTime).toHaveBeenCalledWith(timezone);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'EMPTY_TIMEZONE',
          message: 'Timezone cannot be empty',
          details: [{ field: 'timezone', message: 'Timezone cannot be empty', code: 'EMPTY' }],
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle internal server errors', async () => {
      // Arrange
      const timezone = 'America/New_York';
      const internalError = new TimezoneError(
        'Failed to get current time',
        'INTERNAL_ERROR',
        500
      );

      mockRequest.params = { timezone };
      vi.mocked(timezoneService.getCurrentTime).mockRejectedValue(internalError);

      // Act
      await getCurrentTime(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get current time',
          details: undefined,
          timestamp: expect.any(String)
        }
      });
    });

    it('should pass unexpected errors to next middleware', async () => {
      // Arrange
      const timezone = 'America/New_York';
      const unexpectedError = new Error('Unexpected error');

      mockRequest.params = { timezone };
      vi.mocked(timezoneService.getCurrentTime).mockRejectedValue(unexpectedError);

      // Act
      await getCurrentTime(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(unexpectedError);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('convertTime', () => {
    it('should convert time successfully', async () => {
      // Arrange
      const conversionRequest = {
        sourceTime: '2024-01-15T10:30:00Z',
        sourceTimezone: 'UTC',
        targetTimezone: 'America/New_York'
      };
      const expectedResponse: ConversionResponse = {
        original: {
          timestamp: '2024-01-15T10:30:00.000Z',
          timezone: 'UTC',
          formatted: 'January 15, 2024 at 10:30:00 AM UTC'
        },
        converted: {
          timestamp: '2024-01-15T05:30:00.000Z',
          timezone: 'America/New_York',
          formatted: 'January 15, 2024 at 5:30:00 AM EST'
        },
        utcOffsetDifference: '-5 hours'
      };

      mockRequest.body = conversionRequest;
      vi.mocked(timezoneService.convertTime).mockResolvedValue(expectedResponse);

      // Act
      await convertTime(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(timezoneService.convertTime).toHaveBeenCalledWith(conversionRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResponse);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      // Arrange
      const invalidRequest = {
        sourceTime: '',
        sourceTimezone: 'Invalid/Timezone',
        targetTimezone: ''
      };
      const validationError = new TimezoneError(
        'Validation failed for conversion request',
        'VALIDATION_ERROR',
        400,
        [
          { field: 'sourceTime', message: 'Source time cannot be empty', code: 'EMPTY' },
          { field: 'sourceTimezone', message: 'Invalid source timezone identifier', code: 'INVALID_FORMAT' },
          { field: 'targetTimezone', message: 'Target timezone cannot be empty', code: 'EMPTY' }
        ]
      );

      mockRequest.body = invalidRequest;
      vi.mocked(timezoneService.convertTime).mockRejectedValue(validationError);

      // Act
      await convertTime(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(timezoneService.convertTime).toHaveBeenCalledWith(invalidRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed for conversion request',
          details: [
            { field: 'sourceTime', message: 'Source time cannot be empty', code: 'EMPTY' },
            { field: 'sourceTimezone', message: 'Invalid source timezone identifier', code: 'INVALID_FORMAT' },
            { field: 'targetTimezone', message: 'Target timezone cannot be empty', code: 'EMPTY' }
          ],
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle invalid source time format', async () => {
      // Arrange
      const invalidRequest = {
        sourceTime: 'invalid-date',
        sourceTimezone: 'UTC',
        targetTimezone: 'America/New_York'
      };
      const formatError = new TimezoneError(
        'Invalid source time format. Please use ISO 8601 format or a valid date string',
        'INVALID_SOURCE_TIME',
        400,
        [{ field: 'sourceTime', message: 'Invalid datetime format', code: 'INVALID_FORMAT' }]
      );

      mockRequest.body = invalidRequest;
      vi.mocked(timezoneService.convertTime).mockRejectedValue(formatError);

      // Act
      await convertTime(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_SOURCE_TIME',
          message: 'Invalid source time format. Please use ISO 8601 format or a valid date string',
          details: [{ field: 'sourceTime', message: 'Invalid datetime format', code: 'INVALID_FORMAT' }],
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle missing request body', async () => {
      // Arrange
      const missingBodyError = new TimezoneError(
        'Conversion request is required',
        'INVALID_REQUEST',
        400,
        [{ field: 'request', message: 'Request body is required', code: 'REQUIRED' }]
      );

      mockRequest.body = undefined;
      vi.mocked(timezoneService.convertTime).mockRejectedValue(missingBodyError);

      // Act
      await convertTime(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Conversion request is required',
          details: [{ field: 'request', message: 'Request body is required', code: 'REQUIRED' }],
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle internal server errors', async () => {
      // Arrange
      const conversionRequest = {
        sourceTime: '2024-01-15T10:30:00Z',
        sourceTimezone: 'UTC',
        targetTimezone: 'America/New_York'
      };
      const internalError = new TimezoneError(
        'Failed to convert time',
        'INTERNAL_ERROR',
        500
      );

      mockRequest.body = conversionRequest;
      vi.mocked(timezoneService.convertTime).mockRejectedValue(internalError);

      // Act
      await convertTime(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to convert time',
          details: undefined,
          timestamp: expect.any(String)
        }
      });
    });

    it('should pass unexpected errors to next middleware', async () => {
      // Arrange
      const conversionRequest = {
        sourceTime: '2024-01-15T10:30:00Z',
        sourceTimezone: 'UTC',
        targetTimezone: 'America/New_York'
      };
      const unexpectedError = new Error('Unexpected error');

      mockRequest.body = conversionRequest;
      vi.mocked(timezoneService.convertTime).mockRejectedValue(unexpectedError);

      // Act
      await convertTime(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(unexpectedError);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });
});