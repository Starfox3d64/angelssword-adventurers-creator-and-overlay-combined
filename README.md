# ⚔️ Don's Adventurer

**Overlay · Creator · Live2D Model Suite · Music & Audio** — one local Python app.

**Made by TheDonOfEverything aka Paul Conforti**  
Original JavaScript by **Leaflit** · Angular v0.3.0 by **OOzeClues**  
Python Combined Edition · **v2.3** · 2026

> Runs 100% on your PC. No Node.js required.

---

## What's Inside

| Tool | URL | Description |
|------|-----|-------------|
| **Main Menu** | http://localhost:3000 | Hub for all suites |
| **🎮 Overlay** | /overlay | Face tracking, expressions, emotes, WebSocket control |
| **🎨 Creator** | /creator | Sprite Prep → AI Video → Video Prep → Transparent Export |
| **🎭 Model & Rigging** | /live2d | Live2D runtime viewer + Creator media (PNG/WebM/GIF) |
| **🎵 Music & Audio** | /music | Suno generation, library, trim/fade, **global BGM** |
| **🌸 AnimeGen T2V** | /animegen | AideaLab anime video (Wan 2.2) via ComfyUI or local Diffusers |

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

## AI Providers (Creator)

| Feature | Providers |
|---------|-----------|
| Sprite generation | OpenAI · Gemini · Grok / SuperGrok OAuth · Local ComfyUI |
| Video generation | Gemini Omni Flash · Grok Imagine Video · Local ComfyUI |
| Export | Offline chroma key + **ffmpeg true-alpha WebM** (or MediaRecorder fallback) |

API keys stay in **browser localStorage**. Proxies run on the local Python server.

---

## Live2D Model Suite

### Supported
- Runtime packages: **`.model3.json` + `.moc3` + texture PNGs** (+ motions / physics)
- Zip upload of runtime folders  
- Creator exports: **PNG, WebM, GIF, MP4** (Media mode)  
- Parameter sliders, parts opacity, motion play, pose presets  
- Screenshot, fit/center/zoom, BG color (black / green / magenta / checker)  

### Not supported
- **`.cmo3` / `.can3`** Cubism Editor projects  

**How to export from Cubism Editor:**  
`File → Export for Runtime` → put the folder in `live2d_public/models/YourModel/` or import in the UI.

### QoL
- Load timeout (no silent freeze)  
- Parameter search filter  
- Double-click parameter name to reset  
- Shortcuts: `Space` play motion, `0` center, `+` / `-` zoom  
- Help button in status bar  

---

## Music & Audio Workspace

- **Suno-compatible API** (set Base URL + API key) — Standard / Custom / BGM modes  
- Local **MP3/WAV** library (upload, play, delete)  
- **Trim + fade** with waveform → export WAV to library  
- **Global BGM**: keeps playing while you use Creator, Overlay, Models, or the menu  
- Mini-player on every page: play/pause, stop, seek, volume, mute  
- Random Global BGM, quick volume presets  

Library folder: `music_public/library/`

---

## Overlay

- VTube Studio / iFacialMocap / Webcam sources  
- Expression thresholds + presets (Sensitive / Balanced / Strict)  
- Emotes, Quick Actions, session notes, hotkeys  
- WebSocket control on port **3001**  

Models: `overlay_public/assets/models/YourCharacter/`

---



## AnimeGen T2V (AideaLab)

Local anime video generation based on **Wan 2.2**, trained with ethically sourced studio data ([Hugging Face](https://huggingface.co/aidealab/AnimeGen-T2V)).

- **ComfyUI (recommended):** run your Wan/AnimeGen graph; put finished MP4s in `animegen_public/outputs/`
- **Diffusers (CUDA):** place `high_noise.safetensors` + `low_noise.safetensors` in `animegen_public/models/`, install torch/diffusers, use the AnimeGen tab
- Prompting tip: Japanese prompts + Wan-style negatives work best; English is OK with “Japanese anime style,” prefix
- Presets for idle / wave / talk / walk loops aimed at Adventurer pipeline
- **Send to Creator** hands the MP4 URL into Video Prep via localStorage

## ComfyUI

1. Start ComfyUI (`http://127.0.0.1:8188`)  
2. Creator → Settings → Local ComfyUI → Connect / Refresh models  
3. Choose **Local ComfyUI** as generation source  

---

## ffmpeg (transparent WebM)

Auto-download on Windows into `creator_public/bin/`, or place your own binary there.  
Linux/macOS: install system ffmpeg (`apt install ffmpeg` / `brew install ffmpeg`) or put a binary in `creator_public/bin/`.

---

## Folder Map

```
Don's Adventurer/
├── server.py
├── Start AS Adventurer.bat          # Windows
├── start-dons-adventurer.sh         # Linux
├── start-dons-adventurer.command    # macOS
├── requirements.txt
├── shared/global-player.js          # Persistent BGM mini-player
├── creator_public/                  # Creator UI
├── overlay_public/                  # Overlay UI
├── live2d_public/                   # Model suite
│   ├── models/                      # Live2D runtime folders
│   └── media/                       # Creator image/video imports
└── music_public/
    └── library/                     # Audio library
```

---

## Credits

- **TheDonOfEverything aka Paul Conforti** — Python Combined Edition, Live2D suite, Music suite, global audio  
- **Leaflit** — Original JavaScript version  
- **OOzeClues** — Angular improvements (v0.3.0)  

God bless your streams. ⚔️
