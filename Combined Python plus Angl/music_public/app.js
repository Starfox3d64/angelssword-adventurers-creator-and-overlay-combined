(function () {
  const $ = (id) => document.getElementById(id);
  let currentTrack = null; // { url, title, id }
  let audioBuffer = null;
  let audioCtx = null;

  // Tabs
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-body').forEach((b) => b.classList.remove('active'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab)?.classList.add('active');
    };
  });

  // Gen mode UI
  document.querySelectorAll('input[name=genMode]').forEach((r) => {
    r.onchange = () => {
      const mode = document.querySelector('input[name=genMode]:checked')?.value;
      $('simpleFields').classList.toggle('hidden', mode === 'custom');
      $('customFields').classList.toggle('hidden', mode !== 'custom');
      if (mode === 'bgm') {
        $('genInstrumental').checked = true;
        $('genBgmPreset').checked = true;
        if (!$('genPrompt').value) $('genPrompt').value = 'Seamless looping instrumental background music, no vocals, steady energy';
      }
    };
  });

  // Suno settings
  $('sunoBase').value = localStorage.getItem('suno_api_base') || '';
  $('sunoKey').value = localStorage.getItem('suno_api_key') || '';
  $('btnToggleKey').onclick = () => {
    const i = $('sunoKey');
    i.type = i.type === 'password' ? 'text' : 'password';
    $('btnToggleKey').textContent = i.type === 'password' ? 'Show' : 'Hide';
  };
  $('btnSaveSuno').onclick = () => {
    localStorage.setItem('suno_api_base', $('sunoBase').value.trim());
    localStorage.setItem('suno_api_key', $('sunoKey').value.trim());
    $('sunoStatus').textContent = 'Saved locally.';
    $('sunoStatus').style.color = '#6bcb77';
  };

  async function sunoFetch(path, opts = {}) {
    const key = localStorage.getItem('suno_api_key') || '';
    const base = localStorage.getItem('suno_api_base') || '';
    const res = await fetch('/api/suno' + path, {
      method: opts.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Suno-Key': key,
        'X-Suno-Base': base,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));
    return data;
  }

  $('btnGenerate').onclick = async () => {
    const mode = document.querySelector('input[name=genMode]:checked')?.value || 'simple';
    const instrumental = $('genInstrumental').checked || mode === 'bgm';
    let prompt = $('genPrompt').value.trim();
    if (mode === 'bgm' || $('genBgmPreset').checked) {
      prompt = (prompt || 'Instrumental background music') + '. Seamless loop, no vocals, consistent energy, suitable for streaming BGM.';
    }
    const status = $('genStatus');
    const fill = $('genFill');
    const prog = $('genProgress');
    prog.classList.remove('hidden');
    fill.style.width = '15%';
    status.textContent = 'Submitting to Suno…';
    status.style.color = '#c9a227';
    try {
      let data;
      if (mode === 'custom') {
        data = await sunoFetch('/custom_generate', {
          body: {
            prompt: $('genLyrics').value.trim() || prompt,
            tags: $('genStyle').value.trim() || 'instrumental',
            title: $('genTitle').value.trim() || 'Don Track',
            make_instrumental: instrumental,
            wait_audio: false,
          },
        });
      } else {
        data = await sunoFetch('/generate', {
          body: {
            prompt,
            make_instrumental: instrumental,
            wait_audio: false,
          },
        });
      }
      fill.style.width = '40%';
      // Normalize ids
      let ids = [];
      if (Array.isArray(data)) ids = data.map((x) => x.id).filter(Boolean);
      else if (data.id) ids = [data.id];
      else if (data.clips) ids = data.clips.map((c) => c.id).filter(Boolean);
      else if (data.data) {
        const d = data.data;
        if (Array.isArray(d)) ids = d.map((x) => x.id).filter(Boolean);
      }
      if (!ids.length && data.audio_url) {
        await addRemoteTrack(data.audio_url, data.title || 'Suno track');
        fill.style.width = '100%';
        status.textContent = 'Done.';
        return;
      }
      if (!ids.length) throw new Error('No job ids in response. Check API base URL / key.');
      status.textContent = 'Generating… polling ' + ids.join(', ');
      const clips = await pollSuno(ids, (p) => { fill.style.width = (40 + p * 55) + '%'; });
      fill.style.width = '100%';
      status.textContent = 'Complete — ' + clips.length + ' track(s)';
      status.style.color = '#6bcb77';
      renderResults(clips);
      await refreshLibrary();
    } catch (e) {
      status.textContent = e.message || String(e);
      status.style.color = '#e94560';
      fill.style.width = '0%';
    }
  };

  async function pollSuno(ids, onProg) {
    const max = 90;
    for (let i = 0; i < max; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const data = await sunoFetch('/feed?ids=' + encodeURIComponent(ids.join(',')), { method: 'GET' });
      let list = Array.isArray(data) ? data : data.data || data.clips || [];
      if (!Array.isArray(list)) list = [];
      const ready = list.filter((c) => c.audio_url || c.audioUrl || c.status === 'complete' || c.status === 'streaming');
      onProg && onProg(Math.min(1, (i + 1) / 40));
      if (ready.length >= ids.length || list.every((c) => ['complete', 'error', 'failed'].includes(c.status))) {
        return list;
      }
    }
    throw new Error('Timed out waiting for Suno');
  }

  function renderResults(clips) {
    const host = $('genResults');
    host.innerHTML = '';
    clips.forEach((c, i) => {
      const url = c.audio_url || c.audioUrl;
      if (!url) return;
      const title = c.title || ('Suno ' + (i + 1));
      const div = document.createElement('div');
      div.className = 'result-card';
      div.innerHTML = '<div style="flex:1"><strong>' + escapeHtml(title) + '</strong></div>';
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = url;
      div.appendChild(audio);
      const bgm = document.createElement('button');
      bgm.className = 'btn primary';
      bgm.textContent = '🌐 Global BGM';
      bgm.onclick = () => setGlobal(url, title);
      div.appendChild(bgm);
      const save = document.createElement('button');
      save.className = 'btn';
      save.textContent = 'Save to library';
      save.onclick = () => addRemoteTrack(url, title);
      div.appendChild(save);
      host.appendChild(div);
    });
  }

  async function addRemoteTrack(url, title) {
    try {
      const res = await fetch('/api/music/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      await refreshLibrary();
      selectTrack(data);
    } catch (e) {
      alert(e.message);
    }
  }

  function setGlobal(url, title) {
    if (window.__ASGlobalAudio) {
      window.__ASGlobalAudio.setAsGlobalBgm(url, title);
      $('genStatus').textContent = 'Playing globally: ' + title;
      $('genStatus').style.color = '#6bcb77';
    } else {
      alert('Global player not loaded');
    }
  }

  // Library
  async function refreshLibrary() {
    const host = $('libraryList');
    try {
      const data = await (await fetch('/api/music/library')).json();
      const list = data.tracks || [];
      if (!list.length) {
        host.innerHTML = '<div class="dim small">No tracks yet. Generate or upload.</div>';
        return;
      }
      host.innerHTML = list.map((t) =>
        '<div class="lib-item" data-id="' + t.id + '" data-url="' + t.url + '" data-title="' + escapeHtml(t.title) + '">' +
        escapeHtml(t.title) + '</div>'
      ).join('');
      host.querySelectorAll('.lib-item').forEach((el) => {
        el.onclick = () => selectTrack({ id: el.dataset.id, url: el.dataset.url, title: el.dataset.title });
      });
    } catch {
      host.innerHTML = '<div class="dim">Library unavailable</div>';
    }
  }

  function selectTrack(t) {
    currentTrack = t;
    window.__ASMusicCurrentTrack = t;
    document.querySelectorAll('.lib-item').forEach((el) => el.classList.toggle('active', el.dataset.id === t.id));
    $('playerTitle').textContent = t.title;
    $('localPlayer').src = t.url;
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.tab-body').forEach((x) => x.classList.remove('active'));
    document.querySelector('.tab[data-tab=player]')?.classList.add('active');
    $('tab-player')?.classList.add('active');
    loadWaveform(t.url);
  }

  $('btnSetGlobal').onclick = () => {
    if (!currentTrack) return alert('Select a track');
    setGlobal(currentTrack.url, currentTrack.title);
  };
  let loopOn = true;
  $('btnLoop').onclick = () => {
    loopOn = !loopOn;
    $('localPlayer').loop = loopOn;
    if (window.__ASGlobalAudio) window.__ASGlobalAudio.setLoop(loopOn);
    $('btnLoop').textContent = 'Loop: ' + (loopOn ? 'On' : 'Off');
  };
  $('btnDownloadTrack').onclick = () => {
    if (!currentTrack) return;
    const a = document.createElement('a');
    a.href = currentTrack.url;
    a.download = (currentTrack.title || 'track') + '.mp3';
    a.click();
  };

  // Upload
  const dz = $('audioDrop'), fi = $('audioFile');
  dz.onclick = () => fi.click();
  fi.onchange = () => uploadFiles(fi.files);
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => uploadFiles(e.dataTransfer?.files));

  async function uploadFiles(fileList) {
    if (!fileList?.length) return;
    for (const file of fileList) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/music/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Upload failed');
    }
    await refreshLibrary();
  }

  // Waveform + trim
  async function loadWaveform(url) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      audioBuffer = await audioCtx.decodeAudioData(ab.slice(0));
      $('trimEnd').value = audioBuffer.duration.toFixed(2);
      $('trimStart').value = '0';
      drawWave();
    } catch (e) {
      $('trimStatus').textContent = 'Waveform unavailable: ' + e.message;
    }
  }

  function drawWave() {
    const canvas = $('waveCanvas');
    if (!audioBuffer || !canvas) return;
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = 80 * devicePixelRatio;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#070707';
    ctx.fillRect(0, 0, w, h);
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / w);
    ctx.strokeStyle = '#c9a227';
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      let min = 1, max = -1;
      for (let i = 0; i < step; i++) {
        const v = data[x * step + i] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const y1 = ((1 + min) / 2) * h;
      const y2 = ((1 + max) / 2) * h;
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();
    // markers
    const dur = audioBuffer.duration;
    const s = parseFloat($('trimStart').value) || 0;
    const e = parseFloat($('trimEnd').value) || dur;
    ctx.fillStyle = 'rgba(139,41,66,0.35)';
    ctx.fillRect(0, 0, (s / dur) * w, h);
    ctx.fillRect((e / dur) * w, 0, w, h);
  }
  ['trimStart', 'trimEnd'].forEach((id) => $(id).addEventListener('change', drawWave));

  $('btnPreviewTrim').onclick = () => {
    if (!currentTrack) return;
    const a = $('localPlayer');
    a.currentTime = parseFloat($('trimStart').value) || 0;
    a.play();
    const end = parseFloat($('trimEnd').value) || 0;
    const check = () => {
      if (a.currentTime >= end) { a.pause(); return; }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  };

  $('btnExportTrim').onclick = async () => {
    if (!audioBuffer) return alert('Load a track first');
    const start = Math.max(0, parseFloat($('trimStart').value) || 0);
    const end = Math.min(audioBuffer.duration, parseFloat($('trimEnd').value) || audioBuffer.duration);
    const fadeIn = parseFloat($('fadeIn').value) || 0;
    const fadeOut = parseFloat($('fadeOut').value) || 0;
    const sr = audioBuffer.sampleRate;
    const s0 = Math.floor(start * sr);
    const s1 = Math.floor(end * sr);
    const len = Math.max(1, s1 - s0);
    const out = audioCtx.createBuffer(audioBuffer.numberOfChannels, len, sr);
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const src = audioBuffer.getChannelData(ch);
      const dst = out.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        let g = 1;
        const t = i / sr;
        if (fadeIn > 0 && t < fadeIn) g = t / fadeIn;
        if (fadeOut > 0 && t > (len / sr) - fadeOut) g = Math.max(0, ((len / sr) - t) / fadeOut);
        dst[i] = (src[s0 + i] || 0) * g;
      }
    }
    const wav = bufferToWav(out);
    const blob = new Blob([wav], { type: 'audio/wav' });
    // Upload to library
    const fd = new FormData();
    fd.append('file', blob, (currentTrack?.title || 'clip') + '-trim.wav');
    const res = await fetch('/api/music/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (res.ok) {
      $('trimStatus').textContent = 'Exported and saved to library.';
      $('trimStatus').style.color = '#6bcb77';
      await refreshLibrary();
      // Also download
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (currentTrack?.title || 'clip') + '-trim.wav';
      a.click();
    } else {
      $('trimStatus').textContent = data.error || 'Export failed';
      $('trimStatus').style.color = '#e94560';
    }
  };

  function bufferToWav(buffer) {
    const numCh = buffer.numberOfChannels;
    const sr = buffer.sampleRate;
    const len = buffer.length;
    const bytes = len * numCh * 2;
    const ab = new ArrayBuffer(44 + bytes);
    const view = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); view.setUint32(4, 36 + bytes, true); w(8, 'WAVE'); w(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numCh, true);
    view.setUint32(24, sr, true); view.setUint32(28, sr * numCh * 2, true);
    view.setUint16(32, numCh * 2, true); view.setUint16(34, 16, true); w(36, 'data');
    view.setUint32(40, bytes, true);
    let off = 44;
    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < numCh; ch++) {
        let s = buffer.getChannelData(ch)[i];
        s = Math.max(-1, Math.min(1, s));
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
      }
    }
    return ab;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  refreshLibrary();
})();

