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
    const bar = document.createElement('div');
    bar.id = 'asGlobalAudioBar';
    bar.innerHTML = `
      <style>
        #asGlobalAudioBar{position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;
          display:flex;gap:10px;align-items:center;flex-wrap:wrap;
          background:linear-gradient(135deg,#0c0c0c,#1a0a0c);border:1px solid rgba(201,162,39,.4);
          border-radius:12px;padding:8px 12px;box-shadow:0 8px 32px rgba(0,0,0,.6);
          font-family:system-ui,sans-serif;color:#e6dcc8;font-size:13px}
        #asGlobalAudioBar button{background:#0a0a0a;border:1px solid rgba(201,162,39,.35);
          color:#c9a227;border-radius:8px;padding:4px 10px;cursor:pointer}
        #asGlobalAudioBar button:hover{background:rgba(139,41,66,.35)}
        #asGlobalAudioBar .title{flex:1;min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c9a227}
        #asGlobalAudioBar input[type=range]{width:100px}
        #asGlobalAudioBar.collapsed .extra{display:none}
      </style>
      <button type="button" id="asGapPlay" title="Play/Pause">▶</button>
      <button type="button" id="asGapStop" title="Stop">⏹</button>
      <span class="title" id="asGapTitle">No track</span>
      <span id="asGapTime" class="extra">0:00 / 0:00</span>
      <input type="range" id="asGapScrub" class="extra" min="0" max="1000" value="0" title="Seek" />
      <input type="range" id="asGapVol" min="0" max="1" step="0.01" value="0.8" title="Volume" />
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

  window.__ASGlobalAudio = api;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { ensureUI(); resumeIfNeeded(); });
  } else {
    ensureUI();
    resumeIfNeeded();
  }
})();
