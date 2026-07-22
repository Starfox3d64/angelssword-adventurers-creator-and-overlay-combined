#!/usr/bin/env python3
"""
⚔️ AS Adventurer — Combined Edition (Overlay + Creator)
Python port made by TheDonOfEverything aka Paul Conforti

Credits:
- Original JavaScript version by Leaflit
- Angular Edition by OOzeClues (v0.3.0 → v0.4.0 feature parity)
- Python Combined Edition by TheDonOfEverything aka Paul Conforti

One unified program containing:
- Reactive Overlay (face tracking, expressions, emotes)
- Creator Pipeline (Sprite Prep → AI Video → Video Prep → Export)
- Support for Gemini, OpenAI, Grok (xAI), and Local ComfyUI

Run:
    python server.py

Then open http://localhost:3000
"""

import os
import json
import asyncio
import threading
import tempfile
import shutil
import subprocess
import uuid
import time
import requests as http_requests
from pathlib import Path
from flask import send_file, Flask, send_from_directory, request, jsonify, Response

APP_DIR = Path(__file__).parent
OVERLAY_PUBLIC = APP_DIR / "overlay_public"
CREATOR_PUBLIC = APP_DIR / "creator_public"
LIVE2D_PUBLIC = APP_DIR / "live2d_public"
MUSIC_PUBLIC = APP_DIR / "music_public"
ANIMEGEN_PUBLIC = APP_DIR / "animegen_public"
ANIMEGEN_MODELS = ANIMEGEN_PUBLIC / "models"
ANIMEGEN_OUTPUTS = ANIMEGEN_PUBLIC / "outputs"
MUSIC_LIBRARY = MUSIC_PUBLIC / "library"
SHARED_PUBLIC = APP_DIR / "shared"
LIVE2D_MODELS = LIVE2D_PUBLIC / "models"
BIN_DIR = CREATOR_PUBLIC / "bin"

# ── Startup Checks ─────────────────────────────────────────────────────────
VERSION = "2.5.1 - Don's Adventurer (Angular 0.4.0 parity)"
LAST_UPDATED = "2026-07-22"


def get_ffmpeg_path():
    """Return path to ffmpeg binary, or None if not found."""
    import shutil
    import platform

    # 1. Prefer local bin/ folder
    if platform.system() == "Windows":
        local = BIN_DIR / "ffmpeg.exe"
    else:
        local = BIN_DIR / "ffmpeg"
    if local.exists():
        return str(local)

    # 2. Fall back to system PATH
    system = shutil.which("ffmpeg")
    if system:
        return system

    return None


def _ffmpeg_version_line(path):
    try:
        out = subprocess.run([str(path), "-version"], capture_output=True, text=True, timeout=8)
        return (out.stdout or "").split("\n")[0].strip()
    except Exception:
        return ""


def ensure_ffmpeg():
    """
    Make sure ffmpeg is available.
    - Checks bin/ first, then system PATH
    - If missing, downloads a small static Windows build into bin/
    Returns the path to ffmpeg or None.
    """
    import platform
    import urllib.request
    import zipfile
    import tempfile
    import shutil

    existing = get_ffmpeg_path()
    if existing:
        ver = _ffmpeg_version_line(existing)
        if ver:
            print(f"[ffmpeg] Using {existing}")
            print(f"[ffmpeg] {ver}")
        return existing

    print("[ffmpeg] Not found. Attempting to download a small static build...")

    BIN_DIR.mkdir(exist_ok=True)

    # Only auto-download for Windows (most common for this project)
    if platform.system() != "Windows":
        print("[ffmpeg] Auto-download is only supported on Windows.")
        print("[ffmpeg] Please install ffmpeg and add it to PATH, or place the binary in the bin/ folder.")
        return None

    # Small essential Windows build (gyan.dev essentials ~40MB, much smaller than full builds)
    # Using a direct known-good essentials zip
    url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    target = BIN_DIR / "ffmpeg.exe"

    try:
        print(f"[ffmpeg] Downloading from {url}")
        print("[ffmpeg] This may take a minute (file is ~40-50 MB)...")

        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
            tmp_path = Path(tmp.name)

        urllib.request.urlretrieve(url, tmp_path)

        print("[ffmpeg] Extracting ffmpeg.exe ...")
        with zipfile.ZipFile(tmp_path, "r") as zf:
            # Find ffmpeg.exe inside the zip (usually under ffmpeg-...-essentials_build/bin/)
            for name in zf.namelist():
                if name.endswith("bin/ffmpeg.exe") or name.endswith("ffmpeg.exe"):
                    with zf.open(name) as src, open(target, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    break
            else:
                print("[ffmpeg] Could not find ffmpeg.exe inside the downloaded zip.")
                tmp_path.unlink(missing_ok=True)
                return None

        tmp_path.unlink(missing_ok=True)

        if target.exists():
            size_mb = target.stat().st_size / (1024 * 1024)
            print(f"[ffmpeg] Successfully installed → {target} ({size_mb:.1f} MB)")
            return str(target)
        else:
            print("[ffmpeg] Download finished but file is missing.")
            return None

    except Exception as e:
        print(f"[ffmpeg] Auto-download failed: {e}")
        print("[ffmpeg] Please download ffmpeg manually and place ffmpeg.exe in the bin/ folder.")
        print("         Or install ffmpeg and add it to your system PATH.")
        return None

if not OVERLAY_PUBLIC.exists():
    print(f"[ERROR] overlay_public folder not found at: {OVERLAY_PUBLIC}")
    print("Please make sure the folder exists and contains the Overlay frontend files.")
    exit(1)

if not CREATOR_PUBLIC.exists():
    print(f"[ERROR] creator_public folder not found at: {CREATOR_PUBLIC}")
    print("Please make sure the folder exists and contains the Creator frontend files.")
    exit(1)

app = Flask(__name__)

# Disable browser caching for development (so you always see the latest files)
@app.after_request
def add_header(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# ── Multi-Provider AI Support ─────────────────────────────────────────────
SUPPORTED_PROVIDERS = ["openai", "gemini", "grok", "comfyui"]

def get_provider_from_request():
    """Get provider from form data or JSON, default to gemini"""
    provider = None
    if request.is_json:
        provider = request.json.get("provider")
    if not provider:
        provider = request.form.get("provider")
    if not provider:
        provider = "gemini"
    return provider.lower() if provider.lower() in SUPPORTED_PROVIDERS else "gemini"


# ── OpenAI Chat Proxy (for Settings "Test" button) ────────────────────────
@app.route("/api/chat", methods=["POST"])
def openai_chat_proxy():
    """Simple proxy for OpenAI chat completions (used by Settings Test button)."""
    try:
        auth = request.headers.get("Authorization", "")
        if not auth:
            return jsonify({"error": "No Authorization header"}), 401

        data = request.get_json() or {}
        resp = http_requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": auth,
                "Content-Type": "application/json"
            },
            json=data,
            timeout=30
        )
        return Response(resp.content, status=resp.status_code, content_type="application/json")
    except Exception as e:
        return jsonify({"error": str(e)}), 502



# ── OpenAI Image Generation Proxy ─────────────────────────────────────────
@app.route("/api/generate", methods=["POST"])
def api_openai_generate():
    """Proxy for OpenAI images/generations (text-to-image)."""
    try:
        auth = request.headers.get("Authorization", "")
        if not auth:
            return jsonify({"error": "No Authorization header"}), 401
        data = request.get_json() or {}
        resp = http_requests.post(
            "https://api.openai.com/v1/images/generations",
            headers={"Authorization": auth, "Content-Type": "application/json"},
            json=data,
            timeout=180
        )
        return Response(resp.content, status=resp.status_code, content_type="application/json")
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/edits", methods=["POST"])
def api_openai_edits():
    """Proxy for OpenAI images/edits (image + prompt). Simplified JSON body."""
    try:
        auth = request.headers.get("Authorization", "")
        if not auth:
            return jsonify({"error": "No Authorization header"}), 401
        data = request.get_json() or {}
        # Forward as generations if edits format is complex; many clients use generations
        # with reference images via the newer API. Fall back to generations endpoint.
        resp = http_requests.post(
            "https://api.openai.com/v1/images/generations",
            headers={"Authorization": auth, "Content-Type": "application/json"},
            json={
                "model": data.get("model", "gpt-image-1"),
                "prompt": data.get("prompt", ""),
                "n": data.get("n", 1),
                "size": data.get("size", "1536x1024"),
                "quality": data.get("quality", "high"),
            },
            timeout=180
        )
        return Response(resp.content, status=resp.status_code, content_type="application/json")
    except Exception as e:
        return jsonify({"error": str(e)}), 502



# ── Gemini Video Generation Proxy ─────────────────────────────────────────
@app.route("/api/video/generate", methods=["POST"])
def api_video_generate():
    """Proxy for Gemini Omni Flash / Interactions video generation."""
    try:
        api_key = request.headers.get("X-API-Key") or request.headers.get("x-api-key")
        data = request.get_json() or {}
        if not api_key:
            # Also allow key in body
            api_key = data.get("apiKey") or data.get("key")
        if not api_key:
            return jsonify({"error": "Google API key required (X-API-Key header)"}), 401

        # Forward to Gemini Interactions API (Omni Flash video)
        url = f"https://generativelanguage.googleapis.com/v1beta/interactions?key={api_key}"
        resp = http_requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json=data,
            timeout=300
        )
        return Response(resp.content, status=resp.status_code, content_type="application/json")
    except Exception as e:
        print(f"[ERROR] /api/video/generate: {e}")
        return jsonify({"error": str(e)}), 502


@app.route("/api/video/poll", methods=["POST"])
def api_video_poll():
    """Poll a long-running Gemini video operation."""
    try:
        api_key = request.headers.get("X-API-Key") or request.headers.get("x-api-key")
        data = request.get_json() or {}
        if not api_key:
            api_key = data.get("apiKey") or data.get("key")
        if not api_key:
            return jsonify({"error": "Google API key required"}), 401

        operation = data.get("operation") or data.get("name") or data.get("operationName")
        if not operation:
            return jsonify({"error": "operation name required"}), 400

        # Operations endpoint
        op_name = operation if operation.startswith("operations/") or "/" in operation else operation
        url = f"https://generativelanguage.googleapis.com/v1beta/{op_name}?key={api_key}"
        resp = http_requests.get(url, timeout=60)
        return Response(resp.content, status=resp.status_code, content_type="application/json")
    except Exception as e:
        print(f"[ERROR] /api/video/poll: {e}")
        return jsonify({"error": str(e)}), 502


