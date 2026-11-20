// Design 3: show the pane for the chosen provider. Without this script every pane is shown, one after another.
// Nothing here talks to the network; no key is asked for or stored.
(function () {
  var radios = document.querySelectorAll('input[name="prov"]');
  var panes = document.querySelectorAll('.c-pane');
  if (!radios.length || !panes.length) return;
  document.documentElement.classList.add('js');
  function show() {
    var v = document.querySelector('input[name="prov"]:checked');
    v = v ? v.value : 'mistral';
    panes.forEach(function (p) { p.hidden = p.getAttribute('data-prov') !== v; });
  }
  radios.forEach(function (r) { r.addEventListener('change', show); });
  show();
})();
