// Adds a Copy button to each code block (.codebox). Without this script the blocks stay selectable as they are.
(function () {
  if (!document.querySelectorAll) return;
  document.querySelectorAll('.codebox').forEach(function (box) {
    var code = box.querySelector('code');
    if (!code) return;
    var bar = document.createElement('div');
    bar.className = 'copybar';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy: ' + (box.getAttribute('aria-label') || 'the code'));
    var status = document.createElement('span');
    status.className = 'copy-status';
    status.setAttribute('role', 'status');
    bar.appendChild(btn); bar.appendChild(status);
    box.parentNode.insertBefore(bar, box);
    btn.addEventListener('click', function () {
      var text = code.textContent;
      var done = function () { status.textContent = 'Copied'; setTimeout(function () { status.textContent = ''; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { select(); });
      } else select();
      function select() {
        var r = document.createRange(); r.selectNodeContents(code);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        status.textContent = 'Selected: press Ctrl+C or Cmd+C';
      }
    });
  });
})();
