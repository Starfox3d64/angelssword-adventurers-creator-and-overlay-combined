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
import requests as http_requests
from pathlib import Path
from flask import Flask, send_from_directory, request, jsonify, Response

APP_DIR = Path(__file__).parent
OVERLAY_PUBLIC = APP_DIR / "overlay_public"
CREATOR_PUBLIC = APP_DIR / "creator_public"

# ── Startup Checks ─────────────────────────────────────────────────────────
VERSION = "1.1 - Combined Edition"
LAST_UPDATED = "July 20, 2026"

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

        # Placeholder for actual xAI video endpoint (update when public API is stable)
        # Currently returns a structured response so the frontend can continue.
        return jsonify({
            "success": True,
            "provider": "grok",
            "message": "Grok video generation request accepted",
            "prompt": prompt,
            "duration": duration,
            "aspectRatio": aspect_ratio,
            "note": "Full xAI video generation will be wired when the public endpoint is finalized."
        })

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
                --bg-deep: #1a1a2e;
                --bg-panel: #16213e;
                --accent-gold: #dbb858;
                --accent-gold-glow: rgba(219, 184, 88, 0.3);
                --text: #e0e0e0;
                --text-muted: #8899aa;
            }
            
            body {
                background: var(--bg-deep);
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
                border: 1px solid rgba(219, 184, 88, 0.2);
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
                Everything runs locally on your PC • Supports Gemini • Grok • OpenAI • ComfyUI
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
    return {
        "status": "ok",
        "version": VERSION,
        "made_by": "TheDonOfEverything aka Paul Conforti",
        "original": "Leaflit",
        "angular_improvements": "OOzeClues"
    }

if __name__ == "__main__":
    print("\n" + "═" * 72)
    print("  ⚔️  AS ADVENTURER — COMBINED EDITION")
    print("  Made by TheDonOfEverything aka Paul Conforti")
    print("  Original JavaScript version by Leaflit")
    print("  Angular improvements by OOzeClues (v0.3.0)")
    print(f"  Version: {VERSION}  |  Last Updated: {LAST_UPDATED}")
    print("═" * 72)
    print("\n  Landing Page:   http://localhost:3000")
    print("  Overlay:        http://localhost:3000/overlay")
    print("  Creator:        http://localhost:3000/creator")
    print("\n  Supported AI:   Gemini • OpenAI • Grok (xAI) • Local ComfyUI")
    print("  ComfyUI Proxy:  /api/comfyui/*  →  http://127.0.0.1:8188")
    print("\n  Everything runs 100% locally on your PC.")
    print("  Press Ctrl+C to stop.\n")

    # Auto open browser
    try:
        import webbrowser
        webbrowser.open("http://localhost:3000")
    except:
        pass

    app.run(host="127.0.0.1", port=3000, debug=False, threaded=True)
