// The sanitiser: an SVG written by a model is rebuilt here from an allow-list before it is shown, then shown only as
// an <img> from a blob: address, where a browser runs no script and loads nothing from anywhere. Two locks, not one.
// Elements and attributes not on the lists are dropped and counted; a url() may point only inside the document (#id).
// Runs in the browser (DOMParser). mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
const NS = 'http://www.w3.org/2000/svg';
const ELEMENTS = new Set(['svg', 'g', 'defs', 'title', 'desc', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan',
  'linearGradient', 'radialGradient', 'stop', 'pattern', 'clipPath', 'mask', 'filter', 'feDropShadow', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode', 'feFlood', 'feComposite', 'feBlend']);
const ATTRS = new Set(['viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'd', 'points', 'dx', 'dy', 'rotate',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'opacity',
  'transform', 'id', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'patternUnits', 'patternTransform', 'patternContentUnits',
  'clip-path', 'clipPathUnits', 'mask', 'maskUnits', 'filter', 'filterUnits', 'stdDeviation', 'flood-color', 'flood-opacity', 'in', 'in2', 'result', 'operator', 'mode',
  'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'textLength', 'lengthAdjust', 'preserveAspectRatio']);
const URL_OK = /^url\(#[A-Za-z][\w.-]{0,60}\)$/;
const BAD_VALUE = /(javascript:|data:|https?:|\/\/|expression\(|@import|<|>)/i;

export function sanitiseSvg(source) {
  const report = { dropped: {}, kept: 0, ok: false, reason: '' };
  const drop = (what) => { report.dropped[what] = (report.dropped[what] || 0) + 1; };
  const text = String(source || '').slice(0, 60000);
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName !== 'svg' || doc.getElementsByTagName('parsererror').length) { report.reason = 'not a well-formed SVG document'; return { svg: null, report }; }
  const out = document.implementation.createDocument(NS, 'svg', null);
  const copy = (from, to) => {
    for (const a of [...from.attributes]) {
      const name = a.name, v = a.value.trim();
      if (name === 'xmlns') continue; // the namespace is set by createElementNS
      if (!ATTRS.has(name)) { drop('attribute ' + name); continue; }
      if (/url\(/i.test(v) && !URL_OK.test(v)) { drop('url() in ' + name); continue; }
      if (BAD_VALUE.test(v)) { drop('value of ' + name); continue; }
      to.setAttribute(name, v.slice(0, 4000));
    }
    for (const c of [...from.childNodes]) {
      if (c.nodeType === 3) { to.appendChild(out.createTextNode(c.nodeValue.slice(0, 400))); continue; }
      if (c.nodeType !== 1) continue; // comments, processing instructions, CDATA: gone
      if (c.namespaceURI !== NS || !ELEMENTS.has(c.localName)) { drop('element ' + c.localName); continue; }
      const n = out.createElementNS(NS, c.localName); report.kept++;
      copy(c, n); to.appendChild(n);
    }
  };
  copy(root, out.documentElement);
  const svg = out.documentElement;
  if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 600 800');
  svg.setAttribute('width', '600'); svg.setAttribute('height', '800');
  report.ok = report.kept > 0;
  if (!report.ok) report.reason = 'nothing left to draw';
  return { svg: new XMLSerializer().serializeToString(out), report };
}

// The sanitised SVG as an image: a blob: address for an <img>, never inserted into the page as markup.
export function svgImage(img, svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  img.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  img.src = url;
}
