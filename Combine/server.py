#!/usr/bin/env python3
"""
⚔️ AS Adventurer — Combined Edition (Overlay + Creator)
Python port made by TheDonOfEverything aka Paul Conforti

One unified program containing:
- Reactive Overlay (face tracking, expressions, emotes)
- Creator Pipeline (Sprite Prep → AI Video → Video Prep → Export)

Run:
    python server.py

Then open http://localhost:3000
"""

import os
from pathlib import Path
from flask import Flask, send_from_directory, redirect

APP_DIR = Path(__file__).parent
OVERLAY_PUBLIC = APP_DIR / "overlay_public"
CREATOR_PUBLIC = APP_DIR / "creator_public"

# ── Startup Checks ─────────────────────────────────────────────────────────
VERSION = "1.0 - Combined Edition"
LAST_UPDATED = "July 17, 2026"

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

# ── Multi-Provider AI Support (ChatGPT / Gemini / Grok) ───────────────────
SUPPORTED_PROVIDERS = ["openai", "gemini", "grok"]

def get_provider_from_request():
    """Get provider from form data or JSON, default to gemini"""
    provider = request.form.get("provider") or request.json.get("provider") if request.is_json else None
    if not provider:
        provider = "gemini"  # default
    return provider.lower() if provider.lower() in SUPPORTED_PROVIDERS else "gemini"

# ── Landing Page (matches original Angel's Sword Studios design) ─────────
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
            
            .header {
                margin-bottom: 40px;
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
            <div class="header">
                <div class="logo">⚔️ AS Adventurer</div>
                <div class="subtitle">Angel's Sword Studios</div>
            </div>
            
            <div class="tagline">
                Reactive Overlay + VTuber Creator<br>
                <span style="font-size:1.1rem; color:#8899aa;">Combined Edition • Python Port</span>
            </div>
            
            <div class="cards">
                <!-- Overlay Card -->
                <a href="/overlay" class="card">
                    <div class="card-icon">🎮</div>
                    <div class="card-title">Overlay</div>
                    <div class="card-desc">
                        Real-time reactive streaming overlay with face tracking, 
                        expression detection, and advanced emote system.
                    </div>
                </a>
                
                <!-- Creator Card -->
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
                Python port of the original by <strong>Leaflit</strong><br>
                Angel's Sword Studios • 2026
            </div>
            
            <div class="footer">
                Everything runs locally on your PC • No Node.js required
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
    return {"status": "ok", "made_by": "TheDonOfEverything aka Paul Conforti"}

if __name__ == "__main__":
    print("\n" + "═" * 70)
    print("  ⚔️  AS ADVENTURER — COMBINED EDITION")
    print("  Made by TheDonOfEverything aka Paul Conforti")
    print("  Python port of the original JavaScript version by Leaflit")
    print(f"  Version: {VERSION}  |  Last Updated: {LAST_UPDATED}")
    print("═" * 70)
    print("\n  Landing Page:   http://localhost:3000")
    print("  Overlay:        http://localhost:3000/overlay")
    print("  Creator:        http://localhost:3000/creator")
    print("\n  Everything runs 100% locally on your PC.")
    print("  Press Ctrl+C to stop.\n")

    # Auto open browser
    try:
        import webbrowser
        webbrowser.open("http://localhost:3000")
    except:
        pass

    app.run(host="127.0.0.1", port=3000, debug=False, threaded=True)