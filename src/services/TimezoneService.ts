import { 
  TimeResponse, 
  ConversionRequest, 
  ConversionResponse,
  ValidationError 
} from '../types/index';
import { 
  isValidTimezone,
  getCurrentTimeInTimezone,
  convertTimeBetweenTimezones,
  getCommonTimezones
} from '../utils/timezone';

/**
 * Custom error class for timezone-related errors
 */
export class TimezoneError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: ValidationError[];

  constructor(
    message: string, 
    code: string = 'TIMEZONE_ERROR', 
    statusCode: number = 400,
    details?: ValidationError[]
  ) {
    super(message);
    this.name = 'TimezoneError';
    this.code = code;
    this.statusCode = statusCode;
    if (details) {
      this.details = details;
    }
  }
}

/**
 * Service class for handling timezone operations
 * Provides methods for getting current time and converting between timezones
 */
export class TimezoneService {
  /**
   * Gets the current time in the specified timezone
   * @param timezone - IANA timezone identifier
   * @returns Promise resolving to TimeResponse
   * @throws TimezoneError if timezone is invalid or operation fails
   */
  async getCurrentTime(timezone: string): Promise<TimeResponse> {
    try {
      // Validate timezone parameter
      if (typeof timezone !== 'string') {
        throw new TimezoneError(
          'Timezone parameter is required and must be a string',
          'INVALID_TIMEZONE_PARAMETER',
          400,
          [{ field: 'timezone', message: 'Timezone is required', code: 'REQUIRED' }]
        );
      }

      // Trim whitespace
      const cleanTimezone = timezone.trim();
      
      if (!cleanTimezone) {
        throw new TimezoneError(
          'Timezone cannot be empty',
          'EMPTY_TIMEZONE',
          400,
          [{ field: 'timezone', message: 'Timezone cannot be empty', code: 'EMPTY' }]
        );
      }

      // Validate timezone using utility function
      if (!isValidTimezone(cleanTimezone)) {
        throw new TimezoneError(
          `Invalid timezone identifier: ${cleanTimezone}. Please use a valid IANA timezone identifier (e.g., 'America/New_York', 'Europe/London')`,
          'INVALID_TIMEZONE',
          400,
          [{ 
            field: 'timezone', 
            message: 'Invalid IANA timezone identifier', 
            code: 'INVALID_FORMAT' 
          }]
        );
      }

      // Get current time using utility function
      const timeData = getCurrentTimeInTimezone(cleanTimezone);

      // Format response according to TimeResponse interface
      const response: TimeResponse = {
        timestamp: timeData.timestamp,
        timezone: timeData.timezone,
        utcOffset: timeData.utcOffset,
        formatted: {
          date: timeData.formatted.date,
          time: timeData.formatted.time,
          full: timeData.formatted.full
        }
      };

      return response;

    } catch (error) {
      // Re-throw TimezoneError as-is
      if (error instanceof TimezoneError) {
        throw error;
      }

      // Handle unexpected errors
      throw new TimezoneError(
        'Failed to get current time',
        'INTERNAL_ERROR',
        500
      );
    }
  }

