/* qrkey.js: the visitor's Mistral key from a QR code, entirely in the browser. Code Apache-2.0.
 * Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026.
 *
 * The QR code holds a link to a demo page with the key after the "#", for example
 *   https://mistral.provider.sovereignweb.site/promptugal/ask/#key=<the key>
 * Two ways in:
 *  1. Opening that link. This script runs first, in the page's head: it reads the key from the "#", and at once replaces
 *     the address with the same one without the "#", so the key leaves the address bar and this tab's history entry.
 *     The part after "#" is never sent to any server by the browser.
 *  2. Pasting or dropping a picture of the QR code on the drop area (or choosing the file). The picture is decoded here,
 *     with the browser's own BarcodeDetector or, where there is none, jsQR (self-hosted, /promptugal/vendor/), and is
 *     sent nowhere.
 * Either way the key goes straight into the page's existing key box (the one in /browser/ask/panel.js or
 * /browser/voice/kit.js, unchanged), exactly as if it had been pasted there, and that box clears it from the field.
 * Nothing here stores, logs, shows or sends the key. On /promptugal/ (the list page) a key from the link is held in this
 * script's closure and added to a demo link's "#" only at the moment that link is followed.
 */
(function () {
  'use strict';
  if (window.top !== window.self) return; // the pages refuse to run in a frame; so does this
  const SHAPE = /^[A-Za-z0-9_-]{16,128}$/;
  function keyFrom(fragment) {
    let f = String(fragment || '').replace(/^#/, '');
    if (!f) return null;
    try { f = decodeURIComponent(f); } catch (e) { return null; }
    const m = /(?:^|&)(?:key|k)=([^&]*)/.exec(f);
    const k = m ? m[1] : f;
    return SHAPE.test(k) ? k : null;
  }
  // What a decoded QR code says: a link with the key after "#", or the bare key. Nothing else is accepted.
  function keyFromQr(text) {
    const s = String(text || '').trim();
    if (SHAPE.test(s)) return s;
    try { const u = new URL(s); return keyFrom(u.hash); } catch (e) { return null; }
  }

  // 1. The link. Before anything else on the page runs.
  let pending = null, fromLink = false;
  if (location.hash) {
    pending = keyFrom(location.hash);
    fromLink = true;
    history.replaceState(history.state, '', location.pathname + location.search);
  }

  function target() {
    if (document.getElementById('mk-key') && document.getElementById('mk-use')) return { input: document.getElementById('mk-key'), use: document.getElementById('mk-use') };
    if (document.getElementById('key') && document.getElementById('key-set')) return { input: document.getElementById('key'), use: document.getElementById('key-set') };
    return null;
  }
  function give(key) {
    const t = target();
    if (!t) return false;
    t.input.value = key; // the key box's own "Use this key" handler reads it and empties the field at once
    t.use.click();
    t.input.value = '';
    return true;
  }
  function say(text, bad) {
    const s = document.getElementById('qr-status');
    if (!s) return;
    s.textContent = text;
    s.classList.toggle('bad', !!bad);
  }

  // 2. A picture of the QR code: decoded in this tab.
  let jsqr = null;
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (jsqr) return jsqr;
    jsqr = new Promise(function (ok, no) {
      const s = document.createElement('script');
      s.src = '/promptugal/vendor/jsQR.js';
      s.onload = function () { window.jsQR ? ok(window.jsQR) : no(new Error('jsQR did not load')); };
      s.onerror = function () { jsqr = null; no(new Error('jsQR did not load')); };
      document.head.appendChild(s);
    });
    return jsqr;
  }
  async function decode(blob) {
    const bmp = await createImageBitmap(blob);
    try {
      if ('BarcodeDetector' in window) {
        try {
          const found = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(bmp);
          if (found.length) return found[0].rawValue;
        } catch (e) { /* not supported for this format here: try jsQR */ }
      }
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(bmp, 0, 0, w, h);
      const q = (await loadJsQR())(g.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
      return q ? q.data : null;
    } finally { if (bmp.close) bmp.close(); }
  }
  async function takeImage(blob) {
    if (!blob || !/^image\//.test(blob.type)) { say('That is not a picture. Paste, drop or choose a picture of the QR code.', true); return; }
    if (blob.size > 15 * 1024 * 1024) { say('That picture is over 15 MB. Use a smaller one.', true); return; }
    say('Reading the QR code, here in this tab...');
    let text = null;
    try { text = await decode(blob); } catch (e) { say('This browser could not read that picture.', true); return; }
    if (!text) { say('No QR code found in that picture. Try a sharper or closer picture.', true); return; }
    const key = keyFromQr(text);
    if (!key) { say('That QR code holds no Mistral key in the form this page expects (a link with the key after "#", or the key alone). Nothing was set.', true); return; }
    if (give(key)) say('Key read from the QR code and set, in this tab\'s memory only. It is not shown.');
    else say('Key read, but this page has no key box.', true);
  }

  function wireDrop() {
    const area = document.getElementById('qr-drop');
    if (!area) return;
    const file = document.getElementById('qr-file');
    area.addEventListener('dragover', function (e) { e.preventDefault(); area.classList.add('over'); });
    area.addEventListener('dragleave', function () { area.classList.remove('over'); });
    area.addEventListener('drop', function (e) {
      e.preventDefault(); area.classList.remove('over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      takeImage(f);
    });
    // Paste: into the area when it has focus, or anywhere on the page outside a text field.
    document.addEventListener('paste', function (e) {
      const t = e.target;
      const inField = t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'file'));
      if (inField && !area.contains(t)) return;
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (const it of items) if (it.kind === 'file' && /^image\//.test(it.type)) { e.preventDefault(); takeImage(it.getAsFile()); return; }
      if (area.contains(t) || t === area) say('The clipboard holds no picture. Copy the QR code\'s image, then paste here.', true);
    });
    if (file) file.addEventListener('change', function () { takeImage(file.files && file.files[0]); file.value = ''; });
  }

  // The list page: carry a key from the link into the demo the visitor opens, at the moment they open it.
  function wireLinks() {
    if (!pending) return;
    document.querySelectorAll('a[data-carry-key]').forEach(function (a) {
      a.addEventListener('click', function () { if (pending) a.href = a.getAttribute('href').split('#')[0] + '#key=' + encodeURIComponent(pending); });
    });
    window.addEventListener('pagehide', function () { pending = null; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireDrop();
    if (!fromLink) return;
    if (!pending) { say('The link had something after "#", but not a key in the form this page expects. It was removed from the address bar; nothing was set.', true); return; }
    if (document.querySelector('a[data-carry-key]') && !target()) {
      wireLinks();
      say('A key came with the link. It is held in this tab\'s memory and removed from the address bar; the demo you open from this page receives it. It is not shown.');
      return;
    }
    const ok = give(pending);
    pending = null;
    say(ok ? 'A key came with the link: it is set, in this tab\'s memory only, and removed from the address bar. It is not shown.' : 'A key came with the link, but this page has no key box. It was removed from the address bar.', !ok);
  });
})();