# ── Grok (xAI) Video Generation Route ─────────────────────────────────────
@app.route("/api/grok/video/generate", methods=["POST"])
def grok_video_generate():
    """
    Proxy for Grok Imagine Video generation via xAI API.
    Accepts JSON body with: prompt, duration, aspectRatio, apiKey
    """
    try:
        data = request.get_json() or {}
        api_key = data.get("apiKey") or request.headers.get("X-Grok-Key") or request.headers.get("Authorization", "").replace("Bearer ", "")

        if not api_key:
            return jsonify({"error": "Grok API key is required"}), 401

        prompt = data.get("prompt", "Generate a smooth animation")
        duration = data.get("duration", 5)
        aspect_ratio = data.get("aspectRatio", "16:9")

        print(f"[Grok Video] Request received | Prompt: {prompt[:60]}... | {duration}s | {aspect_ratio}")

        # Try xAI video generations endpoint (may 404 if not yet public for this key)
        try:
            resp = http_requests.post(
                "https://api.x.ai/v1/videos/generations",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "grok-imagine-video",
                    "prompt": prompt,
                    "duration": duration,
                    "aspect_ratio": aspect_ratio,
                },
                timeout=120,
            )
            if resp.ok:
                return Response(resp.content, status=resp.status_code, content_type="application/json")
            # Fall through with details if endpoint exists but rejected
            try:
                err_body = resp.json()
            except Exception:
                err_body = {"raw": resp.text[:500]}
            print(f"[Grok Video] Upstream {resp.status_code}: {err_body}")
            return jsonify({
                "success": False,
                "provider": "grok",
                "error": err_body.get("error", {}).get("message") if isinstance(err_body.get("error"), dict) else err_body.get("error") or f"xAI video HTTP {resp.status_code}",
                "status": resp.status_code,
                "hint": "If video API is not enabled on your key, use Gemini video or ComfyUI. Image generation via Grok still works in Sprite Prep."
            }), 502
        except http_requests.exceptions.RequestException as e:
            return jsonify({
                "success": False,
                "provider": "grok",
                "error": str(e),
                "hint": "Network error calling xAI. Check your connection and API key."
            }), 502

    except Exception as e:
        print(f"[ERROR] Grok video generation failed: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ── ComfyUI Proxy Routes ──────────────────────────────────────────────────
# These routes forward requests to a local ComfyUI instance (default: 127.0.0.1:8188)
# Make sure ComfyUI is running if you select the Local ComfyUI option.

COMFYUI_BASE = "http://127.0.0.1:8188"

@app.route("/api/comfyui/<path:subpath>", methods=["GET", "POST", "PUT", "DELETE"])
def comfyui_proxy(subpath):
    """
    Generic proxy to local ComfyUI.
    Example: /api/comfyui/prompt  →  http://127.0.0.1:8188/prompt
    """
    target_url = f"{COMFYUI_BASE}/{subpath}"
    try:
        # Forward query string
        if request.query_string:
            target_url += "?" + request.query_string.decode()

        headers = {k: v for k, v in request.headers if k.lower() not in ("host", "content-length")}
        
        if request.method == "GET":
            resp = http_requests.get(target_url, headers=headers, timeout=30)
        elif request.method == "POST":
            resp = http_requests.post(target_url, data=request.get_data(), headers=headers, timeout=120)
        elif request.method == "PUT":
            resp = http_requests.put(target_url, data=request.get_data(), headers=headers, timeout=60)
        elif request.method == "DELETE":
            resp = http_requests.delete(target_url, headers=headers, timeout=30)
        else:
            return jsonify({"error": "Method not allowed"}), 405

        return Response(
            resp.content,
            status=resp.status_code,
            content_type=resp.headers.get("Content-Type", "application/json")
        )
    except http_requests.exceptions.ConnectionError:
        return jsonify({
            "error": "Cannot connect to ComfyUI. Make sure ComfyUI is running at http://127.0.0.1:8188"
        }), 503
    except Exception as e:
        print(f"[ERROR] ComfyUI proxy failed: {e}")
        return jsonify({"error": str(e)}), 502


@app.route("/api/comfyui/status", methods=["GET"])
def comfyui_status():
    """Check if local ComfyUI is reachable"""
    try:
        resp = http_requests.get(f"{COMFYUI_BASE}/system_stats", timeout=3)
        if resp.ok:
            return jsonify({"available": True, "status": "online", "url": COMFYUI_BASE})
        return jsonify({"available": False, "status": "error", "code": resp.status_code})
    except Exception:
        return jsonify({"available": False, "status": "offline", "url": COMFYUI_BASE})





# ── xAI OAuth + Image/Video (from Angular 0.3.0) ─────────────────────────
XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828"
XAI_OAUTH_SCOPE = "openid profile email offline_access grok-cli:access api:access"
XAI_DEVICE_CODE_URL = "https://auth.x.ai/oauth2/device/code"
XAI_TOKEN_URL = "https://auth.x.ai/oauth2/token"


def _xai_auth_header():
    auth = request.headers.get("Authorization", "")
    if auth:
        return auth if auth.lower().startswith("bearer ") else f"Bearer {auth}"
    data = request.get_json(silent=True) or {}
    key = data.get("apiKey") or request.headers.get("X-Grok-Key") or request.headers.get("X-Api-Key")
    if key:
        return f"Bearer {key}"
    return None


@app.route("/api/xai/oauth/device", methods=["POST"])
def api_xai_oauth_device():
    """Start SuperGrok device-code login (Angular 0.3.0 compatible)."""
    try:
        body = {
            "client_id": XAI_OAUTH_CLIENT_ID,
            "scope": XAI_OAUTH_SCOPE,
            "referrer": "as-adventurer",
        }
        resp = http_requests.post(
            XAI_DEVICE_CODE_URL,
            data=body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "x-grok-client-version": "1.0.0",
                "x-grok-client-surface": "cli",
            },
            timeout=30,
        )
        return Response(resp.content, status=resp.status_code, content_type="application/json")
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/xai/oauth/token", methods=["POST"])
def api_xai_oauth_token():
    """Poll device_code or refresh SuperGrok token."""
    try:
        data = request.get_json(silent=True) or {}
        params = {"client_id": XAI_OAUTH_CLIENT_ID}
        params.update({k: str(v) for k, v in data.items() if v is not None})
        resp = http_requests.post(
            XAI_TOKEN_URL,
            data=params,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "x-grok-client-version": "1.0.0",
                "x-grok-client-surface": "cli",
            },
            timeout=30,
        )
        return Response(resp.content, status=resp.status_code, content_type="application/json")
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/xai/models", methods=["GET"])
def api_xai_models():
    auth = _xai_auth_header()
    if not auth:
        return jsonify({"error": "No xAI Authorization"}), 401
    try:
        resp = http_requests.get(
            "https://api.x.ai/v1/models",
            headers={"Authorization": auth},
            timeout=30,
        )
        return Response(resp.content, status=resp.status_code, content_type="application/json")
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/xai/test", methods=["POST"])
def api_xai_test():
    """Connection test via tiny chat completion (better than /models for scoped keys)."""
    auth = _xai_auth_header()
    if not auth:
        return jsonify({"error": "No xAI Authorization"}), 401
    try:
        resp = http_requests.post(
            "https://api.x.ai/v1/chat/completions",
            headers={"Authorization": auth, "Content-Type": "application/json"},
            json={
                "model": "grok-3",
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 3,
            },
            timeout=45,
        )
        if resp.ok:
            return jsonify({"ok": True, "status": resp.status_code})
        # Fallback: models list
        m = http_requests.get(
            "https://api.x.ai/v1/models",
            headers={"Authorization": auth},
            timeout=20,
        )
        if m.ok:
            return jsonify({"ok": True, "status": m.status_code, "via": "models"})
        return Response(resp.content, status=resp.status_code, content_type="application/json")
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/xai/images/generations", methods=["POST"])
def api_xai_images_generations():
    auth = _xai_auth_header()
    if not auth:
        return jsonify({"error": "No xAI Authorization"}), 401
    try:
        data = request.get_json(silent=True) or {}
        resp = http_requests.post(
            "https://api.x.ai/v1/images/generations",
            headers={"Authorization": auth, "Content-Type": "application/json"},
            json=data,
            timeout=180,
        )
        return Response(resp.content, status=resp.status_code, content_type="application/json")
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/xai/images/edits", methods=["POST"])
def api_xai_images_edits():
    auth = _xai_auth_header()
    if not auth:
        return jsonify({"error": "No xAI Authorization"}), 401
    try:
        data = request.get_json(silent=True) or {}
        # Prefer images/edits; some accounts use generations with image refs
        resp = http_requests.post(
            "https://api.x.ai/v1/images/edits",
            headers={"Authorization": auth, "Content-Type": "application/json"},
            json=data,
            timeout=180,
        )
        if resp.status_code == 404:
            resp = http_requests.post(
                "https://api.x.ai/v1/images/generations",
                headers={"Authorization": auth, "Content-Type": "application/json"},
                json=data,
                timeout=180,
            )
        return Response(resp.content, status=resp.status_code, content_type="application/json")
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/xai/videos/<path:request_id>", methods=["GET"])
def api_xai_videos_poll(request_id):
    auth = _xai_auth_header()
    if not auth:
        return jsonify({"error": "No xAI Authorization"}), 401
    try:
        resp = http_requests.get(
            f"https://api.x.ai/v1/videos/{request_id}",
            headers={"Authorization": auth},
            timeout=60,
        )
        return Response(resp.content, status=resp.status_code, content_type="application/json")
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/xai/videos/generations", methods=["POST"])
def api_xai_videos_generations():
    auth = _xai_auth_header()
    if not auth:
        return jsonify({"error": "No xAI Authorization"}), 401
    try:
        data = request.get_json(silent=True) or {}
        resp = http_requests.post(
            "https://api.x.ai/v1/videos/generations",
            headers={"Authorization": auth, "Content-Type": "application/json"},
            json=data,
            timeout=180,
        )
        return Response(resp.content, status=resp.status_code, content_type="application/json")
    except Exception as e:
        return jsonify({"error": str(e)}), 502


# ── ComfyUI high-level routes (Angular 0.3.0 compatible aliases) ─────────
_comfy_state = {"base_url": "http://127.0.0.1:8188", "connected": False}


@app.route("/api/comfy/status", methods=["GET"])
def api_comfy_status():
    base = _comfy_state.get("base_url") or "http://127.0.0.1:8188"
    try:
        r = http_requests.get(f"{base.rstrip('/')}/system_stats", timeout=2)
        ok = r.ok
        _comfy_state["connected"] = ok
        return jsonify({"available": ok, "connected": ok, "url": base, "status": "online" if ok else "error"})
    except Exception:
        _comfy_state["connected"] = False
        return jsonify({"available": False, "connected": False, "url": base, "status": "offline"})


@app.route("/api/comfy/connect", methods=["POST"])
def api_comfy_connect():
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or data.get("baseUrl") or "http://127.0.0.1:8188").strip()
    if not url.startswith("http"):
        url = "http://" + url
    _comfy_state["base_url"] = url.rstrip("/")
    try:
        r = http_requests.get(f"{_comfy_state['base_url']}/system_stats", timeout=3)
        _comfy_state["connected"] = r.ok
        return jsonify({"ok": r.ok, "url": _comfy_state["base_url"], "connected": r.ok})
    except Exception as e:
        _comfy_state["connected"] = False
        return jsonify({"ok": False, "url": _comfy_state["base_url"], "error": str(e)}), 503


@app.route("/api/comfy/disconnect", methods=["POST"])
def api_comfy_disconnect():
    _comfy_state["connected"] = False
    return jsonify({"ok": True, "connected": False})


@app.route("/api/comfy/test", methods=["POST"])
def api_comfy_test():
    return api_comfy_status()


