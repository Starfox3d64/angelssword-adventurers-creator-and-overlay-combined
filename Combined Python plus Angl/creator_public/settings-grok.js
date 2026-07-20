/**
 * ⚔️ AS Adventurer — Settings: Grok Imagine + Local ComfyUI
 * Version: 1.3 - Combined Edition
 */

function initGrokSettings() {
    const grokInput = document.getElementById('settingsGrokKey');
    const grokToggle = document.getElementById('settingsGrokToggle');
    const grokSave = document.getElementById('settingsGrokSave');
    const grokTest = document.getElementById('settingsGrokTest');
    const grokStatus = document.getElementById('settingsGrokStatus');
    const backendSelector = document.getElementById('settingsGrokBackend');
    const backendStatus = document.getElementById('settingsGrokBackendStatus');
    const oauthStatus = document.getElementById('settingsGrokOAuthStatus');

    // Load saved key
    if (grokInput) {
        const savedGrok = localStorage.getItem('grok_api_key');
        if (savedGrok) grokInput.value = savedGrok;
    }

    // Backend toggle (API Key vs SuperGrok OAuth)
    const savedBackend = localStorage.getItem('grok_backend') || 'api';
    if (backendSelector) {
        backendSelector.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.backend === savedBackend);
        });
        updateBackendStatus(savedBackend);

        backendSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.mode-btn');
            if (!btn) return;
            backendSelector.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const backend = btn.dataset.backend;
            localStorage.setItem('grok_backend', backend);
            updateBackendStatus(backend);
        });
    }

    function updateBackendStatus(backend) {
        if (!backendStatus) return;
        if (backend === 'oauth') {
            backendStatus.textContent = 'Active backend: SuperGrok OAuth';
            backendStatus.className = 'status-msg info';
        } else {
            backendStatus.textContent = 'Active backend: API Key';
            backendStatus.className = 'status-msg info';
        }
    }

    // Show / Hide password
    if (grokToggle && grokInput) {
        grokToggle.addEventListener('click', () => {
            const isPassword = grokInput.type === 'password';
            grokInput.type = isPassword ? 'text' : 'password';
            grokToggle.textContent = isPassword ? '🙈' : '👁️';
        });
    }

    // Save
    if (grokSave && grokInput) {
        grokSave.addEventListener('click', () => {
            const key = grokInput.value.trim();
            if (key) {
                localStorage.setItem('grok_api_key', key);
                if (typeof showToast === 'function') showToast('Grok API key saved', 'success');
            } else {
                localStorage.removeItem('grok_api_key');
                if (typeof showToast === 'function') showToast('Grok API key removed', 'warning');
            }
        });
    }

    // Test API key
    if (grokTest && grokInput && grokStatus) {
        grokTest.addEventListener('click', async () => {
            const key = grokInput.value.trim();
            if (!key) {
                grokStatus.innerHTML = '<div class="status-msg error">Enter an API key first</div>';
                return;
            }
            grokStatus.innerHTML = '<div class="status-msg info"><span class="spinner"></span> Testing Grok connection...</div>';
            try {
                const response = await fetch('https://api.x.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: 'grok-3',
                        messages: [{ role: 'user', content: 'Say "connected" in one word.' }],
                        max_tokens: 5
                    })
                });
                if (response.ok) {
                    grokStatus.innerHTML = '<div class="status-msg success">✅ Connection successful! Grok is ready.</div>';
                    localStorage.setItem('grok_api_key', key);
                } else {
                    const data = await response.json().catch(() => ({}));
                    const errorMsg = data?.error?.message || `HTTP ${response.status}`;
                    grokStatus.innerHTML = `<div class="status-msg error">❌ ${errorMsg}</div>`;
                }
            } catch (err) {
                grokStatus.innerHTML = `<div class="status-msg error">❌ ${err.message}</div>`;
            }
        });
    }

    // OAuth stubs
    document.getElementById('settingsGrokOAuthTest')?.addEventListener('click', () => {
        if (oauthStatus) {
            oauthStatus.textContent = 'SuperGrok OAuth is not fully wired in the Python port yet. Use API Key for now.';
            oauthStatus.className = 'status-msg warning';
        }
        if (typeof showToast === 'function') showToast('Use API Key backend for now', 'warning');
    });
    document.getElementById('settingsGrokOAuthRefresh')?.addEventListener('click', () => {
        if (typeof showToast === 'function') showToast('No OAuth token to refresh', 'info');
    });
    document.getElementById('settingsGrokOAuthLogout')?.addEventListener('click', () => {
        localStorage.removeItem('grok_oauth_token');
        if (oauthStatus) {
            oauthStatus.textContent = 'SuperGrok session: not connected';
            oauthStatus.className = 'status-msg info';
        }
        if (typeof showToast === 'function') showToast('Logged out of SuperGrok session', 'info');
    });
}

