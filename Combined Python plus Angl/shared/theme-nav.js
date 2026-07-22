(function () {
  var KEY = 'as_menu_theme';
  var THEMES = ['don', 'leaflit', 'ooz', 'original'];
  function getTheme() {
    var t = localStorage.getItem(KEY) || 'don';
    return THEMES.indexOf(t) >= 0 ? t : 'don';
  }
  function ensureCss() {
    if (document.getElementById('asThemeCss')) return;
    var link = document.createElement('link');
    link.id = 'asThemeCss';
    link.rel = 'stylesheet';
    link.href = '/shared/theme.css?v=2';
    // Put as late as possible so it can override :root from page CSS
    document.head.appendChild(link);
  }
  function applyTheme(theme) {
    if (THEMES.indexOf(theme) < 0) theme = 'don';
    document.documentElement.setAttribute('data-theme', theme);
    if (document.body) document.body.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    var old = document.getElementById('asGlobalNav');
    if (old) old.remove();
    try {
      window.dispatchEvent(new CustomEvent('as-theme-change', { detail: { theme: theme } }));
    } catch (e) {}
  }
  // Apply theme attribute ASAP (before paint if possible)
  try {
    document.documentElement.setAttribute('data-theme', getTheme());
  } catch (e) {}
  function boot() {
    ensureCss();
    applyTheme(getTheme());
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.__ASTheme = { get: getTheme, set: applyTheme, themes: THEMES };
})();
