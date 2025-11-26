/**
 * Formatting utility functions
 * Extracted from group-detail.tsx for reuse and performance
 */

/**
 * Format meeting frequency for display
 * Handles both old format (weekly, biweekly, monthly) and new format (2x week, 1-month)
 */
export function formatMeetingFrequency(freq: string): string {
  // Handle old format
  if (freq === "weekly") return "Every week";
  if (freq === "biweekly") return "Every 2 weeks";
  if (freq === "monthly") return "Every month";
  if (freq === "flexible") return "Flexible";

  // Handle new format "2x week" or old format "2-week"
  if (freq.includes("x ") || freq.includes("-")) {
    const parts = freq.includes("x ") ? freq.split("x ") : freq.split("-");
    const [num, unit] = parts;
    const number = parseInt(num);
    // Remove 's' if plural for consistency
    const singularUnit = unit?.trim().endsWith("s") ? unit.trim().slice(0, -1) : unit?.trim() || "week";

    if (number === 1) {
      return `Every ${singularUnit}`;
    }
    // Add 's' for plural display
    return `Every ${number} ${singularUnit}s`;
  }

  return freq;
}

/**
 * Format a date for display with optional timezone
 */
export function formatEventDate(date: Date | string, timezone?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };

  if (timezone) {
    options.timeZone = timezone;
  }

  return d.toLocaleDateString('en-US', options);
}

/**
 * Format a date range for display
 */
export function formatDateRange(startDate: Date | string, endDate: Date | string): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return `${startStr} - ${endStr}`;
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 */
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffMins) < 60) {
    if (diffMins < 0) return `${Math.abs(diffMins)} minutes ago`;
    return `in ${diffMins} minutes`;
  }

  if (Math.abs(diffHours) < 24) {
    if (diffHours < 0) return `${Math.abs(diffHours)} hours ago`;
    return `in ${diffHours} hours`;
  }

  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  return `in ${diffDays} days`;
}

/**
 * Format price range for display (e.g., "$$" or "$15-25")
 */
export function formatPriceRange(priceLevel: number | null): string {
  if (priceLevel === null || priceLevel === undefined) return 'N/A';
  return '$'.repeat(priceLevel);
}
