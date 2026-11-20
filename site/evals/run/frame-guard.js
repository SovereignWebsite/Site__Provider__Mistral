// Refuse to run inside a frame, as site/demos/core.js does: another site could frame this page and trick a
// visitor into typing their key or pressing Run (security.b, reviews 005 and 006). GitHub Pages cannot send
// frame-ancestors, so this is done in script. Imported first by run.js; it throws to stop the page.
if (window.top !== window.self) {
  const stop = () => {
    const main = document.getElementById('main') || document.body;
    main.textContent = '';
    const p = document.createElement('p');
    p.textContent = 'This page does not run inside another page. ';
    const a = document.createElement('a');
    a.href = window.location.href; a.target = '_top'; a.rel = 'noopener';
    a.textContent = 'Open it directly.';
    p.appendChild(a); main.appendChild(p);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stop); else stop();
  throw new Error('framed: refusing to run');
}
