/**
 * ⚔️ AS Adventurer — Settings + Grok API Key Handler
 * Adds full support for Grok (xAI) API key in the Settings tab
 * Version: 1.1 - Combined Edition
 */

// ============================================
// GROK (xAI) API KEY HANDLING
// ============================================
function initGrokSettings() {
    const grokInput = document.getElementById('settingsGrokKey');
    const grokToggle = document.getElementById('settingsGrokToggle');
    const grokSave = document.getElementById('settingsGrokSave');
    const grokTest = document.getElementById('settingsGrokTest');
    const grokStatus = document.getElementById('settingsGrokStatus');

    if (!grokInput || !grokToggle || !grokSave || !grokTest || !grokStatus) {
        console.warn('[AS Adventurer] Grok settings elements not found in DOM');
        return;
    }

    // Load saved key from localStorage
    const savedGrok = localStorage.getItem('grok_api_key');
    if (savedGrok) {
        grokInput.value = savedGrok;
    }

    // Show / Hide password toggle
    grokToggle.addEventListener('click', () => {
        const isPassword = grokInput.type === 'password';
        grokInput.type = isPassword ? 'text' : 'password';
        grokToggle.textContent = isPassword ? '🙈' : '👁️';
    });

    // Save button
    grokSave.addEventListener('click', () => {
        const key = grokInput.value.trim();
        if (key) {
            localStorage.setItem('grok_api_key', key);
            if (typeof showToast === 'function') {
                showToast('Grok API key saved successfully', 'success');
            }
        } else {
            localStorage.removeItem('grok_api_key');
            if (typeof showToast === 'function') {
                showToast('Grok API key removed', 'warning');
            }
        }
    });

    // Test Grok API connection
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
                    messages: [
                        { role: 'user', content: 'Say "connected" in one word.' }
                    ],
                    max_tokens: 5
                })
            });

            if (response.ok) {
                grokStatus.innerHTML = '<div class="status-msg success">✅ Connection successful! Grok is ready to use.</div>';
                localStorage.setItem('grok_api_key', key);
            } else {
                const data = await response.json().catch(() => ({}));
                const errorMsg = data?.error?.message || `HTTP Error ${response.status}`;
                grokStatus.innerHTML = `<div class="status-msg error">❌ ${errorMsg}</div>`;
            }
        } catch (err) {
            grokStatus.innerHTML = `<div class="status-msg error">❌ ${err.message}. Make sure you're online and the key is correct.</div>`;
        }
    });
}

// ============================================
// Initialize on page load
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initGrokSettings();

    // Also keep AI Provider selection persistent
    const providerSelect = document.getElementById('aiProvider');
    if (providerSelect) {
        const savedProvider = localStorage.getItem('ai_provider');
        if (savedProvider) {
            providerSelect.value = savedProvider;
        }

        providerSelect.addEventListener('change', () => {
            localStorage.setItem('ai_provider', providerSelect.value);
        });
    }

    console.log('⚔️ AS Adventurer — Grok settings initialized');
});