@app.route("/api/comfy/models", methods=["GET"])
def api_comfy_models():
    base = _comfy_state.get("base_url") or "http://127.0.0.1:8188"
    try:
        r = http_requests.get(f"{base.rstrip('/')}/object_info", timeout=15)
        if not r.ok:
            return jsonify({"error": "object_info failed", "status": r.status_code}), r.status_code
        info = r.json()
        ckpts = []
        try:
            ckpts = info.get("CheckpointLoaderSimple", {}).get("input", {}).get("required", {}).get("ckpt_name", [[]])[0]
        except Exception:
            pass
        return jsonify({"checkpoints": ckpts or [], "object_info_keys": list(info.keys())[:50]})
    except Exception as e:
        return jsonify({"error": str(e)}), 502



# ── xAI (Grok) Full Proxy Routes ──────────────────────────────────────────
@app.route("/api/xai/<path:subpath>", methods=["GET", "POST", "PUT", "DELETE"])
def api_xai_proxy(subpath):
    """Generic proxy to api.x.ai — used for image/video when public endpoints exist."""
    try:
        auth = request.headers.get("Authorization", "")
        if not auth:
            # Accept body/header key
            data = request.get_json(silent=True) or {}
            key = data.get("apiKey") or request.headers.get("X-Grok-Key")
            if key:
                auth = f"Bearer {key}"
        if not auth:
            return jsonify({"error": "Authorization required"}), 401

        url = f"https://api.x.ai/v1/{subpath}"
        if request.query_string:
            url += "?" + request.query_string.decode()

        headers = {
            "Authorization": auth,
            "Content-Type": request.headers.get("Content-Type", "application/json"),
        }

        if request.method == "GET":
            resp = http_requests.get(url, headers=headers, timeout=120)
        elif request.method == "POST":
            resp = http_requests.post(url, headers=headers, data=request.get_data(), timeout=300)
        elif request.method == "PUT":
            resp = http_requests.put(url, headers=headers, data=request.get_data(), timeout=120)
        else:
            resp = http_requests.delete(url, headers=headers, timeout=60)

        return Response(resp.content, status=resp.status_code,
                        content_type=resp.headers.get("Content-Type", "application/json"))
    except Exception as e:
        print(f"[ERROR] xAI proxy: {e}")
        return jsonify({"error": str(e)}), 502


@app.route("/api/xai/fetch-url", methods=["POST"])
def api_xai_fetch_url():
    """Download a temporary xAI media URL server-side (avoids browser CORS)."""
    try:
        auth = request.headers.get("Authorization", "")
        data = request.get_json() or {}
        if not auth:
            key = data.get("apiKey") or request.headers.get("X-Grok-Key")
            if key:
                auth = f"Bearer {key}"
        target = data.get("url")
        if not target:
            return jsonify({"error": "url required"}), 400
        from urllib.parse import urlparse
        host = urlparse(target).hostname or ""
        if not (host.endswith(".x.ai") or host == "x.ai" or "x.ai" in host):
            return jsonify({"error": f"URL host not allowed: {host}"}), 400

        resp = http_requests.get(target, headers={"Authorization": auth} if auth else {}, timeout=600)
        if not resp.ok:
            return jsonify({"error": f"Download failed HTTP {resp.status_code}"}), resp.status_code
        return Response(resp.content, status=200,
                        content_type=resp.headers.get("Content-Type", "application/octet-stream"))
    except Exception as e:
        return jsonify({"error": str(e)}), 502




