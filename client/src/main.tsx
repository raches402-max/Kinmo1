import { createRoot } from "react-dom/client";

console.log('[DEBUG] main.tsx starting');

// TEMPORARY: Minimal test component - no imports except React
function TestApp() {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1 style={{ color: 'green' }}>React is working!</h1>
      <p>If you see this, the basic setup works.</p>
      <p>The issue is somewhere in the App imports.</p>
    </div>
  );
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
    console.log('[DEBUG] Rendering TestApp');
    root.render(<TestApp />);
    console.log('[DEBUG] TestApp rendered successfully');
  } catch (error) {
    console.error('[FATAL] Error during render:', error);
    document.body.innerHTML = '<h1 style="color: red; padding: 20px;">Render Error: ' + (error as Error).message + '</h1>';
  }
}
