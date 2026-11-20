// Imported first by app.js, so it runs before any other module, agent, tool or error report can read the address.
// A key arriving as #k=... (from the "send this key to my phone" QR code) is read once and stripped from the
// address bar here. Nothing else on the page ever sees location.href with the fragment.
// team.mistral@SovereignWebsite.dinis, 20 November 2026 (security.b, review 005, point c). Code Apache-2.0.
let pending = '';
if (location.hash.startsWith('#k=')) {
  try { pending = decodeURIComponent(location.hash.slice(3)); } catch { pending = ''; }
  history.replaceState(null, '', location.pathname + location.search);
}
// Hand the key over once; the module keeps no copy after that.
export function takeFragmentKey() { const k = pending; pending = ''; return k; }