# ── Music: export track at altered playback speed (atempo) ───────────
@app.route("/api/music/export-speed", methods=["POST"])
def api_music_export_speed():
    """Re-encode audio at a new speed using ffmpeg atempo (0.5–2.0 per stage).
    JSON: { "path": "relative under music library or /music/...", "rate": 1.25, "title": "optional" }
    OR multipart: file + rate field.
    Returns audio/mpeg or audio/wav attachment.
    """
    ff = _resolve_ffmpeg()
    if not ff:
        return jsonify({"error": "ffmpeg not found — cannot export speed-adjusted audio on server"}), 503

    rate = 1.0
    src_path = None
    title = "track"
    tmp_upload = None

    if request.content_type and "multipart/form-data" in request.content_type:
        f = request.files.get("file")
        rate = float(request.form.get("rate") or 1)
        title = Path(f.filename or "track").stem if f else "track"
        if not f:
            return jsonify({"error": "file required"}), 400
        tmp_upload = Path(tempfile.mkdtemp(prefix="as-music-")) / (f.filename or "in.mp3")
        f.save(str(tmp_upload))
        src_path = tmp_upload
    else:
        data = request.get_json(silent=True) or {}
        rate = float(data.get("rate") or 1)
        title = str(data.get("title") or "track")
        rel = str(data.get("path") or data.get("url") or "").lstrip("/")
        # Accept /music/library/x or library/x
        if rel.startswith("music/"):
            rel = rel[len("music/"):]
        candidate = MUSIC_PUBLIC / rel
        if not candidate.exists():
            candidate = MUSIC_LIBRARY / Path(rel).name
        if not candidate.exists() or not candidate.is_file():
            return jsonify({"error": f"Source not found: {rel}"}), 404
        src_path = candidate

    rate = max(0.5, min(2.0, rate))
    if abs(rate - 1.0) < 0.001:
        return jsonify({"error": "Rate is 1.0 — nothing to change. Adjust speed first."}), 400

    # Chain atempo filters (each must be 0.5–2.0)
    filters = []
    remaining = rate
    while remaining > 2.0 + 1e-6:
        filters.append("atempo=2.0")
        remaining /= 2.0
    while remaining < 0.5 - 1e-6:
        filters.append("atempo=0.5")
        remaining /= 0.5
    filters.append(f"atempo={remaining:.6f}")
    af = ",".join(filters)

    out_dir = Path(tempfile.mkdtemp(prefix="as-music-out-"))
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in title)[:80] or "track"
    out_name = f"{safe}_{rate:.2f}x.mp3"
    out_path = out_dir / out_name

    args = [
        ff, "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(src_path),
        "-filter:a", af,
        "-vn",
        "-c:a", "libmp3lame",
        "-q:a", "2",
        str(out_path),
    ]
    try:
        subprocess.run(args, check=True, timeout=300)
        if not out_path.exists() or out_path.stat().st_size == 0:
            raise RuntimeError("ffmpeg produced empty output")
        data = out_path.read_bytes()
        return Response(
            data,
            mimetype="audio/mpeg",
            headers={
                "Content-Disposition": f'attachment; filename="{out_name}"',
                "Content-Length": str(len(data)),
            },
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            if tmp_upload and tmp_upload.parent.exists():
                shutil.rmtree(tmp_upload.parent, ignore_errors=True)
        except Exception:
            pass
        try:
            shutil.rmtree(out_dir, ignore_errors=True)
        except Exception:
            pass


# ── Transparent WebM Export (ffmpeg session API) ──────────────────────────
# Client sends chroma-keyed PNG frames; server packs them into VP9 WebM with alpha.

_export_sessions = {}
FFMPEG_MAX_FRAMES = 2000
SESSION_TTL_MS = 60 * 60 * 1000


def _resolve_ffmpeg():
    path = get_ffmpeg_path()
    return path


@app.route("/api/export/status")
def api_export_status():
    ff = _resolve_ffmpeg()
    version = None
    if ff:
        try:
            out = subprocess.run([ff, "-version"], capture_output=True, text=True, timeout=8)
            version = (out.stdout or "").split("\n")[0]
        except Exception:
            pass
    return jsonify({
        "ffmpeg": bool(ff),
        "path": ff,
        "version": version,
        "maxFrames": FFMPEG_MAX_FRAMES,
        "streaming": True
    })


@app.route("/api/export/session", methods=["POST"])
def api_export_session_create():
    """Create export session. Body optional JSON: { format: 'png'|'rgba', width, height }.
    RGBA mode (Angular 0.4.0 GPU path) streams raw pixels — no PNG double-compression.
    """
    ff = _resolve_ffmpeg()
    if not ff:
        return jsonify({
            "error": "ffmpeg not found. Place ffmpeg in bin/ or install system ffmpeg (auto-download attempted on Windows at startup)."
        }), 503
    data = request.get_json(silent=True) or {}
    fmt = "rgba" if str(data.get("format") or "").lower() == "rgba" else "png"
    width = int(data.get("width") or 0)
    height = int(data.get("height") or 0)
    if fmt == "rgba" and (width < 1 or height < 1 or width > 8192 or height > 8192):
        return jsonify({"error": "RGBA sessions require valid width/height (1–8192)"}), 400
    session_id = uuid.uuid4().hex
    tmp = Path(tempfile.mkdtemp(prefix="as-export-"))
    _export_sessions[session_id] = {
        "dir": tmp, "frames": 0, "created": time.time(),
        "format": fmt, "width": width, "height": height,
    }
    print(f"[EXPORT] Session {session_id} → {tmp} ({fmt}" + (f" {width}x{height}" if fmt == "rgba" else "") + ")")
    return jsonify({
        "sessionId": session_id,
        "maxFrames": FFMPEG_MAX_FRAMES,
        "format": fmt,
        "width": width if fmt == "rgba" else None,
        "height": height if fmt == "rgba" else None,
    })


@app.route("/api/export/session/<session_id>/frame", methods=["POST"])
def api_export_session_frame(session_id):
    session = _export_sessions.get(session_id)
    if not session:
        return jsonify({"error": "Unknown or expired export session"}), 404
    try:
        index = int(request.args.get("index", -1))
    except ValueError:
        return jsonify({"error": "Invalid frame index"}), 400
    if index < 0 or index >= FFMPEG_MAX_FRAMES:
        return jsonify({"error": "Invalid frame index"}), 400

    body = request.get_data()
    if not body:
        return jsonify({"error": "Empty frame body"}), 400

    fmt = session.get("format") or "png"
    if fmt == "rgba":
        expected = int(session.get("width") or 0) * int(session.get("height") or 0) * 4
        if expected and len(body) != expected:
            return jsonify({
                "error": f"RGBA frame size mismatch: got {len(body)}, expected {expected}"
            }), 400
        name = f"frame_{index:05d}.rgba"
    else:
        if len(body) < 8 or body[0] != 0x89 or body[1] != 0x50:
            return jsonify({"error": "Body is not a PNG image"}), 400
        name = f"frame_{index:05d}.png"

    (session["dir"] / name).write_bytes(body)
    session["frames"] = max(session["frames"], index + 1)
    return jsonify({"ok": True, "index": index, "bytes": len(body), "format": fmt})


@app.route("/api/export/session/<session_id>/finalize", methods=["POST"])
def api_export_session_finalize(session_id):
    session = _export_sessions.pop(session_id, None)
    if not session:
        return jsonify({"error": "Unknown or expired export session"}), 404

    ff = _resolve_ffmpeg()
    if not ff:
        shutil.rmtree(session["dir"], ignore_errors=True)
        return jsonify({"error": "ffmpeg not found"}), 503

    data = request.get_json(silent=True) or {}
    fps = max(1, min(120, int(data.get("fps") or 30)))
    frame_count = int(data.get("frameCount") or session["frames"])
    if frame_count < 1:
        shutil.rmtree(session["dir"], ignore_errors=True)
        return jsonify({"error": "No frames in session"}), 400

    export_dir = session["dir"]
    out_path = export_dir / "out.webm"

    fmt = session.get("format") or "png"
    width = int(session.get("width") or 0)
    height = int(session.get("height") or 0)

    # Verify frames exist
    for i in range(frame_count):
        name = f"frame_{i:05d}.rgba" if fmt == "rgba" else f"frame_{i:05d}.png"
        if not (export_dir / name).exists():
            shutil.rmtree(export_dir, ignore_errors=True)
            return jsonify({"error": f"Missing frame {i}"}), 400

    try:
        print(f"[EXPORT] Finalize {session_id}: {frame_count} frames @ {fps}fps ({fmt})")
        if fmt == "rgba":
            # Stream concatenated raw RGBA into ffmpeg stdin (no PNG intermediate)
            expected = width * height * 4
            args = [
                ff, "-y", "-hide_banner", "-loglevel", "error",
                "-f", "rawvideo",
                "-pixel_format", "rgba",
                "-video_size", f"{width}x{height}",
                "-framerate", str(fps),
                "-i", "pipe:0",
                "-frames:v", str(frame_count),
                "-c:v", "libvpx-vp9",
                "-pix_fmt", "yuva420p",
                "-auto-alt-ref", "0",
                "-b:v", "0",
                "-crf", "28",
                "-deadline", "good",
                "-cpu-used", "2",
                "-an",
                str(out_path),
            ]
            proc = subprocess.Popen(args, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
            assert proc.stdin is not None
            for i in range(frame_count):
                buf = (export_dir / f"frame_{i:05d}.rgba").read_bytes()
                if len(buf) != expected:
                    proc.kill()
                    raise RuntimeError(f"RGBA frame {i} size {len(buf)} != {expected}")
                proc.stdin.write(buf)
            proc.stdin.close()
            stderr = proc.stderr.read() if proc.stderr else b""
            code = proc.wait(timeout=600)
            if code != 0:
                raise RuntimeError(f"ffmpeg exited {code}: {stderr[-1500:].decode('utf-8', 'replace')}")
        else:
            args = [
                ff, "-y", "-hide_banner", "-loglevel", "error",
                "-framerate", str(fps),
                "-start_number", "0",
                "-i", str(export_dir / "frame_%05d.png"),
                "-frames:v", str(frame_count),
                "-c:v", "libvpx-vp9",
                "-pix_fmt", "yuva420p",
                "-auto-alt-ref", "0",
                "-b:v", "0",
                "-crf", "28",
                "-deadline", "good",
                "-cpu-used", "2",
                "-an",
                str(out_path),
            ]
            subprocess.run(args, check=True, timeout=600)
        if not out_path.exists() or out_path.stat().st_size == 0:
            raise RuntimeError("ffmpeg produced empty output")

        data_bytes = out_path.read_bytes()
        shutil.rmtree(export_dir, ignore_errors=True)
        return Response(
            data_bytes,
            status=200,
            content_type="video/webm",
            headers={"Content-Disposition": 'attachment; filename="export.webm"'}
        )
    except Exception as e:
        shutil.rmtree(export_dir, ignore_errors=True)
        print(f"[ERROR] Export finalize failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/export/session/<session_id>", methods=["DELETE"])
def api_export_session_delete(session_id):
    session = _export_sessions.pop(session_id, None)
    if session:
        shutil.rmtree(session["dir"], ignore_errors=True)
    return jsonify({"ok": True})



# ── Overlay Backend (models, emotes, assets, tracking stubs) ───────────────
# These routes make the Overlay Control Panel functional.
# Models are scanned from: overlay_public/assets/models/<model_name>/

OVERLAY_ASSETS = OVERLAY_PUBLIC / "assets"
OVERLAY_MODELS_DIR = OVERLAY_ASSETS / "models"

# In-memory state for the Overlay
_overlay_state = {
    "active_model": None,
    "thresholds": {
        "happy": 0.5,
        "sad": 0.5,
        "surprised": 0.5,
        "eyesClosed": 0.4,
        "eyesClosedDelayMs": 200,
        "swapDuration": 80,
        "sfxVolume": 0.7,
        "crossfadeMode": False,
    },
    "tracking": {
        "vts": False,
        "ifacial": False,
    }
}

STATE_NAMES = [
    "neutral_idle", "neutral_speaking",
    "happy_idle", "happy_speaking",
    "sad_idle", "sad_speaking",
    "surprised_idle", "surprised_speaking",
    "typing", "eyes_closed"
]


def _scan_models():
    """Scan overlay_public/assets/models/ for character folders."""
    models = []
    if not OVERLAY_MODELS_DIR.exists():
        OVERLAY_MODELS_DIR.mkdir(parents=True, exist_ok=True)
        return models

    for folder in sorted(OVERLAY_MODELS_DIR.iterdir()):
        if not folder.is_dir():
            continue
        # Count media assets (videos/images)
        assets = list(folder.glob("*.*"))
        media = [a for a in assets if a.suffix.lower() in (
            ".webm", ".mp4", ".png", ".gif", ".webp", ".jpg", ".jpeg"
        )]
        models.append({
            "name": folder.name,
            "assetCount": len(media),
            "path": str(folder.relative_to(OVERLAY_PUBLIC))
        })
    return models


def _get_active_model():
    models = _scan_models()
    if not models:
        return None
    active = _overlay_state.get("active_model")
    names = [m["name"] for m in models]
    if active in names:
        return active
    # Default to first model
    _overlay_state["active_model"] = models[0]["name"]
    return models[0]["name"]


@app.route("/api/models")
def api_models():
    models = _scan_models()
    active = _get_active_model()
    return jsonify({"models": models, "active": active})


@app.route("/api/models/select", methods=["POST"])
def api_models_select():
    data = request.get_json() or {}
    model = data.get("model")
    models = _scan_models()
    names = [m["name"] for m in models]
    if model not in names:
        return jsonify({"error": f"Model '{model}' not found"}), 404
    _overlay_state["active_model"] = model
    print(f"[Overlay] Active model → {model}")
    return jsonify({"ok": True, "active": model})


@app.route("/api/assets")
def api_assets():
    model = request.args.get("model") or _get_active_model()
    result = {state: False for state in STATE_NAMES}
    if not model:
        return jsonify(result)

    model_dir = OVERLAY_MODELS_DIR / model
    if not model_dir.exists():
        return jsonify(result)

    # Mark states that have a matching file (name contains the state key)
    files = [f.stem.lower() for f in model_dir.iterdir() if f.is_file()]
    for state in STATE_NAMES:
        # Accept exact match or common variants
        key = state.lower()
        if any(key in name or name.replace("-", "_") == key for name in files):
            result[state] = True
    return jsonify(result)


@app.route("/api/emotes")
def api_emotes():
    """Return emotes for the active model (looks for an emotes/ subfolder or emote_*.json)."""
    model = _get_active_model()
    emotes = []
    if not model:
        return jsonify(emotes)

    model_dir = OVERLAY_MODELS_DIR / model
    emotes_dir = model_dir / "emotes"
    if emotes_dir.exists():
        for folder in sorted(emotes_dir.iterdir()):
            if folder.is_dir():
                # Type 1 = one-shot, Type 2 = holdable (has idle + speaking)
                has_speaking = any(folder.glob("*speaking*"))
                emotes.append({
                    "name": folder.name,
                    "emoteType": 2 if has_speaking else 1,
                    "files": {}
                })
    return jsonify(emotes)


@app.route("/api/emote/trigger", methods=["POST"])
def api_emote_trigger():
    data = request.get_json() or {}
    name = data.get("name")
    print(f"[Overlay] Emote trigger → {name}")
    # In a full implementation this would broadcast to the overlay WebSocket
    return jsonify({"ok": True, "emote": name, "action": "trigger"})


@app.route("/api/emote/release", methods=["POST"])
def api_emote_release():
    print("[Overlay] Emote release")
    return jsonify({"ok": True, "action": "release"})


@app.route("/api/emote/sub", methods=["POST"])
def api_emote_sub():
    data = request.get_json() or {}
    print(f"[Overlay] Emote sub → {data}")
    return jsonify({"ok": True, "action": "sub"})


@app.route("/api/thresholds", methods=["GET", "POST"])
def api_thresholds():
    if request.method == "POST":
        data = request.get_json() or {}
        _overlay_state["thresholds"].update(data)
        print(f"[Overlay] Thresholds updated → {data}")
        return jsonify({"ok": True, "thresholds": _overlay_state["thresholds"]})
    return jsonify(_overlay_state["thresholds"])


@app.route("/api/connect-vts", methods=["POST"])
def api_connect_vts():
    """Stub for VTube Studio connection. Full tracking requires additional libraries."""
    data = request.get_json() or {}
    _overlay_state["tracking"]["vts"] = True
    print(f"[Overlay] VTS connect requested → {data}")
    return jsonify({
        "ok": True,
        "connected": False,
        "message": "VTube Studio connection is not fully implemented in the Python port yet. Use the original Node version for live tracking, or contribute a VTS plugin."
    })


@app.route("/api/connect-ifacial", methods=["POST"])
def api_connect_ifacial():
    """Stub for iFacialMocap connection."""
    data = request.get_json() or {}
    _overlay_state["tracking"]["ifacial"] = True
    print(f"[Overlay] iFacialMocap connect requested → {data}")
    return jsonify({
        "ok": True,
        "connected": False,
        "message": "iFacialMocap connection is not fully implemented in the Python port yet."
    })


@app.route("/api/overlay/status")
def api_overlay_status():
    return jsonify({
        "active_model": _get_active_model(),
        "models": _scan_models(),
        "thresholds": _overlay_state["thresholds"],
        "tracking": _overlay_state["tracking"]
    })




# ── Overlay WebSocket Server (port 3001) ──────────────────────────────────
# Handles live communication between Control Panel and Overlay browser source.
# Control connects with ?type=control
# Overlay connects with ?type=overlay

_ws_clients = {
    "control": set(),
    "overlay": set(),
}

async def _ws_broadcast(target_type, message: dict):
    """Send a JSON message to all clients of a given type."""
    data = json.dumps(message)
    clients = list(_ws_clients.get(target_type, set()))
    for ws in clients:
        try:
            await ws.send(data)
        except Exception:
            _ws_clients[target_type].discard(ws)


async def _ws_handler(websocket, path=None):
    """Handle a single WebSocket connection."""
    # Compatible with different websockets library versions
    raw = ""
    try:
        if path is not None:
            raw = str(path)
        elif hasattr(websocket, "request") and hasattr(websocket.request, "path"):
            raw = str(websocket.request.path)
            if hasattr(websocket.request, "query_string") and websocket.request.query_string:
                raw += "?" + str(websocket.request.query_string)
        elif hasattr(websocket, "path"):
            raw = str(websocket.path)
    except Exception:
        raw = ""

    client_type = "unknown"
    if "type=control" in raw or "control" in raw:
        client_type = "control"
    elif "type=overlay" in raw or "overlay" in raw:
        client_type = "overlay"

    _ws_clients.setdefault(client_type, set()).add(websocket)
    print(f"[WS] Connected: {client_type} (total control={len(_ws_clients.get('control', []))} overlay={len(_ws_clients.get('overlay', []))})")

    try:
        async for raw_msg in websocket:
            try:
                msg = json.loads(raw_msg)
            except Exception:
                continue

            msg_type = msg.get("type")

            # Relay control → overlay
            if client_type == "control":
                await _ws_broadcast("overlay", msg)
            # Relay overlay → control (status updates etc.)
            elif client_type == "overlay":
                await _ws_broadcast("control", msg)

    except Exception as e:
        print(f"[WS] Connection closed ({client_type}): {e}")
    finally:
        _ws_clients.get(client_type, set()).discard(websocket)
        print(f"[WS] Disconnected: {client_type}")


def _start_ws_server():
    """Start the WebSocket server in a background thread."""
    async def runner():
        import websockets
        # websockets >= 10 uses 'process_request' differently; keep simple
        async with websockets.serve(_ws_handler, "127.0.0.1", 3001, ping_interval=20, ping_timeout=20):
            print("[WS] Overlay WebSocket server running on ws://127.0.0.1:3001")
            await asyncio.Future()  # run forever

    def thread_target():
        try:
            asyncio.run(runner())
        except Exception as e:
            print(f"[WS] WebSocket server failed: {e}")

    t = threading.Thread(target=thread_target, daemon=True)
    t.start()



# ── Landing Page ──────────────────────────────────────────────────────────

# ── Live2D Model & Rigging Suite ──────────────────────────────────────
@app.route("/live2d")
@app.route("/live2d/")
def live2d_index():
    return send_from_directory(LIVE2D_PUBLIC, "index.html")


@app.route("/live2d/<path:filename>")
def live2d_files(filename):
    return send_from_directory(LIVE2D_PUBLIC, filename)


@app.route("/api/live2d/models", methods=["GET"])
def api_live2d_models():
    LIVE2D_MODELS.mkdir(parents=True, exist_ok=True)
    models = sorted([d.name for d in LIVE2D_MODELS.iterdir() if d.is_dir() and not d.name.startswith(".")])
    return jsonify({"models": models})


@app.route("/api/live2d/models/<name>", methods=["GET"])
def api_live2d_model_detail(name):
    folder = LIVE2D_MODELS / name
    if not folder.is_dir():
        return jsonify({"error": "not found"}), 404
    model3 = None
    files = []
    for f in folder.rglob("*"):
        if f.is_file():
            rel = str(f.relative_to(folder)).replace("\\\\", "/")
            files.append(rel)
            if rel.lower().endswith(".model3.json") and model3 is None:
                model3 = rel
    return jsonify({"name": name, "model3": model3, "files": files})



@app.route("/api/live2d/media", methods=["GET"])
def api_live2d_media():
    """List media files dropped into live2d_public/media (Creator exports, etc.)."""
    media_dir = LIVE2D_PUBLIC / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    items = []
    for f in sorted(media_dir.rglob("*"), key=lambda x: x.stat().st_mtime if x.is_file() else 0, reverse=True):
        if not f.is_file():
            continue
        ext = f.suffix.lower()
        if ext not in {".png", ".webp", ".jpg", ".jpeg", ".gif", ".webm", ".mp4", ".mov"}:
            continue
        rel = str(f.relative_to(media_dir)).replace("\\\\", "/")
        items.append({
            "name": f.name,
            "path": rel,
            "url": f"/live2d/media/{rel}",
            "type": "video" if ext in {".webm", ".mp4", ".mov"} else ("gif" if ext == ".gif" else "image"),
            "size": f.stat().st_size,
        })
    return jsonify({"media": items[:100]})


@app.route("/api/live2d/media/upload", methods=["POST"])
def api_live2d_media_upload():
    """Upload a Creator export (PNG/WebM/GIF/MP4) into the Model suite media library."""
    media_dir = LIVE2D_PUBLIC / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "file required"}), 400
    name = Path(f.filename or "asset.bin").name
    ext = Path(name).suffix.lower()
    if ext not in {".png", ".webp", ".jpg", ".jpeg", ".gif", ".webm", ".mp4", ".mov"}:
        return jsonify({"error": "Unsupported type. Use PNG, GIF, WebM, MP4."}), 400
    safe = "".join(c if c.isalnum() or c in "._- " else "_" for c in name)[:120]
    dest = media_dir / safe
    f.save(dest)
    return jsonify({"ok": True, "name": safe, "url": f"/live2d/media/{safe}"})



