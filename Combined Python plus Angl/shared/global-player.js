/**
 * Don's Adventurer — Global Background Audio Manager
 * Persists across page navigations via localStorage + single Audio element per page.
 * State keys under as_global_audio_*
 */
(function () {
  if (window.__ASGlobalAudio) return;

  const KEYS = {
    url: 'as_global_audio_url',
    title: 'as_global_audio_title',
    playing: 'as_global_audio_playing',
    time: 'as_global_audio_time',
    volume: 'as_global_audio_volume',
    loop: 'as_global_audio_loop',
  };

  const audio = new Audio();
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';

  function loadState() {
    return {
      url: localStorage.getItem(KEYS.url) || '',
      title: localStorage.getItem(KEYS.title) || 'No track',
      playing: localStorage.getItem(KEYS.playing) === '1',
      time: parseFloat(localStorage.getItem(KEYS.time) || '0') || 0,
      volume: parseFloat(localStorage.getItem(KEYS.volume) || '0.8') || 0.8,
      loop: localStorage.getItem(KEYS.loop) !== '0',
    };
  }

  function savePartial(obj) {
    Object.entries(obj).forEach(([k, v]) => {
      if (KEYS[k]) localStorage.setItem(KEYS[k], typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    });
    try { localStorage.setItem('as_global_audio_tick', String(Date.now())); } catch (_) {}
  }

  const api = {
    audio,
    getState: loadState,
    play(url, title) {
      if (url) {
        if (audio.src !== url && !audio.src.endsWith(url)) {
          audio.src = url;
          savePartial({ url, title: title || url.split('/').pop() });
        } else if (title) savePartial({ title });
      }
      audio.loop = loadState().loop;
      audio.volume = loadState().volume;
      const p = audio.play();
      savePartial({ playing: true });
      updateUI();
      return p;
    },
    pause() {
      audio.pause();
      savePartial({ playing: false, time: audio.currentTime || 0 });
      updateUI();
    },
    stop() {
      audio.pause();
      audio.currentTime = 0;
      savePartial({ playing: false, time: 0 });
      updateUI();
    },
    setVolume(v) {
      v = Math.max(0, Math.min(1, Number(v)));
      audio.volume = v;
      savePartial({ volume: v });
      updateUI();
    },
    setLoop(on) {
      audio.loop = !!on;
      savePartial({ loop: !!on });
    },
    setAsGlobalBgm(url, title) {
      return this.play(url, title);
    },
  };

  audio.addEventListener('timeupdate', () => {
    if (!audio.paused) savePartial({ time: audio.currentTime });
    const t = document.getElementById('asGapTime');
    if (t) t.textContent = fmt(audio.currentTime) + ' / ' + fmt(audio.duration || 0);
    const scrub = document.getElementById('asGapScrub');
    if (scrub && audio.duration) scrub.value = String((audio.currentTime / audio.duration) * 1000);
  });
  audio.addEventListener('ended', () => {
    if (!audio.loop) savePartial({ playing: false });
    updateUI();
  });

  function fmt(s) {
    if (!isFinite(s)) return '0:00';
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }


  function ensureUI() {
    if (document.getElementById('asGlobalAudioBar')) return;
    // Remove any stray duplicate players
    document.querySelectorAll('[data-as-audio-legacy]').forEach(function (el) { el.remove(); });
    const bar = document.createElement('div');
    bar.id = 'asGlobalAudioBar';
    bar.innerHTML = `
      <style id="asGlobalAudioBarStyle">
        #asGlobalAudioBar {
          position: fixed;
          left: 16px;
          right: 16px;
          bottom: 14px;
          z-index: 99999;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          border-radius: 14px;
          max-width: 920px;
          margin: 0 auto;
          background: color-mix(in srgb, var(--bg-panel, #0a0a0a) 92%, transparent);
          border: 1px solid var(--border-gold, var(--as-border, rgba(201,162,39,.35)));
          box-shadow: 0 10px 40px rgba(0,0,0,.55);
          font-family: system-ui, sans-serif;
          color: var(--text, var(--as-text, #e6dcc8));
          font-size: 13px;
          backdrop-filter: blur(10px);
        }
        #asGlobalAudioBar button {
          background: var(--bg-deep, #050505);
          border: 1px solid var(--border-gold, var(--as-border, rgba(201,162,39,.3)));
          color: var(--accent-gold, var(--as-accent, #c9a227));
          border-radius: 8px;
          padding: 5px 10px;
          cursor: pointer;
          line-height: 1;
        }
        #asGlobalAudioBar button:hover {
          background: var(--accent-red, var(--as-accent-2, #8b2942));
          color: #fff;
        }
        #asGlobalAudioBar .title {
          flex: 1;
          min-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--accent-gold, var(--as-accent, #c9a227));
          font-weight: 600;
        }
        #asGlobalAudioBar .extra { color: var(--text-muted, var(--as-muted, #9a8b6a)); font-size: 12px; }
        #asGlobalAudioBar input[type=range] {
          accent-color: var(--accent-gold, var(--as-accent, #c9a227));
          width: 90px;
        }
        #asGlobalAudioBar input#asGapScrub { flex: 1; min-width: 80px; max-width: 220px; }
        #asGlobalAudioBar a {
          color: var(--accent-gold, var(--as-accent, #c9a227)) !important;
          text-decoration: none;
          font-size: 12px;
          border: 1px solid var(--border-gold, var(--as-border, rgba(201,162,39,.3)));
          border-radius: 8px;
          padding: 4px 8px;
        }
        #asGlobalAudioBar.collapsed {
          width: auto;
          right: auto;
          max-width: none;
        }
        #asGlobalAudioBar.collapsed .extra,
        #asGlobalAudioBar.collapsed #asGapScrub,
        #asGlobalAudioBar.collapsed #asGapVol,
        #asGlobalAudioBar.collapsed #asGapOpenMusic { display: none; }
      </style>
      <button type="button" id="asGapPlay" title="Play/Pause">▶</button>
      <button type="button" id="asGapStop" title="Stop">⏹</button>
      <span class="title" id="asGapTitle">No track</span>
      <span id="asGapTime" class="extra">0:00 / 0:00</span>
      <input type="range" id="asGapScrub" class="extra" min="0" max="1000" value="0" title="Seek" />
      <input type="range" id="asGapVol" min="0" max="1" step="0.01" value="0.8" title="Volume" />
      <button type="button" id="asGapMute" title="Mute">🔇</button>
      <a href="/music" id="asGapOpenMusic" title="Open Music Workspace">Music</a>
      <button type="button" id="asGapHide" title="Minimize">▾</button>
    `;
    document.body.appendChild(bar);

    $('asGapPlay').onclick = () => {
      if (audio.paused) {
        if (!audio.src && loadState().url) audio.src = loadState().url;
        api.play();
      } else api.pause();
    };
    $('asGapStop').onclick = () => api.stop();
    $('asGapVol').oninput = (e) => api.setVolume(e.target.value);
    $('asGapScrub').oninput = (e) => {
      if (!audio.duration) return;
      audio.currentTime = (parseFloat(e.target.value) / 1000) * audio.duration;
      savePartial({ time: audio.currentTime });
    };
    $('asGapHide').onclick = () => bar.classList.toggle('collapsed');
    let _preMute = 0.8;
    $('asGapMute').onclick = () => {
      if (audio.volume > 0.01) { _preMute = audio.volume; api.setVolume(0); $('asGapMute').textContent = '🔊'; }
      else { api.setVolume(_preMute || 0.8); $('asGapMute').textContent = '🔇'; }
    };
  }

  function $(id) { return document.getElementById(id); }

  function updateUI() {
    ensureUI();
    const st = loadState();
    const title = $('asGapTitle');
    if (title) title.textContent = st.title || 'No track';
    const play = $('asGapPlay');
    if (play) play.textContent = audio.paused ? '▶' : '⏸';
    const vol = $('asGapVol');
    if (vol) vol.value = String(audio.volume);
  }

  function resumeIfNeeded() {
    const st = loadState();
    audio.volume = st.volume;
    audio.loop = st.loop;
    if (st.url) {
      if (!audio.src) audio.src = st.url;
      if (st.time > 0) {
        audio.addEventListener('loadedmetadata', function once() {
          audio.removeEventListener('loadedmetadata', once);
          try { audio.currentTime = st.time; } catch (_) {}
        });
      }
      if (st.playing) {
        audio.play().catch(() => {
          // Autoplay blocked — show bar so user can press play
          savePartial({ playing: false });
        });
      }
    }
    updateUI();
  }

  // Cross-page sync
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith('as_global_audio')) return;
    const st = loadState();
    if (st.url && audio.src !== st.url && !audio.src.endsWith(st.url)) {
      audio.src = st.url;
    }
    audio.volume = st.volume;
    audio.loop = st.loop;
    if (st.playing && audio.paused) audio.play().catch(() => {});
    if (!st.playing && !audio.paused) audio.pause();
    updateUI();
  });

  window.addEventListener('as-theme-change', function () {
      // CSS variables already update; force repaint
      var bar = document.getElementById('asGlobalAudioBar');
      if (bar) { bar.style.display = 'none'; bar.offsetHeight; bar.style.display = ''; }
    });
  window.__ASGlobalAudio = api;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { ensureUI(); resumeIfNeeded(); });
  } else {
    ensureUI();
    resumeIfNeeded();
  }
})();