function initComfySettings() {
    const urlInput = document.getElementById('settingsComfyUrl');
    const statusEl = document.getElementById('settingsComfyConnStatus');
    const autoConnect = document.getElementById('settingsComfyAutoConnect');
    const imageWorkflow = document.getElementById('settingsComfyImageWorkflow');
    const videoWorkflow = document.getElementById('settingsComfyVideoWorkflow');

    // Load saved values
    if (urlInput) {
        const saved = localStorage.getItem('comfyui_url');
        if (saved) urlInput.value = saved;
        urlInput.addEventListener('change', () => {
            localStorage.setItem('comfyui_url', urlInput.value.trim());
        });
    }
    if (autoConnect) {
        autoConnect.checked = localStorage.getItem('comfyui_auto_connect') !== 'false';
        autoConnect.addEventListener('change', () => {
            localStorage.setItem('comfyui_auto_connect', autoConnect.checked);
        });
    }
    if (imageWorkflow) {
        const saved = localStorage.getItem('comfyui_image_workflow');
        if (saved) imageWorkflow.value = saved;
        imageWorkflow.addEventListener('change', () => {
            localStorage.setItem('comfyui_image_workflow', imageWorkflow.value);
        });
    }
    if (videoWorkflow) {
        const saved = localStorage.getItem('comfyui_video_workflow');
        if (saved) videoWorkflow.value = saved;
        videoWorkflow.addEventListener('change', () => {
            localStorage.setItem('comfyui_video_workflow', videoWorkflow.value);
        });
    }

    async function testComfy(url) {
        // Use server proxy status (checks 127.0.0.1:8188 by default)
        // For custom URLs we still hit the proxy status endpoint
        try {
            const res = await fetch('/api/comfyui/status');
            const data = await res.json();
            return !!data.available;
        } catch {
            return false;
        }
    }

    function setStatus(text, ok) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.className = ok ? 'status-msg success' : 'status-msg error';
    }

    document.getElementById('settingsComfyConnect')?.addEventListener('click', async () => {
        const url = (urlInput?.value || 'http://127.0.0.1:8188').trim();
        localStorage.setItem('comfyui_url', url);
        localStorage.setItem('comfyui_connected', 'true');
        setStatus('Status: connecting...', false);
        const ok = await testComfy(url);
        if (ok) {
            setStatus(`Connected: ${url}`, true);
            if (typeof showToast === 'function') showToast('ComfyUI connected', 'success');
        } else {
            setStatus(`Failed to connect to ${url}`, false);
            if (typeof showToast === 'function') showToast('ComfyUI not reachable', 'error');
        }
    });

    document.getElementById('settingsComfyTest')?.addEventListener('click', async () => {
        const url = (urlInput?.value || 'http://127.0.0.1:8188').trim();
        setStatus('Status: testing...', false);
        const ok = await testComfy(url);
        setStatus(ok ? `Connected: ${url}` : `Offline: ${url}`, ok);
    });

    document.getElementById('settingsComfyOpen')?.addEventListener('click', () => {
        const url = (urlInput?.value || 'http://127.0.0.1:8188').trim();
        window.open(url, '_blank');
    });

    document.getElementById('settingsComfyDisconnect')?.addEventListener('click', () => {
        localStorage.setItem('comfyui_connected', 'false');
        setStatus('Status: not connected', false);
        if (typeof showToast === 'function') showToast('ComfyUI disconnected', 'info');
    });

    document.getElementById('settingsComfyScanLocal')?.addEventListener('click', async () => {
        setStatus('Status: scanning localhost...', false);
        const ok = await testComfy('http://127.0.0.1:8188');
        if (ok) {
            if (urlInput) urlInput.value = 'http://127.0.0.1:8188';
            localStorage.setItem('comfyui_url', 'http://127.0.0.1:8188');
            setStatus('Connected: http://127.0.0.1:8188', true);
            if (typeof showToast === 'function') showToast('Found ComfyUI on localhost:8188', 'success');
        } else {
            setStatus('No ComfyUI found on localhost:8188', false);
        }
    });

    document.getElementById('settingsComfyScanLan')?.addEventListener('click', () => {
        if (typeof showToast === 'function') {
            showToast('LAN scan is limited in browser — enter your ComfyUI IP manually (e.g. http://192.168.x.x:8188)', 'info');
        }
    });

    // Persist model override dropdowns
    const modelSelectIds = [
        'settingsComfyCkptBase',
        'settingsComfyCkptRefiner',
        'settingsComfyVideoCkpt',
        'settingsComfyVideoTextEnc',
        'settingsComfyVideoTextEnc2'
    ];
    modelSelectIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const saved = localStorage.getItem('comfyui_' + id);
        if (saved) {
            // Ensure option exists
            if (![...el.options].some(o => o.value === saved)) {
                const opt = document.createElement('option');
                opt.value = saved;
                opt.textContent = saved;
                el.appendChild(opt);
            }
            el.value = saved;
        }
        el.addEventListener('change', () => localStorage.setItem('comfyui_' + id, el.value));
    });

    async function refreshComfyModels() {
        try {
            const res = await fetch('/api/comfyui/object_info');
            if (!res.ok) throw new Error('object_info failed');
            const info = await res.json();

            // Collect checkpoint names from CheckpointLoaderSimple
            const ckpts = info?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
            const fill = (selectId, list) => {
                const el = document.getElementById(selectId);
                if (!el || !Array.isArray(list) || list.length === 0) return;
                const current = el.value;
                // Keep first default option
                const first = el.options[0];
                el.innerHTML = '';
                if (first) el.appendChild(first);
                list.forEach(name => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name;
                    el.appendChild(opt);
                });
                if (current) el.value = current;
            };

            fill('settingsComfyCkptBase', ckpts);
            fill('settingsComfyCkptRefiner', ckpts);
            fill('settingsComfyVideoCkpt', ckpts);
            fill('settingsComfyVideoTextEnc', ckpts);

            if (typeof showToast === 'function') {
                showToast(`Loaded ${ckpts.length} checkpoint(s) from ComfyUI`, 'success');
            }
            return true;
        } catch (e) {
            console.warn('[ComfyUI] refresh models failed:', e);
            if (typeof showToast === 'function') {
                showToast('Could not load models from ComfyUI (is it running?)', 'warning');
            }
            return false;
        }
    }

    document.getElementById('settingsComfyRefreshTemplates')?.addEventListener('click', async () => {
        const ok = await testComfy();
        if (ok) await refreshComfyModels();
        else if (typeof showToast === 'function') {
            showToast('ComfyUI offline', 'warning');
        }
    });

    // Auto-connect on load
    if (autoConnect?.checked || localStorage.getItem('comfyui_connected') === 'true') {
        testComfy().then(ok => {
            const url = urlInput?.value || 'http://127.0.0.1:8188';
            if (ok) {
                setStatus(`Connected: ${url}`, true);
                refreshComfyModels();
            } else {
                setStatus('Status: not connected', false);
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initGrokSettings();
    initComfySettings();
    console.log('⚔️ AS Adventurer — Grok + ComfyUI settings initialized');
});



// ── Prompt Templates + Data Tools + Status Bar + Shortcuts ─────────────

function getPromptTemplates() {
    try {
        return JSON.parse(localStorage.getItem('as_prompt_templates') || '[]');
    } catch {
        return [];
    }
}

function savePromptTemplates(list) {
    localStorage.setItem('as_prompt_templates', JSON.stringify(list));
}

function renderPromptTemplateList() {
    const listEl = document.getElementById('settingsPromptList');
    const chipEl = document.getElementById('sgPromptTemplates');
    const templates = getPromptTemplates();

    if (listEl) {
        if (!templates.length) {
            listEl.innerHTML = '<div class="text-dim" style="font-size:0.8rem;">No templates saved yet.</div>';
        } else {
            listEl.innerHTML = templates.map((t, i) => `
                <div style="display:flex; gap:8px; align-items:center; margin:6px 0; padding:6px 8px; background:rgba(0,0,0,0.25); border-radius:6px;">
                    <strong style="color:#dbb858; min-width:100px;">${escapeHtml(t.name)}</strong>
                    <span class="text-dim" style="flex:1; font-size:0.75rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(t.body)}</span>
                    <button class="btn btn-sm btn-secondary" data-tpl-load="${i}">Load</button>
                    <button class="btn btn-sm btn-danger" data-tpl-del="${i}">✕</button>
                </div>
            `).join('');
            listEl.querySelectorAll('[data-tpl-load]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const t = templates[parseInt(btn.dataset.tplLoad)];
                    if (!t) return;
                    document.getElementById('settingsPromptTemplateName').value = t.name;
                    document.getElementById('settingsPromptTemplateBody').value = t.body;
                });
            });
            listEl.querySelectorAll('[data-tpl-del]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const next = getPromptTemplates();
                    next.splice(parseInt(btn.dataset.tplDel), 1);
                    savePromptTemplates(next);
                    renderPromptTemplateList();
                    if (typeof showToast === 'function') showToast('Template deleted', 'info');
                });
            });
        }
    }

    if (chipEl) {
        const defaults = [
            { name: 'Idle Loop', body: 'Locked-off Position Static Camera. Perfect Seamless Loop. Subtle idle breathing and blinking. Solid chroma key background.' },
            { name: 'Talking', body: 'Locked-off Position Static Camera. Perfect Seamless Loop. Subtle talking mouth movements, soft gestures. Solid chroma key background.' },
            { name: 'Wave', body: 'Locked-off Position Static Camera. Character waves hello with one hand, friendly expression. Solid chroma key background.' },
        ];
        const all = [...defaults, ...templates];
        chipEl.innerHTML = all.map((t, i) =>
            `<button type="button" class="btn btn-sm btn-secondary" data-chip-prompt="${i}">${escapeHtml(t.name)}</button>`
        ).join('');
        chipEl.querySelectorAll('[data-chip-prompt]').forEach(btn => {
            btn.addEventListener('click', () => {
                const t = all[parseInt(btn.dataset.chipPrompt)];
                const desc = document.getElementById('sgCharDesc') || document.getElementById('sgCharAction');
                if (desc && t) {
                    desc.value = t.body;
                    if (typeof showToast === 'function') showToast(`Applied template: ${t.name}`, 'success');
                }
            });
        });
    }
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function initPromptTemplates() {
    document.getElementById('settingsPromptSave')?.addEventListener('click', () => {
        const name = document.getElementById('settingsPromptTemplateName')?.value?.trim();
        const body = document.getElementById('settingsPromptTemplateBody')?.value?.trim();
        if (!name || !body) {
            if (typeof showToast === 'function') showToast('Name and prompt text required', 'warning');
            return;
        }
        const list = getPromptTemplates();
        const idx = list.findIndex(t => t.name === name);
        if (idx >= 0) list[idx] = { name, body };
        else list.push({ name, body });
        savePromptTemplates(list);
        renderPromptTemplateList();
        if (typeof showToast === 'function') showToast('Template saved', 'success');
    });

    document.getElementById('settingsPromptApplySprite')?.addEventListener('click', () => {
        const body = document.getElementById('settingsPromptTemplateBody')?.value?.trim();
        if (!body) return;
        const desc = document.getElementById('sgCharDesc') || document.getElementById('sgCharAction');
        if (desc) desc.value = body;
        if (window.switchTab) window.switchTab('tab-sprite-prep');
        if (typeof showToast === 'function') showToast('Applied to Sprite Prep', 'success');
    });

    document.getElementById('settingsPromptApplyVideo')?.addEventListener('click', () => {
        const body = document.getElementById('settingsPromptTemplateBody')?.value?.trim();
        if (!body) return;
        const vg = document.getElementById('vgPrompt');
        if (vg) vg.value = body;
        if (window.switchTab) window.switchTab('tab-video-gen');
        if (typeof showToast === 'function') showToast('Applied to Generate Video', 'success');
    });

    renderPromptTemplateList();
}