@app.route("/api/live2d/export/vts", methods=["POST"])
def api_live2d_export_vts():
    """
    Pack a Live2D runtime folder OR a flat texture/video into a VTube Studio–oriented zip.
    Body JSON:
      { "modelFolder": "MyModel" }  — existing live2d_public/models/<name>
      OR { "mediaPath": "file.png" } — from live2d_public/media
      OR multipart file upload with form field file=
    """
    import io
    import json
    import zipfile
    import shutil
    import uuid

    LIVE2D_MODELS.mkdir(parents=True, exist_ok=True)
    media_dir = LIVE2D_PUBLIC / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    export_root = LIVE2D_PUBLIC / "_exports"
    export_root.mkdir(parents=True, exist_ok=True)

    data = request.get_json(silent=True) or {}
    model_folder = (data.get("modelFolder") or data.get("model") or "").strip()
    media_path = (data.get("mediaPath") or data.get("media") or "").strip()
    display_name = (data.get("name") or model_folder or Path(media_path).stem or "DonModel").strip()
    safe_name = "".join(c if c.isalnum() or c in "._- " else "_" for c in display_name)[:64] or "DonModel"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        readme = (
            f"Don's Adventurer — VTube Studio / PrprLive package\n"
            f"Name: {safe_name}\n\n"
            "VTube Studio:\n"
            "  1. Unzip this folder into your VTube Studio Models directory\n"
            "     (Steam) .../VTube Studio/Live2DModels/\n"
            "  2. If .moc3 + .model3.json are present, open as Live2D model\n"
            "  3. If only textures/ are present, use as PNGTuber/item source or\n"
            "     import textures into Cubism → Export for Runtime for full Live2D\n\n"
            "PrprLive:\n"
            "  Import the folder as a Live2D model if moc3 exists, or use textures\n"
            "  as image-model / expression sheets.\n\n"
            "Generated by Don's Adventurer Model Suite\n"
        )
        zf.writestr(f"{safe_name}/README_VTS_PRPRLIVE.txt", readme)

        # Case 1: full Live2D folder
        if model_folder:
            src = LIVE2D_MODELS / model_folder
            if not src.is_dir():
                return jsonify({"error": f"Model folder not found: {model_folder}"}), 404
            model3_rel = None
            for f in src.rglob("*"):
                if not f.is_file():
                    continue
                rel = str(f.relative_to(src)).replace("\\\\", "/")
                zf.write(f, f"{safe_name}/{rel}")
                if rel.lower().endswith(".model3.json") and model3_rel is None:
                    model3_rel = rel
            vtube = {
                "Version": 1,
                "Name": safe_name,
                "ModelID": str(uuid.uuid4()),
                "FileReferences": {
                    "Model": model3_rel or "model.model3.json",
                },
                "ModelFPS": 30,
                "TapActions": [],
                "Hotkeys": [],
                "Note": "Generated by Don's Adventurer for VTube Studio",
            }
            zf.writestr(f"{safe_name}/{safe_name}.vtube.json", json.dumps(vtube, indent=2))
            # PrprLive hint file
            zf.writestr(
                f"{safe_name}/prprlive_import.txt",
                "Open PrprLive → Add Model → select this folder's .model3.json (if present).\n",
            )

        # Case 2: single media file (Creator export)
        elif media_path:
            src = (media_dir / media_path).resolve()
            if not str(src).startswith(str(media_dir.resolve())) or not src.is_file():
                return jsonify({"error": f"Media not found: {media_path}"}), 404
            ext = src.suffix.lower()
            # textures
            if ext in {".png", ".webp", ".jpg", ".jpeg", ".gif"}:
                zf.write(src, f"{safe_name}/textures/texture_00{ext if ext != '.jpeg' else '.jpg'}")
            elif ext in {".webm", ".mp4", ".mov"}:
                # Copy video + try extract a PNG poster frame with ffmpeg
                zf.write(src, f"{safe_name}/textures/source{ext}")
                try:
                    import subprocess, tempfile
                    poster = export_root / f"{safe_name}_poster.png"
                    ff = None
                    for c in [
                        APP_DIR / "creator_public" / "bin" / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg"),
                        APP_DIR / "bin" / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg"),
                        "ffmpeg",
                    ]:
                        if c == "ffmpeg" or Path(c).exists():
                            ff = str(c)
                            break
                    if ff:
                        subprocess.run(
                            [ff, "-y", "-i", str(src), "-vframes", "1", str(poster)],
                            capture_output=True,
                            timeout=60,
                        )
                        if poster.exists():
                            zf.write(poster, f"{safe_name}/textures/texture_00.png")
                            try:
                                poster.unlink()
                            except Exception:
                                pass
                except Exception as e:
                    zf.writestr(f"{safe_name}/textures/EXTRACT_NOTE.txt", f"ffmpeg poster failed: {e}\n")
            else:
                return jsonify({"error": "Unsupported media type"}), 400

            # Texture-only package manifest (not a full Live2D model)
            manifest = {
                "type": "texture_pack",
                "name": safe_name,
                "target": ["VTubeStudio", "PrprLive", "CubismImport"],
                "note": "No .moc3 included. Import texture into Cubism or use as PNGTuber sheet.",
                "textures": ["textures/texture_00.png"],
            }
            zf.writestr(f"{safe_name}/don_texture_pack.json", json.dumps(manifest, indent=2))
            zf.writestr(
                f"{safe_name}/{safe_name}.vtube.json",
                json.dumps(
                    {
                        "Version": 1,
                        "Name": safe_name,
                        "ModelID": str(uuid.uuid4()),
                        "FileReferences": {"Model": None, "TexturesOnly": True},
                        "Note": "Texture pack from Creator export — not a full Live2D .moc3 model.",
                    },
                    indent=2,
                ),
            )
        else:
            return jsonify({"error": "Provide modelFolder or mediaPath"}), 400

    buf.seek(0)
    return send_file(
        buf,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"{safe_name}_VTS_PrprLive.zip",
    )


