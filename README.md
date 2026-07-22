# ⚔️ Don's Adventurer

**Overlay · Creator · Live2D · Music · AnimeGen · Tetris** — one local Python app.

**Made by TheDonOfEverything aka Paul Conforti**  
Original JavaScript by **Leaflit** · Angular v0.3.0 by **OOzeClues**  
Python Combined Edition · **v2.5** · July 2026

> Runs 100% on your PC. No Node.js required.

---

## What's Inside

| Suite | URL | Description |
|-------|-----|-------------|
| **Main Menu** | http://localhost:3000 | Hub, theme picker, suite cards |
| **🎮 Overlay** | `/overlay` | Face tracking, expressions, emotes, WebSocket control, notes |
| **🎨 Creator** | `/creator` | Sprite Prep → AI Video → Video Prep → Transparent Export |
| **🎭 Model & Rigging** | `/live2d` | Live2D runtime viewer + Media mode (PNG/WebM/MP4) |
| **🎵 Music & Audio** | `/music` | Suno generation, library, trim/fade, **global BGM** |
| **🌸 AnimeGen T2V** | `/animegen` | AideaLab anime video (Wan 2.2) via ComfyUI or Diffusers |
| **🧱 Tetris** | `/tetris` | Theme-aware Tetris with difficulty, speed, hold, ghost |

Every suite has **suite navigation**, **session notes** (📌), and the **global music mini-player** when BGM is active.

---

## Quick Start

### Windows
1. Extract the folder  
2. Double-click **`Start AS Adventurer.bat`**  
3. Browser opens to the main menu  

### Linux
```bash
chmod +x start-dons-adventurer.sh
./start-dons-adventurer.sh
```

### macOS
- Double-click **`start-dons-adventurer.command`**  
  (If blocked: right-click → Open, or `chmod +x start-dons-adventurer.command`)  
- Or in Terminal:
```bash
./start-dons-adventurer.command
```

### Manual
```bash
pip install -r requirements.txt   # flask websockets numpy requests
python server.py                  # or python3 server.py
```

Open **http://localhost:3000**

---

## Global Features

### Themes (apply everywhere)
| Theme | Look |
|-------|------|
| **Don (Gold)** | Default — antique gold / rose / void black |
| **Leaflit** | Blue primary + **cape/hat red** accents |
| **Ooz** | Cyan / magenta slime aesthetic |
| **Original Adventurer** | Classic purple + gold |

Pick a theme on the **main menu**. It is stored in `localStorage` and applied on every suite via `/shared/theme-nav.js` + `/shared/theme.css`.

### Global BGM
1. Open **Music & Audio**  
2. Generate or load a track  
3. Click **Set as Active Global BGM**  
4. Navigate anywhere — the mini-player keeps playing  

### Session Notes
Floating **📌** button on Models, Music, AnimeGen, Tetris (Creator & Overlay have built-in notes). Notes sync in `localStorage` across pages.

### Suite navigation
Header links on every page: Menu · Creator · Overlay · Models · Music · AnimeGen · Tetris.

---

## AI Providers (Creator)

| Feature | Providers |
|---------|-----------|
| Sprite generation | OpenAI · Gemini · Grok / SuperGrok OAuth · Local ComfyUI |
| Video generation | Gemini Omni Flash · Grok Imagine Video · Local ComfyUI |
| Export | Offline chroma key + **ffmpeg true-alpha WebM** (or MediaRecorder fallback) |

API keys stay in **browser localStorage**. Proxies run on the local Python server.

---

## Live2D Model Suite

### Live2D mode
- Runtime packages: **`.model3.json` + `.moc3` + texture PNGs** (+ motions / physics)
- Zip upload of runtime folders  
- Parameter sliders, parts, physics, motion play, pose presets  
- Center / zoom / physics toggle / loop motion  

### Media mode
- **Open Image / Video** or drag PNG · JPG · WebP · GIF · WebM · MP4 · MOV into the viewport  
- Transform: **scale, offset X/Y, rotation, opacity**  
- Play / Pause / Reset  
- Creator Media Library (`live2d_public/media/`)  
- Export helpers (VTS / frames — where supported by server)

### Not supported
- **`.cmo3` / `.can3`** Cubism Editor projects — use **File → Export for Runtime** in Cubism first  

---

## Music & Audio Workspace

- Suno API key (stored locally)  
- Prompt / generation suite  
- Local MP3 / WAV library  
- Scrubber, volume, loop  
- Trim + fade-in / fade-out  
- **Set as Active Global BGM** for app-wide playback  

---

## AnimeGen T2V

- AideaLab **AnimeGen** (Wan 2.2 based)  
- Local Diffusers or ComfyUI backend  
- Download links for High Noise / Low Noise model weights  
- Handoff path toward Creator Video Prep  

---

## Tetris

| Control | Action |
|---------|--------|
| ← → | Move |
| ↑ or X | Rotate (wall kicks) |
| ↓ | Soft drop |
| Space | Hard drop |
| C / Shift | Hold piece |
| P | Pause |
| R / Enter | Restart |

