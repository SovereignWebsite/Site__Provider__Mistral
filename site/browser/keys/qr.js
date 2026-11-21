// Draws a QR code as SVG with the qrcode-generator already on this site (/team/qrcode.js, Kazuhiko Arase, MIT),
// and copies text. Code Apache-2.0. Written by browser.c for Dinis Cruz, 21 November 2026. No request, no storage.

// Refuse to run inside a frame (security.b, review 005). GitHub Pages cannot send frame-ancestors.
if (window.top !== window.self) {
  const stop = () => {
    const main = document.getElementById('main') || document.body;
    main.textContent = '';
    const p = document.createElement('p');
    p.textContent = 'This demo does not run inside another page. ';
    const a = document.createElement('a');
    a.href = window.location.href; a.target = '_top'; a.rel = 'noopener';
    a.textContent = 'Open it directly.';
    p.appendChild(a); main.appendChild(p);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stop); else stop();
  throw new Error('framed: demo stopped');
}

import qrcode from '/team/qrcode.js';

const NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs) { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); return n; }

// Error correction L: these links are about 1000 characters, shown on a screen, and L keeps the code smallest.
export function drawQR(box, text, label) {
  const q = qrcode(0, 'L'); q.addData(text, 'Byte'); q.make();
  const n = q.getModuleCount(), pad = 4, size = n + pad * 2;
  const svg = sv('svg', { viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': label, 'shape-rendering': 'crispEdges' });
  svg.append(sv('rect', { x: 0, y: 0, width: size, height: size, fill: '#fff' }));
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + pad} ${r + pad}h1v1h-1z`;
  svg.append(sv('path', { d, fill: '#000' }));
  box.replaceChildren(svg);
}

export async function copyText(field, status) {
  try { await navigator.clipboard.writeText(field.value); status.textContent = 'Copied.'; }
  catch { field.focus(); field.select(); status.textContent = 'Selected: copy it with your keyboard or menu.'; }
}
