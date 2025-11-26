/**
 * Enhanced error handling utilities for better user experience
 */

export type ErrorCategory =
  | 'network'      // Network/connectivity issues
  | 'validation'   // User input validation
  | 'auth'         // Authentication/authorization
  | 'api'          // External API failures (OpenAI, Google Places)
  | 'notFound'     // Resource not found
  | 'server'       // Server errors
  | 'timeout'      // Request timeout
  | 'unknown';     // Fallback

export interface EnhancedError {
  category: ErrorCategory;
  title: string;
  message: string;
  action?: string;           // Suggested action for user
  canRetry: boolean;        // Whether retry makes sense
  retryDelay?: number;      // Suggested retry delay in ms
  technicalDetails?: string; // For debugging (not shown to user)
}

/**
 * Parse error and return user-friendly information
 */
export function parseError(error: any): EnhancedError {
  // Network errors
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return {
      category: 'network',
      title: 'Connection Issue',
      message: 'Unable to connect to the server. Please check your internet connection.',
      action: 'Check your connection and try again',
      canRetry: true,
      retryDelay: 2000,
      technicalDetails: error.message,
    };
  }

  // Timeout errors
  if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
    return {
      category: 'timeout',
      title: 'Request Timed Out',
      message: 'This is taking longer than expected. The server might be busy.',
      action: 'Please try again in a moment',
      canRetry: true,
      retryDelay: 3000,
      technicalDetails: error.message,
    };
  }

  // Authentication errors (401, 403)
  if (error.status === 401 || error.message?.includes('Unauthorized')) {
    return {
      category: 'auth',
      title: 'Authentication Required',
      message: 'Your session may have expired. Please log in again.',
      action: 'Refresh the page to log in',
      canRetry: false,
      technicalDetails: error.message,
    };
  }

  if (error.status === 403 || error.message?.includes('Forbidden')) {
    return {
      category: 'auth',
      title: 'Access Denied',
      message: 'You don\'t have permission to perform this action.',
      action: 'Contact the group organizer if you think this is a mistake',
      canRetry: false,
      technicalDetails: error.message,
    };
  }

  // Not found errors (404)
  if (error.status === 404 || error.message?.includes('not found')) {
    return {
      category: 'notFound',
      title: 'Not Found',
      message: 'The requested item could not be found. It may have been deleted.',
      action: 'Go back and try again',
      canRetry: false,
      technicalDetails: error.message,
    };
  }

  // Validation errors (400)
  if (error.status === 400) {
    return {
      category: 'validation',
      title: 'Invalid Input',
      message: error.message || 'Please check your input and try again.',
      action: 'Review the form and make corrections',
      canRetry: true,
      retryDelay: 0,
      technicalDetails: error.message,
    };
  }

  // OpenAI API errors
  if (error.message?.includes('OpenAI') || error.message?.includes('GPT')) {
    return {
      category: 'api',
      title: 'AI Service Unavailable',
      message: 'Our AI service is temporarily unavailable. This usually resolves quickly.',
      action: 'Try again in a few seconds',
      canRetry: true,
      retryDelay: 5000,
      technicalDetails: error.message,
    };
  }

  // Google Places API errors
  if (error.message?.includes('Google Places') || error.message?.includes('No venues found')) {
    return {
      category: 'api',
      title: 'Venue Search Issue',
      message: 'Unable to find venues in this area.',
      action: 'Try expanding your search radius or changing the location',
      canRetry: true,
      retryDelay: 1000,
      technicalDetails: error.message,
    };
  }

  // Location/geocoding errors
  if (error.message?.includes('Location not found') || error.message?.includes('geocode')) {
    return {
      category: 'validation',
      title: 'Location Not Found',
      message: 'We couldn\'t find that location.',
      action: 'Try using "City, State" format (e.g., "Oakland, California")',
      canRetry: true,
      retryDelay: 0,
      technicalDetails: error.message,
    };
  }

  // Server errors (500+)
  if (error.status >= 500) {
    return {
      category: 'server',
      title: 'Server Error',
      message: 'Something went wrong on our end. We\'re working to fix it.',
      action: 'Try again in a moment',
      canRetry: true,
      retryDelay: 5000,
      technicalDetails: error.message,
    };
  }

  // Default fallback
  return {
    category: 'unknown',
    title: 'Something Went Wrong',
    message: error.message || 'An unexpected error occurred.',
    action: 'Try again or contact support if this persists',
    canRetry: true,
    retryDelay: 3000,
    technicalDetails: JSON.stringify(error),
  };
}

/**
 * Common error messages for specific scenarios
 */
export const ERROR_MESSAGES = {
  // Venue-related
  noVenuesFound: {
    title: 'No Venues Found',
    message: 'We couldn\'t find any venues matching your criteria.',
    action: 'Try expanding your search radius to 10+ miles or adjusting filters',
  },
  venueSearchFailed: {
    title: 'Venue Search Failed',
    message: 'Unable to search for venues right now.',
    action: 'Check your internet connection and try again',
  },

  // Event creation
  eventCreationFailed: {
    title: 'Event Creation Failed',
    message: 'We couldn\'t create the event.',
    action: 'Please check all required fields and try again',
  },
  insufficientMembers: {
    title: 'More Members Needed',
    message: 'You need at least 2 members to create an event.',
    action: 'Invite more members to your group first',
  },

  // RSVP
  rsvpFailed: {
    title: 'RSVP Failed',
    message: 'Unable to submit your RSVP.',
    action: 'Try again in a moment',
  },

  // AI generation
  aiGenerationFailed: {
    title: 'AI Generation Failed',
    message: 'Our AI service encountered an issue.',
    action: 'This usually resolves in a few seconds. Please try again',
  },
  aiGenerationSlow: {
    title: 'Taking Longer Than Expected',
    message: 'AI generation is running slower than usual (typically 10-20 seconds).',
    action: 'Please wait a bit longer, or try again if nothing happens after 30 seconds',
  },

  // Generic
  formIncomplete: {
    title: 'Missing Information',
    message: 'Please fill in all required fields.',
    action: 'Check for fields marked with *',
  },
};

/**
 * Retry utility with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);

        if (onRetry) {
          onRetry(attempt + 1, error);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable based on category
 */
export function isRetryable(error: EnhancedError): boolean {
  return error.canRetry && ['network', 'timeout', 'api', 'server'].includes(error.category);
}
