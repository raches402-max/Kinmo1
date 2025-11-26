/**
 * Enhanced error display component with retry functionality
 */

import { AlertCircle, RefreshCw, WifiOff, Server, ShieldAlert, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parseError, type EnhancedError, isRetryable } from "@/lib/errorHandling";

interface ErrorDisplayProps {
  error: any;
  onRetry?: () => void;
  className?: string;
  showTechnicalDetails?: boolean; // For debugging
}

/**
 * Display error with appropriate icon, message, and retry button
 */
export function ErrorDisplay({ error, onRetry, className, showTechnicalDetails = false }: ErrorDisplayProps) {
  const enhancedError: EnhancedError = parseError(error);

  // Choose icon based on error category
  const Icon = {
    network: WifiOff,
    timeout: RefreshCw,
    auth: ShieldAlert,
    api: Server,
    server: Server,
    validation: AlertCircle,
    notFound: Info,
    unknown: AlertCircle,
  }[enhancedError.category];

  return (
    <Alert variant="destructive" className={className}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{enhancedError.title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{enhancedError.message}</p>
        {enhancedError.action && (
          <p className="text-sm font-medium mt-2">
            💡 {enhancedError.action}
          </p>
        )}
        {onRetry && enhancedError.canRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Try Again
          </Button>
        )}
        {showTechnicalDetails && enhancedError.technicalDetails && (
          <details className="mt-2 text-xs opacity-70">
            <summary className="cursor-pointer">Technical Details</summary>
            <pre className="mt-1 whitespace-pre-wrap">{enhancedError.technicalDetails}</pre>
          </details>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Inline error message (smaller, for form fields)
 */
interface InlineErrorProps {
  message: string;
  action?: string;
}

export function InlineError({ message, action }: InlineErrorProps) {
  return (
    <div className="text-sm text-destructive space-y-1">
      <p className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {message}
      </p>
      {action && (
        <p className="text-xs pl-4">
          💡 {action}
        </p>
      )}
    </div>
  );
}

/**
 * Error toast content (for use with toast notifications)
 */
export function getErrorToast(error: any) {
  const enhancedError = parseError(error);

  return {
    title: enhancedError.title,
    description: (
      <div className="space-y-1">
        <p>{enhancedError.message}</p>
        {enhancedError.action && (
          <p className="text-sm font-medium">
            💡 {enhancedError.action}
          </p>
        )}
      </div>
    ),
    variant: "destructive" as const,
  };
}
