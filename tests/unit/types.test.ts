import { describe, it, expect } from 'vitest';
import {
  timezoneParamSchema,
  conversionRequestSchema,
  errorResponseSchema,
  timeResponseSchema,
  conversionResponseSchema,
  healthResponseSchema,
  type TimezoneParam,
  type ConversionRequestInput,
  type ErrorResponseData,
  type TimeResponseData,
  type ConversionResponseData,
  type HealthResponseData
} from '../../src/types/index.js';

describe('Type Definitions and Zod Schemas', () => {
  describe('timezoneParamSchema', () => {
    it('should validate valid timezone identifiers', () => {
      const validTimezones = [
        { timezone: 'America/New_York' },
        { timezone: 'Europe/London' },
        { timezone: 'Asia/Tokyo' },
        { timezone: 'Australia/Sydney' },
        { timezone: 'UTC' },
        { timezone: 'GMT' }
      ];

      validTimezones.forEach(tz => {
        const result = timezoneParamSchema.safeParse(tz);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timezone).toBe(tz.timezone);
        }
      });
    });

    it('should reject invalid timezone identifiers', () => {
      const invalidTimezones = [
        { timezone: '' },
        { timezone: 'InvalidTimezone' },
        { timezone: 'EST' },
        { timezone: 'PST' },
        { timezone: 'America' },
        { timezone: 'Europe' }
      ];

      invalidTimezones.forEach(tz => {
        const result = timezoneParamSchema.safeParse(tz);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThanOrEqual(1);
        }
      });
    });

    it('should reject timezone identifiers that are too long', () => {
      const longTimezone = { timezone: 'A'.repeat(101) + '/B'.repeat(101) };
      const result = timezoneParamSchema.safeParse(longTimezone);
      expect(result.success).toBe(false);
    });

    it('should reject missing timezone parameter', () => {
      const result = timezoneParamSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('conversionRequestSchema', () => {
    it('should validate valid conversion requests', () => {
      const validRequests = [
        {
          sourceTime: '2024-01-15T10:30:00Z',
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        },
        {
          sourceTime: '2024-01-15T10:30:00.123Z',
          sourceTimezone: 'Asia/Tokyo',
          targetTimezone: 'Australia/Sydney'
        },
        {
          sourceTime: '2024-01-15T10:30:00+05:00',
          sourceTimezone: 'Asia/Kolkata',
          targetTimezone: 'UTC'
        },
        {
          sourceTime: '2024-01-15',
          sourceTimezone: 'America/Los_Angeles',
          targetTimezone: 'America/New_York'
        }
      ];

      validRequests.forEach(req => {
        const result = conversionRequestSchema.safeParse(req);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sourceTime).toBe(req.sourceTime);
          expect(result.data.sourceTimezone).toBe(req.sourceTimezone);
          expect(result.data.targetTimezone).toBe(req.targetTimezone);
        }
      });
    });

    it('should reject invalid datetime formats', () => {
      const invalidRequests = [
        {
          sourceTime: 'invalid-date',
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        },
        {
          sourceTime: '2024-13-01T10:30:00Z', // Invalid month
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        },
        {
          sourceTime: '2024-01-32T10:30:00Z', // Invalid day
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        },
        {
          sourceTime: '',
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        }
      ];

      invalidRequests.forEach(req => {
        const result = conversionRequestSchema.safeParse(req);
        expect(result.success).toBe(false);
      });
    });

    it('should reject invalid timezone identifiers', () => {
      const invalidRequests = [
        {
          sourceTime: '2024-01-15T10:30:00Z',
          sourceTimezone: 'InvalidTimezone',
          targetTimezone: 'Europe/London'
        },
        {
          sourceTime: '2024-01-15T10:30:00Z',
          sourceTimezone: 'America/New_York',
          targetTimezone: 'InvalidTimezone'
        },
        {
          sourceTime: '2024-01-15T10:30:00Z',
          sourceTimezone: '',
          targetTimezone: 'Europe/London'
        },
        {
          sourceTime: '2024-01-15T10:30:00Z',
          sourceTimezone: 'America/New_York',
          targetTimezone: ''
        }
      ];

      invalidRequests.forEach(req => {
        const result = conversionRequestSchema.safeParse(req);
        expect(result.success).toBe(false);
      });
    });

    it('should reject missing required fields', () => {
      const incompleteRequests = [
        {
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        },
        {
          sourceTime: '2024-01-15T10:30:00Z',
          targetTimezone: 'Europe/London'
        },
        {
          sourceTime: '2024-01-15T10:30:00Z',
          sourceTimezone: 'America/New_York'
        },
        {}
      ];

      incompleteRequests.forEach(req => {
        const result = conversionRequestSchema.safeParse(req);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('errorResponseSchema', () => {
    it('should validate valid error responses', () => {
      const validErrorResponses = [
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input provided',
            timestamp: '2024-01-15T10:30:00.000Z'
          }
        },
        {
          error: {
            code: 'TIMEZONE_ERROR',
            message: 'Invalid timezone identifier',
            details: [
              {
                field: 'timezone',
                message: 'Invalid timezone format',
                code: 'INVALID_FORMAT'
              }
            ],
            timestamp: '2024-01-15T10:30:00.123Z'
          }
        }
      ];

      validErrorResponses.forEach(errorResp => {
        const result = errorResponseSchema.safeParse(errorResp);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid error responses', () => {
      const invalidErrorResponses = [
        {
          error: {
            code: '',
            message: 'Invalid input provided',
            timestamp: '2024-01-15T10:30:00.000Z'
          }
        },
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '',
            timestamp: '2024-01-15T10:30:00.000Z'
          }
        },
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input provided',
            timestamp: 'invalid-timestamp'
          }
        },
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input provided'
            // Missing timestamp
          }
        }
      ];

      invalidErrorResponses.forEach(errorResp => {
        const result = errorResponseSchema.safeParse(errorResp);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('timeResponseSchema', () => {
    it('should validate valid time responses', () => {
      const validTimeResponses = [
        {
          timestamp: '2024-01-15T10:30:00.000Z',
          timezone: 'America/New_York',
          utcOffset: '-05:00',
          formatted: {
            date: '2024-01-15',
            time: '05:30:00',
            full: 'January 15, 2024 at 5:30:00 AM EST'
          }
        },
        {
          timestamp: '2024-07-15T14:30:00.123Z',
          timezone: 'Europe/London',
          utcOffset: '+01:00',
          formatted: {
            date: '2024-07-15',
            time: '15:30:00',
            full: 'July 15, 2024 at 3:30:00 PM BST'
          }
        }
      ];

      validTimeResponses.forEach(timeResp => {
        const result = timeResponseSchema.safeParse(timeResp);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid time responses', () => {
      const invalidTimeResponses = [
        {
          timestamp: 'invalid-timestamp',
          timezone: 'America/New_York',
          utcOffset: '-05:00',
          formatted: {
            date: '2024-01-15',
            time: '05:30:00',
            full: 'January 15, 2024 at 5:30:00 AM EST'
          }
        },
        {
          timestamp: '2024-01-15T10:30:00.000Z',
          timezone: '',
          utcOffset: '-05:00',
          formatted: {
            date: '2024-01-15',
            time: '05:30:00',
            full: 'January 15, 2024 at 5:30:00 AM EST'
          }
        },
        {
          timestamp: '2024-01-15T10:30:00.000Z',
          timezone: 'America/New_York',
          utcOffset: 'invalid-offset',
          formatted: {
            date: '2024-01-15',
            time: '05:30:00',
            full: 'January 15, 2024 at 5:30:00 AM EST'
          }
        }
      ];

      invalidTimeResponses.forEach(timeResp => {
        const result = timeResponseSchema.safeParse(timeResp);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('conversionResponseSchema', () => {
    it('should validate valid conversion responses', () => {
      const validConversionResponse = {
        original: {
          timestamp: '2024-01-15T10:30:00.000Z',
          timezone: 'America/New_York',
          formatted: 'January 15, 2024 at 5:30:00 AM EST'
        },
        converted: {
          timestamp: '2024-01-15T15:30:00.000Z',
          timezone: 'Europe/London',
          formatted: 'January 15, 2024 at 3:30:00 PM GMT'
        },
        utcOffsetDifference: '+5 hours'
      };

      const result = conversionResponseSchema.safeParse(validConversionResponse);
      expect(result.success).toBe(true);
    });

    it('should reject invalid conversion responses', () => {
      const invalidConversionResponses = [
        {
          original: {
            timestamp: 'invalid-timestamp',
            timezone: 'America/New_York',
            formatted: 'January 15, 2024 at 5:30:00 AM EST'
          },
          converted: {
            timestamp: '2024-01-15T15:30:00.000Z',
            timezone: 'Europe/London',
            formatted: 'January 15, 2024 at 3:30:00 PM GMT'
          },
          utcOffsetDifference: '+5 hours'
        },
        {
          original: {
            timestamp: '2024-01-15T10:30:00.000Z',
            timezone: '',
            formatted: 'January 15, 2024 at 5:30:00 AM EST'
          },
          converted: {
            timestamp: '2024-01-15T15:30:00.000Z',
            timezone: 'Europe/London',
            formatted: 'January 15, 2024 at 3:30:00 PM GMT'
          },
          utcOffsetDifference: '+5 hours'
        }
      ];

      invalidConversionResponses.forEach(convResp => {
        const result = conversionResponseSchema.safeParse(convResp);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('healthResponseSchema', () => {
    it('should validate valid health responses', () => {
      const validHealthResponses = [
        {
          status: 'healthy' as const,
          uptime: 3600,
          memory: {
            used: 50000000,
            total: 100000000,
            percentage: 50
          },
          version: '1.0.0',
          timestamp: '2024-01-15T10:30:00.000Z'
        },
        {
          status: 'degraded' as const,
          uptime: 0,
          memory: {
            used: 0,
            total: 100000000,
            percentage: 0
          },
          version: '1.0.0-beta',
          timestamp: '2024-01-15T10:30:00.123Z'
        }
      ];

      validHealthResponses.forEach(healthResp => {
        const result = healthResponseSchema.safeParse(healthResp);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid health responses', () => {
      const invalidHealthResponses = [
        {
          status: 'invalid-status',
          uptime: 3600,
          memory: {
            used: 50000000,
            total: 100000000,
            percentage: 50
          },
          version: '1.0.0',
          timestamp: '2024-01-15T10:30:00.000Z'
        },
        {
          status: 'healthy',
          uptime: -1,
          memory: {
            used: 50000000,
            total: 100000000,
            percentage: 50
          },
          version: '1.0.0',
          timestamp: '2024-01-15T10:30:00.000Z'
        },
        {
          status: 'healthy',
          uptime: 3600,
          memory: {
            used: 50000000,
            total: 100000000,
            percentage: 150 // Invalid percentage > 100
          },
          version: '1.0.0',
          timestamp: '2024-01-15T10:30:00.000Z'
        }
      ];

      invalidHealthResponses.forEach(healthResp => {
        const result = healthResponseSchema.safeParse(healthResp);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle timezone edge cases', () => {
      const edgeCaseTimezones = [
        { timezone: 'UTC' }, // Should be valid despite not having '/'
        { timezone: 'GMT' }  // Should be valid despite not having '/'
      ];

      // These should now pass with updated validation
      edgeCaseTimezones.forEach(tz => {
        const result = timezoneParamSchema.safeParse(tz);
        expect(result.success).toBe(true);
      });
    });

    it('should handle datetime edge cases', () => {
      const edgeCaseDatetimes = [
        '2024-02-29T10:30:00Z', // Leap year
        '2024-12-31T23:59:59Z', // End of year
        '2024-01-01T00:00:00Z', // Start of year
        '2024-06-21T12:00:00+14:00', // Extreme positive offset
        '2024-06-21T12:00:00-12:00'  // Extreme negative offset
      ];

      edgeCaseDatetimes.forEach(datetime => {
        const request = {
          sourceTime: datetime,
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        };
        const result = conversionRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });
    });

    it('should provide detailed error messages for validation failures', () => {
      const invalidRequest = {
        sourceTime: '',
        sourceTimezone: 'InvalidTimezone',
        targetTimezone: ''
      };

      const result = conversionRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        // Should have multiple validation errors
        const errorMessages = result.error.issues.map(issue => issue.message);
        expect(errorMessages.some(msg => msg.includes('Source time is required'))).toBe(true);
        expect(errorMessages.some(msg => msg.includes('Invalid source timezone'))).toBe(true);
        expect(errorMessages.some(msg => msg.includes('Target timezone is required'))).toBe(true);
      }
    });

    it('should validate nested object structures correctly', () => {
      const partialTimeResponse = {
        timestamp: '2024-01-15T10:30:00.000Z',
        timezone: 'America/New_York',
        utcOffset: '-05:00',
        formatted: {
          date: '2024-01-15',
          time: '05:30:00'
          // Missing 'full' field
        }
      };

      const result = timeResponseSchema.safeParse(partialTimeResponse);
      expect(result.success).toBe(false);
    });
  });
});