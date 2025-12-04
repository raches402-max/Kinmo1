// ULTRA MINIMAL TEST - No React, no imports at all
console.log('[TEST] Script is executing');

document.addEventListener('DOMContentLoaded', function() {
  console.log('[TEST] DOM loaded');
  var root = document.getElementById('root');
  if (root) {
    root.innerHTML = '<h1 style="color: green; padding: 40px; text-align: center;">✅ JavaScript Works!</h1><p style="text-align: center;">No React - just vanilla JS</p>';
    console.log('[TEST] Content rendered');
  } else {
    document.body.innerHTML = '<h1 style="color: red;">No root element</h1>';
  }
});

// Also try immediate execution
try {
  console.log('[TEST] Immediate execution works');
} catch (e) {
  // silent
}
