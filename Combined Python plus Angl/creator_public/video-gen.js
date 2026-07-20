/**
 * ⚔️ AS Adventurer — Video Generation Module (Multi-Provider)
 * Supports: Gemini (default), Grok (xAI), and placeholder for others
 */

(function() {
    'use strict';

    let generating = false;
    let cancelled = false;
    let referenceImages = [];
    let generatedVideos = [];
    let selectedVideos = new Set();
    let fromSpritePrep = false;

    // ============================================
    // GET CURRENT PROVIDER + API KEY
    // ============================================
    function getVideoProviderConfig() {
        const provider = localStorage.getItem('ai_provider') || 'gemini';
        let apiKey = '';
        let modelName = '';

        if (provider === 'gemini') {
            apiKey = localStorage.getItem('google_api_key');
            modelName = 'gemini-omni-flash-preview';
        } else if (provider === 'grok') {
            apiKey = localStorage.getItem('grok_api_key');
            modelName = 'grok-imagine-video'; // Grok Imagine Video model
        } else if (provider === 'openai') {
            apiKey = localStorage.getItem('openai_api_key');
            modelName = 'sora-2'; // Note: Sora is being discontinued Sept 2026
        }

        return { provider, apiKey, modelName };
    }

    // ============================================
    // REFERENCE IMAGE HANDLING (unchanged)
    // ============================================
    function loadReferenceFromHandoff() {
        const handoff = window.ASAdventurer.handoff;
        if (handoff.spriteBase64) {
            referenceImages = [{ dataUrl: handoff.spriteBase64 }];
            fromSpritePrep = true;

            const preview = document.getElementById('vgRefImagePreview');
            const img = document.getElementById('vgRefImage');
            img.src = handoff.spriteBase64;
            preview.classList.remove('hidden');

            document.getElementById('vgRefFromSprite').classList.remove('hidden');
            document.getElementById('vgUploadZone').classList.add('hidden');
        }
    }

    function loadReferenceFiles(files) {
        referenceImages = [];
        fromSpritePrep = false;
        document.getElementById('vgRefFromSprite').classList.add('hidden');

        const maxFiles = Math.min(files.length, 3);
        let loaded = 0;

        for (let i = 0; i < maxFiles; i++) {
            const reader = new FileReader();
            reader.onload = (e) => {
                referenceImages.push({ dataUrl: e.target.result });
                loaded++;
                if (loaded === maxFiles) {
                    const preview = document.getElementById('vgRefImagePreview');
                    const img = document.getElementById('vgRefImage');
                    img.src = referenceImages[0].dataUrl;
                    preview.classList.remove('hidden');
                    showToast(`${referenceImages.length} reference image(s) loaded`, 'success');
                }
            };
            reader.readAsDataURL(files[i]);
        }
    }

    // ============================================
    // MAIN GENERATE FUNCTION (Now Provider-Aware)
    // ============================================
    async function generateVideo() {
        if (generating) return;

        const config = getVideoProviderConfig();
        const { provider, apiKey, modelName } = config;

        if (!apiKey) {
            showToast(`No ${provider.toUpperCase()} API key found. Go to Settings.`, 'error');
            return;
        }

        if (referenceImages.length === 0) {
            showToast('Upload a reference image or send one from Sprite Prep', 'warning');
            return;
        }

        const modeSelector = document.getElementById('vgModeSelector');
        const activeMode = modeSelector?.querySelector('.mode-btn.active');
        const mode = activeMode?.dataset.mode || 'reference';

        if (mode === 'keyframe' && referenceImages.length < 2) {
            showToast('Keyframe mode requires Start + End frames', 'warning');
            return;
        }

        const duration = parseInt(document.getElementById('vgDuration')?.value || '5');
        const genCountEl = document.getElementById('vgGenCount');
        const activeBtn = genCountEl?.querySelector('.gen-count-btn.active');
        const genCount = activeBtn ? parseInt(activeBtn.dataset.count) : 1;

        const prompt = mode === 'keyframe'
            ? (document.getElementById('vgKeyframePrompt')?.value?.trim() || '')
            : (document.getElementById('vgPrompt')?.value?.trim() || '');

        generating = true;
        cancelled = false;

        document.getElementById('vgProgress').classList.add('active');
        document.getElementById('vgGenerateBtn').disabled = true;

        const status = document.getElementById('vgStatus');
        status.innerHTML = `<div class="status-msg info"><span class="spinner"></span> Generating with ${provider.toUpperCase()} — this may take a few minutes…</div>`;

        try {
            const promises = [];
            for (let i = 0; i < genCount; i++) {
                if (cancelled) break;
                promises.push(generateOneVideo(config, prompt, duration, mode));
            }

            const results = await Promise.allSettled(promises);
            generatedVideos = results
                .filter(r => r.status === 'fulfilled' && r.value)
                .map(r => r.value);

            if (generatedVideos.length > 0) {
                displayVideoResults();
                window.notificationSound?.play();
                status.innerHTML = `<div class="status-msg success">✅ Generated ${generatedVideos.length} video(s) with ${provider.toUpperCase()}!</div>`;
            } else {
                status.innerHTML = `<div class="status-msg error">❌ Generation failed. Check console for details.</div>`;
            }
        } catch (err) {
            status.innerHTML = `<div class="status-msg error">❌ ${err.message}</div>`;
        } finally {
            generating = false;
            document.getElementById('vgProgress').classList.remove('active');
            document.getElementById('vgGenerateBtn').disabled = false;
        }
    }

    // ============================================
    // SINGLE VIDEO GENERATION (Provider Routing)
    // ============================================
    async function generateOneVideo(config, prompt, duration, mode) {
        const { provider, apiKey, modelName } = config;

        if (provider === 'gemini') {
            return await generateWithGemini(apiKey, prompt, duration, mode);
        } 
        else if (provider === 'grok') {
            return await generateWithGrok(apiKey, prompt, duration, mode);
        } 
        else if (provider === 'openai') {
            showToast('OpenAI Sora support is limited (being discontinued Sept 2026)', 'warning');
            // You can add Sora logic here later if needed
            throw new Error('OpenAI Sora is not fully implemented yet');
        } 
        else {
            throw new Error(`Unsupported provider: ${provider}`);
        }
    }

    // Gemini implementation (your original logic)
    async function generateWithGemini(apiKey, prompt, duration, mode) {
        // ... (keep your existing Gemini code here)
        // For brevity, I'm keeping the original Gemini request logic
        const textPrompt = prompt || 'Generate a gentle breathing idle animation...';

        const requestBody = {
            model: 'gemini-omni-flash-preview',
            input: referenceImages.length > 0 
                ? [{ type: 'image', data: referenceImages[0].dataUrl.split(',')[1], mime_type: 'image/png' }, { type: 'text', text: textPrompt }]
                : textPrompt,
            generation_config: { video_config: { task: 'image_to_video' } }
        };

        const response = await fetch('/api/video/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        return extractVideoFromResponse(data);
    }

    // Grok implementation (new)
    async function generateWithGrok(apiKey, prompt, duration, mode) {
        const textPrompt = prompt || 'Create a smooth idle animation';

        const requestBody = {
            model: 'grok-imagine-video',
            prompt: textPrompt,
            image: referenceImages.length > 0 ? referenceImages[0].dataUrl : null,
            duration: duration,
            // Add more Grok-specific params as needed
        };

        const response = await fetch('/api/video/generate', {  // You may need a separate backend route later
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        return extractVideoFromResponse(data);
    }

    function extractVideoFromResponse(data) {
        // Keep your existing extraction logic here
        if (data.steps) {
            for (const step of data.steps) {
                if (step.type === 'model_output' && step.content) {
                    for (const item of step.content) {
                        if (item.type === 'video' && item.data) {
                            const blob = base64ToBlob(item.data, item.mime_type || 'video/mp4');
                            return { blob, url: URL.createObjectURL(blob) };
                        }
                    }
                }
            }
        }
        // Add other extraction patterns as needed
        throw new Error('Could not extract video from response');
    }

    // displayVideoResults, bindVideoResultEvents, handoffToVideoPrep, etc. remain the same
    // (copy the rest of your original functions here)

    function initVideoGen() {
        // Mode selector, upload zones, sliders, etc. (same as before)
        initModeSelector('vgModeSelector', (mode) => {
            document.getElementById('vgReferenceMode').classList.toggle('hidden', mode !== 'reference');
            document.getElementById('vgKeyframeMode').classList.toggle('hidden', mode !== 'keyframe');
        });

        initUploadZone('vgUploadZone', 'vgFileInput', loadReferenceFiles);
        // ... rest of your init code ...

        document.getElementById('vgGenerateBtn')?.addEventListener('click', generateVideo);
        // ... other event listeners ...
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVideoGen);
    } else {
        initVideoGen();
    }

})();