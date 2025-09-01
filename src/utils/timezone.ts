import { DateTime, IANAZone } from 'luxon';

/**
 * Validates if a timezone identifier is valid using Luxon
 * @param timezone - IANA timezone identifier (e.g., 'America/New_York')
 * @returns boolean indicating if timezone is valid
 */
export function isValidTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== 'string') {
    return false;
  }

  try {
    const zone = IANAZone.create(timezone);
    if (!zone.isValid) {
      return false;
    }

    // Additional check to ensure it's a proper IANA timezone identifier
    // IANA timezones typically have format like "Area/Location" or are "UTC"
    // Reject common abbreviations that Luxon might accept but aren't proper IANA identifiers
    const abbreviations = ['EST', 'PST', 'CST', 'MST', 'EDT', 'PDT', 'CDT', 'MDT', 'GMT', 'BST'];
    if (abbreviations.includes(timezone.toUpperCase())) {
      return false;
    }

    // Reject offset formats like GMT+5, UTC+2, etc.
    if (/^(GMT|UTC)[+-]\d+$/.test(timezone)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the current time in the specified timezone
 * @param timezone - IANA timezone identifier
 * @returns Object containing current time information
 * @throws Error if timezone is invalid
 */
export function getCurrentTimeInTimezone(timezone: string) {
  if (!isValidTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  const now = DateTime.now().setZone(timezone);

  if (!now.isValid) {
    throw new Error(`Failed to get current time for timezone: ${timezone}`);
  }

  const isoString = now.toISO();
  if (!isoString) {
    throw new Error('Failed to generate ISO timestamp');
  }

  return {
    timestamp: isoString,
    timezone: timezone,
    utcOffset: now.toFormat('ZZ'),
    formatted: {
      date: now.toFormat('yyyy-MM-dd'),
      time: now.toFormat('HH:mm:ss'),
      full: now.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')
    },
    zoneName: now.zoneName,
    offsetMinutes: now.offset
  };
}

/**
 * Converts time from one timezone to another
 * @param sourceTime - ISO string or DateTime-compatible string
 * @param sourceTimezone - Source IANA timezone identifier
 * @param targetTimezone - Target IANA timezone identifier
 * @returns Object containing conversion information
 * @throws Error if any parameter is invalid
 */
export function convertTimeBetweenTimezones(
  sourceTime: string,
  sourceTimezone: string,
  targetTimezone: string
) {
  // Validate timezones
  if (!isValidTimezone(sourceTimezone)) {
    throw new Error(`Invalid source timezone: ${sourceTimezone}`);
  }

  if (!isValidTimezone(targetTimezone)) {
    throw new Error(`Invalid target timezone: ${targetTimezone}`);
  }

  // Parse source time
  let sourceDateTime: DateTime;

  try {
    // Try parsing as ISO string first
    sourceDateTime = DateTime.fromISO(sourceTime, { zone: sourceTimezone });

    // If not valid, try other common formats
    if (!sourceDateTime.isValid) {
      sourceDateTime = DateTime.fromFormat(sourceTime, 'yyyy-MM-dd HH:mm:ss', { zone: sourceTimezone });
    }

    if (!sourceDateTime.isValid) {
      sourceDateTime = DateTime.fromFormat(sourceTime, 'yyyy-MM-dd', { zone: sourceTimezone });
    }

    if (!sourceDateTime.isValid) {
      throw new Error('Unable to parse source time');
    }
  } catch {
    throw new Error(`Invalid source time format: ${sourceTime}`);
  }

  // Convert to target timezone
  const targetDateTime = sourceDateTime.setZone(targetTimezone);

  if (!targetDateTime.isValid) {
    throw new Error(`Failed to convert time to target timezone: ${targetTimezone}`);
  }

  // Calculate UTC offset difference
  const offsetDifferenceMinutes = targetDateTime.offset - sourceDateTime.offset;
  const offsetDifferenceHours = offsetDifferenceMinutes / 60;

  // Format as ±HH:MM
  const absHours = Math.abs(Math.floor(offsetDifferenceHours));
  const absMinutes = Math.abs(offsetDifferenceMinutes % 60);
  const sign = offsetDifferenceMinutes >= 0 ? '+' : '-';
  const offsetDifferenceFormatted = `${sign}${absHours.toString().padStart(2, '0')}:${absMinutes.toString().padStart(2, '0')}`;

  // Ensure ISO strings are not null
  const originalISO = sourceDateTime.toISO();
  const convertedISO = targetDateTime.toISO();

  if (!originalISO || !convertedISO) {
    throw new Error('Failed to generate ISO timestamp for conversion');
  }

  return {
    original: {
      timestamp: originalISO,
      timezone: sourceTimezone,
      formatted: sourceDateTime.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'),
      utcOffset: sourceDateTime.toFormat('ZZ')
    },
    converted: {
      timestamp: convertedISO,
      timezone: targetTimezone,
      formatted: targetDateTime.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'),
      utcOffset: targetDateTime.toFormat('ZZ')
    },
    utcOffsetDifference: offsetDifferenceFormatted,
    offsetDifferenceMinutes
  };
}

/**
 * Gets a list of commonly used timezone identifiers
 * @returns Array of IANA timezone identifiers
 */
export function getCommonTimezones(): string[] {
  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Kolkata',
    'Australia/Sydney',
    'Pacific/Auckland'
  ];
}

/**
 * Checks if a given date/time falls within Daylight Saving Time for a timezone
 * @param dateTime - ISO string or DateTime-compatible string
 * @param timezone - IANA timezone identifier
 * @returns boolean indicating if DST is active
 * @throws Error if parameters are invalid
 */
export function isDaylightSavingTime(dateTime: string, timezone: string): boolean {
  if (!isValidTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  let dt: DateTime;
  try {
    dt = DateTime.fromISO(dateTime, { zone: timezone });
    if (!dt.isValid) {
      dt = DateTime.fromFormat(dateTime, 'yyyy-MM-dd HH:mm:ss', { zone: timezone });
    }
    if (!dt.isValid) {
      throw new Error('Unable to parse date time');
    }
  } catch {
    throw new Error(`Invalid date time format: ${dateTime}`);
  }

  return dt.isInDST;
}

// Export all timezone utilities for easy importing
export const timezoneUtils = {
  isValidTimezone,
  getCurrentTimeInTimezone,
  convertTimeBetweenTimezones,
  getCommonTimezones,
  isDaylightSavingTime
};
