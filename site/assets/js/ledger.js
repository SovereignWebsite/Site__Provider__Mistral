// Design 4: the visitor's own row, tallied in this page. Nothing is sent anywhere or stored.
(function () {
  var sels = document.querySelectorAll('.yours select');
  var out = document.getElementById('tally');
  if (!sels.length || !out) return;
  function tally() {
    var answered = 0, yours = 0, unsure = 0, open = [];
    sels.forEach(function (s) {
      if (!s.value) return;
      answered++;
      var good = (s.getAttribute('data-good') || '').split(' ');
      if (s.value === 'unsure') { unsure++; open.push(s.labels && s.labels[0] ? s.labels[0].textContent : s.name); }
      else if (good.indexOf(s.value) >= 0) yours++;
    });
    if (!answered) { out.textContent = 'Answer the five questions in your row and your tally appears here.'; return; }
    var t = yours + ' of ' + sels.length + ' answers point to you holding control.';
    if (unsure) t += ' Not sure on ' + unsure + ': ' + open.join(', ').toLowerCase() + ' Those are the ones to find out first.';
    if (answered < sels.length) t += ' (' + (sels.length - answered) + ' still to answer.)';
    out.textContent = t;
  }
  sels.forEach(function (s) { s.addEventListener('change', tally); });
  tally();
})();
