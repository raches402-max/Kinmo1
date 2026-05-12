interface VenueForNaming {
  name: string;
  type: string;
}

/**
 * Generate a short, descriptive name for an itinerary based on its venues.
 *
 * This used to call gpt-4o-mini, but the deterministic fallback below
 * produces equivalent quality ("Marufuku & Ippudo - SF", "Ramen in Oakland")
 * for zero cost. The export signature is kept so callers don't change.
 */
export async function generateItineraryName(
  venues: VenueForNaming[],
  location: string,
): Promise<string> {
  return generateFallbackName(venues, location);
}

function generateFallbackName(venues: VenueForNaming[], location: string): string {
  const city = location.split(",")[0].trim();

  if (venues.length === 1) {
    return `${venues[0].name} - ${city}`;
  }

  if (venues.length === 2) {
    return `${venues[0].name} & ${venues[1].name} - ${city}`;
  }

  const types = Array.from(new Set(venues.map((v) => v.type.toLowerCase())));

  if (types.length === 1) {
    const typeCapitalized = types[0].charAt(0).toUpperCase() + types[0].slice(1);
    return `${typeCapitalized} in ${city}`;
  }

  return `${venues.length} Spots - ${city}`;
}