@app.route("/api/live2d/export/frames", methods=["POST"])
def api_live2d_export_frames():
    """Extract PNG frames from a media video into a zip (for Cubism / VTS expression sheets)."""
    import io
    import zipfile
    import subprocess
    import tempfile
    import shutil

    data = request.get_json(silent=True) or {}
    media_path = (data.get("mediaPath") or "").strip()
    if not media_path:
        return jsonify({"error": "mediaPath required"}), 400
    media_dir = LIVE2D_PUBLIC / "media"
    src = (media_dir / media_path).resolve()
    if not str(src).startswith(str(media_dir.resolve())) or not src.is_file():
        return jsonify({"error": "Media not found"}), 404
    if src.suffix.lower() not in {".webm", ".mp4", ".mov", ".gif"}:
        return jsonify({"error": "Frame extract needs video/gif"}), 400

    ff = None
    for c in [
        APP_DIR / "creator_public" / "bin" / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg"),
        APP_DIR / "bin" / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg"),
        "ffmpeg",
    ]:
        if c == "ffmpeg" or Path(c).exists():
            ff = str(c)
            break
    if not ff:
        return jsonify({"error": "ffmpeg not found"}), 503

    tmp = Path(tempfile.mkdtemp(prefix="don-frames-"))
    try:
        pattern = str(tmp / "frame_%04d.png")
        # Cap fps to keep package small
        fps = float(data.get("fps") or 8)
        fps = max(1.0, min(fps, 15.0))
        r = subprocess.run(
            [ff, "-y", "-i", str(src), "-vf", f"fps={fps}", pattern],
            capture_output=True,
            timeout=180,
        )
        frames = sorted(tmp.glob("frame_*.png"))
        if not frames:
            return jsonify({"error": "No frames extracted", "stderr": (r.stderr or b"")[-500:].decode("utf-8", "ignore")}), 500
        # Limit frames
        max_frames = int(data.get("maxFrames") or 60)
        frames = frames[:max_frames]
        buf = io.BytesIO()
        name = src.stem
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, f in enumerate(frames):
                zf.write(f, f"{name}_frames/frame_{i:04d}.png")
            zf.writestr(
                f"{name}_frames/README.txt",
                "Import these frames into Live2D Cubism as textures/expression sheets,\n"
                "or use as VTS/PrprLive PNGTuber states (idle/talk variants).\n",
            )
        buf.seek(0)
        return send_file(buf, mimetype="application/zip", as_attachment=True, download_name=f"{name}_frames.zip")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


@app.route("/api/live2d/upload", methods=["POST"])
def api_live2d_upload():
    """Accept a zip of a runtime Live2D package and extract under live2d_public/models/."""
    import zipfile
    import re
    LIVE2D_MODELS.mkdir(parents=True, exist_ok=True)
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "file required"}), 400
    raw_name = f.filename or "model.zip"
    if not raw_name.lower().endswith(".zip"):
        return jsonify({"error": "Only .zip packages are accepted for upload"}), 400
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "_", Path(raw_name).stem)[:64] or "model"
    dest = LIVE2D_MODELS / safe
    dest.mkdir(parents=True, exist_ok=True)
    tmp = LIVE2D_MODELS / (safe + "_upload.zip")
    f.save(tmp)
    try:
        with zipfile.ZipFile(tmp, "r") as zf:
            # Block path traversal
            for info in zf.infolist():
                target = (dest / info.filename).resolve()
                if not str(target).startswith(str(dest.resolve())):
                    return jsonify({"error": "Illegal path in zip"}), 400
            zf.extractall(dest)
    finally:
        try:
            tmp.unlink()
        except Exception:
            pass
    # If zip contained a single top-level folder, that's fine
    return jsonify({"ok": True, "name": safe, "path": safe})



# ── Music & Audio Workspace ───────────────────────────────────────────
@app.route("/music")
def music_index():
    return send_from_directory(MUSIC_PUBLIC, "index.html")


@app.route("/music/<path:filename>")
def music_files(filename):
    return send_from_directory(MUSIC_PUBLIC, filename)


@app.route("/shared/<path:filename>")
def shared_files(filename):
    return send_from_directory(SHARED_PUBLIC, filename)


@app.route("/api/music/library", methods=["GET"])
def api_music_library():
    MUSIC_LIBRARY.mkdir(parents=True, exist_ok=True)
    tracks = []
    for f in sorted(MUSIC_LIBRARY.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if not f.is_file():
            continue
        if f.suffix.lower() not in {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".webm"}:
            continue
        tracks.append({
            "id": f.stem,
            "title": f.stem.replace("_", " "),
            "url": f"/music/library/{f.name}",
            "name": f.name,
            "size": f.stat().st_size,
        })
    return jsonify({"tracks": tracks})



@app.route("/api/music/delete", methods=["POST"])
def api_music_delete():
    data = request.get_json(silent=True) or {}
    name = data.get("name") or data.get("id")
    if not name:
        return jsonify({"error": "name required"}), 400
    MUSIC_LIBRARY.mkdir(parents=True, exist_ok=True)
    # match by stem or full name
    target = None
    for f in MUSIC_LIBRARY.iterdir():
        if not f.is_file():
            continue
        if f.name == name or f.stem == name or f.stem == Path(str(name)).stem:
            target = f
            break
    if not target:
        return jsonify({"error": "not found"}), 404
    try:
        target.unlink()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/music/upload", methods=["POST"])
def api_music_upload():
    MUSIC_LIBRARY.mkdir(parents=True, exist_ok=True)
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "file required"}), 400
    name = Path(f.filename or "track.wav").name
    safe = "".join(c if c.isalnum() or c in "._- " else "_" for c in name)[:120]
    if not Path(safe).suffix:
        safe += ".wav"
    dest = MUSIC_LIBRARY / safe
    # avoid overwrite
    if dest.exists():
        dest = MUSIC_LIBRARY / f"{dest.stem}_{int(time.time())}{dest.suffix}"
    f.save(dest)
    return jsonify({
        "ok": True,
        "id": dest.stem,
        "title": dest.stem.replace("_", " "),
        "url": f"/music/library/{dest.name}",
        "name": dest.name,
    })


