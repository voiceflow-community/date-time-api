import { z } from 'zod';

// ============================================================================
// Core TypeScript Interfaces
// ============================================================================

/**
 * Response for current time requests
 */
export interface TimeResponse {
  timestamp: string;        // ISO 8601 format
  timezone: string;         // IANA timezone identifier
  utcOffset: string;        // UTC offset (e.g., "+05:00")
  formatted: {
    date: string;           // Human-readable date
    time: string;           // Human-readable time
    full: string;           // Full formatted datetime
  };
}

/**
 * Request for time conversion
 */
export interface ConversionRequest {
  sourceTime: string;       // ISO 8601 or flexible format
  sourceTimezone: string;   // IANA timezone identifier
  targetTimezone: string;   // IANA timezone identifier
}

/**
 * Response for time conversion requests
 */
export interface ConversionResponse {
  original: {
    timestamp: string;
    timezone: string;
    formatted: string;
  };
  converted: {
    timestamp: string;
    timezone: string;
    formatted: string;
  };
  utcOffsetDifference: string;
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ValidationError[];
    timestamp: string;
  };
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  version: string;
  timestamp: string;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Basic timezone validation function
 * This will be enhanced with actual timezone validation in the utils layer
 */
const isValidTimezone = (timezone: string): boolean => {
  // Basic validation - will be replaced with proper Luxon validation
  if (timezone.length === 0) return false;
  
  // Allow common timezone formats
  const commonTimezones = ['UTC', 'GMT'];
  if (commonTimezones.includes(timezone)) return true;
  
  // IANA timezone format (Region/City)
  return timezone.includes('/') && timezone.split('/').length >= 2;
};

/**
 * Schema for timezone parameter validation
 */
export const timezoneParamSchema = z.object({
  timezone: z.string()
    .min(1, "Timezone is required")
    .max(100, "Timezone identifier too long")
    .refine(isValidTimezone, {
      message: "Invalid timezone identifier. Use IANA timezone format (e.g., 'America/New_York')"
    })
});

/**
 * Schema for current time POST request body validation
 */
export const currentTimeRequestSchema = z.object({
  timezone: z.string()
    .min(1, "Timezone is required")
    .max(100, "Timezone identifier too long")
    .refine(isValidTimezone, {
      message: "Invalid timezone identifier. Use IANA timezone format (e.g., 'America/New_York')"
    })
});

/**
 * Schema for time conversion request validation
 */
export const conversionRequestSchema = z.object({
  sourceTime: z.string()
    .min(1, "Source time is required")
    .refine((time) => {
      // Try to parse the date - if it's valid, Date.parse won't return NaN
      const parsed = Date.parse(time);
      if (isNaN(parsed)) return false;
      
      // Additional validation for common formats
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:\d{2}|Z)?$/;
      const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
      const basicDateRegex = /^\d{4}-\d{2}-\d{2}/;
      
      return isoRegex.test(time) || dateOnlyRegex.test(time) || basicDateRegex.test(time);
    }, {
      message: "Invalid datetime format. Use ISO 8601 format or valid date string"
    }),
  sourceTimezone: z.string()
    .min(1, "Source timezone is required")
    .refine(isValidTimezone, {
      message: "Invalid source timezone identifier"
    }),
  targetTimezone: z.string()
    .min(1, "Target timezone is required")
    .refine(isValidTimezone, {
      message: "Invalid target timezone identifier"
    })
});

/**
 * Schema for error response validation
 */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.array(z.object({
      field: z.string(),
      message: z.string(),
      code: z.string()
    })).optional(),
    timestamp: z.string().datetime()
  })
});

/**
 * Schema for time response validation
 */
export const timeResponseSchema = z.object({
  timestamp: z.string().datetime(),
  timezone: z.string().min(1),
  utcOffset: z.string().regex(/^[+-]\d{2}:\d{2}$/, "Invalid UTC offset format"),
  formatted: z.object({
    date: z.string().min(1),
    time: z.string().min(1),
    full: z.string().min(1)
  })
});

/**
 * Schema for conversion response validation
 */
export const conversionResponseSchema = z.object({
  original: z.object({
    timestamp: z.string().datetime(),
    timezone: z.string().min(1),
    formatted: z.string().min(1)
  }),
  converted: z.object({
    timestamp: z.string().datetime(),
    timezone: z.string().min(1),
    formatted: z.string().min(1)
  }),
  utcOffsetDifference: z.string()
});

/**
 * Schema for health response validation
 */
export const healthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  uptime: z.number().min(0),
  memory: z.object({
    used: z.number().min(0),
    total: z.number().min(0),
    percentage: z.number().min(0).max(100)
  }),
  version: z.string().min(1),
  timestamp: z.string().datetime()
});

// ============================================================================
// Type Exports from Zod Schemas
// ============================================================================

export type TimezoneParam = z.infer<typeof timezoneParamSchema>;
export type CurrentTimeRequest = z.infer<typeof currentTimeRequestSchema>;
export type ConversionRequestInput = z.infer<typeof conversionRequestSchema>;
export type ErrorResponseData = z.infer<typeof errorResponseSchema>;
export type TimeResponseData = z.infer<typeof timeResponseSchema>;
export type ConversionResponseData = z.infer<typeof conversionResponseSchema>;
export type HealthResponseData = z.infer<typeof healthResponseSchema>;