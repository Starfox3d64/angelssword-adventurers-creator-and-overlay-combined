(function () {
  var KEY = "as_menu_theme";
  var THEMES = ["don", "leaflit", "ooz", "original"];
  var PALETTES = {"don": {"--as-bg": "#030303", "--as-panel": "#0a0a0a", "--as-accent": "#c9a227", "--as-accent-2": "#8b2942", "--as-glow": "rgba(201,162,39,.4)", "--as-text": "#e6dcc8", "--as-muted": "#9a8b6a", "--as-border": "rgba(201,162,39,.28)", "--as-tetris-1": "#c9a227", "--as-tetris-2": "#8b2942", "--as-tetris-3": "#e6dcc8", "--as-tetris-4": "#6b1c23", "--as-tetris-5": "#dbb858", "--as-tetris-6": "#a67c00", "--as-tetris-7": "#4a1520", "--bg-deep": "#030303", "--bg-panel": "#0a0a0a", "--bg-panel-alt": "#101010", "--bg-input": "#070707", "--bg-card": "rgba(8,8,8,.96)", "--accent-gold": "#c9a227", "--accent-gold-soft": "#b8860b", "--accent-gold-glow": "rgba(201,162,39,.4)", "--accent-gold-dim": "rgba(201,162,39,.16)", "--accent-teal": "#c9a227", "--accent-teal-glow": "rgba(201,162,39,.22)", "--accent-red": "#8b2942", "--accent-rose": "#6b1c23", "--accent-copper": "#a67c3d", "--accent-blue": "#121212", "--clr-success": "#6b8f5e", "--clr-error": "#8b2942", "--clr-info": "#c9a227", "--clr-warning": "#c9a227", "--text": "#e6dcc8", "--text-bright": "#f5ecd7", "--text-muted": "#9a8b6a", "--text-dim": "#5c5340", "--border": "rgba(201,162,39,.14)", "--border-light": "rgba(201,162,39,.24)", "--border-gold": "rgba(201,162,39,.32)", "--border-gold-med": "rgba(201,162,39,.45)"}, "leaflit": {
    "--as-bg": "#0a1020", "--as-panel": "#121c34", "--as-accent": "#5b9fff", "--as-accent-2": "#e23d4f",
    "--as-glow": "rgba(91,159,255,.45)", "--as-text": "#e8f0ff", "--as-muted": "#9bb0d0",
    "--as-border": "rgba(91,159,255,.35)",
    "--as-tetris-1": "#5b9fff", "--as-tetris-2": "#e23d4f", "--as-tetris-3": "#f0c14a",
    "--as-tetris-4": "#7eb6ff", "--as-tetris-5": "#c43a4a", "--as-tetris-6": "#ffe08a", "--as-tetris-7": "#3d6bb3",
    "--bg-deep": "#0a1020", "--bg-panel": "#121c34", "--bg-panel-alt": "#182440", "--bg-input": "#0c1428",
    "--bg-card": "rgba(18,28,52,.96)",
    "--accent-gold": "#5b9fff", "--accent-gold-soft": "#3d7fd4", "--accent-gold-glow": "rgba(91,159,255,.45)",
    "--accent-gold-dim": "rgba(91,159,255,.16)", "--accent-teal": "#5b9fff", "--accent-teal-glow": "rgba(91,159,255,.25)",
    "--accent-red": "#e23d4f", "--accent-rose": "#c9182e", "--accent-copper": "#f0c14a", "--accent-blue": "#0a1020",
    "--clr-success": "#5b9fff", "--clr-error": "#e23d4f", "--clr-info": "#5b9fff", "--clr-warning": "#f0c14a",
    "--text": "#e8f0ff", "--text-bright": "#ffffff", "--text-muted": "#9bb0d0", "--text-dim": "#6a7a98",
    "--border": "rgba(226,61,79,.25)", "--border-light": "rgba(91,159,255,.35)",
    "--border-gold": "rgba(91,159,255,.4)", "--border-gold-med": "rgba(226,61,79,.45)"
  }, "ooz": {"--as-bg": "#07141c", "--as-panel": "#0c1e28", "--as-accent": "#2ad4e8", "--as-accent-2": "#ff2d7a", "--as-glow": "rgba(42,212,232,.4)", "--as-text": "#e8fbff", "--as-muted": "#7ab0bc", "--as-border": "rgba(42,212,232,.35)", "--as-tetris-1": "#2ad4e8", "--as-tetris-2": "#ff2d7a", "--as-tetris-3": "#e8b923", "--as-tetris-4": "#1a9aaa", "--as-tetris-5": "#e23d4f", "--as-tetris-6": "#7ef0ff", "--as-tetris-7": "#c9185a", "--bg-deep": "#07141c", "--bg-panel": "#0c1e28", "--bg-panel-alt": "#122830", "--bg-input": "#081018", "--bg-card": "rgba(12,30,40,.96)", "--accent-gold": "#2ad4e8", "--accent-gold-soft": "#1a9aaa", "--accent-gold-glow": "rgba(42,212,232,.4)", "--accent-gold-dim": "rgba(42,212,232,.16)", "--accent-teal": "#2ad4e8", "--accent-teal-glow": "rgba(42,212,232,.25)", "--accent-red": "#ff2d7a", "--accent-rose": "#c9185a", "--accent-copper": "#e8b923", "--accent-blue": "#07141c", "--clr-success": "#2ad4e8", "--clr-error": "#ff2d7a", "--clr-info": "#2ad4e8", "--clr-warning": "#e8b923", "--text": "#e8fbff", "--text-bright": "#ffffff", "--text-muted": "#7ab0bc", "--text-dim": "#4a7080", "--border": "rgba(42,212,232,.2)", "--border-light": "rgba(42,212,232,.3)", "--border-gold": "rgba(42,212,232,.4)", "--border-gold-med": "rgba(42,212,232,.5)"}, "original": {"--as-bg": "#120a1c", "--as-panel": "#1c1228", "--as-accent": "#d4af37", "--as-accent-2": "#9b59b6", "--as-glow": "rgba(212,175,55,.4)", "--as-text": "#f5e6ff", "--as-muted": "#b8a0c8", "--as-border": "rgba(155,89,182,.4)", "--as-tetris-1": "#d4af37", "--as-tetris-2": "#9b59b6", "--as-tetris-3": "#e8c547", "--as-tetris-4": "#7d3c98", "--as-tetris-5": "#f1c40f", "--as-tetris-6": "#bb8fce", "--as-tetris-7": "#6c3483", "--bg-deep": "#120a1c", "--bg-panel": "#1c1228", "--bg-panel-alt": "#261830", "--bg-input": "#140c1e", "--bg-card": "rgba(28,18,40,.96)", "--accent-gold": "#d4af37", "--accent-gold-soft": "#b8860b", "--accent-gold-glow": "rgba(212,175,55,.4)", "--accent-gold-dim": "rgba(212,175,55,.16)", "--accent-teal": "#d4af37", "--accent-teal-glow": "rgba(212,175,55,.25)", "--accent-red": "#9b59b6", "--accent-rose": "#7d3c98", "--accent-copper": "#e8c547", "--accent-blue": "#120a1c", "--clr-success": "#9b59b6", "--clr-error": "#c0392b", "--clr-info": "#d4af37", "--clr-warning": "#f1c40f", "--text": "#f5e6ff", "--text-bright": "#ffffff", "--text-muted": "#b8a0c8", "--text-dim": "#7a6a88", "--border": "rgba(155,89,182,.25)", "--border-light": "rgba(155,89,182,.35)", "--border-gold": "rgba(212,175,55,.4)", "--border-gold-med": "rgba(212,175,55,.55)"}};

  function getTheme() {
    var t = localStorage.getItem(KEY) || "don";
    return THEMES.indexOf(t) >= 0 ? t : "don";
  }

  function applyPalette(theme) {
    var map = PALETTES[theme] || PALETTES.don;
    var root = document.documentElement;
    // Inline custom properties beat stylesheet :root — full theme swap
    Object.keys(map).forEach(function (k) {
      root.style.setProperty(k, map[k]);
    });
    root.setAttribute("data-theme", theme);
    if (document.body) {
      document.body.setAttribute("data-theme", theme);
      document.body.style.backgroundColor = map["--bg-deep"] || map["--as-bg"];
      document.body.style.color = map["--text"] || map["--as-text"];
    }
  }

  function ensureCss() {
    if (document.getElementById("asThemeCss")) return;
    var link = document.createElement("link");
    link.id = "asThemeCss";
    link.rel = "stylesheet";
    link.href = "/shared/theme.css?v=3";
    document.head.appendChild(link);
  }

  function applyTheme(theme) {
    if (THEMES.indexOf(theme) < 0) theme = "don";
    localStorage.setItem(KEY, theme);
    applyPalette(theme);
    var old = document.getElementById("asGlobalNav");
    if (old) old.remove();
    try {
      window.dispatchEvent(new CustomEvent("as-theme-change", { detail: { theme: theme } }));
    } catch (e) {}
  }

  // Apply as early as possible
  try {
    var early = getTheme();
    document.documentElement.setAttribute("data-theme", early);
    applyPalette(early);
  } catch (e) {}

  function boot() {
    ensureCss();
    applyTheme(getTheme());
    // Re-apply after page CSS loads so Creator/AnimeGen tokens win
    setTimeout(function () { applyTheme(getTheme()); }, 50);
    setTimeout(function () { applyTheme(getTheme()); }, 300);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.__ASTheme = { get: getTheme, set: applyTheme, themes: THEMES, palettes: PALETTES };
})();
