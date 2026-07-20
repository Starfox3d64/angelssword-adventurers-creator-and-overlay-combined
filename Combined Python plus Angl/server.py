#!/usr/bin/env python3
"""
⚔️ AS Adventurer — Combined Edition (Overlay + Creator)
Python port made by TheDonOfEverything aka Paul Conforti

Credits:
- Original JavaScript version by Leaflit
- Angular improvements (v0.3.0) by OOzeClues
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
from flask import Flask, send_from_directory, request, jsonify, Response

APP_DIR = Path(__file__).parent
OVERLAY_PUBLIC = APP_DIR / "overlay_public"
CREATOR_PUBLIC = APP_DIR / "creator_public"
BIN_DIR = CREATOR_PUBLIC / "bin"

# ── Startup Checks ─────────────────────────────────────────────────────────
VERSION = "1.8 - Combined Edition"
LAST_UPDATED = "July 20, 2026"


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
    ff = _resolve_ffmpeg()
    if not ff:
        return jsonify({
            "error": "ffmpeg not found. Place ffmpeg.exe in creator_public/bin/ or install system ffmpeg."
        }), 503
    session_id = uuid.uuid4().hex
    tmp = Path(tempfile.mkdtemp(prefix="as-export-"))
    _export_sessions[session_id] = {"dir": tmp, "frames": 0, "created": time.time()}
    print(f"[EXPORT] Session {session_id} → {tmp}")
    return jsonify({"sessionId": session_id, "maxFrames": FFMPEG_MAX_FRAMES})


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
    if not body or len(body) < 8 or body[0] != 0x89 or body[1] != 0x50:
        return jsonify({"error": "Body is not a PNG image"}), 400

    name = f"frame_{index:05d}.png"
    (session["dir"] / name).write_bytes(body)
    session["frames"] = max(session["frames"], index + 1)
    return jsonify({"ok": True, "index": index, "bytes": len(body)})


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

    # Verify frames exist
    for i in range(frame_count):
        if not (export_dir / f"frame_{i:05d}.png").exists():
            shutil.rmtree(export_dir, ignore_errors=True)
            return jsonify({"error": f"Missing frame {i}"}), 400

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
    try:
        print(f"[EXPORT] Finalize {session_id}: {frame_count} frames @ {fps}fps")
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
@app.route("/")
def landing():
    html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>⚔️ AS Adventurer — Combined</title>
        <style>
            :root {
                --bg-deep: #030303;
                --bg-panel: #0a0a0a;
                --accent-gold: #c9a227;
                --accent-gold-glow: rgba(201, 162, 39, 0.4);
                --text: #e6dcc8;
                --text-muted: #9a8b6a;
            }
            
            body {
                background: radial-gradient(ellipse at 50% 0%, rgba(107,28,35,0.15) 0%, transparent 50%), #030303;
                color: var(--text);
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                margin: 0;
                padding: 40px 20px;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .container {
                max-width: 720px;
                width: 100%;
                text-align: center;
            }
            
            .logo {
                font-size: 3.2rem;
                font-weight: 700;
                color: var(--accent-gold);
                margin-bottom: 8px;
                text-shadow: 0 0 20px var(--accent-gold-glow);
            }
            
            .subtitle {
                font-size: 1.1rem;
                color: var(--text-muted);
                margin-bottom: 8px;
            }
            
            .tagline {
                font-size: 1.35rem;
                color: var(--text);
                margin-bottom: 40px;
                font-weight: 500;
            }
            
            .cards {
                display: flex;
                gap: 24px;
                justify-content: center;
                flex-wrap: wrap;
                margin-bottom: 50px;
            }
            
            .card {
                background: var(--bg-panel);
                border: 1px solid rgba(212, 175, 55, 0.25);
                border-radius: 12px;
                padding: 32px 28px;
                width: 300px;
                text-decoration: none;
                color: var(--text);
                transition: all 0.2s ease;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            }
            
            .card:hover {
                transform: translateY(-6px);
                border-color: var(--accent-gold);
                box-shadow: 0 12px 30px rgba(0,0,0,0.4);
            }
            
            .card-icon {
                font-size: 2.8rem;
                margin-bottom: 16px;
                display: block;
            }
            
            .card-title {
                font-size: 1.5rem;
                font-weight: 600;
                margin-bottom: 12px;
                color: var(--accent-gold);
            }
            
            .card-desc {
                font-size: 0.95rem;
                color: var(--text-muted);
                line-height: 1.5;
            }
            
            .credit {
                margin-top: 30px;
                padding-top: 24px;
                border-top: 1px solid rgba(255,255,255,0.1);
                font-size: 0.95rem;
                color: var(--text-muted);
            }
            
            .credit strong {
                color: var(--accent-gold);
            }
            
            .footer {
                margin-top: 20px;
                font-size: 0.85rem;
                color: #556677;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">⚔️ AS Adventurer</div>
            <div class="subtitle">Angel's Sword Studios</div>
            
            <div class="tagline">
                Reactive Overlay + VTuber Creator<br>
                <span style="font-size:1.1rem; color:#8899aa;">Combined Edition • Python Port</span>
            </div>
            
            <div class="cards">
                <a href="/overlay" class="card">
                    <div class="card-icon">🎮</div>
                    <div class="card-title">Overlay</div>
                    <div class="card-desc">
                        Real-time reactive streaming overlay with face tracking, 
                        expression detection, and advanced emote system.
                    </div>
                </a>
                
                <a href="/creator" class="card">
                    <div class="card-icon">🎨</div>
                    <div class="card-title">Creator</div>
                    <div class="card-desc">
                        Full VTuber asset pipeline: Sprite Prep → AI Video Generation → 
                        Video Prep → Transparent Export.
                    </div>
                </a>
            </div>
            
            <div class="credit">
                Made by <strong>TheDonOfEverything</strong> aka <strong>Paul Conforti</strong><br>
                Original by <strong>Leaflit</strong> • Angular improvements by <strong>OOzeClues</strong><br>
                Angel's Sword Studios • 2026
            </div>
            
            <div class="footer">
                Everything runs locally on your PC • Supports Gemini • Grok • OpenAI • ComfyUI<br>
                <span style="display:inline-block;margin-top:10px;">
                    <a href="/health" style="color:#dbb858;margin:0 8px;">Health</a>
                    <a href="/api/export/status" style="color:#dbb858;margin:0 8px;">Export Status</a>
                    <a href="/api/comfyui/status" style="color:#dbb858;margin:0 8px;">ComfyUI Status</a>
                    <a href="/api/ffmpeg/status" style="color:#dbb858;margin:0 8px;">ffmpeg Status</a>
                </span>
            </div>
        </div>
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
        "angular_improvements": "OOzeClues",
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
    print("  Angular improvements by OOzeClues (v0.3.0)")
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
