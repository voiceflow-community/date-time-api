import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimezoneService, TimezoneError } from '../../src/services/TimezoneService.js';
import * as timezoneUtils from '../../src/utils/timezone.js';

// Mock the timezone utilities
vi.mock('../../src/utils/timezone.js', () => ({
  isValidTimezone: vi.fn(),
  getCurrentTimeInTimezone: vi.fn(),
  convertTimeBetweenTimezones: vi.fn(),
  getCommonTimezones: vi.fn()
}));

describe('TimezoneService', () => {
  let service: TimezoneService;
  
  beforeEach(() => {
    service = new TimezoneService();
    vi.clearAllMocks();
  });

  describe('getCurrentTime', () => {
    it('should return current time for valid timezone', async () => {
      // Arrange
      const timezone = 'America/New_York';
      const mockTimeData = {
        timestamp: '2024-01-15T10:30:00.000-05:00',
        timezone: 'America/New_York',
        utcOffset: '-05:00',
        formatted: {
          date: '2024-01-15',
          time: '10:30:00',
          full: '2024-01-15 10:30:00 EST'
        }
      };

      vi.mocked(timezoneUtils.isValidTimezone).mockReturnValue(true);
      vi.mocked(timezoneUtils.getCurrentTimeInTimezone).mockReturnValue(mockTimeData);

      // Act
      const result = await service.getCurrentTime(timezone);

      // Assert
      expect(result).toEqual({
        timestamp: '2024-01-15T10:30:00.000-05:00',
        timezone: 'America/New_York',
        utcOffset: '-05:00',
        formatted: {
          date: '2024-01-15',
          time: '10:30:00',
          full: '2024-01-15 10:30:00 EST'
        }
      });
      expect(timezoneUtils.isValidTimezone).toHaveBeenCalledWith('America/New_York');
      expect(timezoneUtils.getCurrentTimeInTimezone).toHaveBeenCalledWith('America/New_York');
    });

    it('should handle timezone with whitespace', async () => {
      // Arrange
      const timezone = '  Europe/London  ';
      const mockTimeData = {
        timestamp: '2024-01-15T15:30:00.000+00:00',
        timezone: 'Europe/London',
        utcOffset: '+00:00',
        formatted: {
          date: '2024-01-15',
          time: '15:30:00',
          full: '2024-01-15 15:30:00 GMT'
        }
      };

      vi.mocked(timezoneUtils.isValidTimezone).mockReturnValue(true);
      vi.mocked(timezoneUtils.getCurrentTimeInTimezone).mockReturnValue(mockTimeData);

      // Act
      const result = await service.getCurrentTime(timezone);

      // Assert
      expect(result.timezone).toBe('Europe/London');
      expect(timezoneUtils.isValidTimezone).toHaveBeenCalledWith('Europe/London');
    });

    it('should throw TimezoneError for null timezone', async () => {
      // Act & Assert
      await expect(service.getCurrentTime(null as any)).rejects.toThrow(TimezoneError);
      await expect(service.getCurrentTime(null as any)).rejects.toMatchObject({
        code: 'INVALID_TIMEZONE_PARAMETER',
        statusCode: 400,
        details: [{ field: 'timezone', message: 'Timezone is required', code: 'REQUIRED' }]
      });
    });

    it('should throw TimezoneError for undefined timezone', async () => {
      // Act & Assert
      await expect(service.getCurrentTime(undefined as any)).rejects.toThrow(TimezoneError);
      await expect(service.getCurrentTime(undefined as any)).rejects.toMatchObject({
        code: 'INVALID_TIMEZONE_PARAMETER',
        statusCode: 400
      });
    });

    it('should throw TimezoneError for empty string timezone', async () => {
      // Act & Assert
      await expect(service.getCurrentTime('')).rejects.toThrow(TimezoneError);
      await expect(service.getCurrentTime('')).rejects.toMatchObject({
        code: 'EMPTY_TIMEZONE',
        statusCode: 400,
        details: [{ field: 'timezone', message: 'Timezone cannot be empty', code: 'EMPTY' }]
      });
    });

    it('should throw TimezoneError for whitespace-only timezone', async () => {
      // Act & Assert
      await expect(service.getCurrentTime('   ')).rejects.toThrow(TimezoneError);
      await expect(service.getCurrentTime('   ')).rejects.toMatchObject({
        code: 'EMPTY_TIMEZONE',
        statusCode: 400
      });
    });

    it('should throw TimezoneError for invalid timezone', async () => {
      // Arrange
      const invalidTimezone = 'Invalid/Timezone';
      vi.mocked(timezoneUtils.isValidTimezone).mockReturnValue(false);

      // Act & Assert
      await expect(service.getCurrentTime(invalidTimezone)).rejects.toThrow(TimezoneError);
      await expect(service.getCurrentTime(invalidTimezone)).rejects.toMatchObject({
        code: 'INVALID_TIMEZONE',
        statusCode: 400,
        details: [{ 
          field: 'timezone', 
          message: 'Invalid IANA timezone identifier', 
          code: 'INVALID_FORMAT' 
        }]
      });
    });

    it('should throw TimezoneError for non-string timezone', async () => {
      // Act & Assert
      await expect(service.getCurrentTime(123 as any)).rejects.toThrow(TimezoneError);
      await expect(service.getCurrentTime(123 as any)).rejects.toMatchObject({
        code: 'INVALID_TIMEZONE_PARAMETER',
        statusCode: 400
      });
    });

    it('should handle utility function errors gracefully', async () => {
      // Arrange
      const timezone = 'America/New_York';
      vi.mocked(timezoneUtils.isValidTimezone).mockReturnValue(true);
      vi.mocked(timezoneUtils.getCurrentTimeInTimezone).mockImplementation(() => {
        throw new Error('Utility error');
      });

      // Act & Assert
      await expect(service.getCurrentTime(timezone)).rejects.toThrow(TimezoneError);
      await expect(service.getCurrentTime(timezone)).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        statusCode: 500
      });
    });
  });

  describe('convertTime', () => {
    it('should convert time between valid timezones', async () => {
      // Arrange
      const request = {
        sourceTime: '2024-01-15T10:30:00',
        sourceTimezone: 'America/New_York',
        targetTimezone: 'Europe/London'
      };
      
      const mockConversionData = {
        original: {
          timestamp: '2024-01-15T10:30:00.000-05:00',
          timezone: 'America/New_York',
          formatted: '2024-01-15 10:30:00 EST'
        },
        converted: {
          timestamp: '2024-01-15T15:30:00.000+00:00',
          timezone: 'Europe/London',
          formatted: '2024-01-15 15:30:00 GMT'
        },
        utcOffsetDifference: '+5.0h'
      };

      vi.mocked(timezoneUtils.isValidTimezone).mockReturnValue(true);
      vi.mocked(timezoneUtils.convertTimeBetweenTimezones).mockReturnValue(mockConversionData);

      // Act
      const result = await service.convertTime(request);

      // Assert
      expect(result).toEqual({
        original: {
          timestamp: '2024-01-15T10:30:00.000-05:00',
          timezone: 'America/New_York',
          formatted: '2024-01-15 10:30:00 EST'
        },
        converted: {
          timestamp: '2024-01-15T15:30:00.000+00:00',
          timezone: 'Europe/London',
          formatted: '2024-01-15 15:30:00 GMT'
        },
        utcOffsetDifference: '+5.0h'
      });
      expect(timezoneUtils.convertTimeBetweenTimezones).toHaveBeenCalledWith(
        '2024-01-15T10:30:00',
        'America/New_York',
        'Europe/London'
      );
    });

    it('should handle request with whitespace in parameters', async () => {
      // Arrange
      const request = {
        sourceTime: '  2024-01-15T10:30:00  ',
        sourceTimezone: '  America/New_York  ',
        targetTimezone: '  Europe/London  '
      };

      vi.mocked(timezoneUtils.isValidTimezone).mockReturnValue(true);
      vi.mocked(timezoneUtils.convertTimeBetweenTimezones).mockReturnValue({
        original: { timestamp: '', timezone: '', formatted: '' },
        converted: { timestamp: '', timezone: '', formatted: '' },
        utcOffsetDifference: ''
      });

      // Act
      await service.convertTime(request);

      // Assert
      expect(timezoneUtils.convertTimeBetweenTimezones).toHaveBeenCalledWith(
        '2024-01-15T10:30:00',
        'America/New_York',
        'Europe/London'
      );
    });

    it('should throw TimezoneError for null request', async () => {
      // Act & Assert
      await expect(service.convertTime(null as any)).rejects.toThrow(TimezoneError);
      await expect(service.convertTime(null as any)).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
        statusCode: 400,
        details: [{ field: 'request', message: 'Request body is required', code: 'REQUIRED' }]
      });
    });

    it('should throw TimezoneError for missing sourceTime', async () => {
      // Arrange
      const request = {
        sourceTime: '',
        sourceTimezone: 'America/New_York',
        targetTimezone: 'Europe/London'
      };

      // Act & Assert
      await expect(service.convertTime(request)).rejects.toThrow(TimezoneError);
      await expect(service.convertTime(request)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: expect.arrayContaining([
          { field: 'sourceTime', message: 'Source time cannot be empty', code: 'EMPTY' }
        ])
      });
    });

    it('should throw TimezoneError for invalid sourceTimezone', async () => {
      // Arrange
      const request = {
        sourceTime: '2024-01-15T10:30:00',
        sourceTimezone: 'Invalid/Timezone',
        targetTimezone: 'Europe/London'
      };

      vi.mocked(timezoneUtils.isValidTimezone).mockImplementation((timezone) => {
        if (timezone === 'Invalid/Timezone') return false;
        if (timezone === 'Europe/London') return true;
        return false;
      });

      // Act & Assert
      await expect(service.convertTime(request)).rejects.toThrow(TimezoneError);
      await expect(service.convertTime(request)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: expect.arrayContaining([
          { field: 'sourceTimezone', message: 'Invalid source timezone identifier', code: 'INVALID_FORMAT' }
        ])
      });
    });

    it('should throw TimezoneError for invalid targetTimezone', async () => {
      // Arrange
      const request = {
        sourceTime: '2024-01-15T10:30:00',
        sourceTimezone: 'America/New_York',
        targetTimezone: 'Invalid/Timezone'
      };

      vi.mocked(timezoneUtils.isValidTimezone).mockImplementation((timezone) => {
        if (timezone === 'America/New_York') return true;
        if (timezone === 'Invalid/Timezone') return false;
        return false;
      });

      // Act & Assert
      await expect(service.convertTime(request)).rejects.toThrow(TimezoneError);
      await expect(service.convertTime(request)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: expect.arrayContaining([
          { field: 'targetTimezone', message: 'Invalid target timezone identifier', code: 'INVALID_FORMAT' }
        ])
      });
    });

    it('should collect multiple validation errors', async () => {
      // Arrange
      const request = {
        sourceTime: '',
        sourceTimezone: '',
        targetTimezone: ''
      };

      // Act & Assert
      await expect(service.convertTime(request)).rejects.toThrow(TimezoneError);
      await expect(service.convertTime(request)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: [
          { field: 'sourceTime', message: 'Source time cannot be empty', code: 'EMPTY' },
          { field: 'sourceTimezone', message: 'Source timezone cannot be empty', code: 'EMPTY' },
          { field: 'targetTimezone', message: 'Target timezone cannot be empty', code: 'EMPTY' }
        ]
      });
    });

    it('should handle utility function error for invalid source time', async () => {
      // Arrange
      const request = {
        sourceTime: 'invalid-time',
        sourceTimezone: 'America/New_York',
        targetTimezone: 'Europe/London'
      };

      vi.mocked(timezoneUtils.isValidTimezone).mockReturnValue(true);
      vi.mocked(timezoneUtils.convertTimeBetweenTimezones).mockImplementation(() => {
        throw new Error('Invalid source time format: invalid-time');
      });

      // Act & Assert
      await expect(service.convertTime(request)).rejects.toThrow(TimezoneError);
      await expect(service.convertTime(request)).rejects.toMatchObject({
        code: 'INVALID_SOURCE_TIME',
        statusCode: 400,
        details: [{ 
          field: 'sourceTime', 
          message: 'Invalid datetime format', 
          code: 'INVALID_FORMAT' 
        }]
      });
    });

    it('should handle utility function error for invalid source timezone', async () => {
      // Arrange
      const request = {
        sourceTime: '2024-01-15T10:30:00',
        sourceTimezone: 'America/New_York',
        targetTimezone: 'Europe/London'
      };

      vi.mocked(timezoneUtils.isValidTimezone).mockReturnValue(true);
      vi.mocked(timezoneUtils.convertTimeBetweenTimezones).mockImplementation(() => {
        throw new Error('Invalid source timezone: America/New_York');
      });

      // Act & Assert
      await expect(service.convertTime(request)).rejects.toThrow(TimezoneError);
      await expect(service.convertTime(request)).rejects.toMatchObject({
        code: 'INVALID_SOURCE_TIMEZONE',
        statusCode: 400
      });
    });

    it('should handle unexpected utility function errors', async () => {
      // Arrange
      const request = {
        sourceTime: '2024-01-15T10:30:00',
        sourceTimezone: 'America/New_York',
        targetTimezone: 'Europe/London'
      };

      vi.mocked(timezoneUtils.isValidTimezone).mockReturnValue(true);
      vi.mocked(timezoneUtils.convertTimeBetweenTimezones).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act & Assert
      await expect(service.convertTime(request)).rejects.toThrow(TimezoneError);
      await expect(service.convertTime(request)).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        statusCode: 500
      });
    });
  });

  describe('validateTimezone', () => {
    it('should return true for valid timezone', () => {
      // Arrange
      vi.mocked(timezoneUtils.isValidTimezone).mockReturnValue(true);

      // Act
      const result = service.validateTimezone('America/New_York');

      // Assert
      expect(result).toBe(true);
      expect(timezoneUtils.isValidTimezone).toHaveBeenCalledWith('America/New_York');
    });

    it('should return false for invalid timezone', () => {
      // Arrange
      vi.mocked(timezoneUtils.isValidTimezone).mockReturnValue(false);

      // Act
      const result = service.validateTimezone('Invalid/Timezone');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle timezone with whitespace', () => {
      // Arrange
      vi.mocked(timezoneUtils.isValidTimezone).mockReturnValue(true);

      // Act
      const result = service.validateTimezone('  Europe/London  ');

      // Assert
      expect(result).toBe(true);
      expect(timezoneUtils.isValidTimezone).toHaveBeenCalledWith('Europe/London');
    });

    it('should return false for null timezone', () => {
      // Act
      const result = service.validateTimezone(null as any);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for non-string timezone', () => {
      // Act
      const result = service.validateTimezone(123 as any);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('listSupportedTimezones', () => {
    it('should return list of supported timezones', () => {
      // Arrange
      const mockTimezones = ['UTC', 'America/New_York', 'Europe/London'];
      vi.mocked(timezoneUtils.getCommonTimezones).mockReturnValue(mockTimezones);

      // Act
      const result = service.listSupportedTimezones();

      // Assert
      expect(result).toEqual(mockTimezones);
      expect(timezoneUtils.getCommonTimezones).toHaveBeenCalled();
    });
  });

  describe('getServiceHealth', () => {
    it('should return service health information', () => {
      // Arrange
      const mockTimezones = ['UTC', 'America/New_York', 'Europe/London'];
      vi.mocked(timezoneUtils.getCommonTimezones).mockReturnValue(mockTimezones);

      // Act
      const result = service.getServiceHealth();

      // Assert
      expect(result).toEqual({
        status: 'healthy',
        supportedTimezones: 3,
        version: '1.0.0'
      });
    });
  });
});

describe('TimezoneError', () => {
  it('should create error with default values', () => {
    // Act
    const error = new TimezoneError('Test message');

    // Assert
    expect(error.message).toBe('Test message');
    expect(error.name).toBe('TimezoneError');
    expect(error.code).toBe('TIMEZONE_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.details).toBeUndefined();
  });

  it('should create error with custom values', () => {
    // Arrange
    const details = [{ field: 'test', message: 'Test error', code: 'TEST' }];

    // Act
    const error = new TimezoneError('Custom message', 'CUSTOM_CODE', 500, details);

    // Assert
    expect(error.message).toBe('Custom message');
    expect(error.code).toBe('CUSTOM_CODE');
    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual(details);
  });
});