**Difficulty:** Easy · Normal · Hard · Insane (saved)  
**Speed:** Auto from difficulty/level, or manual slider override  
**Ghost piece:** Toggle landing preview  
**High score:** Saved in `localStorage`  
Blocks follow the **active theme** colors.

---

## Project Layout

```
as-adventurer-combined-python/
├── server.py                 # Flask app (port 3000)
├── requirements.txt
├── Start AS Adventurer.bat   # Windows
├── start-dons-adventurer.sh  # Linux
├── start-dons-adventurer.command  # macOS
├── shared/
│   ├── theme.css             # Global theme tokens
│   ├── theme-nav.js          # Theme apply + persistence
│   ├── global-player.js      # Cross-suite BGM mini-player
│   └── notes.js              # Floating session notes
├── creator_public/
├── overlay_public/
├── live2d_public/
│   ├── media/                # Uploaded Creator media
│   └── models/               # Live2D runtime packages
├── music_public/
├── animegen_public/
│   ├── models/               # AnimeGen weights
│   └── outputs/
└── tetris_public/
```

---

## Requirements

- **Python 3.9+**
- **ffmpeg** on PATH (recommended for true-alpha WebM export)
- Optional: **ComfyUI** on `127.0.0.1:8188` for local gen
- Optional: API keys for OpenAI / Gemini / Grok / Suno

```bash
pip install -r requirements.txt
```

---

## Credits

- **TheDonOfEverything (Paul Conforti)** — Python combined edition, suites, themes, Tetris, integration  
- **Leaflit** — original Adventurer JavaScript  
- **OOzeClues** — Angular Edition v0.3.0  
- **AideaLab / AnimeGen** — T2V model (ethical studio data, Wan 2.2 lineage)  

---

# Patch Notes — v2.5 (July 22, 2026 session)

*Everything new or fixed in the last few hours of development.*

## Themes & UI chrome
- **Four global themes:** Don (Gold), Leaflit, Ooz, Original Adventurer  
- Theme switch on main menu applies to **all** suites (not only Tetris)  
- **Leaflit:** stronger **cape/hat red** on accents, borders, and secondary colors alongside blue  
- Hardcoded gold hex/rgba in Creator CSS mapped to CSS variables so themes can recolor panels and buttons  
- Creator body/header no longer locked to pure `#030303`; uses `--bg-deep` / `--bg-panel` with theme-tinted glows  
- AnimeGen & Live2D styles rewritten to use `--as-*` / theme tokens (no circular CSS variables)  
- Shared `/shared/theme.css` + `/shared/theme-nav.js` with re-apply after late page CSS loads  

## Navigation & shared widgets
- Full suite nav on **Creator, Overlay, Models, Music, AnimeGen, Tetris**  
- **Global music mini-player** themed (accent follows Don/Ooz/Leaflit/Original)  
- Compact original player layout restored (not a broken full-bleed bar)  
- **📌 Session Notes** on Models, Music, AnimeGen, Tetris (shared `notes.js`)  
- World **clock** on Tetris top nav  

## Creator
- Layout restored after path/critical-CSS issues (`/creator/style.css` absolute + cache bust)  
- Theme-aware polish rules (no force-black `!important` backgrounds)  
- Full header nav + shortcuts preserved  

## Model & Rigging Suite (Live2D)
- **Media mode** switch fixed (was a no-op due to null canvas / script order)  
- **Open Image / Video** file picker fixed (fresh input each open — dialog selection now loads)  
- **Drag/drop** PNG/WebM/MP4 onto viewport or dropzone  
- Transform sliders: scale, offset X/Y, rotation, opacity  
- Play / Pause / Reset for video  
- Media stage forced above Live2D canvas (z-index / visibility)  
- Video load path (controls, muted autoplay fallback)  
- Creator Media Library button + empty-state messaging  
- Tips for Media vs Live2D runtime packages  
- Timeline / motion bar layout restored (no longer crushed by global player)  

## Music
- Global BGM tip (dismissible) explaining cross-suite playback  
- Nav + notes + themed player  

## AnimeGen
- Theme-aware stylesheet  
- Model download links in UI (High / Low noise)  
- Suite nav + notes  

## Tetris (major feature pass)
- **Difficulty:** Easy · Normal · Hard · Insane (persisted)  
- **Drop speed:** auto from difficulty/level, or manual slider override  
- **Ghost piece** toggle (persisted)  
- **Hold piece** (`C` / Shift)  
- **High score** in `localStorage`  
- Wall kicks on rotate  
- Soft/hard drop score bonuses + difficulty score multiplier  
- Theme-colored blocks via `--as-tetris-1…7`  
- HUD: score, high score, lines, level, drop ms, status, difficulty label  
- Full suite nav + clock + notes  

## Infrastructure
- Absolute asset paths for suite CSS/JS where relative + `<base>` caused 404s  
- `/live2d/`, `/creator/`, `/animegen/` trailing-slash friendly routes  
- Shared static: `theme.css`, `theme-nav.js`, `global-player.js`, `notes.js`  

## Known limits
- Live2D **editor** files (`.cmo3` / `.can3`) are not runtime-loadable — export from Cubism first  
- AnimeGen local Diffusers needs CUDA + weights on disk  
- VTS/frames export depends on server routes and available assets  

---

**God Bless — stream safe.**
