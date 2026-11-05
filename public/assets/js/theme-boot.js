/* Pre-paint: apply the saved watch theme (hw-theme) before first paint.
   External file on purpose: the production CSP does not allow inline scripts.
   Logic copied verbatim from the pre-paint block in index.html. */
(function () {
  try {
    var t = localStorage.getItem('hw-theme');
    if (t === 'system') t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    if (t === 'dark' || t === 'night') {
      document.documentElement.setAttribute('data-theme', t);
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', t === 'night' ? '#080404' : '#0E1210');
    }
  } catch (e) { /* storage unavailable: stay on light */ }
})();
