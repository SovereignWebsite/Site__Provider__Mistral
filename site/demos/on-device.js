// Level 1, on your device: fills in this page's own address for OLLAMA_ORIGINS, and compares
// measurements the visitor types in. Makes no network request of any kind.
'use strict';
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const origin = location.origin && location.origin !== 'null' ? location.origin : 'https://your-site.example';
  $('ollama-origins').textContent = 'OLLAMA_ORIGINS=' + origin + ' ollama serve';

  function secs(tokens, rate) {
    const s = tokens / rate;
    if (s < 60) return s.toFixed(1) + ' s';
    return Math.floor(s / 60) + ' min ' + Math.round(s % 60) + ' s';
  }

  $('measure').addEventListener('submit', function (e) {
    e.preventDefault();
    const st = $('m-status');
    const gen = parseFloat($('m-gen').value);
    const pr = parseFloat($('m-prompt').value);
    if (!(gen > 0)) { st.className = 'bad'; st.textContent = 'Enter the generation speed, a number above zero.'; $('m-gen').focus(); return; }
    st.className = ''; st.textContent = 'Added. Nothing was sent anywhere.';
    const tr = document.createElement('tr');
    const cells = [
      $('m-device').value.trim() || 'Not given',
      $('m-model').value.trim() || 'Not given',
      gen.toFixed(2) + (pr > 0 ? ' (prompt ' + pr.toFixed(2) + ')' : ''),
      secs(150, gen),
      secs(600, gen),
      'By you, ' + new Date().toISOString().slice(0, 10)
    ];
    cells.forEach(function (c, i) { const td = document.createElement('td'); td.textContent = c; if (i >= 2 && i <= 4) td.className = 'num'; tr.appendChild(td); });
    $('m-body').appendChild(tr);
  });
})();