  /**
   * Converts time from one timezone to another
   * @param request - ConversionRequest containing source time and timezones
   * @returns Promise resolving to ConversionResponse
   * @throws TimezoneError if parameters are invalid or operation fails
   */
  async convertTime(request: ConversionRequest): Promise<ConversionResponse> {
    try {
      // Validate request object
      if (!request || typeof request !== 'object') {
        throw new TimezoneError(
          'Conversion request is required',
          'INVALID_REQUEST',
          400,
          [{ field: 'request', message: 'Request body is required', code: 'REQUIRED' }]
        );
      }

      const { sourceTime, sourceTimezone, targetTimezone } = request;
      const validationErrors: ValidationError[] = [];

      // Validate sourceTime
      if (typeof sourceTime !== 'string') {
        validationErrors.push({
          field: 'sourceTime',
          message: 'Source time is required and must be a string',
          code: 'REQUIRED'
        });
      } else if (!sourceTime.trim()) {
        validationErrors.push({
          field: 'sourceTime',
          message: 'Source time cannot be empty',
          code: 'EMPTY'
        });
      }

      // Validate sourceTimezone
      if (typeof sourceTimezone !== 'string') {
        validationErrors.push({
          field: 'sourceTimezone',
          message: 'Source timezone is required and must be a string',
          code: 'REQUIRED'
        });
      } else if (!sourceTimezone.trim()) {
        validationErrors.push({
          field: 'sourceTimezone',
          message: 'Source timezone cannot be empty',
          code: 'EMPTY'
        });
      } else if (!isValidTimezone(sourceTimezone.trim())) {
        validationErrors.push({
          field: 'sourceTimezone',
          message: 'Invalid source timezone identifier',
          code: 'INVALID_FORMAT'
        });
      }

      // Validate targetTimezone
      if (typeof targetTimezone !== 'string') {
        validationErrors.push({
          field: 'targetTimezone',
          message: 'Target timezone is required and must be a string',
          code: 'REQUIRED'
        });
      } else if (!targetTimezone.trim()) {
        validationErrors.push({
          field: 'targetTimezone',
          message: 'Target timezone cannot be empty',
          code: 'EMPTY'
        });
      } else if (!isValidTimezone(targetTimezone.trim())) {
        validationErrors.push({
          field: 'targetTimezone',
          message: 'Invalid target timezone identifier',
          code: 'INVALID_FORMAT'
        });
      }

      // If there are validation errors, throw them
      if (validationErrors.length > 0) {
        throw new TimezoneError(
          'Validation failed for conversion request',
          'VALIDATION_ERROR',
          400,
          validationErrors
        );
      }

      // Clean parameters
      const cleanSourceTime = sourceTime.trim();
      const cleanSourceTimezone = sourceTimezone.trim();
      const cleanTargetTimezone = targetTimezone.trim();

      // Perform conversion using utility function
      const conversionData = convertTimeBetweenTimezones(
        cleanSourceTime,
        cleanSourceTimezone,
        cleanTargetTimezone
      );

      // Format response according to ConversionResponse interface
      const response: ConversionResponse = {
        original: {
          timestamp: conversionData.original.timestamp,
          timezone: conversionData.original.timezone,
          formatted: conversionData.original.formatted
        },
        converted: {
          timestamp: conversionData.converted.timestamp,
          timezone: conversionData.converted.timezone,
          formatted: conversionData.converted.formatted
        },
        utcOffsetDifference: conversionData.utcOffsetDifference
      };

      return response;

    } catch (error) {
      // Re-throw TimezoneError as-is
      if (error instanceof TimezoneError) {
        throw error;
      }

      // Handle errors from utility functions
      if (error instanceof Error) {
        if (error.message.includes('Invalid source time format')) {
          throw new TimezoneError(
            'Invalid source time format. Please use ISO 8601 format or a valid date string',
            'INVALID_SOURCE_TIME',
            400,
            [{ 
              field: 'sourceTime', 
              message: 'Invalid datetime format', 
              code: 'INVALID_FORMAT' 
            }]
          );
        }
        
        if (error.message.includes('Invalid source timezone')) {
          throw new TimezoneError(
            'Invalid source timezone identifier',
            'INVALID_SOURCE_TIMEZONE',
            400,
            [{ 
              field: 'sourceTimezone', 
              message: 'Invalid IANA timezone identifier', 
              code: 'INVALID_FORMAT' 
            }]
          );
        }
        
        if (error.message.includes('Invalid target timezone')) {
          throw new TimezoneError(
            'Invalid target timezone identifier',
            'INVALID_TARGET_TIMEZONE',
            400,
            [{ 
              field: 'targetTimezone', 
              message: 'Invalid IANA timezone identifier', 
              code: 'INVALID_FORMAT' 
            }]
          );
        }
      }

      // Handle unexpected errors
      throw new TimezoneError(
        'Failed to convert time',
        'INTERNAL_ERROR',
        500
      );
    }
  }

  /**
   * Validates if a timezone identifier is valid
   * @param timezone - IANA timezone identifier to validate
   * @returns boolean indicating if timezone is valid
   */
  validateTimezone(timezone: string): boolean {
    if (!timezone || typeof timezone !== 'string') {
      return false;
    }
    
    return isValidTimezone(timezone.trim());
  }

  /**
   * Gets a list of commonly supported timezone identifiers
   * @returns Array of IANA timezone identifiers
   */
  listSupportedTimezones(): string[] {
    return getCommonTimezones();
  }

  /**
   * Gets service health information
   * @returns Object containing service status and metadata
   */
  getServiceHealth(): { status: string; supportedTimezones: number; version: string } {
    try {
      // Test basic timezone functionality to ensure service is working
      const testTimezone = 'UTC';
      const isWorking = this.validateTimezone(testTimezone);
      const supportedCount = this.listSupportedTimezones().length;
      
      // Consider service unhealthy if basic validation fails or no timezones are supported
      if (!isWorking || supportedCount === 0) {
        return {
          status: 'unhealthy',
          supportedTimezones: supportedCount,
          version: '1.0.0'
        };
      }
      
      return {
        status: 'healthy',
        supportedTimezones: supportedCount,
        version: '1.0.0'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        supportedTimezones: 0,
        version: '1.0.0'
      };
    }
  }
}

// Export a default instance for convenience
export const timezoneService = new TimezoneService();