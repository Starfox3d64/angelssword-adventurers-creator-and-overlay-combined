/**
 * Global ? / F1 help overlay — lists suite-relevant shortcuts.
 */
(function () {
  if (window.__ASShortcuts) return;
  window.__ASShortcuts = true;

  const PATH = (location.pathname || '/').replace(/\/$/, '') || '/';
  const suites = {
    '/': 'Main Menu — pick a suite. Themes apply everywhere.',
    '/creator': '1–5 switch tabs · Esc cancel · Ctrl+S Settings focus',
    '/overlay': 'Emotes from control panel · thresholds in Settings',
    '/live2d': 'Media: Open Image/Video · drag PNG/MP4 · C center · scroll zoom (model)',
    '/music': 'Player: speed 0.5–2× · Export at speed · Set Global BGM',
    '/animegen': 'Prompt + seed · Generate · download outputs',
    '/tetris': '←→ move · ↑/X rotate · ↓ soft · Space hard · C hold · P pause · R restart'
  };

  function pathKey() {
    for (const k of Object.keys(suites)) {
      if (k !== '/' && PATH.indexOf(k) === 0) return k;
    }
    return '/';
  }

  function show() {
    let el = document.getElementById('asHelpOverlay');
    if (el) { el.remove(); return; }
    el = document.createElement('div');
    el.id = 'asHelpOverlay';
    el.setAttribute('role', 'dialog');
    el.innerHTML = `
      <div class="as-help-card">
        <div class="as-help-head">
          <strong>Shortcuts & tips</strong>
          <button type="button" id="asHelpClose" title="Close">✕</button>
        </div>
        <p class="as-help-suite">${suites[pathKey()] || ''}</p>
        <ul class="as-help-list">
          <li><kbd>?</kbd> / <kbd>F1</kbd> — this help</li>
          <li><kbd>Esc</kbd> — close help / cancel</li>
          <li>📌 Notes FAB — session notes (most suites)</li>
          <li>Theme — set on Main Menu (applies everywhere)</li>
          <li>Global BGM — Music → Set as Active Global BGM</li>
        </ul>
        <p class="as-help-foot">Don's Adventurer · press ? anytime</p>
      </div>`;
    const style = document.createElement('style');
    style.textContent = `
      #asHelpOverlay{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}
      .as-help-card{max-width:420px;width:100%;background:var(--as-panel,var(--bg-panel,#121212));color:var(--as-text,#eee);
        border:1px solid var(--as-border,rgba(201,162,39,.35));border-radius:12px;padding:16px 18px;box-shadow:0 12px 40px rgba(0,0,0,.5);font:14px/1.45 system-ui,sans-serif}
      .as-help-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;color:var(--as-accent,#c9a227)}
      .as-help-head button{background:transparent;border:none;color:var(--as-muted,#888);font-size:18px;cursor:pointer}
      .as-help-suite{color:var(--as-text,#ddd);margin:0 0 10px}
      .as-help-list{margin:0;padding-left:18px;color:var(--as-muted,#aaa)}
      .as-help-list kbd{background:var(--as-bg,#0a0a0a);border:1px solid var(--as-border,#333);border-radius:4px;padding:1px 5px;font-size:12px}
      .as-help-foot{margin:12px 0 0;font-size:11px;color:var(--as-muted,#666)}
    `;
    document.head.appendChild(style);
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
    document.getElementById('asHelpClose').onclick = () => el.remove();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === '?' || e.key === 'F1') {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      e.preventDefault();
      show();
    }
    if (e.key === 'Escape') {
      const el = document.getElementById('asHelpOverlay');
      if (el) el.remove();
    }
  });
})();
