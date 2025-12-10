/**
 * usePhotoRefresh - Self-healing mechanism for broken venue photos
 *
 * When a photo fails to load, this triggers a background API call to refresh
 * the photo URL from Google Places API. The fix is stored in the database,
 * so all pages benefit from the refresh.
 */

// Tracks which googlePlaceIds we've already tried to refresh (prevents duplicate calls)
const refreshAttempts = new Set<string>();

/**
 * Trigger a photo refresh for a venue. Call this from img onError handlers.
 *
 * @param googlePlaceId - The Google Place ID for the venue
 * @param imgElement - Optional img element to hide on error
 */
export function handlePhotoError(
  googlePlaceId: string | undefined | null,
  imgElement?: HTMLImageElement
) {
  // Hide broken image icon
  if (imgElement) {
    imgElement.style.display = 'none';
  }

  // Trigger refresh if we haven't tried yet for this place
  if (googlePlaceId && !refreshAttempts.has(googlePlaceId)) {
    refreshAttempts.add(googlePlaceId);

    // Fire-and-forget API call to refresh the photo
    fetch(`/api/venues/${encodeURIComponent(googlePlaceId)}/refresh-photo`, {
      method: 'POST',
    }).catch(() => {
      // Silent fail - this is a best-effort background refresh
    });
  }
}

/**
 * Hook version for components that prefer hooks pattern.
 * Returns the same handlePhotoError function.
 */
export function usePhotoRefresh() {
  return { handlePhotoError };
}
