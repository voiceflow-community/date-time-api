import { describe, it, expect, beforeEach } from 'vitest';
import { DateTime } from 'luxon';
import {
  isValidTimezone,
  getCurrentTimeInTimezone,
  convertTimeBetweenTimezones,
  getCommonTimezones,
  isDaylightSavingTime
} from '../../src/utils/timezone';

describe('Timezone Utilities', () => {
  describe('isValidTimezone', () => {
    it('should return true for valid IANA timezone identifiers', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('Australia/Sydney')).toBe(true);
    });

    it('should return false for invalid timezone identifiers', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('EST')).toBe(false); // Abbreviations are not IANA identifiers
      expect(isValidTimezone('GMT+5')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
      expect(isValidTimezone('America/NonExistent')).toBe(false);
    });

    it('should return false for non-string inputs', () => {
      expect(isValidTimezone(null as any)).toBe(false);
      expect(isValidTimezone(undefined as any)).toBe(false);
      expect(isValidTimezone(123 as any)).toBe(false);
      expect(isValidTimezone({} as any)).toBe(false);
    });
  });

  describe('getCurrentTimeInTimezone', () => {
    it('should return current time information for valid timezone', () => {
      const result = getCurrentTimeInTimezone('America/New_York');
      
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('timezone', 'America/New_York');
      expect(result).toHaveProperty('utcOffset');
      expect(result).toHaveProperty('formatted');
      expect(result.formatted).toHaveProperty('date');
      expect(result.formatted).toHaveProperty('time');
      expect(result.formatted).toHaveProperty('full');
      expect(result).toHaveProperty('zoneName');
      expect(result).toHaveProperty('offsetMinutes');

      // Validate timestamp is ISO format
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
      
      // Validate date format
      expect(result.formatted.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Validate time format
      expect(result.formatted.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('should return different times for different timezones', () => {
      const nyTime = getCurrentTimeInTimezone('America/New_York');
      const londonTime = getCurrentTimeInTimezone('Europe/London');
      const tokyoTime = getCurrentTimeInTimezone('Asia/Tokyo');

      // Times should be different (unless by coincidence they're the same hour)
      expect(nyTime.utcOffset).not.toBe(tokyoTime.utcOffset);
      expect(londonTime.utcOffset).not.toBe(tokyoTime.utcOffset);
    });

    it('should throw error for invalid timezone', () => {
      expect(() => getCurrentTimeInTimezone('Invalid/Timezone')).toThrow('Invalid timezone: Invalid/Timezone');
      expect(() => getCurrentTimeInTimezone('')).toThrow('Invalid timezone: ');
    });

    it('should handle UTC timezone correctly', () => {
      const result = getCurrentTimeInTimezone('UTC');
      expect(result.timezone).toBe('UTC');
      expect(result.utcOffset).toBe('+00:00');
      expect(result.offsetMinutes).toBe(0);
    });
  });

  describe('convertTimeBetweenTimezones', () => {
    it('should convert time between different timezones', () => {
      const sourceTime = '2024-01-15T12:00:00';
      const result = convertTimeBetweenTimezones(sourceTime, 'America/New_York', 'Europe/London');

      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('converted');
      expect(result).toHaveProperty('utcOffsetDifference');
      expect(result).toHaveProperty('offsetDifferenceMinutes');

      expect(result.original.timezone).toBe('America/New_York');
      expect(result.converted.timezone).toBe('Europe/London');
      
      // Validate ISO format timestamps
      expect(result.original.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
      expect(result.converted.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
    });

    it('should handle ISO string input format', () => {
      const sourceTime = '2024-06-15T14:30:00.000Z';
      const result = convertTimeBetweenTimezones(sourceTime, 'UTC', 'America/New_York');

      expect(result.original.timezone).toBe('UTC');
      expect(result.converted.timezone).toBe('America/New_York');
      expect(result.original.utcOffset).toBe('+00:00');
    });

    it('should handle different date formats', () => {
      // Test yyyy-MM-dd HH:mm:ss format
      const result1 = convertTimeBetweenTimezones('2024-01-15 12:00:00', 'UTC', 'Asia/Tokyo');
      expect(result1.original.timezone).toBe('UTC');
      expect(result1.converted.timezone).toBe('Asia/Tokyo');

      // Test yyyy-MM-dd format (should default to start of day)
      const result2 = convertTimeBetweenTimezones('2024-01-15', 'UTC', 'Asia/Tokyo');
      expect(result2.original.timezone).toBe('UTC');
      expect(result2.converted.timezone).toBe('Asia/Tokyo');
    });

    it('should calculate UTC offset difference correctly', () => {
      // Winter time: EST (-5) to GMT (+0) = +5 hours
      const winterResult = convertTimeBetweenTimezones('2024-01-15T12:00:00', 'America/New_York', 'UTC');
      expect(winterResult.offsetDifferenceMinutes).toBe(300); // 5 hours = 300 minutes
      expect(winterResult.utcOffsetDifference).toBe('+5.0h');
    });

    it('should throw error for invalid source timezone', () => {
      expect(() => convertTimeBetweenTimezones('2024-01-15T12:00:00', 'Invalid/Timezone', 'UTC'))
        .toThrow('Invalid source timezone: Invalid/Timezone');
    });

    it('should throw error for invalid target timezone', () => {
      expect(() => convertTimeBetweenTimezones('2024-01-15T12:00:00', 'UTC', 'Invalid/Timezone'))
        .toThrow('Invalid target timezone: Invalid/Timezone');
    });

    it('should throw error for invalid source time format', () => {
      expect(() => convertTimeBetweenTimezones('invalid-time', 'UTC', 'America/New_York'))
        .toThrow('Invalid source time format: invalid-time');
    });

    it('should handle same timezone conversion', () => {
      const result = convertTimeBetweenTimezones('2024-01-15T12:00:00', 'UTC', 'UTC');
      expect(result.original.timezone).toBe('UTC');
      expect(result.converted.timezone).toBe('UTC');
      expect(result.offsetDifferenceMinutes).toBe(0);
      expect(result.utcOffsetDifference).toBe('+0.0h');
    });
  });

  describe('getCommonTimezones', () => {
    it('should return an array of common timezone identifiers', () => {
      const timezones = getCommonTimezones();
      
      expect(Array.isArray(timezones)).toBe(true);
      expect(timezones.length).toBeGreaterThan(0);
      
      // Check for some expected timezones
      expect(timezones).toContain('UTC');
      expect(timezones).toContain('America/New_York');
      expect(timezones).toContain('Europe/London');
      expect(timezones).toContain('Asia/Tokyo');
    });

    it('should return only valid timezone identifiers', () => {
      const timezones = getCommonTimezones();
      
      timezones.forEach(timezone => {
        expect(isValidTimezone(timezone)).toBe(true);
      });
    });
  });

  describe('isDaylightSavingTime', () => {
    it('should correctly identify DST periods for US Eastern timezone', () => {
      // Summer time (DST active)
      expect(isDaylightSavingTime('2024-07-15T12:00:00', 'America/New_York')).toBe(true);
      
      // Winter time (DST not active)
      expect(isDaylightSavingTime('2024-01-15T12:00:00', 'America/New_York')).toBe(false);
    });

    it('should correctly identify DST periods for European timezone', () => {
      // Summer time (DST active)
      expect(isDaylightSavingTime('2024-07-15T12:00:00', 'Europe/London')).toBe(true);
      
      // Winter time (DST not active)
      expect(isDaylightSavingTime('2024-01-15T12:00:00', 'Europe/London')).toBe(false);
    });

    it('should return false for timezones that do not observe DST', () => {
      // UTC never observes DST
      expect(isDaylightSavingTime('2024-07-15T12:00:00', 'UTC')).toBe(false);
      expect(isDaylightSavingTime('2024-01-15T12:00:00', 'UTC')).toBe(false);
      
      // Arizona (most of it) doesn't observe DST
      expect(isDaylightSavingTime('2024-07-15T12:00:00', 'America/Phoenix')).toBe(false);
    });

    it('should handle different date formats', () => {
      // ISO format
      expect(isDaylightSavingTime('2024-07-15T12:00:00.000Z', 'America/New_York')).toBe(true);
      
      // yyyy-MM-dd HH:mm:ss format
      expect(isDaylightSavingTime('2024-07-15 12:00:00', 'America/New_York')).toBe(true);
    });

    it('should throw error for invalid timezone', () => {
      expect(() => isDaylightSavingTime('2024-07-15T12:00:00', 'Invalid/Timezone'))
        .toThrow('Invalid timezone: Invalid/Timezone');
    });

    it('should throw error for invalid date format', () => {
      expect(() => isDaylightSavingTime('invalid-date', 'America/New_York'))
        .toThrow('Invalid date time format: invalid-date');
    });

    // DST transition edge cases
    it('should handle DST transition periods correctly', () => {
      // Spring forward transition (2024 DST starts March 10 in US)
      // Before transition (still standard time)
      expect(isDaylightSavingTime('2024-03-09T12:00:00', 'America/New_York')).toBe(false);
      
      // After transition (now daylight time)
      expect(isDaylightSavingTime('2024-03-11T12:00:00', 'America/New_York')).toBe(true);
      
      // Fall back transition (2024 DST ends November 3 in US)
      // Before transition (still daylight time)
      expect(isDaylightSavingTime('2024-11-02T12:00:00', 'America/New_York')).toBe(true);
      
      // After transition (back to standard time)
      expect(isDaylightSavingTime('2024-11-04T12:00:00', 'America/New_York')).toBe(false);
    });
  });

  describe('DST Edge Cases and Complex Scenarios', () => {
    it('should handle time conversion during DST transitions', () => {
      // Convert from a non-DST timezone to DST timezone during summer
      const summerResult = convertTimeBetweenTimezones(
        '2024-07-15T12:00:00', 
        'UTC', 
        'America/New_York'
      );
      
      // During summer, NY is UTC-4 (EDT)
      expect(summerResult.offsetDifferenceMinutes).toBe(-240); // -4 hours
      
      // Convert during winter
      const winterResult = convertTimeBetweenTimezones(
        '2024-01-15T12:00:00', 
        'UTC', 
        'America/New_York'
      );
      
      // During winter, NY is UTC-5 (EST)
      expect(winterResult.offsetDifferenceMinutes).toBe(-300); // -5 hours
    });

    it('should handle cross-hemisphere DST differences', () => {
      // Northern hemisphere summer (July) vs Southern hemisphere winter
      const result = convertTimeBetweenTimezones(
        '2024-07-15T12:00:00',
        'America/New_York', // DST active (EDT)
        'Australia/Sydney'   // DST not active (AEST)
      );
      
      expect(result.original.timezone).toBe('America/New_York');
      expect(result.converted.timezone).toBe('Australia/Sydney');
      
      // Verify the conversion worked
      expect(result.original.timestamp).toBeDefined();
      expect(result.converted.timestamp).toBeDefined();
    });

    it('should maintain accuracy across multiple timezone conversions', () => {
      const originalTime = '2024-06-15T15:30:00';
      
      // Chain conversions: UTC -> NY -> London -> Tokyo -> back to UTC
      const step1 = convertTimeBetweenTimezones(originalTime, 'UTC', 'America/New_York');
      const step2 = convertTimeBetweenTimezones(step1.converted.timestamp, 'America/New_York', 'Europe/London');
      const step3 = convertTimeBetweenTimezones(step2.converted.timestamp, 'Europe/London', 'Asia/Tokyo');
      const step4 = convertTimeBetweenTimezones(step3.converted.timestamp, 'Asia/Tokyo', 'UTC');
      
      // Final result should match original (accounting for potential millisecond differences)
      const originalDateTime = DateTime.fromISO(originalTime, { zone: 'UTC' });
      const finalDateTime = DateTime.fromISO(step4.converted.timestamp);
      
      expect(Math.abs(finalDateTime.toMillis() - originalDateTime.toMillis())).toBeLessThan(1000);
    });
  });
});