/**
 * Global ? / F1 help — rich tips per suite + optional floating Help button.
 */
(function () {
  if (window.__ASShortcuts) return;
  window.__ASShortcuts = true;

  function pathKey() {
    const PATH = (location.pathname || '/').replace(/\/$/, '') || '/';
    for (const k of ['/creator', '/overlay', '/live2d', '/music', '/animegen', '/tetris']) {
      if (PATH.indexOf(k) === 0) return k;
    }
    return '/';
  }

  const TIPS = {
    '/': {
      title: 'Main Menu — tips',
      body: [
        'Pick a <b>theme</b> (Don / Leaflit / Ooz / Original) — it applies to every suite.',
        'Open <b>Music</b> first, play a track, then <b>Set as Active Global BGM</b> so music follows you into Creator, Models, Tetris, etc.',
        'Use <b>Creator</b> for sprites → video → transparent WebM/GIF for PNGtubers.',
        'Use <b>Model Suite</b> to preview Live2D runtimes or drag PNG/WebM/MP4 media.',
        'Use <b>Overlay</b> as an OBS Browser Source for face/emote control.',
        '<b>AnimeGen</b> for short anime clips (local ComfyUI / Diffusers).',
        '<b>Tetris</b> if you need a break — themes color the blocks.',
        '📌 Notes button (most suites) keeps session scratch notes in the browser.',
      ]
    },
    '/creator': {
      title: 'Creator — tips',
      body: [
        'Pipeline: <b>Sprite Prep → Generate Video → Video Prep → Model Exporter</b>.',
        'Keys live in <b>Settings</b> (OpenAI / Gemini / Grok) — stored only in your browser.',
        'Export: try <b>GPU / RGBA</b> mode in Settings if WebM has rare quality issues.',
        'Chroma key: pick green/magenta and use auto-detect when unsure.',
        'Handoff buttons send assets to the next tab.',
        'Need ffmpeg on PATH (or Windows auto-download) for true-alpha WebM.',
      ]
    },
    '/overlay': {
      title: 'Overlay — tips',
      body: [
        'Copy the <b>OBS Browser Source URL</b> from the bar at the top.',
        'Add that URL in OBS → Sources → Browser.',
        'Tune expression thresholds before going live.',
        'Emote buttons fire from the control panel.',
      ]
    },
    '/live2d': {
      title: 'Model Suite — tips',
      body: [
        '<b>Live2D mode:</b> load a runtime package (.model3.json + .moc3 + textures), not .cmo3 editor files.',
        '<b>Media mode:</b> Open Image/Video or drag PNG / WebM / MP4 into the viewer.',
        'Use <b>Media Tweak</b> for scale, offset, rotation, opacity.',
        '<b>Screenshot / Copy</b> capture the current model or media frame.',
        'Export Cubism projects with File → Export for Runtime first.',
      ]
    },
    '/music': {
      title: 'Music — tips',
      body: [
        'Generate with Suno (API key in settings) or upload MP3/WAV.',
        'Playback <b>speed 0.5×–2×</b> — then <b>Export at speed</b> for a permanent file.',
        '<b>Set as Active Global BGM</b> keeps music while you use other suites.',
        '<b>Fade stop</b> gently lowers volume then pauses (local + global).',
        '★ Favorite tracks in the library for quick finds.',
        'Trim tab: set start/end and export a clip.',
      ]
    },
    '/animegen': {
      title: 'AnimeGen — tips',
      body: [
        'Japanese-leaning prompts often work better for AnimeGen/Wan.',
        'Use negative prompts (3d, cg, photo, …) to stay on-model.',
        'Prompt history remembers your last prompts — click to restore.',
        'Download High/Low noise weights if running local Diffusers.',
        'ComfyUI on 127.0.0.1:8188 can be used as a backend when configured.',
      ]
    },
    '/tetris': {
      title: 'Tetris — tips',
      body: [
        '← → move · ↑ or X rotate · ↓ soft drop · Space hard drop.',
        '<b>C</b> / Shift hold piece · <b>P</b> pause · <b>R</b> restart.',
        'Difficulty: Easy → Insane (saved). Manual speed slider overrides auto.',
        'Ghost piece shows landing position. SFX toggle for beeps.',
        'High score is stored in this browser.',
      ]
    }
  };

  function show() {
    let el = document.getElementById('asHelpOverlay');
    if (el) { el.remove(); return; }
    const tip = TIPS[pathKey()] || TIPS['/'];
    el = document.createElement('div');
    el.id = 'asHelpOverlay';
    el.innerHTML = `
      <div class="as-help-card">
        <div class="as-help-head">
          <strong>${tip.title}</strong>
          <button type="button" id="asHelpClose" title="Close">✕</button>
        </div>
        <ul class="as-help-list">${tip.body.map((b) => '<li>' + b + '</li>').join('')}</ul>
        <div class="as-help-global">
          <p><kbd>?</kbd> or <kbd>F1</kbd> — open/close this help · <kbd>Esc</kbd> — close</p>
          <p>Themes · Global BGM · Notes (📌) work across suites.</p>
        </div>
        <p class="as-help-foot">Don's Adventurer — press F1 anytime</p>
      </div>`;
    if (!document.getElementById('asHelpStyle')) {
      const style = document.createElement('style');
      style.id = 'asHelpStyle';
      style.textContent = `
        #asHelpOverlay{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}
        .as-help-card{max-width:520px;width:100%;max-height:85vh;overflow:auto;background:var(--as-panel,var(--bg-panel,#121212));color:var(--as-text,#eee);
          border:1px solid var(--as-border,rgba(201,162,39,.4));border-radius:14px;padding:18px 20px;box-shadow:0 16px 48px rgba(0,0,0,.55);font:14px/1.5 system-ui,sans-serif}
        .as-help-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;color:var(--as-accent,#c9a227);font-size:1.05rem}
        .as-help-head button{background:transparent;border:none;color:var(--as-muted,#888);font-size:18px;cursor:pointer}
        .as-help-list{margin:0;padding-left:18px;color:var(--as-text,#ddd)}
        .as-help-list li{margin:6px 0}
        .as-help-list b{color:var(--as-accent,#c9a227)}
        .as-help-global{margin-top:14px;padding-top:10px;border-top:1px solid var(--as-border,#333);color:var(--as-muted,#999);font-size:13px}
        .as-help-list kbd,.as-help-global kbd{background:var(--as-bg,#0a0a0a);border:1px solid var(--as-border,#444);border-radius:4px;padding:1px 6px;font-size:12px}
        .as-help-foot{margin:12px 0 0;font-size:11px;color:var(--as-muted,#666)}
        #asHelpFab{
          position:fixed; top:14px; right:14px; z-index:9000;
          border-radius:10px; padding:8px 14px; cursor:pointer;
          background:var(--as-panel, var(--bg-panel, #121212));
          color:var(--as-accent, var(--accent-gold, #c9a227));
          border:1px solid var(--as-border, rgba(201,162,39,.45));
          font:600 12px/1.2 system-ui,sans-serif;
          box-shadow:0 4px 18px rgba(0,0,0,.4);
          letter-spacing:.02em;
        }
        #asHelpFab:hover{
          filter:brightness(1.12);
          border-color:var(--as-accent, #c9a227);
          box-shadow:0 0 0 1px var(--as-accent, #c9a227), 0 6px 20px rgba(0,0,0,.45);
        }
        body.as-main-menu #asHelpFab,
        html[data-main="1"] #asHelpFab { display:none !important; }
      `;
      document.head.appendChild(style);
    }
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
    document.getElementById('asHelpClose').onclick = () => el.remove();
  }

  function ensureFab() {
    if (document.getElementById('asHelpFab')) return;
    // Main menu already has "F1 Help & Tips" in the theme row — skip floating fab there
    if (pathKey() === '/' || document.getElementById('asMainF1Btn')) return;
    const fab = document.createElement('button');
    fab.id = 'asHelpFab';
    fab.type = 'button';
    fab.title = 'Help & tips (F1)';
    fab.textContent = 'F1 · Tips';
    fab.onclick = show;
    // Inline fallback styles (in case shared CSS is late)
    fab.style.cssText = [
      'position:fixed', 'top:14px', 'right:14px', 'z-index:9000',
      'border-radius:10px', 'padding:8px 14px', 'cursor:pointer',
      'background:var(--as-panel,#121212)', 'color:var(--as-accent,#c9a227)',
      'border:1px solid var(--as-border,rgba(201,162,39,.45))',
      'font:600 12px/1.2 system-ui,sans-serif',
      'box-shadow:0 4px 18px rgba(0,0,0,.4)', 'letter-spacing:.02em'
    ].join(';');
    document.body.appendChild(fab);
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

  function boot() {
    var path = pathKey();
    if (path === '/') {
      document.body.classList.add('as-main-menu');
      document.documentElement.setAttribute('data-main', '1');
    }
    ensureFab();
    // Main menu: also put a clear tip under themes if present
    if (pathKey() === '/') {
      const host = document.querySelector('.theme-row, .themes, #themePicker, .card-grid');
      if (host && !document.getElementById('asMainHelpHint')) {
        const hint = document.createElement('p');
        hint.id = 'asMainHelpHint';
        hint.style.cssText = 'text-align:center;color:var(--as-muted,#9a8b6a);font-size:13px;margin:10px 0';
        hint.innerHTML = '💡 Press <b style="color:var(--as-accent,#c9a227)">F1</b> or click <b>F1 Help</b> for tips & tricks · Themes apply to every suite';
        host.parentNode.insertBefore(hint, host.nextSibling);
      }
    }
  }

  window.__ASShowHelp = show;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
