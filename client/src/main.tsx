import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

console.log('[DEBUG] main.tsx starting');

// Initialize Sentry for error monitoring (only if DSN is configured)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  console.log('[DEBUG] Initializing Sentry');
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Capture 10% of sessions, 100% of sessions with errors
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 10% in prod, 100% in dev
    // Session replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    // Don't send errors in development unless explicitly enabled
    enabled: import.meta.env.PROD || import.meta.env.VITE_SENTRY_ENABLED === 'true',
  });
  console.log('✅ Sentry error monitoring initialized');
}

console.log('[DEBUG] Looking for root element');
const rootElement = document.getElementById("root");
console.log('[DEBUG] Root element:', rootElement);

if (!rootElement) {
  console.error('[FATAL] Root element not found!');
  document.body.innerHTML = '<h1 style="color: red; padding: 20px;">Error: Root element not found</h1>';
} else {
  console.log('[DEBUG] Creating React root');
  try {
    const root = createRoot(rootElement);
    console.log('[DEBUG] Rendering App');
    root.render(<App />);
    console.log('[DEBUG] App rendered successfully');
  } catch (error) {
    console.error('[FATAL] Error during render:', error);
    document.body.innerHTML = '<h1 style="color: red; padding: 20px;">Render Error: ' + (error as Error).message + '</h1>';
  }
}