/* ── Music sweep v2.2: bugfixes + QoL ─────────────────────────────── */
(function () {
  const $ = (id) => document.getElementById(id);

  function toast(msg, ok) {
    let el = $('musicToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'musicToast';
      el.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:99998;padding:10px 16px;border-radius:10px;background:#0c0c0c;border:1px solid rgba(201,162,39,.45);color:#e6dcc8;font-size:.85rem;max-width:90%;box-shadow:0 8px 24px rgba(0,0,0,.5)';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.borderColor = ok === false ? '#e94560' : 'rgba(201,162,39,.45)';
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = 'none'; }, 3000);
  }

  // Delete track from library
  async function deleteTrack(id, name) {
    if (!confirm('Delete "' + (name || id) + '" from library?')) return;
    try {
      const res = await fetch('/api/music/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast('Deleted', true);
      // refresh if function exists
      if (typeof refreshLibrary === 'function') await refreshLibrary();
      else location.reload();
    } catch (e) {
      toast(e.message, false);
    }
  }

  // Enhance library items with delete + play global buttons after each refresh
  const _origRefresh = window.refreshLibrary;
  // Patch list rendering via MutationObserver on libraryList
  const host = $('libraryList');
  if (host) {
    const obs = new MutationObserver(() => {
      host.querySelectorAll('.lib-item').forEach((el) => {
        if (el.dataset.enhanced) return;
        el.dataset.enhanced = '1';
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:4px;margin-top:4px';
        const playG = document.createElement('button');
        playG.className = 'btn sm';
        playG.textContent = '🌐 BGM';
        playG.onclick = (e) => {
          e.stopPropagation();
          if (window.__ASGlobalAudio) {
            window.__ASGlobalAudio.setAsGlobalBgm(el.dataset.url, el.dataset.title);
            toast('Global BGM: ' + el.dataset.title, true);
          }
        };
        const del = document.createElement('button');
        del.className = 'btn sm';
        del.textContent = '🗑';
        del.onclick = (e) => {
          e.stopPropagation();
          deleteTrack(el.dataset.id, el.dataset.title);
        };
        actions.appendChild(playG);
        actions.appendChild(del);
        el.appendChild(actions);
      });
    });
    obs.observe(host, { childList: true });
  }

  // Cancel generation flag
  let genAbort = false;
  function ensureCancelBtn() {
    const btn = $('btnGenerate');
    if (!btn || $('btnCancelGen')) return;
    const cancel = document.createElement('button');
    cancel.id = 'btnCancelGen';
    cancel.className = 'btn';
    cancel.textContent = 'Cancel';
    cancel.style.marginLeft = '8px';
    cancel.onclick = () => { genAbort = true; toast('Cancel requested', true); };
    btn.parentElement?.appendChild(cancel);
  }

  // Volume preset buttons for local player
  function ensureVolPresets() {
    const tab = $('tab-player');
    if (!tab || $('volPresets')) return;
    const row = document.createElement('div');
    row.id = 'volPresets';
    row.className = 'row';
    row.innerHTML = '<span class="dim small">Quick volume:</span>';
    [0.25, 0.5, 0.75, 1].forEach((v) => {
      const b = document.createElement('button');
      b.className = 'btn sm';
      b.textContent = Math.round(v * 100) + '%';
      b.onclick = () => {
        const a = $('localPlayer');
        if (a) a.volume = v;
        if (window.__ASGlobalAudio) window.__ASGlobalAudio.setVolume(v);
      };
      row.appendChild(b);
    });
    tab.querySelector('.card')?.appendChild(row);
  }

  // Shuffle / random BGM from library
  function ensureShuffle() {
    const pad = document.querySelector('.panel .pad:last-of-type') || $('libraryList')?.parentElement;
    if (!pad || $('btnShuffleBgm')) return;
    const b = document.createElement('button');
    b.id = 'btnShuffleBgm';
    b.className = 'btn block';
    b.style.marginTop = '8px';
    b.textContent = '🎲 Random Global BGM';
    b.onclick = async () => {
      try {
        const data = await (await fetch('/api/music/library')).json();
        const list = data.tracks || [];
        if (!list.length) return toast('Library empty', false);
        const t = list[Math.floor(Math.random() * list.length)];
        if (window.__ASGlobalAudio) {
          window.__ASGlobalAudio.setAsGlobalBgm(t.url, t.title);
          toast('Now playing: ' + t.title, true);
        }
      } catch (e) { toast(e.message, false); }
    };
    pad.appendChild(b);
  }

  // Validate Suno settings before generate
  const genBtn = $('btnGenerate');
  if (genBtn) {
    const prev = genBtn.onclick;
    genBtn.addEventListener('click', (e) => {
      const key = localStorage.getItem('suno_api_key') || $('sunoKey')?.value;
      const base = localStorage.getItem('suno_api_base') || $('sunoBase')?.value;
      if (!key || !base) {
        toast('Set Suno API Base URL and Key first', false);
      }
    }, true);
  }

  // Remember last prompt
  const promptEl = $('genPrompt');
  if (promptEl) {
    promptEl.value = localStorage.getItem('suno_last_prompt') || promptEl.value;
    promptEl.addEventListener('change', () => localStorage.setItem('suno_last_prompt', promptEl.value));
  }

  window.addEventListener('DOMContentLoaded', () => {
    ensureCancelBtn();
    ensureVolPresets();
    ensureShuffle();
  });
  if (document.readyState !== 'loading') {
    ensureCancelBtn();
    ensureVolPresets();
    ensureShuffle();
  }

  // Expose delete for enhanced items after refreshLibrary runs
  window.__musicDeleteTrack = deleteTrack;
})();