function initDataTools() {
    const status = document.getElementById('settingsDataStatus');

    document.getElementById('settingsExportPrefs')?.addEventListener('click', () => {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k) data[k] = localStorage.getItem(k);
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `as-adventurer-settings-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        if (status) status.innerHTML = '<div class="status-msg success">Settings exported</div>';
        if (typeof showToast === 'function') showToast('Settings exported', 'success');
    });

    const fileInput = document.getElementById('settingsImportFile');
    document.getElementById('settingsImportPrefs')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
            const json = JSON.parse(await file.text());
            Object.entries(json).forEach(([k, v]) => {
                if (typeof v === 'string') localStorage.setItem(k, v);
            });
            if (status) status.innerHTML = '<div class="status-msg success">Settings imported — reload recommended</div>';
            if (typeof showToast === 'function') showToast('Settings imported — refresh the page', 'success');
            renderPromptTemplateList();
            initGrokSettings();
            initComfySettings();
        } catch (e) {
            if (status) status.innerHTML = `<div class="status-msg error">Import failed: ${e.message}</div>`;
        }
        fileInput.value = '';
    });

    document.getElementById('settingsResetLocal')?.addEventListener('click', () => {
        if (!confirm('Clear ALL local AS Adventurer data (API keys, templates, preferences)?')) return;
        localStorage.clear();
        if (status) status.innerHTML = '<div class="status-msg warning">Local data cleared — reload the page</div>';
        if (typeof showToast === 'function') showToast('Local data cleared', 'warning');
    });
}

async function refreshGlobalStatusBar() {
    const ff = document.getElementById('statusFfmpeg');
    const comfy = document.getElementById('statusComfy');
    const keys = document.getElementById('statusKeys');
    const ver = document.getElementById('statusVersion');

    try {
        const res = await fetch('/health');
        const data = await res.json();
        if (ver) ver.textContent = data.version || 'AS Adventurer';
        if (ff) {
            const ok = data.services?.ffmpeg?.available;
            ff.textContent = ok ? 'ffmpeg: ready ✅' : 'ffmpeg: missing';
            ff.style.color = ok ? '#6bcb77' : '#e94560';
        }
        if (comfy) {
            const ok = data.services?.comfyui?.available;
            comfy.textContent = ok ? 'ComfyUI: online ✅' : 'ComfyUI: offline';
            comfy.style.color = ok ? '#6bcb77' : '#8899aa';
        }
    } catch {
        if (ff) ff.textContent = 'ffmpeg: ?';
        if (comfy) comfy.textContent = 'ComfyUI: ?';
    }

    if (keys) {
        const has = [];
        if (localStorage.getItem('openai_api_key')) has.push('OpenAI');
        if (localStorage.getItem('google_api_key')) has.push('Gemini');
        if (localStorage.getItem('grok_api_key')) has.push('Grok');
        keys.textContent = has.length ? `Keys: ${has.join(', ')}` : 'Keys: none set';
        keys.style.color = has.length ? '#dbb858' : '#8899aa';
    }
}

function initShortcuts() {
    const modal = document.getElementById('shortcutsModal');
    const openBtn = document.getElementById('btnShortcutsHelp');
    const closeBtn = document.getElementById('shortcutsClose');

    const open = () => modal?.classList.remove('hidden');
    const close = () => modal?.classList.add('hidden');

    openBtn?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.addEventListener('keydown', (e) => {
        const tag = (e.target && e.target.tagName) || '';
        const typing = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;

        if (e.key === 'Escape') {
            close();
            document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
            return;
        }
        if (typing) return;

        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            e.preventDefault();
            open();
            return;
        }

        // Tab numbers 1-5
        if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key >= '1' && e.key <= '5') {
            const tabs = ['tab-sprite-prep', 'tab-video-gen', 'tab-video-prep', 'tab-exporter', 'tab-settings'];
            const id = tabs[parseInt(e.key, 10) - 1];
            if (id && window.switchTab) {
                e.preventDefault();
                window.switchTab(id);
            }
            return;
        }

        if (e.ctrlKey || e.metaKey) {
            const k = e.key.toLowerCase();
            if (k === 's' && window.switchTab) {
                e.preventDefault();
                window.switchTab('tab-settings');
            } else if (k === 'e' && window.switchTab) {
                e.preventDefault();
                window.switchTab('tab-exporter');
            } else if (k === 'g' && window.switchTab) {
                e.preventDefault();
                window.switchTab('tab-video-gen');
            }
        }
    });
}

// Hook into existing DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initPromptTemplates();
    initDataTools();
    initShortcuts();
    refreshGlobalStatusBar();
    setInterval(refreshGlobalStatusBar, 30000);
});



// ── Extra QoL: FAB, recent characters, beforeunload ────────────────────

function initRecentCharacters() {
    const input = document.getElementById('sgCharName');
    const chips = document.getElementById('sgRecentChars');
    if (!input || !chips) return;

    function load() {
        try { return JSON.parse(localStorage.getItem('as_recent_chars') || '[]'); }
        catch { return []; }
    }
    function save(list) {
        localStorage.setItem('as_recent_chars', JSON.stringify(list.slice(0, 8)));
    }
    function render() {
        const list = load();
        chips.innerHTML = list.map(n =>
            `<button type="button" data-char="${n.replace(/"/g, '&quot;')}">${n}</button>`
        ).join('');
        chips.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                input.value = btn.dataset.char || btn.textContent;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });
    }
    function remember() {
        const name = input.value.trim();
        if (!name) return;
        const list = load().filter(n => n.toLowerCase() !== name.toLowerCase());
        list.unshift(name);
        save(list);
        render();
    }
    input.addEventListener('change', remember);
    input.addEventListener('blur', remember);
    // Also remember when generate is clicked
    document.getElementById('sgGenerateBtn')?.addEventListener('click', () => setTimeout(remember, 0));
    render();
}