@app.route("/api/music/import-url", methods=["POST"])
def api_music_import_url():
    """Download remote audio (e.g. Suno CDN) into the library."""
    MUSIC_LIBRARY.mkdir(parents=True, exist_ok=True)
    data = request.get_json(silent=True) or {}
    url = data.get("url")
    title = (data.get("title") or "suno_track").strip()
    if not url:
        return jsonify({"error": "url required"}), 400
    try:
        r = http_requests.get(url, timeout=120, stream=True)
        if not r.ok:
            return jsonify({"error": f"download failed: {r.status_code}"}), 502
        ext = ".mp3"
        ct = (r.headers.get("content-type") or "").lower()
        if "wav" in ct:
            ext = ".wav"
        elif "ogg" in ct:
            ext = ".ogg"
        safe = "".join(c if c.isalnum() or c in "._- " else "_" for c in title)[:80] or "track"
        dest = MUSIC_LIBRARY / f"{safe}_{int(time.time())}{ext}"
        with open(dest, "wb") as out:
            for chunk in r.iter_content(65536):
                if chunk:
                    out.write(chunk)
        return jsonify({
            "ok": True,
            "id": dest.stem,
            "title": title,
            "url": f"/music/library/{dest.name}",
            "name": dest.name,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/suno/generate", methods=["POST"])
@app.route("/api/suno/custom_generate", methods=["POST"])
def api_suno_generate():
    """Proxy Suno-compatible generate endpoints. Base URL + key from headers."""
    key = request.headers.get("X-Suno-Key") or ""
    base = (request.headers.get("X-Suno-Base") or "").rstrip("/")
    if not key:
        return jsonify({"error": "Suno API key not set (Settings in Music workspace)"}), 401
    if not base:
        return jsonify({"error": "Suno API base URL not set"}), 400
    path = "/api/custom_generate" if request.path.endswith("custom_generate") else "/api/generate"
    # Some providers use /generate without /api prefix — try configured base as-is
    url = base + path
    alt = base + path.replace("/api", "")
    body = request.get_json(silent=True) or {}
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    # Also send common alternate header
    headers["X-API-Key"] = key
    try:
        resp = http_requests.post(url, headers=headers, json=body, timeout=120)
        if resp.status_code == 404:
            resp = http_requests.post(alt, headers=headers, json=body, timeout=120)
        return Response(resp.content, status=resp.status_code, content_type=resp.headers.get("content-type", "application/json"))
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/suno/feed", methods=["GET", "POST"])
def api_suno_feed():
    key = request.headers.get("X-Suno-Key") or ""
    base = (request.headers.get("X-Suno-Base") or "").rstrip("/")
    if not key or not base:
        return jsonify({"error": "Suno key/base required"}), 400
    ids = request.args.get("ids") or (request.get_json(silent=True) or {}).get("ids") or ""
    headers = {"Authorization": f"Bearer {key}", "X-API-Key": key, "Accept": "application/json"}
    urls = [
        f"{base}/api/get?ids={ids}",
        f"{base}/api/feed?ids={ids}",
        f"{base}/get?ids={ids}",
    ]
    last_err = None
    for url in urls:
        try:
            resp = http_requests.get(url, headers=headers, timeout=60)
            if resp.ok or resp.status_code != 404:
                return Response(resp.content, status=resp.status_code, content_type="application/json")
        except Exception as e:
            last_err = e
    return jsonify({"error": str(last_err or "feed failed")}), 502



# ── AnimeGen T2V (AideaLab / Wan 2.2) ─────────────────────────────────
_animegen_jobs = {}



@app.route("/tetris")
def tetris_index():
    return send_from_directory(APP_DIR / "tetris_public", "index.html")

@app.route("/tetris/<path:filename>")
def tetris_files(filename):
    return send_from_directory(APP_DIR / "tetris_public", filename)

@app.route("/animegen")
@app.route("/animegen/")
def animegen_index():
    return send_from_directory(ANIMEGEN_PUBLIC, "index.html")


@app.route("/animegen/<path:filename>")
def animegen_files(filename):
    return send_from_directory(ANIMEGEN_PUBLIC, filename)


@app.route("/api/animegen/status", methods=["GET"])
def api_animegen_status():
    ANIMEGEN_MODELS.mkdir(parents=True, exist_ok=True)
    ANIMEGEN_OUTPUTS.mkdir(parents=True, exist_ok=True)
    high = (ANIMEGEN_MODELS / "high_noise.safetensors").exists()
    low = (ANIMEGEN_MODELS / "low_noise.safetensors").exists()
    diffusers_ok = False
    cuda = False
    try:
        import torch  # noqa: F401
        import diffusers  # noqa: F401
        diffusers_ok = True
        import torch as _t
        cuda = bool(_t.cuda.is_available())
    except Exception:
        pass
    comfy = {"available": False}
    try:
        r = http_requests.get("http://127.0.0.1:8188/system_stats", timeout=1.5)
        comfy = {"available": r.ok}
    except Exception:
        pass
    return jsonify({
        "diffusers_available": diffusers_ok,
        "cuda": cuda,
        "weights_ready": high and low,
        "high_noise": high,
        "low_noise": low,
        "comfyui": comfy,
        "model_card": "https://huggingface.co/aidealab/AnimeGen-T2V",
        "note": "AnimeGen-T2V (AideaLab). Prefer Japanese prompts. ComfyUI Wan workflow recommended for most users.",
    })


@app.route("/api/animegen/outputs", methods=["GET"])
def api_animegen_outputs():
    ANIMEGEN_OUTPUTS.mkdir(parents=True, exist_ok=True)
    items = []
    for f in sorted(ANIMEGEN_OUTPUTS.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.suffix.lower() in {".mp4", ".webm", ".gif"}:
            items.append({
                "name": f.name,
                "url": f"/animegen/outputs/{f.name}",
                "size": f.stat().st_size,
            })
    return jsonify({"outputs": items[:50]})


@app.route("/api/animegen/generate", methods=["POST"])
def api_animegen_generate():
    data = request.get_json(silent=True) or {}
    backend = (data.get("backend") or "comfyui").lower()
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "prompt required"}), 400
    job_id = str(uuid.uuid4())[:12]
    job = {
        "id": job_id,
        "status": "queued",
        "progress": 0.05,
        "message": "queued",
        "url": None,
        "backend": backend,
        "params": data,
    }
    _animegen_jobs[job_id] = job

    def run_job():
        try:
            job["status"] = "running"
            job["message"] = "starting"
            job["progress"] = 0.1
            if backend == "diffusers":
                _run_animegen_diffusers(job)
            else:
                _run_animegen_comfy(job)
        except Exception as e:
            job["status"] = "error"
            job["message"] = str(e)
            job["progress"] = 0

    threading.Thread(target=run_job, daemon=True).start()
    return jsonify({
        "job_id": job_id,
        "message": "Job started. Poll /api/animegen/job/<id>. Diffusers needs CUDA + weights; ComfyUI needs Wan/AnimeGen graph.",
    })


@app.route("/api/animegen/job/<job_id>", methods=["GET"])
def api_animegen_job(job_id):
    job = _animegen_jobs.get(job_id)
    if not job:
        return jsonify({"error": "unknown job"}), 404
    return jsonify(job)


@app.route("/api/animegen/cancel/<job_id>", methods=["POST"])
def api_animegen_cancel(job_id):
    job = _animegen_jobs.get(job_id)
    if not job:
        return jsonify({"error": "unknown job"}), 404
    if job["status"] in ("done", "error"):
        return jsonify(job)
    job["status"] = "cancelled"
    job["message"] = "cancelled"
    return jsonify(job)


def _run_animegen_comfy(job):
    """Submit a minimal API prompt to ComfyUI. Users should load a Wan/AnimeGen workflow;
    we try a text-encoded queue and save output path when possible."""
    params = job.get("params") or {}
    base = (params.get("comfy_url") or "http://127.0.0.1:8188").rstrip("/")
    job["message"] = "checking ComfyUI"
    try:
        r = http_requests.get(f"{base}/system_stats", timeout=3)
        if not r.ok:
            raise RuntimeError("ComfyUI not reachable at " + base)
    except Exception as e:
        raise RuntimeError(
            f"ComfyUI offline ({e}). Start ComfyUI with Wan 2.2 + AnimeGen high/low noise weights, "
            "or switch backend to Diffusers if you have CUDA and model files."
        ) from e

    job["progress"] = 0.2
    job["message"] = (
        "ComfyUI is online. Open your Wan/AnimeGen workflow in ComfyUI, set the prompt to the text below, and Queue Prompt. "
        "This suite cannot inject a full A14B graph automatically without your node setup."
    )
    # Store prompt helper file for the user
    ANIMEGEN_OUTPUTS.mkdir(parents=True, exist_ok=True)
    tip = ANIMEGEN_OUTPUTS / f"prompt_{job['id']}.txt"
    tip.write_text(
        f"PROMPT:\n{params.get('prompt','')}\n\nNEGATIVE:\n{params.get('negative_prompt','')}\n\n"
        f"size={params.get('width')}x{params.get('height')} secs={params.get('seconds')} "
        f"seed={params.get('seed')} steps={params.get('steps')} cfg={params.get('guidance_scale')}\n",
        encoding="utf-8",
    )
    # Try to detect new mp4 in Comfy output or our outputs folder for a short window
    job["progress"] = 0.35
    job["message"] = "Waiting for you to queue in ComfyUI… (watching animegen_public/outputs for new mp4)"
    deadline = time.time() + 600
    seen = {f.name for f in ANIMEGEN_OUTPUTS.glob("*.mp4")}
    while time.time() < deadline:
        if job["status"] == "cancelled":
            return
        time.sleep(3)
        job["progress"] = min(0.9, job["progress"] + 0.02)
        for f in ANIMEGEN_OUTPUTS.glob("*.mp4"):
            if f.name not in seen:
                job["status"] = "done"
                job["progress"] = 1
                job["url"] = f"/animegen/outputs/{f.name}"
                job["message"] = "found " + f.name
                return
    job["status"] = "error"
    job["message"] = (
        "Timed out waiting for output. Export your ComfyUI video into animegen_public/outputs/ "
        "or use Diffusers backend with high_noise.safetensors + low_noise.safetensors in animegen_public/models/."
    )


def _run_animegen_diffusers(job):
    params = job.get("params") or {}
    ANIMEGEN_MODELS.mkdir(parents=True, exist_ok=True)
    ANIMEGEN_OUTPUTS.mkdir(parents=True, exist_ok=True)
    high = ANIMEGEN_MODELS / "high_noise.safetensors"
    low = ANIMEGEN_MODELS / "low_noise.safetensors"
    if not high.exists() or not low.exists():
        raise RuntimeError(
            "Missing high_noise.safetensors / low_noise.safetensors in animegen_public/models/. "
            "Download from https://huggingface.co/aidealab/AnimeGen-T2V"
        )
    try:
        import torch
        from diffusers import (
            WanPipeline,
            WanTransformer3DModel,
            FlowMatchEulerDiscreteScheduler,
            AutoencoderKLWan,
        )
        from diffusers.utils import export_to_video
    except Exception as e:
        raise RuntimeError(
            "Diffusers stack not installed. pip install torch torchvision diffusers transformers "
            f"accelerate peft imageio imageio-ffmpeg safetensors — detail: {e}"
        ) from e

    if not torch.cuda.is_available():
        job["message"] = "Warning: no CUDA — will be very slow or fail"
    job["progress"] = 0.15
    job["message"] = "loading Wan / AnimeGen weights (first run is slow)"

    width = int(params.get("width") or 832)
    height = int(params.get("height") or 480)
    secs = int(params.get("seconds") or 5)
    steps = int(params.get("steps") or 8)
    seed = int(params.get("seed") or 42)
    cfg = float(params.get("guidance_scale") or 1.0)
    prompt = params.get("prompt") or ""
    neg = params.get("negative_prompt") or "3d, cg, photo, stop, wait"

    scheduler = FlowMatchEulerDiscreteScheduler(shift=3.0)
    transformer_high = WanTransformer3DModel.from_single_file(str(high), torch_dtype=torch.bfloat16)
    transformer_low = WanTransformer3DModel.from_single_file(str(low), torch_dtype=torch.bfloat16)
    job["progress"] = 0.35
    job["message"] = "loading VAE + pipeline"
    vae = AutoencoderKLWan.from_pretrained(
        "Wan-AI/Wan2.2-T2V-A14B-Diffusers", subfolder="vae", torch_dtype=torch.float32
    )
    pipe = WanPipeline.from_pretrained(
        "Wan-AI/Wan2.2-T2V-A14B-Diffusers",
        transformer=transformer_high,
        transformer_2=transformer_low,
        scheduler=scheduler,
        vae=vae,
        torch_dtype=torch.bfloat16,
    )
    try:
        pipe.load_lora_weights(
            "lightx2v/Wan2.2-Lightning",
            weight_name="Wan2.2-T2V-A14B-4steps-lora-250928/high_noise_model.safetensors",
            adapter_name="high",
        )
        pipe.load_lora_weights(
            "lightx2v/Wan2.2-Lightning",
            weight_name="Wan2.2-T2V-A14B-4steps-lora-250928/low_noise_model.safetensors",
            adapter_name="low",
            load_into_transformer_2=True,
        )
        pipe.set_adapters(["high", "low"], adapter_weights=[2.0, 1.0])
    except Exception as e:
        job["message"] = f"LoRA optional skip: {e}"
    try:
        transformer_high.enable_layerwise_casting(
            storage_dtype=torch.float8_e4m3fn, compute_dtype=torch.bfloat16
        )
        transformer_low.enable_layerwise_casting(
            storage_dtype=torch.float8_e4m3fn, compute_dtype=torch.bfloat16
        )
    except Exception:
        pass
    try:
        pipe.enable_model_cpu_offload()
    except Exception:
        pass

    job["progress"] = 0.5
    job["message"] = "generating frames"
    if job["status"] == "cancelled":
        return
    generator = torch.Generator("cuda" if torch.cuda.is_available() else "cpu").manual_seed(seed)
    output = pipe(
        prompt=prompt,
        negative_prompt=neg,
        height=height,
        width=width,
        num_frames=int(16 * secs + 1),
        guidance_scale=cfg,
        num_inference_steps=steps,
        generator=generator,
    ).frames[0]
    job["progress"] = 0.9
    job["message"] = "exporting mp4"
    out_path = ANIMEGEN_OUTPUTS / f"animegen_{job['id']}.mp4"
    export_to_video(output, str(out_path), fps=16)
    job["status"] = "done"
    job["progress"] = 1
    job["url"] = f"/animegen/outputs/{out_path.name}"
    job["message"] = "done"


@app.route("/")
def landing():
    html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>⚔️ Don's Adventurer</title>
        <style>
            :root, [data-theme="don"] {
                --bg-deep: #030303;
                --bg-panel: #0a0a0a;
                --accent: #c9a227;
                --accent-2: #8b2942;
                --accent-glow: rgba(201, 162, 39, 0.4);
                --text: #e6dcc8;
                --text-muted: #9a8b6a;
                --card-border: rgba(201, 162, 39, 0.28);
                --bg-image: radial-gradient(ellipse at 50% 0%, rgba(107,28,35,0.18) 0%, transparent 50%), #030303;
            }
            /* Leaflit / AIMancer — blue mage, red cape, library night */
            [data-theme="leaflit"] {
                --bg-deep: #0a1020;
                --bg-panel: rgba(18, 28, 52, 0.92);
                --accent: #5b9fff;
                --accent-2: #e23d4f;
                --accent-glow: rgba(91, 159, 255, 0.45);
                --text: #e8f0ff;
                --text-muted: #9bb0d0;
                --card-border: rgba(91, 159, 255, 0.35);
                --bg-image:
                    radial-gradient(ellipse at 80% 10%, rgba(70, 120, 255, 0.25) 0%, transparent 45%),
                    radial-gradient(ellipse at 20% 90%, rgba(226, 61, 79, 0.15) 0%, transparent 40%),
                    linear-gradient(165deg, #0a1020 0%, #121c34 50%, #0d1528 100%);
            }
            [data-theme="ooz"] {
                --bg-deep: #07141c;
                --bg-panel: rgba(12, 30, 40, 0.94);
                --accent: #2ad4e8;
                --accent-2: #ff2d7a;
                --accent-glow: rgba(42, 212, 232, 0.4);
                --text: #e8fbff;
                --text-muted: #7ab0bc;
                --card-border: rgba(42, 212, 232, 0.35);
                --bg-image:
                    radial-gradient(ellipse at 70% 20%, rgba(42,212,232,0.2) 0%, transparent 45%),
                    radial-gradient(ellipse at 20% 80%, rgba(255,45,122,0.15) 0%, transparent 40%),
                    #07141c;
            }
            [data-theme="original"] {
                --bg-deep: #120a1c;
                --bg-panel: rgba(28, 18, 40, 0.95);
                --accent: #d4af37;
                --accent-2: #9b59b6;
                --accent-glow: rgba(212, 175, 55, 0.4);
                --text: #f5e6ff;
                --text-muted: #b8a0c8;
                --card-border: rgba(155, 89, 182, 0.4);
                --bg-image: radial-gradient(ellipse at 50% 0%, rgba(155,89,182,0.22) 0%, transparent 50%),
                    radial-gradient(ellipse at 80% 80%, rgba(212,175,55,0.12) 0%, transparent 40%), #120a1c;
            }
            body {
                background: var(--bg-image);
                color: var(--text);
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                margin: 0;
                padding: 40px 20px;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.35s ease, color 0.25s ease;
            }
            .corner {
                position: fixed;
                top: 14px;
                right: 14px;
                z-index: 100;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 8px;
                max-width: min(320px, 92vw);
            }
            .corner-box {
                background: var(--bg-panel);
                border: 1px solid var(--card-border);
                border-radius: 12px;
                padding: 10px 12px;
                box-shadow: 0 8px 28px rgba(0,0,0,0.45);
                backdrop-filter: blur(10px);
            }
            .corner-title {
                font-size: 0.7rem;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                color: var(--text-muted);
                margin-bottom: 6px;
            }
            .theme-row { display: flex; gap: 6px; flex-wrap: wrap; }
            .theme-btn {
                border: 1px solid var(--card-border);
                background: transparent;
                color: var(--text);
                border-radius: 999px;
                padding: 5px 10px;
                font-size: 0.78rem;
                cursor: pointer;
            }
            .theme-btn.active {
                background: var(--accent);
                color: #0a0a0a;
                border-color: transparent;
                font-weight: 600;
            }
            .api-links { display: flex; flex-direction: column; gap: 4px; }
            .api-links a {
                color: var(--accent);
                text-decoration: none;
                font-size: 0.82rem;
                padding: 4px 0;
            }
            .api-links a:hover { text-decoration: underline; color: var(--text); }
            .container {
                max-width: 960px;
                width: 100%;
                text-align: center;
            }
            .logo {
                font-size: 3rem;
                font-weight: 700;
                color: var(--accent);
                margin-bottom: 8px;
                text-shadow: 0 0 22px var(--accent-glow);
            }
            .subtitle { font-size: 1.05rem; color: var(--text-muted); margin-bottom: 6px; }
            .tagline { font-size: 1.2rem; margin-bottom: 36px; font-weight: 500; }
            .cards {
                display: flex;
                gap: 20px;
                justify-content: center;
                flex-wrap: wrap;
                margin-bottom: 40px;
            }
            .card {
                background: var(--bg-panel);
                border: 1px solid var(--card-border);
                border-radius: 12px;
                padding: 28px 24px;
                width: 260px;
                text-decoration: none;
                color: var(--text);
                transition: all 0.2s ease;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                text-align: left;
            }
            .card:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 28px rgba(0,0,0,0.45), 0 0 20px var(--accent-glow);
                border-color: var(--accent);
            }
            .card-icon { font-size: 1.8rem; margin-bottom: 8px; }
            .card-title { font-size: 1.15rem; font-weight: 600; color: var(--accent); margin-bottom: 8px; }
            .card-desc { font-size: 0.88rem; color: var(--text-muted); line-height: 1.45; }
            .credit { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px; line-height: 1.6; }
            .footer { color: var(--text-muted); font-size: 0.8rem; }
            .footer a { color: var(--accent); }
        </style>
    </head>
    <body data-theme="don">
        <div class="corner">
            <div class="corner-box">
                <div class="corner-title">Theme</div>
                <div class="theme-row">
                    <button type="button" class="theme-btn active" data-theme-set="don">Don (Gold)</button>
                    <button type="button" class="theme-btn" data-theme-set="leaflit">Leaflit</button>
                    <button type="button" class="theme-btn" data-theme-set="ooz">Ooz</button>
                    <button type="button" class="theme-btn" data-theme-set="original">Original (Purple/Gold)</button>
                </div>
            </div>
            <div class="corner-box">
                <div class="corner-title">Get API keys</div>
                <div class="api-links">
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">ChatGPT / OpenAI →</a>
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Gemini (Google AI) →</a>
                    <a href="https://console.x.ai/" target="_blank" rel="noopener">Grok (xAI) →</a>
                </div>
            </div>
        </div>

        <div class="container">
            <div class="logo">⚔️ Don's Adventurer</div>
            <div class="subtitle">Angel's Sword Studios · Combined Python Edition</div>
            <div class="tagline">Overlay · Creator · Live2D · Music · AnimeGen · Tetris</div>


            <div class="cards">
                <a href="/overlay" class="card">
                    <div class="card-icon">🎮</div>
                    <div class="card-title">Overlay</div>
                    <div class="card-desc">Real-time reactive streaming overlay with face tracking, expression detection, and emotes.</div>
                </a>
                <a href="/creator" class="card">
                    <div class="card-icon">🎨</div>
                    <div class="card-title">Creator</div>
                    <div class="card-desc">Sprite Prep → AI Video → <strong>Video Prep</strong> → Transparent Export. Full VTuber asset pipeline.</div>
                </a>
                <a href="/live2d" class="card">
                    <div class="card-icon">🎭</div>
                    <div class="card-title">Model &amp; Rigging Suite</div>
                    <div class="card-desc">Live2D runtime viewer + Creator PNG/WebM media. Parameters, motions, presets.</div>
                </a>
                <a href="/music" class="card">
                    <div class="card-icon">🎵</div>
                    <div class="card-title">Music &amp; Audio</div>
                    <div class="card-desc">Suno generation, library, trim/fade, global BGM across the whole app.</div>
                </a>
                <a href="/animegen" class="card">
                    <div class="card-icon">🌸</div>
                    <div class="card-title">AnimeGen T2V</div>
                    <div class="card-desc">AideaLab anime video (Wan 2.2). ComfyUI or local Diffusers for loops &amp; transitions.</div>
                </a>
                <a href="/tetris" class="card">
                    <div class="card-icon">🧱</div>
                    <div class="card-title">Tetris</div>
                    <div class="card-desc">Playable classic Tetris. Block colors follow your active theme (Don / Leaflit / Ooz / Original).</div>
                </a>
            </div>

            <div class="credit">
                Made by <strong>TheDonOfEverything</strong> aka <strong>Paul Conforti</strong><br>
                Original by <strong>Leaflit</strong> • Angular <strong>0.4.0</strong> by <strong>OOzeClues</strong> • Python by <strong>TheDonOfEverything</strong><br>
                Angel's Sword Studios • 2026
            </div>
            <div class="footer">
                Everything runs locally • Gemini • Grok • OpenAI • ComfyUI<br>
                <a href="/health">Health</a> ·
                <a href="/api/export/status">Export</a> ·
                <a href="/api/comfy/status">ComfyUI</a> ·
                <a href="/api/ffmpeg/status">ffmpeg</a>
            </div>
        </div>
        <script src="/shared/theme-nav.js"></script>
        <script src="/shared/global-player.js"></script>
        <script>
          (function () {
            function apply(theme) {
              if (window.__ASTheme) window.__ASTheme.set(theme);
              else {
                document.documentElement.setAttribute('data-theme', theme);
                document.body.setAttribute('data-theme', theme);
                localStorage.setItem('as_menu_theme', theme);
              }
              document.querySelectorAll('[data-theme-set]').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-theme-set') === theme);
              });
            }
            const saved = localStorage.getItem('as_menu_theme') || 'don';
            apply(saved);
            document.querySelectorAll('[data-theme-set]').forEach(btn => {
              btn.addEventListener('click', () => apply(btn.getAttribute('data-theme-set')));
            });
          })();
        </script>
    </body>
    </html>
    """
    return html




# ── Overlay Routes ────────────────────────────────────────────────────────
@app.route("/overlay")
def overlay_index():
    return send_from_directory(OVERLAY_PUBLIC, "index.html")

@app.route("/overlay/<path:filename>")
def overlay_files(filename):
    return send_from_directory(OVERLAY_PUBLIC, filename)

# ── Creator Routes ────────────────────────────────────────────────────────
@app.route("/creator")
@app.route("/creator/")
def creator_index():
    return send_from_directory(CREATOR_PUBLIC, "index.html")

@app.route("/creator/<path:filename>")
def creator_files(filename):
    return send_from_directory(CREATOR_PUBLIC, filename)

# ── Health ─────────────────────────────────────────────────────────────────
@app.route("/health")
def health():
    ffmpeg = get_ffmpeg_path()
    # ComfyUI quick check (non-blocking short timeout)
    comfy_ok = False
    try:
        r = http_requests.get("http://127.0.0.1:8188/system_stats", timeout=1.5)
        comfy_ok = r.ok
    except Exception:
        pass
    return {
        "status": "ok",
        "version": VERSION,
        "made_by": "TheDonOfEverything aka Paul Conforti",
        "original": "Leaflit",
        "angular_improvements": "OOzeClues (0.3.0 → 0.4.0 parity)",
        "services": {
            "ffmpeg": {"available": bool(ffmpeg), "path": ffmpeg},
            "comfyui": {"available": comfy_ok, "url": "http://127.0.0.1:8188"},
            "websocket": {"port": 3001, "path": "ws://127.0.0.1:3001"},
            "export_api": True,
            "xai_proxy": True
        }
    }


@app.route("/api/ffmpeg/status")
def ffmpeg_status():
    path = get_ffmpeg_path()
    return {
        "available": bool(path),
        "path": path,
        "bin_dir": str(BIN_DIR)
    }

if __name__ == "__main__":
    # Start Overlay WebSocket server (port 3001)
    _start_ws_server()

    print("\n" + "═" * 72)
    print("  ⚔️  AS ADVENTURER — COMBINED EDITION")
    print("  Made by TheDonOfEverything aka Paul Conforti")
    print("  Original JavaScript version by Leaflit")
    print("  Angular Edition by OOzeClues (v0.3.0 → v0.4.0 feature parity)")
    print(f"  Version: {VERSION}  |  Last Updated: {LAST_UPDATED}")
    print("═" * 72)

    # Ensure ffmpeg is available (auto-download on Windows if missing)
    ffmpeg_path = ensure_ffmpeg()
    if ffmpeg_path:
        print(f"\n  ffmpeg:          Ready ({ffmpeg_path})")
    else:
        print("\n  ffmpeg:          NOT FOUND")
        print("                   Transparent WebM export will be unavailable until ffmpeg is installed.")
        print("                   Place ffmpeg.exe in the bin/ folder or add it to PATH.")

    print("\n  Landing Page:   http://localhost:3000")
    print("  Overlay:        http://localhost:3000/overlay")
    print("  Creator:        http://localhost:3000/creator")
    print("\n  Supported AI:   Gemini • OpenAI • Grok (xAI) • Local ComfyUI")
    print("  ComfyUI Proxy:  /api/comfyui/*  →  http://127.0.0.1:8188")
    print("  Overlay API:    /api/models • /api/emotes • /api/assets • /api/thresholds")
    print("  Overlay WS:     ws://127.0.0.1:3001  (control + overlay)")
    print("\n  Everything runs 100% locally on your PC.")
    print("  Press Ctrl+C to stop.\n")

    # Auto open browser
    try:
        import webbrowser
        webbrowser.open("http://localhost:3000")
    except:
        pass

    app.run(host="127.0.0.1", port=3000, debug=False, threaded=True)