/* Playback rate (speed up / slow down) */
(function () {
  const KEY = 'as_music_playback_rate';
  function $(id) { return document.getElementById(id); }
  function applyRate(r) {
    r = Math.max(0.5, Math.min(2, Number(r) || 1));
    try { localStorage.setItem(KEY, String(r)); } catch (_) {}
    const audio = $('localPlayer');
    if (audio) audio.playbackRate = r;
    if (window.__ASGlobalAudio && window.__ASGlobalAudio.audio) {
      window.__ASGlobalAudio.audio.playbackRate = r;
    }
    if (window.__ASGlobalAudio && typeof window.__ASGlobalAudio.setRate === 'function') {
      window.__ASGlobalAudio.setRate(r);
    }
    const slider = $('playbackRate');
    const lab = $('playbackRateVal');
    if (slider) slider.value = String(r);
    if (lab) lab.textContent = r.toFixed(2) + '×';
  }
  function boot() {
    let r = parseFloat(localStorage.getItem(KEY) || '1') || 1;
    applyRate(r);
    const slider = $('playbackRate');
    if (slider) slider.addEventListener('input', () => applyRate(slider.value));
    if ($('rateSlower')) $('rateSlower').onclick = () => applyRate((parseFloat(slider && slider.value) || 1) - 0.1);
    if ($('rateFaster')) $('rateFaster').onclick = () => applyRate((parseFloat(slider && slider.value) || 1) + 0.1);
    if ($('rateReset')) $('rateReset').onclick = () => applyRate(1);
    // When a track loads into local player, re-apply rate
    const audio = $('localPlayer');
    if (audio) {
      audio.addEventListener('loadedmetadata', () => applyRate(localStorage.getItem(KEY) || 1));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


/* Export track permanently at current playback speed */
(function () {
  function $(id) { return document.getElementById(id); }
  function currentRate() {
    const s = $('playbackRate');
    return Math.max(0.5, Math.min(2, parseFloat(s && s.value) || parseFloat(localStorage.getItem('as_music_playback_rate') || '1') || 1));
  }
  async function exportAtSpeed() {
    const status = $('exportSpeedStatus');
    const rate = currentRate();
    if (Math.abs(rate - 1) < 0.001) {
      alert('Set speed above or below 1.00× first, then export.');
      return;
    }
    const track = window.__ASMusicCurrentTrack || null;
    const player = $('localPlayer');
    const src = (track && track.url) || (player && player.src) || '';
    if (!src) {
      alert('Load a track in the player first.');
      return;
    }
    if (status) status.textContent = 'Exporting at ' + rate.toFixed(2) + '×…';
    const title = (track && (track.title || track.name)) || 'track';

    try {
      // Prefer server ffmpeg atempo (best quality, real duration change)
      let res;
      if (src.startsWith('blob:')) {
        // Fetch blob and send as multipart
        const blob = await fetch(src).then((r) => r.blob());
        const fd = new FormData();
        fd.append('file', blob, title + '.mp3');
        fd.append('rate', String(rate));
        res = await fetch('/api/music/export-speed', { method: 'POST', body: fd });
      } else {
        // Path relative to music public
        let path = src;
        try {
          const u = new URL(src, location.origin);
          path = u.pathname;
        } catch (_) {}
        res = await fetch('/api/music/export-speed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: path, rate: rate, title: title })
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Export failed');
      }
      const out = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(out);
      a.download = title.replace(/[^\w\-]+/g, '_') + '_' + rate.toFixed(2) + 'x.mp3';
      a.click();
      if (status) status.textContent = 'Downloaded ' + a.download;
      // Optionally add to library
      try {
        const fd2 = new FormData();
        fd2.append('file', out, a.download);
        await fetch('/api/music/upload', { method: 'POST', body: fd2 });
        if (typeof window.refreshMusicLibrary === 'function') window.refreshMusicLibrary();
      } catch (_) {}
    } catch (e) {
      console.warn('Server speed export failed, trying offline fallback', e);
      // Offline fallback: OfflineAudioContext time-stretch approximation via playback rate render
      try {
        const abuf = await (async () => {
          const arr = await fetch(src).then((r) => r.arrayBuffer());
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const decoded = await ctx.decodeAudioData(arr.slice(0));
          ctx.close();
          return decoded;
        })();
        const newLen = Math.ceil(abuf.length / rate);
        const offline = new OfflineAudioContext(abuf.numberOfChannels, newLen, abuf.sampleRate);
        const srcNode = offline.createBufferSource();
        srcNode.buffer = abuf;
        srcNode.playbackRate.value = rate;
        srcNode.connect(offline.destination);
        srcNode.start(0);
        const rendered = await offline.startRendering();
        // Encode WAV
        const ch = rendered.numberOfChannels;
        const len = rendered.length;
        const wav = new ArrayBuffer(44 + len * ch * 2);
        const view = new DataView(wav);
        const wstr = (o, str) => { for (let i = 0; i < str.length; i++) view.setUint8(o + i, str.charCodeAt(i)); };
        wstr(0, 'RIFF'); view.setUint32(4, 36 + len * ch * 2, true); wstr(8, 'WAVE'); wstr(12, 'fmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, ch, true);
        view.setUint32(24, rendered.sampleRate, true); view.setUint32(28, rendered.sampleRate * ch * 2, true);
        view.setUint16(32, ch * 2, true); view.setUint16(34, 16, true); wstr(36, 'data');
        view.setUint32(40, len * ch * 2, true);
        let off = 44;
        for (let i = 0; i < len; i++) {
          for (let c = 0; c < ch; c++) {
            let s = Math.max(-1, Math.min(1, rendered.getChannelData(c)[i]));
            view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
            off += 2;
          }
        }
        const blob = new Blob([wav], { type: 'audio/wav' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = title.replace(/[^\w\-]+/g, '_') + '_' + rate.toFixed(2) + 'x.wav';
        a.click();
        if (status) status.textContent = 'Downloaded (browser fallback) ' + a.download;
      } catch (e2) {
        if (status) status.textContent = 'Export failed: ' + (e.message || e2.message);
        alert('Could not export: ' + (e.message || e2.message));
      }
    }
  }
  function boot() {
    const btn = $('btnExportSpeed');
    if (btn) btn.onclick = exportAtSpeed;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


/* Favorites + fade-out stop */
(function () {
  const FAV_KEY = 'as_music_favorites';
  function $(id) { return document.getElementById(id); }
  function loadFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (_) { return []; }
  }
  function saveFavs(a) { localStorage.setItem(FAV_KEY, JSON.stringify(a)); }
  function toggleFav(id) {
    let a = loadFavs();
    if (a.includes(id)) a = a.filter((x) => x !== id);
    else a.push(id);
    saveFavs(a);
    return a.includes(id);
  }
  window.__ASMusicIsFav = (id) => loadFavs().includes(id);
  window.__ASMusicToggleFav = toggleFav;

  // Enhance library render: star button via event delegation
  document.addEventListener('click', (e) => {
    const star = e.target.closest('[data-fav-id]');
    if (!star) return;
    e.preventDefault();
    e.stopPropagation();
    const id = star.getAttribute('data-fav-id');
    const on = toggleFav(id);
    star.textContent = on ? '★' : '☆';
    star.title = on ? 'Unfavorite' : 'Favorite';
  });

  // Patch library items after refresh — observe
  const host = $('libraryList');
  if (host) {
    const obs = new MutationObserver(() => {
      host.querySelectorAll('.lib-item').forEach((el) => {
        if (el.querySelector('[data-fav-id]')) return;
        const id = el.dataset.id || el.dataset.url || '';
        if (!id) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn sm';
        btn.style.marginLeft = '6px';
        btn.setAttribute('data-fav-id', id);
        const on = loadFavs().includes(id);
        btn.textContent = on ? '★' : '☆';
        btn.title = on ? 'Unfavorite' : 'Favorite';
        el.appendChild(btn);
      });
      // Sort favorites to top optionally — leave order, just mark
    });
    obs.observe(host, { childList: true, subtree: true });
  }

  // Fade stop
  function fadeStop(audio, ms) {
    if (!audio) return;
    const start = audio.volume;
    const t0 = performance.now();
    function step(t) {
      const p = Math.min(1, (t - t0) / ms);
      audio.volume = start * (1 - p);
      if (p < 1) requestAnimationFrame(step);
      else { audio.pause(); audio.volume = start; }
    }
    requestAnimationFrame(step);
  }
  function boot() {
    const btn = $('btnFadeStop');
    if (btn) btn.onclick = () => {
      const local = $('localPlayer');
      if (local && !local.paused) fadeStop(local, 1200);
      if (window.__ASGlobalAudio && window.__ASGlobalAudio.audio) {
        fadeStop(window.__ASGlobalAudio.audio, 1200);
      }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
