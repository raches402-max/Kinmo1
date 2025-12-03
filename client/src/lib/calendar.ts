/**
 * Generate a Google Calendar URL for adding an event
 *
 * @param params Event parameters
 * @returns Google Calendar URL string
 */
export function generateGoogleCalendarUrl(params: {
  title: string;
  startDate: Date;
  durationHours?: number;
  description?: string;
  location?: string;
}): string {
  const { title, startDate, durationHours = 3, description, location } = params;

  // Calculate end date
  const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

  // Format dates as YYYYMMDDTHHmmss (Google Calendar format)
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const dates = `${formatDate(startDate)}/${formatDate(endDate)}`;

  // Build URL with query params
  const baseUrl = 'https://calendar.google.com/calendar/render';
  const urlParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: dates,
  });

  if (description) {
    urlParams.set('details', description);
  }

  if (location) {
    urlParams.set('location', location);
  }

  return `${baseUrl}?${urlParams.toString()}`;
}

/**
 * Generate calendar URL from itinerary data
 */
export function generateCalendarUrlFromItinerary(params: {
  groupName: string;
  eventName: string;
  eventDate: string;
  venues: Array<{ venueName: string; venueAddress?: string | null }>;
}): string {
  const { groupName, eventName, eventDate, venues } = params;

  // Build description from venues
  const venueList = venues
    .map((v, idx) => `${idx + 1}. ${v.venueName}`)
    .join('\n');

  const description = `${groupName}\n\nThe Plan:\n${venueList}\n\nManaged with Kinmo`;

  // Use first venue address as location
  const location = venues.find(v => v.venueAddress)?.venueAddress || '';

  return generateGoogleCalendarUrl({
    title: eventName || groupName,
    startDate: new Date(eventDate),
    durationHours: 3,
    description,
    location,
  });
}
