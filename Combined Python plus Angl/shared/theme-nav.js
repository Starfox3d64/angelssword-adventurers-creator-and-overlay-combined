(function () {
  var KEY = 'as_menu_theme';
  var THEMES = ['don', 'leaflit', 'ooz', 'original'];
  function getTheme() {
    var t = localStorage.getItem(KEY) || 'don';
    return THEMES.indexOf(t) >= 0 ? t : 'don';
  }
  function applyTheme(theme) {
    if (THEMES.indexOf(theme) < 0) theme = 'don';
    document.documentElement.setAttribute('data-theme', theme);
    if (document.body) document.body.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    var sel = document.getElementById('asThemeSelect');
    if (sel) sel.value = theme;
    try { window.dispatchEvent(new CustomEvent('as-theme-change', { detail: { theme: theme } })); } catch (e) {}
  }
  function ensureCss() {
    if (document.getElementById('asThemeCss')) return;
    var link = document.createElement('link');
    link.id = 'asThemeCss';
    link.rel = 'stylesheet';
    link.href = '/shared/theme.css';
    document.head.appendChild(link);
  }
  function ensureNav() {
    if (document.getElementById('asGlobalNav')) return;
    var nav = document.createElement('nav');
    nav.id = 'asGlobalNav';
    nav.innerHTML =
      '<span class="as-nav-title">⚔ Don\'s Adventurer</span>' +
      '<a href="/">Menu</a>' +
      '<a href="/overlay">Overlay</a>' +
      '<a href="/creator">Creator</a>' +
      '<a href="/live2d">Models</a>' +
      '<a href="/music">Music</a>' +
      '<a href="/animegen">AnimeGen</a>' +
      '<a href="/tetris">Tetris</a>' +
      '<span class="as-nav-spacer"></span>' +
      '<label style="color:var(--as-muted);font-size:0.75rem">Theme ' +
      '<select id="asThemeSelect">' +
      '<option value="don">Don (Gold)</option>' +
      '<option value="leaflit">Leaflit</option>' +
      '<option value="ooz">Ooz</option>' +
      '<option value="original">Original Adventurer</option>' +
      '</select></label>';
    document.body.insertBefore(nav, document.body.firstChild);
    document.getElementById('asThemeSelect').addEventListener('change', function (e) {
      applyTheme(e.target.value);
    });
  }
  function boot() {
    ensureCss();
    applyTheme(getTheme());
    ensureNav();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.__ASTheme = { get: getTheme, set: applyTheme, themes: THEMES };
})();
