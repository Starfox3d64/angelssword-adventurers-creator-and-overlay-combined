(function () {
  const $ = (id) => document.getElementById(id);
  let jobId = null;
  let pollTimer = null;
  let lastUrl = null;

  const PRESETS = {
    idle: {
      en: 'A single anime character standing in a neutral idle pose, subtle breathing and blinking, seamless loop, locked-off static camera, full body visible, solid chroma key green background',
      ja: 'アニメキャラクターがその場で待機している。微かな呼吸とまばたき。シームレスループ。固定カメラ。全身。単色のグリーンスクリーン背景。',
    },
    wave: {
      en: 'Anime character waving hello with one hand, friendly expression, seamless loop, static camera, full body, solid magenta background',
      ja: 'アニメキャラクターが片手で手を振って挨拶する。明るい表情。シームレスループ。固定カメラ。全身。マゼンタ背景。',
    },
    talk: {
      en: 'Anime character talking with subtle mouth movement and soft gestures, idle stance, seamless loop, static camera, solid green background',
      ja: 'アニメキャラクターが会話している。口の動きと軽いジェスチャー。待機姿勢。シームレスループ。固定カメラ。緑背景。',
    },
    walk: {
      en: 'Anime character walking in place, loopable walk cycle, side view, consistent pace, solid background',
      ja: 'アニメキャラクターがその場で歩く。ループ可能な歩行サイクル。横から。一定のペース。単色背景。',
    },
  };

  function tick() {
    const el = $('stClock');
    if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function refreshStatus() {
    try {
      const data = await (await fetch('/api/animegen/status')).json();
      $('stBackend').textContent = 'Backend: ' + (data.diffusers_available ? 'Diffusers OK' : 'Diffusers optional');
      $('stCuda').textContent = 'CUDA: ' + (data.cuda ? 'yes' : 'no');
      $('stModels').textContent = 'Weights: ' + (data.weights_ready ? 'found' : 'missing high/low noise');
      if (data.comfyui) {
        $('backendStatus').textContent = data.comfyui.available ? 'ComfyUI online' : 'ComfyUI offline';
        $('backendStatus').style.color = data.comfyui.available ? '#6bcb77' : '#9a8b6a';
      }
    } catch {
      $('stBackend').textContent = 'Backend: ?';
    }
  }

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.onclick = () => {
      const p = PRESETS[btn.dataset.preset];
      if (!p) return;
      $('prompt').value = p.en;
      $('promptJa').value = p.ja;
    };
  });

  $('btnCheck').onclick = async () => {
    localStorage.setItem('animegen_backend', $('backend').value);
    localStorage.setItem('animegen_comfy', $('comfyUrl').value.trim());
    await refreshStatus();
    try {
      const url = $('comfyUrl').value.trim() || 'http://127.0.0.1:8188';
      const r = await fetch('/api/comfy/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const d = await r.json();
      $('backendStatus').textContent = d.ok || d.connected ? 'ComfyUI connected' : (d.error || 'ComfyUI not reachable');
      $('backendStatus').style.color = d.ok || d.connected ? '#6bcb77' : '#e94560';
    } catch (e) {
      $('backendStatus').textContent = e.message;
      $('backendStatus').style.color = '#e94560';
    }
  };

  $('backend').value = localStorage.getItem('animegen_backend') || 'comfyui';
  $('comfyUrl').value = localStorage.getItem('animegen_comfy') || 'http://127.0.0.1:8188';

  function buildPrompt() {
    const ja = $('promptJa').value.trim();
    const en = $('prompt').value.trim();
    let prompt = ja || en;
    if (!ja && $('prefixAnime').checked && en) prompt = 'Japanese anime style, ' + en;
    return prompt;
  }

  $('btnGenerate').onclick = async () => {
    const prompt = buildPrompt();
    if (!prompt) {
      $('genStatus').textContent = 'Enter a prompt';
      $('genStatus').style.color = '#e94560';
      return;
    }
    const body = {
      backend: $('backend').value,
      comfy_url: $('comfyUrl').value.trim(),
      prompt,
      negative_prompt: $('negative').value.trim(),
      width: parseInt($('width').value, 10) || 832,
      height: parseInt($('height').value, 10) || 480,
      seconds: parseInt($('secs').value, 10) || 5,
      seed: parseInt($('seed').value, 10) || 42,
      steps: parseInt($('steps').value, 10) || 8,
      guidance_scale: parseFloat($('cfg').value) || 1,
    };
    $('progress').classList.remove('hidden');
    $('fill').style.width = '10%';
    $('genStatus').textContent = 'Starting job…';
    $('genStatus').style.color = '#c9a227';
    try {
      const res = await fetch('/api/animegen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generate failed');
      jobId = data.job_id;
      $('genStatus').textContent = 'Job ' + jobId + ' — ' + (data.message || 'running');
      pollJob();
    } catch (e) {
      $('genStatus').textContent = e.message;
      $('genStatus').style.color = '#e94560';
      $('fill').style.width = '0%';
    }
  };

  $('btnCancel').onclick = async () => {
    if (!jobId) return;
    await fetch('/api/animegen/cancel/' + encodeURIComponent(jobId), { method: 'POST' });
    $('genStatus').textContent = 'Cancel requested';
  };

  function pollJob() {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (!jobId) return;
      try {
        const data = await (await fetch('/api/animegen/job/' + encodeURIComponent(jobId))).json();
        const p = Math.min(95, (data.progress || 0) * 100);
        $('fill').style.width = p + '%';
        $('genStatus').textContent = data.status + (data.message ? ' — ' + data.message : '');
        if (data.status === 'done' && data.url) {
          clearInterval(pollTimer);
          $('fill').style.width = '100%';
          $('genStatus').textContent = 'Done';
          $('genStatus').style.color = '#6bcb77';
          lastUrl = data.url;
          $('preview').src = data.url;
          refreshOutputs();
        } else if (data.status === 'error' || data.status === 'cancelled') {
          clearInterval(pollTimer);
          $('genStatus').textContent = data.message || data.status;
          $('genStatus').style.color = '#e94560';
        }
      } catch (_) {}
    }, 2000);
  }

  async function refreshOutputs() {
    const host = $('outputList');
    try {
      const data = await (await fetch('/api/animegen/outputs')).json();
      const list = data.outputs || [];
      host.innerHTML = list.length
        ? list.map((o) => '<div class="lib-item" data-url="' + o.url + '">🎬 ' + o.name + ' <span class="dim">(' + Math.round((o.size || 0) / 1024) + ' KB)</span></div>').join('')
        : '<div class="dim small">No outputs yet</div>';
      host.querySelectorAll('.lib-item').forEach((el) => {
        el.onclick = () => {
          lastUrl = el.dataset.url;
          $('preview').src = lastUrl;
        };
      });
    } catch {
      host.innerHTML = '<div class="dim">Could not list outputs</div>';
    }
  }

  $('btnRefreshOut').onclick = refreshOutputs;
  $('btnDownload').onclick = () => {
    if (!lastUrl) return alert('No video yet');
    const a = document.createElement('a');
    a.href = lastUrl;
    a.download = lastUrl.split('/').pop() || 'animegen.mp4';
    a.click();
  };
  $('btnToCreator').onclick = () => {
    if (!lastUrl) return alert('Generate or select a video first');
    // Stash for Creator Video Prep handoff
    localStorage.setItem('as_handoff_video_url', lastUrl);
    localStorage.setItem('as_handoff_video_from', 'animegen');
    window.location.href = '/creator#tab-video-prep';
  };

  tick();
  setInterval(tick, 15000);
  refreshStatus();
  refreshOutputs();
})();


