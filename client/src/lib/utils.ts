import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatInTimeZone } from "date-fns-tz"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get timezone abbreviation (e.g., "PST", "EST", "PDT") from IANA timezone identifier
 * @param date - The date to get the abbreviation for (affects DST)
 * @param timezone - IANA timezone identifier (e.g., "America/Los_Angeles")
 * @returns Timezone abbreviation (e.g., "PST", "PDT")
 */
export function getTimezoneAbbreviation(date: Date, timezone: string): string {
  try {
    // Use Intl.DateTimeFormat to get the timezone abbreviation
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });

    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(part => part.type === 'timeZoneName');
    return tzPart?.value || timezone;
  } catch (error) {
    // Fallback to timezone identifier if abbreviation unavailable
    return timezone;
  }
}

/**
 * Format a datetime with timezone in the format: "Saturday, Jan 25 at 7:00 PM PST"
 * @param date - Date to format (can be Date object or ISO string)
 * @param timezone - IANA timezone identifier (e.g., "America/Los_Angeles")
 * @returns Formatted string like "Saturday, Jan 25 at 7:00 PM PST"
 */
export function formatDateTimeWithTimezone(date: Date | string, timezone: string = 'America/Los_Angeles'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Format the date and time
  const formatted = formatInTimeZone(
    dateObj,
    timezone,
    "EEEE, MMM d 'at' h:mm a"
  );

  // Get timezone abbreviation
  const tzAbbr = getTimezoneAbbreviation(dateObj, timezone);

  return `${formatted} ${tzAbbr}`;
}
