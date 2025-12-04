import { createRoot } from "react-dom/client";
// Sentry temporarily disabled for debugging
// import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

console.log('[DEBUG] main.tsx starting - imports completed');

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