/* Prompt history (last 12) */
(function () {
  const KEY = 'as_animegen_prompts';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
  function save(a) { localStorage.setItem(KEY, JSON.stringify(a.slice(0, 12))); }
  function render() {
    const host = document.getElementById('promptHistory');
    if (!host) return;
    const list = load();
    if (!list.length) { host.innerHTML = ''; return; }
    host.innerHTML = '<span style="color:var(--as-muted)">Recent:</span> ' + list.map((p, i) =>
      '<button type="button" class="btn sm" data-ph="' + i + '" style="margin:2px" title="' + p.replace(/"/g, '&quot;') + '">' +
      (p.length > 40 ? p.slice(0, 40) + '…' : p) + '</button>'
    ).join(' ');
    host.querySelectorAll('[data-ph]').forEach((btn) => {
      btn.onclick = () => {
        const ta = document.getElementById('prompt') || document.querySelector('textarea');
        if (ta) ta.value = load()[parseInt(btn.getAttribute('data-ph'), 10)] || '';
      };
    });
  }
  function push(text) {
    if (!text || !text.trim()) return;
    let a = load().filter((x) => x !== text.trim());
    a.unshift(text.trim());
    save(a);
    render();
  }
  window.__ASAnimeGenRememberPrompt = push;
  // Hook generate button
  function boot() {
    render();
    const clr = document.getElementById('btnClearPromptHist');
    if (clr) clr.onclick = () => { localStorage.removeItem(KEY); render(); };
    const gen = document.getElementById('btnGenerate') || document.querySelector('[data-action="generate"]');
    if (gen) {
      gen.addEventListener('click', () => {
        const ta = document.getElementById('prompt') || document.querySelector('textarea');
        if (ta) push(ta.value);
      }, true);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
