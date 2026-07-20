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