function initFab() {
    document.getElementById('qolScrollTop')?.addEventListener('click', () => {
        const main = document.querySelector('.tab-content') || document.querySelector('.app-container') || window;
        if (main.scrollTo) main.scrollTo({ top: 0, behavior: 'smooth' });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('qolRefreshStatus')?.addEventListener('click', () => {
        if (typeof refreshGlobalStatusBar === 'function') refreshGlobalStatusBar();
        if (typeof showToast === 'function') showToast('Status refreshed', 'info');
    });
    document.getElementById('qolCopyStatus')?.addEventListener('click', async () => {
        try {
            const health = await (await fetch('/health')).json();
            const exportSt = await (await fetch('/api/export/status')).json();
            const text = JSON.stringify({ health, export: exportSt, keys: {
                openai: !!localStorage.getItem('openai_api_key'),
                gemini: !!localStorage.getItem('google_api_key'),
                grok: !!localStorage.getItem('grok_api_key')
            }}, null, 2);
            await navigator.clipboard.writeText(text);
            if (typeof showToast === 'function') showToast('Status copied to clipboard', 'success');
        } catch (e) {
            if (typeof showToast === 'function') showToast('Could not copy status', 'error');
        }
    });
}

function initBeforeUnloadGuard() {
    window.addEventListener('beforeunload', (e) => {
        // Soft guard if generation flags exist
        if (window.__asGenerating) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initRecentCharacters();
    initFab();
    initBeforeUnloadGuard();
});
